import { useId, type ReactNode } from 'react';

import { cn } from '../lib/cn';

import { useChoice } from './choice-context';

interface RadioCardProps {
  value: string;
  label: ReactNode;
  /** Reason shown under a disabled option, e.g. "Maya already has a trial on Tue 27 Oct." */
  hint?: ReactNode;
  disabled?: boolean;
  children?: ReactNode;
}

/** A labelled radio row for small choice lists (child picker), inside a ChoiceGroup. */
export function RadioCard({ value, label, hint, disabled = false, children }: RadioCardProps) {
  const input = useChoice(value, disabled);
  const hintId = useId();
  return (
    <div className="flex flex-col gap-1">
      <label
        className={cn(
          'group relative flex min-h-11 items-center gap-3',
          disabled ? 'cursor-not-allowed' : 'cursor-pointer',
        )}
      >
        <input {...input} aria-describedby={hint ? hintId : undefined} />
        <span
          aria-hidden
          className={cn(
            'flex size-5 shrink-0 items-center justify-center rounded-full border border-line-control bg-surface',
            'transition-colors duration-(--dur-color) group-has-checked:border-accent group-has-disabled:bg-sunken',
            'group-has-focus-visible:outline-2 group-has-focus-visible:outline-offset-2 group-has-focus-visible:outline-accent',
          )}
        >
          <span className="hidden size-2.5 rounded-full bg-accent group-has-checked:block" />
        </span>
        <span className={cn('text-body', disabled ? 'text-ink-faint' : 'text-ink')}>{label}</span>
      </label>
      {Boolean(hint) && (
        <div id={hintId} className="pl-8 text-small text-ink-muted">
          {hint}
        </div>
      )}
      {Boolean(children) && <div className="pl-8">{children}</div>}
    </div>
  );
}
