import { type Temporal } from 'temporal-polyfill';

/** A validated, canonical IANA zone id (see `canonicalZone`). */
export type IanaZone = string & { readonly __brand: 'IanaZone' };

/** Calendar date without a zone, `YYYY-MM-DD`. */
export type LocalDate = string;

/** Anything that denotes an instant: a Temporal.Instant or an ISO 8601 string with an offset. */
export type InstantLike = Temporal.Instant | string;

/** A wall-clock offset change in a zone, as exposed by the API (`+01:00` style offsets). */
export interface ZoneTransition {
  /** Instant of the change, ISO 8601 UTC. */
  at: string;
  offsetBefore: string;
  offsetAfter: string;
}
