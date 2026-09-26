import { toInstant } from './instant.js';
import { type IanaZone, type InstantLike } from './types.js';

/**
 * ICU keeps some renamed zones under their legacy ids (CLDR stability), so
 * `Intl` reports e.g. `Asia/Calcutta` for `Asia/Kolkata`. This maps every
 * legacy alias CLDR lists to its current IANA name (CLDR bcp47/timezone.xml
 * `iana` attribute); `zones.spec.ts` checks it against that data and against
 * every zone the running ICU reports.
 */
export const LEGACY_ZONE_ALIASES: Readonly<Record<string, string>> = {
  'Africa/Asmera': 'Africa/Asmara',
  'America/Argentina/ComodRivadavia': 'America/Argentina/Catamarca',
  'America/Buenos_Aires': 'America/Argentina/Buenos_Aires',
  'America/Catamarca': 'America/Argentina/Catamarca',
  'America/Coral_Harbour': 'America/Atikokan',
  'America/Cordoba': 'America/Argentina/Cordoba',
  'America/Fort_Wayne': 'America/Indiana/Indianapolis',
  'America/Godthab': 'America/Nuuk',
  'America/Indianapolis': 'America/Indiana/Indianapolis',
  'America/Jujuy': 'America/Argentina/Jujuy',
  'America/Louisville': 'America/Kentucky/Louisville',
  'America/Mendoza': 'America/Argentina/Mendoza',
  'America/Rosario': 'America/Argentina/Cordoba',
  'Asia/Calcutta': 'Asia/Kolkata',
  'Asia/Katmandu': 'Asia/Kathmandu',
  'Asia/Rangoon': 'Asia/Yangon',
  'Asia/Saigon': 'Asia/Ho_Chi_Minh',
  'Atlantic/Faeroe': 'Atlantic/Faroe',
  'Europe/Kiev': 'Europe/Kyiv',
  'Europe/Uzhgorod': 'Europe/Kyiv',
  'Europe/Zaporozhye': 'Europe/Kyiv',
  'Pacific/Enderbury': 'Pacific/Kanton',
  'Pacific/Ponape': 'Pacific/Pohnpei',
  'Pacific/Truk': 'Pacific/Chuuk',
  'Pacific/Yap': 'Pacific/Chuuk',
  'US/East-Indiana': 'America/Indiana/Indianapolis',
};

export const UTC = 'UTC' as IanaZone;

// Named zones only: `Area/Location[/Sub]`, `UTC`, `EST5EDT` style. Offsets such as
// `+05:30` are valid for Intl but are not IANA zones and never accepted.
const ZONE_ID_SHAPE = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+){0,2}$/;

function resolvedZone(id: string): string | undefined {
  if (id.length > 64 || !ZONE_ID_SHAPE.test(id)) return undefined;
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: id }).resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

/** True for any IANA zone id the runtime knows, current or legacy, in any letter case. */
export function isValidZone(id: unknown): id is string {
  return typeof id === 'string' && resolvedZone(id) !== undefined;
}

/**
 * Normalises a zone id to the current IANA name: letter case fixed, links
 * resolved the way the runtime's ICU resolves them, legacy ICU ids replaced
 * (`asia/calcutta` and `Asia/Kolkata` both become `Asia/Kolkata`).
 * @throws RangeError when the id is not a known zone
 */
export function canonicalZone(id: string): IanaZone {
  const resolved = resolvedZone(id);
  if (resolved === undefined) throw new RangeError('Unknown time zone');
  return (LEGACY_ZONE_ALIASES[resolved] ?? resolved) as IanaZone;
}

/** Same zone after canonicalisation; false when either id is invalid. */
export function sameZone(a: string, b: string): boolean {
  return isValidZone(a) && isValidZone(b) && canonicalZone(a) === canonicalZone(b);
}

/** The device zone (browser or process), canonicalised; UTC when unavailable. */
export function deviceZone(): IanaZone {
  const id = new Intl.DateTimeFormat().resolvedOptions().timeZone;
  return isValidZone(id) ? canonicalZone(id) : UTC;
}

/** UTC offset in ISO form at that instant, e.g. `+05:30`, `-04:00`, `+00:00`. */
export function zoneOffset(zone: string, at: InstantLike): string {
  return toInstant(at).toZonedDateTimeISO(zone).offset;
}

/** Offset in minutes east of UTC at that instant (`+05:30` is 330). */
export function zoneOffsetMinutes(zone: string, at: InstantLike): number {
  return toInstant(at).toZonedDateTimeISO(zone).offsetNanoseconds / 60e9;
}

/** Parses an ISO offset (`+05:30`, `-04:00`, `Z`) to minutes east of UTC. */
export function parseOffsetMinutes(offset: string): number {
  if (offset === 'Z') return 0;
  const match = /^([+-])(\d{2}):?(\d{2})$/.exec(offset);
  if (match === null) throw new RangeError(`Invalid UTC offset: ${offset}`);
  const [, sign, hours, minutes] = match;
  const value = Number(hours) * 60 + Number(minutes);
  return sign === '-' ? -value : value;
}
