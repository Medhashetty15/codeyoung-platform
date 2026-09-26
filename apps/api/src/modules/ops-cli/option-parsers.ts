import {
  canonicalZone,
  isLocalDate,
  isValidZone,
  type LocalDate,
  type Temporal,
  toInstant,
} from '@app/time';

import { InvalidOptionError } from './command-errors';

/** Shared option checks for ops commands; every failure names the flag. */

export function zoneOption(value: string, flag = '--tz'): string {
  const zone = value;
  // isValidZone narrows its argument, so the message quotes the untouched input.
  if (!isValidZone(zone)) throw new InvalidOptionError(`${flag}: unknown time zone "${value}"`);
  return canonicalZone(zone);
}

export function capOption(value: string): number {
  const cap = Number(value);
  if (!Number.isInteger(cap) || cap < 1 || cap > 20) {
    throw new InvalidOptionError('--cap must be a whole number from 1 to 20');
  }
  return cap;
}

export function booleanOption(value: string, flag: string): boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new InvalidOptionError(`${flag} must be true or false`);
}

/** An instant with an explicit offset, e.g. 2026-10-24T00:00+05:30 or 2026-10-23T18:30Z. */
export function instantOption(value: string, flag: string): Temporal.Instant {
  try {
    return toInstant(value);
  } catch {
    throw new InvalidOptionError(
      `${flag} must be a date and time with an offset, e.g. 2026-10-24T00:00+05:30`,
    );
  }
}

export function dateOption(value: string, flag: string): LocalDate {
  if (!isLocalDate(value)) throw new InvalidOptionError(`${flag} must be a date like 2026-10-24`);
  return value;
}

export function requiredText(value: string | undefined, flag: string): string {
  const text = value?.trim() ?? '';
  if (text === '') throw new InvalidOptionError(`${flag} is required`);
  return text;
}
