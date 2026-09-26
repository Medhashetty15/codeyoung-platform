import { Radio } from '@base-ui/react/radio';

import { cn } from '../lib/cn';

interface DateChipProps {
  /** Local date (YYYY-MM-DD); the radio value. */
  value: string;
  weekday: string;
  day: string;
  /** "4 times", "Full", "No classes". */
  availability: string;
  /** Unavailable days stay focusable and selectable so they can explain why (doc 05 §5.1). */
  muted?: boolean;
}

/** 64x72 date control for the date strip (a Base UI RadioGroup with native horizontal scroll). */
export function DateChip({ value, weekday, day, availability, muted = false }: DateChipProps) {
  return (
    <Radio.Root
      value={value}
      data-muted={muted || undefined}
      className={cn(
        'pressable flex h-18 min-w-16 shrink-0 snap-start px-2 flex-col items-center justify-center gap-0.5 rounded-control border border-line bg-surface',
        'text-ink hover:bg-sunken',
        'data-checked:border-ink data-checked:bg-ink data-checked:text-canvas',
        'data-muted:text-ink-faint data-muted:data-checked:text-canvas',
      )}
    >
      <span className="text-micro uppercase">{weekday}</span>
      <span className="text-h2 tabular-nums">{day}</span>
      <span className="text-micro font-normal whitespace-nowrap">{availability}</span>
    </Radio.Root>
  );
}
