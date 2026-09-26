import { describe, expect, it } from 'vitest';

import {
  EmailSchema,
  FirstNameSchema,
  IanaZoneSchema,
  INVALID_TIMEZONE_ISSUE,
  IsoInstantSchema,
  LocalDateSchema,
  PhoneSchema,
  StudentAgeSchema,
} from './primitives.js';

describe('IsoInstantSchema', () => {
  it.each(['2026-10-24T16:00:00Z', '2026-10-24T16:00:00.123Z'])('accepts %s', (value) => {
    expect(IsoInstantSchema.parse(value)).toBe(value);
  });

  it.each([
    '2026-10-24T16:00:00+01:00',
    '2026-10-24T16:00:00',
    '2026-10-24',
    '2026-13-01T00:00:00Z',
    '2026-02-30T00:00:00Z',
    'soon',
  ])('rejects %s', (value) => {
    expect(IsoInstantSchema.safeParse(value).success).toBe(false);
  });
});

describe('LocalDateSchema', () => {
  it('accepts real dates only', () => {
    expect(LocalDateSchema.safeParse('2026-10-24').success).toBe(true);
    expect(LocalDateSchema.safeParse('2026-02-30').success).toBe(false);
    expect(LocalDateSchema.safeParse('24/10/2026').success).toBe(false);
  });
});

describe('IanaZoneSchema (PD-19)', () => {
  it('stores Asia/Calcutta and Asia/Kolkata both as Asia/Kolkata', () => {
    expect(IanaZoneSchema.parse('Asia/Calcutta')).toBe('Asia/Kolkata');
    expect(IanaZoneSchema.parse('Asia/Kolkata')).toBe('Asia/Kolkata');
    expect(IanaZoneSchema.parse('europe/london')).toBe('Europe/London');
  });

  it('flags unknown zones so the API can answer INVALID_TIMEZONE', () => {
    const result = IanaZoneSchema.safeParse('Mars/Olympus');

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({ params: INVALID_TIMEZONE_ISSUE });
  });

  it('rejects offsets and non-strings', () => {
    expect(IanaZoneSchema.safeParse('+05:30').success).toBe(false);
    expect(IanaZoneSchema.safeParse(330).success).toBe(false);
  });
});

describe('EmailSchema', () => {
  it('trims and lower-cases before validating', () => {
    expect(EmailSchema.parse('  Hannah@Okafor.CO.UK ')).toBe('hannah@okafor.co.uk');
  });

  it('rejects invalid addresses', () => {
    expect(EmailSchema.safeParse('hannah@').success).toBe(false);
    expect(EmailSchema.safeParse(`${'a'.repeat(250)}@example.com`).success).toBe(false);
  });
});

describe('FirstNameSchema', () => {
  it.each(['Leo', 'Zoë', "D'Arcy", 'Anne-Marie', 'Arjun'])('accepts %s', (name) => {
    expect(FirstNameSchema.parse(` ${name} `)).toBe(name);
  });

  it.each(['', '   ', 'Leo2', '<script>', 'x'.repeat(51)])('rejects %j', (name) => {
    expect(FirstNameSchema.safeParse(name).success).toBe(false);
  });
});

describe('PhoneSchema and StudentAgeSchema', () => {
  it('accepts common phone formats', () => {
    expect(PhoneSchema.parse(' +44 20 7946 0958 ')).toBe('+44 20 7946 0958');
    expect(PhoneSchema.safeParse('(212) 555-0199').success).toBe(true);
    expect(PhoneSchema.safeParse('call me').success).toBe(false);
  });

  it('limits ages to 4 to 18', () => {
    expect(StudentAgeSchema.safeParse(4).success).toBe(true);
    expect(StudentAgeSchema.safeParse(18).success).toBe(true);
    expect(StudentAgeSchema.safeParse(3).success).toBe(false);
    expect(StudentAgeSchema.safeParse(9.5).success).toBe(false);
  });
});
