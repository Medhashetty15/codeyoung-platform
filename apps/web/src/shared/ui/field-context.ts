import { createContext, use } from 'react';

import { cn } from '../lib/cn';

export interface FieldContextValue {
  controlId: string;
  describedBy: string | undefined;
  invalid: boolean;
}

export const FieldContext = createContext<FieldContextValue | null>(null);

/** Accessibility wiring for a control rendered inside <Field>: id, aria-describedby, aria-invalid. */
export function useFieldControl(): {
  id: string | undefined;
  'aria-describedby': string | undefined;
  'aria-invalid': true | undefined;
} {
  const field = use(FieldContext);
  return {
    id: field?.controlId,
    'aria-describedby': field?.describedBy,
    'aria-invalid': field?.invalid ? true : undefined,
  };
}

export const controlClassName = cn(
  'w-full rounded-control border border-line-control bg-surface px-3.5 text-body text-ink',
  'transition-[border-color] duration-(--dur-color) ease-[ease] placeholder:text-ink-faint',
  'hover:border-ink-muted aria-invalid:border-danger',
  'disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-faint',
);
