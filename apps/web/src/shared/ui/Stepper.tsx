import { cn } from '../lib/cn';

import { CheckIcon } from './icons';

export interface Step {
  id: string;
  label: string;
}

/** Text-first progress for the booking flow: Time, Account, Confirm. No "Step 1 of 3" (doc 07 §9). */
export function Stepper({
  steps,
  currentId,
  label = 'Booking progress',
}: {
  steps: Step[];
  currentId: string;
  label?: string;
}) {
  const currentIndex = steps.findIndex((step) => step.id === currentId);
  return (
    <nav aria-label={label}>
      <ol className="flex items-center gap-5 text-small font-medium">
        {steps.map((step, index) => {
          const state =
            index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'upcoming';
          return (
            <li
              key={step.id}
              aria-current={state === 'current' ? 'step' : undefined}
              className={cn(
                'flex items-center gap-1.5 py-1',
                state === 'done' && 'text-ink',
                state === 'current' &&
                  'text-ink underline decoration-accent decoration-2 underline-offset-[6px]',
                state === 'upcoming' && 'text-ink-faint',
              )}
            >
              {state === 'done' && <CheckIcon aria-hidden size={16} className="text-accent" />}
              {step.label}
              {state === 'done' && <span className="sr-only"> (done)</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
