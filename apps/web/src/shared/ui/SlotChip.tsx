import { Radio } from '@base-ui/react/radio';
import type { ReactNode } from 'react';

import { cn } from '../lib/cn';

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
 * One time in the slot grid; lives inside a Base UI RadioGroup (arrow keys, one tab stop).
 * Selection changes colour and reveals a check; nothing moves (doc 07 motion row 3).
 */
export function SlotChip({ value, children, disabled = false, current = false }: SlotChipProps) {
  return (
    <Radio.Root
      value={value}
      disabled={disabled || current}
      className={cn(
        'pressable group relative flex h-12 items-center justify-center gap-1.5 rounded-control border border-line-control bg-surface',
        'text-body font-medium text-ink tabular-nums',
        'hover:bg-sunken data-checked:border-accent data-checked:bg-accent-tint data-checked:text-accent-ink',
        'data-disabled:cursor-not-allowed data-disabled:border-line data-disabled:bg-sunken data-disabled:text-ink-faint',
      )}
    >
      <CheckIcon
        aria-hidden
        size={16}

        className="absolute left-3 opacity-0 transition-opacity duration-(--dur-color) group-data-checked:opacity-100"
      />
      {children}
      {current && <span className="text-micro text-ink-muted">Current</span>}
    </Radio.Root>
  );
}
