import { Link } from 'react-router';

import type { Student } from '@app/contracts';
import { formatDate } from '@app/time';

import { ChoiceGroup } from '../../shared/ui/ChoiceGroup';
import { Field, Input, NativeSelect } from '../../shared/ui/Field';
import { RadioCard } from '../../shared/ui/RadioCard';
import { textLinkClassName } from '../../shared/ui/text-link';

export const NEW_CHILD = 'new';

export interface NewChild {
  firstName: string;
  age: string;
}

interface ChildPickerProps {
  students: Student[];
  value: string;
  onChange: (value: string) => void;
  newChild: NewChild;
  onNewChildChange: (next: NewChild) => void;
  errors: { firstName?: string | undefined; age?: string | undefined };
  zone: string;
  locale: string;
  /** Inline reason after a 409 STUDENT_ALREADY_HAS_TRIAL for the chosen child. */
  alreadyBooked?: { studentId: string; bookingId: string; start: string } | undefined;
}

const AGES = Array.from({ length: 15 }, (_, index) => String(index + 4));

/**
 * "Who is the class for?" (doc 05 §5.3). A child with an upcoming trial stays visible but
 * disabled with the reason and a link; a new child can be added inline.
 */
export function ChildPicker({
  students,
  value,
  onChange,
  newChild,
  onNewChildChange,
  errors,
  zone,
  locale,
  alreadyBooked,
}: ChildPickerProps) {
  const trialOf = (student: Student) =>
    student.upcomingTrial ??
    (alreadyBooked?.studentId === student.id
      ? { bookingId: alreadyBooked.bookingId, start: alreadyBooked.start }
      : null);

  return (
    <ChoiceGroup
      label="Who is the class for?"
      value={value}
      onChange={onChange}
      className="flex flex-col gap-2"
    >
      {students.map((student) => {
        const trial = trialOf(student);
        return (
          <RadioCard
            key={student.id}
            value={student.id}
            label={`${student.firstName}, ${String(student.age)}`}
            disabled={trial !== null}
            hint={
              trial && (
                <>
                  {student.firstName} already has a trial on{' '}
                  {formatDate(trial.start, zone, 'short', locale)}.{' '}
                  <Link to={`/bookings/${trial.bookingId}`} className={textLinkClassName}>
                    View booking
                  </Link>
                </>
              )
            }
          />
        );
      })}
      <RadioCard value={NEW_CHILD} label="Add a child">
        {value === NEW_CHILD && (
          <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3 pt-2">
            <Field label="First name" error={errors.firstName}>
              <Input
                autoComplete="off"
                autoCapitalize="words"
                enterKeyHint="next"
                value={newChild.firstName}
                onChange={(event) => {
                  onNewChildChange({ ...newChild, firstName: event.target.value });
                }}
              />
            </Field>
            <Field label="Age" error={errors.age}>
              <NativeSelect
                value={newChild.age}
                onChange={(event) => {
                  onNewChildChange({ ...newChild, age: event.target.value });
                }}
              >
                <option value="" disabled>
                  Age
                </option>
                {AGES.map((age) => (
                  <option key={age} value={age}>
                    {age}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
        )}
      </RadioCard>
    </ChoiceGroup>
  );
}
