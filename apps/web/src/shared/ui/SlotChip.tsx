import type { ReactNode } from 'react';

import { cn } from '../lib/cn';

import { choiceFocusClassName, useChoice } from './choice-context';
import { CheckIcon } from './icons';

interface SlotChipProps {
  /** ISO instant of the slot start; the radio value. */
  value: string;
  children: ReactNode;
  disabled?: boolean;
  /** Marks the booking's current time on the reschedule screen (not selectable). */
  current?: boolean;
}

/**
 * One time in the slot grid, inside a ChoiceGroup (arrow keys, one tab stop). Selection changes
 * colour and reveals a check; nothing moves (doc 07 motion row 3).
 */
export function SlotChip({ value, children, disabled = false, current = false }: SlotChipProps) {
  const input = useChoice(value, disabled || current);
  return (
    <label
      className={cn(
        'pressable group relative flex h-12 cursor-pointer items-center justify-center gap-1.5 rounded-control border border-line-control bg-surface select-none',
        'text-body font-medium text-ink tabular-nums',
        'hover:bg-sunken has-checked:border-accent has-checked:bg-accent-tint has-checked:text-accent-ink',
        'has-disabled:cursor-not-allowed has-disabled:border-line has-disabled:bg-sunken has-disabled:text-ink-faint',
        choiceFocusClassName,
      )}
    >
      <input {...input} />
      <CheckIcon
        aria-hidden
        size={16}
        className="absolute left-3 opacity-0 transition-opacity duration-(--dur-color) group-has-checked:opacity-100"
      />
      {children}
      {current && <span className="text-micro text-ink-muted">Current</span>}
    </label>
  );
}
