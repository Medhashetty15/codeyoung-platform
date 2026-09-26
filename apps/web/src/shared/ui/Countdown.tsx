import NumberFlow, { NumberFlowGroup } from '@number-flow/react';

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const twoDigits = { minimumIntegerDigits: 2 } as const;

function Unit({ value, label, pad = true }: { value: number; label: string; pad?: boolean }) {
  return (
    <span className="flex flex-col items-center gap-1">
      <NumberFlow
        value={value}
        format={pad ? twoDigits : {}}
        trend={-1}
        className="text-display font-bold tabular-nums"
      />
      <span className="text-micro text-ink-muted">{label}</span>
    </span>
  );
}

/**
 * Countdown digits via NumberFlow (doc 07 row 17); it respects reduced motion by itself.
 * The parent owns ticking and clock-skew correction and supplies an aria-live summary if needed.
 */
export function Countdown({ parts }: { parts: CountdownParts }) {
  return (
    <NumberFlowGroup>
      <div aria-hidden className="flex items-start gap-4 text-ink sm:gap-6">
        {parts.days > 0 && (
          <Unit value={parts.days} label={parts.days === 1 ? 'day' : 'days'} pad={false} />
        )}
        <Unit value={parts.hours} label="hours" />
        <Unit value={parts.minutes} label="minutes" />
        {parts.days === 0 && <Unit value={parts.seconds} label="seconds" />}
      </div>
    </NumberFlowGroup>
  );
}
