import { lazy, Suspense, useState } from 'react';
import { useNavigate } from 'react-router';

import type { CreateBookingRequest, Slot, Student } from '@app/contracts';
import { localDateOf } from '@app/time';

import { ApiError, isApiError } from '../../shared/api/ApiError';
import { retryAfterSeconds, unreachableText, waitText } from '../../shared/api/error-copy';
import { useCountdown } from '../../shared/hooks/useCountdown';
import { useOnline } from '../../shared/hooks/useOnline';
import { Button } from '../../shared/ui/Button';
import { Notice } from '../../shared/ui/Notice';
import { notify } from '../../shared/ui/notify';
import { Skeleton } from '../../shared/ui/Skeleton';
import { useMe } from '../auth';
import { useDisplayZone } from '../timezone';

import { ChildPicker, NEW_CHILD, type NewChild } from './ChildPicker';
import { forgetIdempotencyKey, idempotencyKeyFor } from './idempotency';
import { useCreateBooking, useStudents } from './queries';
import { ZoneChecks } from './ZoneChecks';

// Only needed when another family wins the last mentor; loaded on the first submit.
const SlotTakenDialog = lazy(() =>
  import('./SlotTakenDialog').then((module) => ({ default: module.SlotTakenDialog })),
);

interface ConfirmPanelProps {
  slot: Slot;
  /** A nearby free time was picked in the slot-taken dialog. */
  onChangeSlot: (slot: Slot) => void;
}

const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M} '.-]*$/u;

function validateNewChild(child: NewChild): { firstName?: string; age?: string } {
  const errors: { firstName?: string; age?: string } = {};
  const name = child.firstName.trim();
  if (!name) errors.firstName = "Enter your child's first name.";
  else if (name.length > 50) errors.firstName = 'Use at most 50 characters.';
  else if (!NAME_PATTERN.test(name))
    errors.firstName = 'Use letters only, as on a school register.';
  if (!child.age) errors.age = 'Choose an age.';
  return errors;
}

function firstEligible(students: Student[]): string {
  return students.find((student) => student.upcomingTrial === null)?.id ?? NEW_CHILD;
}

