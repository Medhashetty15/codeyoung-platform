import { Temporal } from '@app/time';

import { Clock } from '../../src/common/clock/clock';

/** Test clock: time only moves when the test says so. */
export class ManualClock extends Clock {
  private current: Temporal.Instant;

  constructor(start: Temporal.Instant | string = '2026-10-20T09:00:00Z') {
    super();
    this.current = typeof start === 'string' ? Temporal.Instant.from(start) : start;
  }

  now(): Temporal.Instant {
    return this.current;
  }

  set(instant: Temporal.Instant | string): void {
    this.current = typeof instant === 'string' ? Temporal.Instant.from(instant) : instant;
  }

  advance(duration: Temporal.DurationLike): void {
    this.current = this.current.add(duration);
  }
}
