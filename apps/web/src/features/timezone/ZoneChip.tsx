import { lazy, Suspense, useState, type ComponentPropsWithRef } from 'react';

import { nowInstant, zoneParts, type InstantLike } from '@app/time';

import { cn } from '../../shared/lib/cn';
import { GlobeHemisphereWestIcon } from '../../shared/ui/icons';

import { useDisplayZone } from './timezone-context';

const loadPicker = () => import('./ZonePicker');
const ZonePicker = lazy(() => loadPicker().then((module) => ({ default: module.ZonePicker })));

export interface ZoneChipButtonProps extends ComponentPropsWithRef<'button'> {
  zone: string;
  at: InstantLike;
}

/**
 * Pill with the display zone: "London time (GMT+1)", shortened to "London (GMT+1)" on phones
 * (doc 07 §6). The accessible name always carries the full label.
 */
export function ZoneChipButton({ zone, at, className, ...props }: ZoneChipButtonProps) {
  const { name, offset } = zoneParts(zone, at);
  const full = name === 'UTC' ? 'UTC' : `${name} (${offset})`;
  const short = name === 'UTC' ? 'UTC' : `${name.replace(/ (time|Time)$/, '')} (${offset})`;
  return (
    <button
      type="button"
      aria-label={`${full}, change time zone`}
      className={cn(
        'pressable inline-flex h-11 max-w-full items-center gap-2 rounded-pill border border-line-control bg-surface px-3.5 text-small font-medium whitespace-nowrap text-ink hover:bg-sunken sm:px-4',
        className,
      )}
      {...props}
    >
      <GlobeHemisphereWestIcon aria-hidden size={20} className="shrink-0 text-ink-muted" />
      <span aria-hidden className="sm:hidden">
        {short}
      </span>
      <span aria-hidden className="hidden sm:inline">
        {full}
      </span>
    </button>
  );
}

/**
 * The zone chip on every time-bearing screen. The picker (Combobox, zone list) loads on first
 * use; `at` is the date being viewed so offsets match the times on screen.
 */
export function ZoneChip({ at }: { at?: InstantLike }) {
  const { zone } = useDisplayZone();
  const [active, setActive] = useState(false);
  const reference = at ?? nowInstant();

  const idle = (
    <ZoneChipButton
      zone={zone}
      at={reference}
      onPointerDown={() => void loadPicker()}
      onClick={() => {
        setActive(true);
      }}
    />
  );
  if (!active) return idle;
  return (
    <Suspense fallback={idle}>
      <ZonePicker at={reference} initiallyOpen />
    </Suspense>
  );
}
