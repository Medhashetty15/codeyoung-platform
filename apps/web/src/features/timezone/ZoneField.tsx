import { lazy, Suspense, useState } from 'react';

import { nowInstant } from '@app/time';

import { loadZonePicker, prefetchZonePicker } from './zone-picker-loader';
import { ZoneChipButton } from './ZoneChip';

const ZonePicker = lazy(() => loadZonePicker().then((module) => ({ default: module.ZonePicker })));

interface ZoneFieldProps {
  value: string;
  onChange: (zone: string) => void;
  /** Ties the chip to its field label and helper text. */
  'aria-describedby'?: string | undefined;
}

/**
 * A time zone form control (the profile zone): the zone chip look, but it edits a form value and
 * leaves the display zone alone. The picker loads on first use, like ZoneChip.
 */
export function ZoneField({ value, onChange, 'aria-describedby': describedBy }: ZoneFieldProps) {
  const [active, setActive] = useState(false);
  const at = nowInstant();
  const idle = (
    <ZoneChipButton
      zone={value}
      at={at}
      aria-describedby={describedBy}
      onPointerEnter={prefetchZonePicker}
      onFocus={prefetchZonePicker}
      onPointerDown={prefetchZonePicker}
      onClick={() => {
        setActive(true);
      }}
    />
  );
  if (!active) return idle;
  return (
    <Suspense fallback={idle}>
      <ZonePicker at={at} initiallyOpen value={value} onSelect={onChange} align="start" />
    </Suspense>
  );
}
