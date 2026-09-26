import {
  canonicalZone,
  isLocalDate,
  isValidZone,
  isoInstant,
  type IanaZone,
  type LocalDate,
} from '@app/time';

export interface BookSearch {
  tz: IanaZone | null;
  date: LocalDate | null;
  /** Slot start, ISO instant (UTC). */
  slot: string | null;
}

function parseInstant(value: string | null): string | null {
  if (!value) return null;
  try {
    return isoInstant(value);
  } catch {
    return null;
  }
}

/**
 * `?tz=&date=&slot=` from a shared or refreshed link (doc 05 §12.2). Anything invalid falls back
 * to "not set" rather than an error page.
 */
export function parseBookSearch(params: URLSearchParams): BookSearch {
  const tz = params.get('tz');
  const date = params.get('date');
  return {
    tz: tz && isValidZone(tz) ? canonicalZone(tz) : null,
    date: date && isLocalDate(date) ? date : null,
    slot: parseInstant(params.get('slot')),
  };
}
