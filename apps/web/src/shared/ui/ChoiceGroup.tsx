import { useId, type ReactNode } from 'react';

import { ChoiceContext } from './choice-context';

type ChoiceGroupProps = {
  value: string | null;
  onChange: (value: string) => void;
  children: ReactNode;
  className?: string;
} & ({ label: string; labelledBy?: never } | { labelledBy: string; label?: never });

/**
 * A single-choice group of native radio inputs: one tab stop, arrow keys move and select, and no
 * primitives library in the booking flow's first load (bundle budget). Chips inside draw their own
 * look around a visually hidden input (see useChoice).
 */
export function ChoiceGroup({
  value,
  onChange,
  children,
  className,
  label,
  labelledBy,
}: ChoiceGroupProps) {
  const groupId = useId();
  return (
    <ChoiceContext value={{ name: groupId, value, onChange }}>
      <div role="radiogroup" aria-label={label} aria-labelledby={labelledBy} className={className}>
        {children}
      </div>
    </ChoiceContext>
  );
}
