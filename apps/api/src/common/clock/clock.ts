import { Injectable } from '@nestjs/common';

import { Temporal } from '@app/time';

/**
 * Source of "now" for all business logic. Inject it instead of reading the
 * system clock so tests can pin time (lead time, horizon, DST weeks, expiry).
 */
export abstract class Clock {
  abstract now(): Temporal.Instant;
}

@Injectable()
export class SystemClock extends Clock {
  now(): Temporal.Instant {
    return Temporal.Now.instant();
  }
}
