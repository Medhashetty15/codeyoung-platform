import { z } from 'zod';

import { canonicalZone, type IanaZone, isLocalDate, isValidZone, toInstant } from '@app/time';

/**
 * Marker placed on zod issues whose failure has its own error code; the API
 * reports such requests with that code instead of VALIDATION_FAILED.
 */
export const INVALID_TIMEZONE_ISSUE = { code: 'INVALID_TIMEZONE' } as const;

function isInstant(value: string): boolean {
  try {
    toInstant(value);
    return true;
  } catch {
    return false;
  }
}

/** UTC instant in ISO 8601 with `Z`, e.g. `2026-10-24T16:00:00Z`. */
export const IsoInstantSchema = z.iso
  .datetime({ offset: false })
  .refine(isInstant, { message: 'Invalid instant' });
export type IsoInstant = z.infer<typeof IsoInstantSchema>;

/** Calendar date `YYYY-MM-DD` (a real date: `2026-02-30` is rejected). */
export const LocalDateSchema = z.string().refine(isLocalDate, { message: 'Invalid date' });
export type LocalDate = z.infer<typeof LocalDateSchema>;

/**
 * IANA zone id. Accepts any id the runtime knows (legacy ICU ids and any
 * letter case) and outputs the current canonical name (PD-19): `Asia/Calcutta`
 * becomes `Asia/Kolkata`.
 */
export const IanaZoneSchema = z
  .string()
  .max(64)
  .refine(isValidZone, { message: 'Unknown time zone', params: INVALID_TIMEZONE_ISSUE })
  .transform((zone): IanaZone => canonicalZone(zone));
export type { IanaZone };

export const UuidSchema = z.uuid();
export type Uuid = z.infer<typeof UuidSchema>;

/** Email as typed by a person: trimmed and lower-cased before validation. */
export const EmailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());

export const FullNameSchema = z.string().trim().min(1).max(100);

/** Phone as entered; digits with optional `+`, spaces, brackets and hyphens. */
export const PhoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{7,20}$/, { message: 'Invalid phone number' });

/** A child's first name: letters, spaces, apostrophes, dots and hyphens. */
export const FirstNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(50)
  .regex(/^[\p{L}\p{M}' .-]+$/u, { message: 'Use letters only' });

export const StudentAgeSchema = z.int().min(4).max(18);

/** A bookable interval; `end` is start plus the trial duration. */
export const SlotSchema = z.object({ start: IsoInstantSchema, end: IsoInstantSchema });
export type Slot = z.infer<typeof SlotSchema>;
