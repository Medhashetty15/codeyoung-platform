import { describe, expect, it } from 'vitest';

import { LoginRequestSchema, RegisterRequestSchema } from './auth.js';
import { SlotsQuerySchema } from './availability.js';
import {
  BookingListQuerySchema,
  CancelBookingRequestSchema,
  CreateBookingRequestSchema,
  RescheduleBookingRequestSchema,
} from './bookings.js';
import { UpdateMeRequestSchema } from './me.js';
import { UpdateStudentRequestSchema } from './students.js';
import { WaitlistRequestSchema } from './waitlist.js';

describe('auth requests', () => {
  it('normalises the register body', () => {
    expect(
      RegisterRequestSchema.parse({
        fullName: '  Hannah Okafor ',
        email: 'Hannah@Okafor.co.uk',
        password: 'violet-harbour-lantern',
        timezone: 'Europe/London',
      }),
    ).toEqual({
      fullName: 'Hannah Okafor',
      email: 'hannah@okafor.co.uk',
      password: 'violet-harbour-lantern',
      timezone: 'Europe/London',
    });
  });

  it('caps password input size before hashing', () => {
    expect(
      LoginRequestSchema.safeParse({ email: 'a@b.co', password: 'x'.repeat(1025) }).success,
    ).toBe(false);
    expect(LoginRequestSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false);
  });
});

describe('profile and students', () => {
  it('requires at least one field to update', () => {
    expect(UpdateMeRequestSchema.safeParse({}).success).toBe(false);
    expect(UpdateMeRequestSchema.parse({ phone: null })).toEqual({ phone: null });
    expect(UpdateMeRequestSchema.parse({ timezone: 'Asia/Calcutta' })).toEqual({
      timezone: 'Asia/Kolkata',
    });
    expect(UpdateStudentRequestSchema.safeParse({}).success).toBe(false);
    expect(UpdateStudentRequestSchema.parse({ age: 10 })).toEqual({ age: 10 });
  });
});

describe('SlotsQuerySchema', () => {
  it('defaults days to 14 and leaves from to the server (PD-13)', () => {
    expect(SlotsQuerySchema.parse({ tz: 'Europe/London' })).toEqual({
      tz: 'Europe/London',
      days: 14,
    });
  });

  it('coerces query-string numbers and bounds them', () => {
    expect(SlotsQuerySchema.parse({ tz: 'UTC', days: '3', from: '2026-10-24' }).days).toBe(3);
    expect(SlotsQuerySchema.safeParse({ tz: 'UTC', days: '15' }).success).toBe(false);
    expect(SlotsQuerySchema.safeParse({ tz: 'UTC', days: '0' }).success).toBe(false);
  });
});

describe('booking requests', () => {
  const base = { slotStart: '2026-10-24T16:00:00Z', timezone: 'Europe/London' };

  it('accepts an existing child or a new child, never a mix', () => {
    expect(
      CreateBookingRequestSchema.safeParse({
        ...base,
        student: { id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d' },
      }).success,
    ).toBe(true);
    expect(
      CreateBookingRequestSchema.safeParse({ ...base, student: { firstName: 'Leo', age: 9 } })
        .success,
    ).toBe(true);
    expect(
      CreateBookingRequestSchema.safeParse({
        ...base,
        student: { id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d', firstName: 'Leo', age: 9 },
      }).success,
    ).toBe(false);
  });

  it('requires a UTC slot start', () => {
    expect(
      RescheduleBookingRequestSchema.safeParse({ ...base, slotStart: '2026-10-24T17:00:00+01:00' })
        .success,
    ).toBe(false);
  });

  it('accepts only the documented cancel reasons (PD-14)', () => {
    expect(CancelBookingRequestSchema.parse({})).toEqual({});
    expect(CancelBookingRequestSchema.parse({ reason: 'SCHEDULE_CHANGED' })).toEqual({
      reason: 'SCHEDULE_CHANGED',
    });
    expect(CancelBookingRequestSchema.safeParse({ reason: 'sick' }).success).toBe(false);
  });

  it('pages bookings with sane defaults', () => {
    expect(BookingListQuerySchema.parse({})).toEqual({ scope: 'upcoming', limit: 20 });
    expect(BookingListQuerySchema.parse({ scope: 'past', limit: '50' })).toEqual({
      scope: 'past',
      limit: 50,
    });
    expect(BookingListQuerySchema.safeParse({ limit: '51' }).success).toBe(false);
  });
});

describe('WaitlistRequestSchema', () => {
  it('keeps preferred times optional and bounded', () => {
    const body = {
      fullName: 'Daniel Reyes',
      email: 'daniel@reyes.us',
      timezone: 'America/Chicago',
    };

    expect(WaitlistRequestSchema.parse(body)).toEqual(body);
    expect(
      WaitlistRequestSchema.safeParse({ ...body, preferredTimes: 'x'.repeat(501) }).success,
    ).toBe(false);
  });
});

describe('HTTP constants', () => {
  it('match docs/03 §6.1', async () => {
    const http = await import('./http.js');

    expect(http.REQUESTED_WITH_HEADER).toEqual(['X-Requested-With', 'cy-web']);
    expect(http.IDEMPOTENCY_KEY_HEADER).toBe('Idempotency-Key');
    expect(http.REFRESH_COOKIE_NAME).toBe('cy_rt');
    expect(http.API_BASE_PATH).toBe('/api/v1');
    expect(http.IdempotencyKeySchema.safeParse('not-a-uuid').success).toBe(false);
  });
});
