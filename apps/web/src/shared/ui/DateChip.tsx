import { cn } from '../lib/cn';

import { choiceFocusClassName, useChoice } from './choice-context';

interface DateChipProps {
  /** Local date (YYYY-MM-DD); the radio value. */
  value: string;
  weekday: string;
  day: string;
  /** "4 times", "Full", "No classes". */
  availability: string;
  /** Unavailable days stay focusable and selectable so they can explain why (doc 05 §5.1). */
  muted?: boolean;
  /** Full name for assistive tech, e.g. "Saturday 24 October, 4 times available". */
  label: string;
}

/** 72px-high date control for the date strip (a ChoiceGroup with native horizontal scroll). */
export function DateChip({
  value,
  weekday,
  day,
  availability,
  muted = false,
  label,
}: DateChipProps) {
  const input = useChoice(value);
  return (
    <label
      data-muted={muted || undefined}
      className={cn(
        'pressable flex h-18 min-w-16 shrink-0 cursor-pointer snap-start flex-col items-center justify-center gap-0.5 rounded-control border border-line bg-surface px-2 select-none',
        'text-ink hover:bg-sunken',
        'has-checked:border-ink has-checked:bg-ink has-checked:text-canvas',
        'data-muted:text-ink-faint data-muted:has-checked:text-canvas',
        choiceFocusClassName,
      )}
    >
      <input {...input} aria-label={label} />
      <span aria-hidden className="text-micro uppercase">
        {weekday}
      </span>
      <span aria-hidden className="text-h2 tabular-nums">
        {day}
      </span>
      <span aria-hidden className="text-micro font-normal whitespace-nowrap">
        {availability}
      </span>
    </label>
  );
}
