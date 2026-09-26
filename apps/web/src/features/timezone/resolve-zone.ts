import { canonicalZone, isValidZone, UTC, type IanaZone } from '@app/time';

export interface ZoneCandidates {
  /** `?tz=` on shareable booking URLs. */
  url?: string | null | undefined;
  /** Picked in the zone picker during this visit ("just for now"). */
  chosen?: string | null | undefined;
  /** The signed-in parent's profile zone. */
  profile?: string | null | undefined;
  /** Last zone picked on this device (localStorage). */
  saved?: string | null | undefined;
  /** Intl's zone for this device. */
  device?: string | null | undefined;
}

/**
 * Display zone resolution (doc 05 §11): URL, then this visit's explicit choice, then profile, saved
 * preference and device, then UTC. Invalid ids are skipped; legacy ids ("Asia/Calcutta") come back
 * canonical so comparisons with the profile work (PD-19).
 */
export function resolveDisplayZone(candidates: ZoneCandidates): IanaZone {
  const order = [
    candidates.url,
    candidates.chosen,
    candidates.profile,
    candidates.saved,
    candidates.device,
  ];
  for (const zone of order) {
    if (zone && isValidZone(zone)) return canonicalZone(zone);
  }
  return UTC;
}