/** Doc 05 §5.3: who the class is for, zone checks, and the booking itself with §5.4 error handling. */
export function ConfirmPanel({ slot, onChangeSlot }: ConfirmPanelProps) {
  const navigate = useNavigate();
  const online = useOnline();
  const { zone, device, locale, setZone } = useDisplayZone();
  const { data: me } = useMe();
  const students = useStudents();
  const create = useCreateBooking();
  const [choice, setChoice] = useState<string | null>(null);
  const [newChild, setNewChild] = useState<NewChild>({ firstName: '', age: '' });
  const [childErrors, setChildErrors] = useState<{ firstName?: string; age?: string }>({});
  const [alternatives, setAlternatives] = useState<Slot[] | null>(null);
  // Mounted (closed) from the first submit, so a later 409 opens it with its enter transition.
  const [slotTakenMounted, setSlotTakenMounted] = useState(false);
  const [alreadyBooked, setAlreadyBooked] = useState<{
    studentId: string;
    bookingId: string;
    start: string;
  }>();
  const waitSeconds = useCountdown(
    isApiError(create.error, 'RATE_LIMITED') ? retryAfterSeconds(create.error) : undefined,
  );

  if (students.isPending) {
    return (
      <div aria-busy="true" aria-label="Loading your children" className="flex flex-col gap-3">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    );
  }
  if (students.isError) {
    return (
      <Notice
        tone="danger"
        role="alert"
        action={
          <Button size="compact" variant="secondary" onClick={() => void students.refetch()}>
            Try again
          </Button>
        }
      >
        {unreachableText(students.error)}
      </Notice>
    );
  }

  const list = students.data;
  const selected = choice ?? firstEligible(list);
  const selectedStudent = list.find((student) => student.id === selected);
  const blocked =
    (selectedStudent?.upcomingTrial ?? null) !== null || alreadyBooked?.studentId === selected;

  const selectionParts = (): string[] =>
    selected === NEW_CHILD
      ? [slot.start, `new:${newChild.firstName.trim().toLowerCase()}:${newChild.age}`, zone]
      : [slot.start, selected, zone];

  const handleError = (error: unknown, parts: string[]) => {
    if (!(error instanceof ApiError)) return;
    switch (error.code) {
      case 'NO_MENTOR_AVAILABLE':
        setAlternatives(
          Array.isArray(error.extras.alternatives) ? (error.extras.alternatives as Slot[]) : [],
        );
        break;
      case 'STUDENT_ALREADY_HAS_TRIAL':
        if (selectedStudent && typeof error.extras.bookingId === 'string') {
          setAlreadyBooked({
            studentId: selectedStudent.id,
            bookingId: error.extras.bookingId,
            start: slot.start,
          });
        }
        void students.refetch();
        break;
      case 'SLOT_IN_PAST':
      case 'SLOT_OUTSIDE_HORIZON':
      case 'SLOT_NOT_ON_GRID':
        notify('That time can no longer be booked.');
        void navigate(
          `/book?tz=${encodeURIComponent(zone)}&date=${localDateOf(slot.start, zone)}`,
          { replace: true },
        );
        break;
      case 'INVALID_TIMEZONE':
        setZone(device);
        notify("We switched to your device's time zone. Check the time and confirm again.");
        break;
      case 'STUDENT_NAME_TAKEN':
        setChildErrors({
          firstName: `You already have a child called ${newChild.firstName.trim()}. Choose them above.`,
        });
        break;
      case 'VALIDATION_FAILED':
        setChildErrors({
          firstName: error.errors.find((e) => e.path === 'student.firstName')?.message,
          age: error.errors.find((e) => e.path === 'student.age')?.message,
        });
        break;
      case 'IDEMPOTENCY_KEY_REUSED':
        forgetIdempotencyKey(parts);
        break;
      default:
        break;
    }
  };

  const submit = () => {
    setSlotTakenMounted(true);
    if (selected === NEW_CHILD) {
      const errors = validateNewChild(newChild);
      setChildErrors(errors);
      if (errors.firstName ?? errors.age) return;
    }
    const parts = selectionParts();
    const student: CreateBookingRequest['student'] =
      selected === NEW_CHILD
        ? { firstName: newChild.firstName.trim(), age: Number(newChild.age) }
        : { id: selected };
    create.mutate(
      {
        body: { slotStart: slot.start, timezone: zone, student },
        idempotencyKey: idempotencyKeyFor(parts),
      },
      {
        onSuccess: (booking) => {
          forgetIdempotencyKey(parts);
          void navigate(`/bookings/${booking.id}?new=1`, { replace: true });
        },
        onError: (error) => {
          handleError(error, parts);
        },
      },
    );
  };

  const error = create.error;
  const handledInline = [
    'NO_MENTOR_AVAILABLE',
    'STUDENT_ALREADY_HAS_TRIAL',
    'SLOT_IN_PAST',
    'SLOT_OUTSIDE_HORIZON',
    'SLOT_NOT_ON_GRID',
    'INVALID_TIMEZONE',
    'STUDENT_NAME_TAKEN',
    'VALIDATION_FAILED',
  ];
  const showFailure =
    create.isError && !(error instanceof ApiError && handledInline.includes(error.code));

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <h2 className="text-h2 text-ink">Who is the class for?</h2>
        <ChildPicker
          students={list}
          value={selected}
          onChange={(value) => {
            setChoice(value);
            setChildErrors({});
          }}
          newChild={newChild}
          onNewChildChange={setNewChild}
          errors={childErrors}
          zone={zone}
          locale={locale}
          alreadyBooked={alreadyBooked}
        />
      </section>

      <ZoneChecks
        zone={zone}
        deviceZone={device}
        profileZone={me?.timezone}
        at={slot.start}
        onUseDeviceZone={() => {
          setZone(device);
        }}
      />

      {showFailure && isApiError(error, 'RATE_LIMITED') && (
        <Notice tone="danger" role="alert">
          {waitSeconds > 0
            ? `Too many attempts. Try again in ${waitText(waitSeconds)}.`
            : 'You can try again now.'}
        </Notice>
      )}
      {showFailure && !isApiError(error, 'RATE_LIMITED') && (
        <Notice tone="danger" role="alert">
          {isApiError(error, 'IDEMPOTENCY_KEY_REUSED')
            ? 'Something changed while we were booking. Check the details and confirm again.'
            : unreachableText(error)}
        </Notice>
      )}

      <div className="flex flex-col gap-2">
        <Button
          size="default"
          className="w-full sm:w-auto sm:self-start"
          pending={create.isPending}
          disabled={!online || blocked || waitSeconds > 0}
          onClick={submit}
        >
          {showFailure && !isApiError(error, 'RATE_LIMITED') ? 'Try again' : 'Confirm trial'}
        </Button>
        {!online && (
          <p className="text-small text-ink-muted">You are offline. Connect to confirm.</p>
        )}
      </div>

      {slotTakenMounted && (
        <Suspense fallback={null}>
          <SlotTakenDialog
            open={alternatives !== null}
            alternatives={alternatives ?? []}
            zone={zone}
            locale={locale}
            allTimesHref={`/book?tz=${encodeURIComponent(zone)}&date=${localDateOf(slot.start, zone)}`}
            onPick={(next) => {
              setAlternatives(null);
              create.reset();
              onChangeSlot(next);
            }}
            onClose={() => {
              setAlternatives(null);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
