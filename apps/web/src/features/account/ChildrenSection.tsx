import { useState } from 'react';
import { Link } from 'react-router';

import type { Student } from '@app/contracts';
import { formatDate } from '@app/time';

import { ApiError, isApiError } from '../../shared/api/ApiError';
import { tooManyAttemptsText, unreachableText } from '../../shared/api/error-copy';
import {
  CHILD_AGES,
  validateChild,
  type ChildDraft,
  type ChildErrors,
} from '../../shared/lib/child';
import { cn } from '../../shared/lib/cn';
import { Button } from '../../shared/ui/Button';
import { Field, Input, NativeSelect } from '../../shared/ui/Field';
import { PlusIcon } from '../../shared/ui/icons';
import { Notice } from '../../shared/ui/Notice';
import { notify } from '../../shared/ui/notify';
import { Skeleton } from '../../shared/ui/Skeleton';
import { textLinkClassName } from '../../shared/ui/text-link';
import { useStudents } from '../booking';
import { useDisplayZone } from '../timezone';

import { useSaveStudent } from './queries';

const NEW = 'new';

interface ChildFormProps {
  student: Student | null;
  onDone: () => void;
}

/** Add or edit one child inline: first name and age (doc 05 §8). */
function ChildForm({ student, onDone }: ChildFormProps) {
  const save = useSaveStudent();
  const [draft, setDraft] = useState<ChildDraft>({
    firstName: student?.firstName ?? '',
    age: student ? String(student.age) : '',
  });
  const [errors, setErrors] = useState<ChildErrors>({});

  const submit = () => {
    const found = validateChild(draft);
    setErrors(found);
    if (found.firstName ?? found.age) return;
    const firstName = draft.firstName.trim();
    save.mutate(
      { id: student?.id ?? null, body: { firstName, age: Number(draft.age) } },
      {
        onSuccess: () => {
          notify.success(student ? 'Changes saved' : `${firstName} added`);
          onDone();
        },
        onError: (error) => {
          if (!(error instanceof ApiError)) return;
          if (error.code === 'STUDENT_NAME_TAKEN') {
            setErrors({ firstName: `You already have a child called ${firstName}.` });
          }
          if (error.code === 'VALIDATION_FAILED') {
            setErrors({
              firstName: error.errors.find((e) => e.path === 'firstName')?.message,
              age: error.errors.find((e) => e.path === 'age')?.message,
            });
          }
        },
      },
    );
  };

  const formLevel =
    save.isError &&
    !isApiError(save.error, 'STUDENT_NAME_TAKEN') &&
    !isApiError(save.error, 'VALIDATION_FAILED');

  return (
    <form
      noValidate
      aria-label={student ? `Edit ${student.firstName}` : 'Add a child'}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="flex flex-col gap-4 rounded-surface bg-sunken p-4"
    >
      {formLevel && (
        <Notice tone="danger" role="alert">
          {isApiError(save.error, 'RATE_LIMITED')
            ? tooManyAttemptsText(save.error)
            : unreachableText(save.error)}
        </Notice>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
        <Field label="First name" error={errors.firstName}>
          <Input
            autoComplete="off"
            autoCapitalize="words"
            enterKeyHint="next"
            value={draft.firstName}
            onChange={(event) => {
              setDraft({ ...draft, firstName: event.target.value });
            }}
          />
        </Field>
        <Field label="Age" error={errors.age}>
          <NativeSelect
            value={draft.age}
            onChange={(event) => {
              setDraft({ ...draft, age: event.target.value });
            }}
          >
            <option value="" disabled>
              Age
            </option>
            {CHILD_AGES.map((age) => (
              <option key={age} value={age}>
                {age}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" pending={save.isPending}>
          {student ? 'Save' : 'Add child'}
        </Button>
        <Button variant="secondary" disabled={save.isPending} onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** Children (doc 05 §8): list, add, edit. A child's upcoming trial links to the booking. */
export function ChildrenSection() {
  const students = useStudents();
  const { zone, locale } = useDisplayZone();
  const [editing, setEditing] = useState<string | null>(null);

  if (students.isPending) {
    return (
      <div aria-busy="true" aria-label="Loading your children" className="flex flex-col gap-3">
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

  const done = () => {
    setEditing(null);
  };
  return (
    <div className="flex flex-col gap-4">
      {students.data.length === 0 && editing !== NEW && (
        <p className="text-body text-ink-muted">
          No children yet. Add one here or while booking a trial.
        </p>
      )}
      {students.data.length > 0 && (
        <ul className="flex flex-col divide-y divide-line">
          {students.data.map((student) =>
            editing === student.id ? (
              <li key={student.id} className="py-3">
                <ChildForm student={student} onDone={done} />
              </li>
            ) : (
              <li key={student.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-body font-medium text-ink">
                    {student.firstName}, {student.age}
                  </span>
                  {student.upcomingTrial && (
                    <Link
                      to={`/bookings/${student.upcomingTrial.bookingId}`}
                      className={cn(textLinkClassName, 'self-start text-small')}
                    >
                      Trial on {formatDate(student.upcomingTrial.start, zone, 'short', locale)}
                    </Link>
                  )}
                </div>
                <Button
                  variant="secondary"
                  aria-label={`Edit ${student.firstName}`}
                  onClick={() => {
                    setEditing(student.id);
                  }}
                >
                  Edit
                </Button>
              </li>
            ),
          )}
        </ul>
      )}
      {editing === NEW ? (
        <ChildForm student={null} onDone={done} />
      ) : (
        <Button
          variant="secondary"
          className="self-start"
          icon={<PlusIcon aria-hidden size={20} />}
          onClick={() => {
            setEditing(NEW);
          }}
        >
          Add a child
        </Button>
      )}
    </div>
  );
}
