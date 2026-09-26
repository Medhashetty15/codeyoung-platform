import { Temporal } from 'temporal-polyfill';

import { localDateOf } from './calendar.js';
import { isoInstant, toInstant } from './instant.js';
import { type InstantLike, type LocalDate, type ZoneTransition } from './types.js';
import { parseOffsetMinutes } from './zones.js';

/**
 * Offset changes in `zone` within `[from, to)`, oldest first. Covers DST and
 * any other rule change in the IANA data; zones without changes return [].
 */
export function dstTransitionsBetween(
  from: InstantLike,
  to: InstantLike,
  zone: string,
): ZoneTransition[] {
  const end = toInstant(to);
  const transitions: ZoneTransition[] = [];
  let cursor = toInstant(from).toZonedDateTimeISO(zone);
  for (;;) {
    const next = cursor.getTimeZoneTransition('next');
    if (next === null || Temporal.Instant.compare(next.toInstant(), end) >= 0) break;
    const before = next.toInstant().subtract({ nanoseconds: 1 }).toZonedDateTimeISO(zone);
    transitions.push({
      at: isoInstant(next.toInstant()),
      offsetBefore: before.offset,
      offsetAfter: next.offset,
    });
    cursor = next;
  }
  return transitions;
}

export interface TransitionDescription {
  /** `forward` when clocks spring ahead (offset grows), `back` when they fall back. */
  direction: 'forward' | 'back';
  /** Size of the jump in minutes, e.g. 60. */
  minutes: number;
  /** Local date in the zone on which the change happens. */
  localDate: LocalDate;
}

/** Human-oriented view of a transition, for notices such as "Clocks go back 1 hour on Sun 25 Oct". */
export function describeTransition(
  transition: ZoneTransition,
  zone: string,
): TransitionDescription {
  const delta =
    parseOffsetMinutes(transition.offsetAfter) - parseOffsetMinutes(transition.offsetBefore);
  return {
    direction: delta > 0 ? 'forward' : 'back',
    minutes: Math.abs(delta),
    localDate: localDateOf(transition.at, zone),
  };
}
