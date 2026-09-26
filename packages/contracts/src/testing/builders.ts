import { type z } from 'zod';

import {
  type AuthResponse,
  AuthResponseSchema,
  type RefreshResponse,
  RefreshResponseSchema,
} from '../auth.js';
import {
  type Booking,
  type BookingListResponse,
  BookingListResponseSchema,
  BookingSchema,
  type BookingSummary,
  BookingSummarySchema,
} from '../bookings.js';
import { type ClassroomView, ClassroomViewSchema } from '../classroom.js';
import { type ErrorCode, errorCodeStatus, errorTitles, errorTypeUri } from '../errors.js';
import { type Me, MeSchema } from '../me.js';
import {
  type BookingConfig,
  BookingConfigSchema,
  type TimezonesResponse,
  TimezonesResponseSchema,
  type Zone,
  ZoneSchema,
} from '../meta.js';
import { type Slot, SlotSchema } from '../primitives.js';
import { type Problem, ProblemSchema } from '../problems.js';
import { type Student, StudentSchema } from '../students.js';
import { type WaitlistResponse, WaitlistResponseSchema } from '../waitlist.js';

import {
  FIXTURE_IDS,
  FIXTURE_JOIN_URL,
  FIXTURE_MENTOR_FIRST_NAME,
  FIXTURE_NOW,
  FIXTURE_PARENT,
} from './ids.js';

/**
 * Overrides use the schema input type, so zone ids can be written as plain
 * strings (`'Europe/London'`); the parsed result carries the canonical brand.
 */
type Overrides<T extends z.ZodType> = Partial<z.input<T>>;

// Every builder parses its result with the contract schema, so a fixture that
// drifts from the contract fails the consumer's tests instead of lying to them.

export function buildMe(overrides: Overrides<typeof MeSchema> = {}): Me {
  return MeSchema.parse({
    id: FIXTURE_IDS.parent,
    email: FIXTURE_PARENT.email,
    fullName: FIXTURE_PARENT.fullName,
    phone: null,
    timezone: FIXTURE_PARENT.timezone,
    ...overrides,
  });
}

export function buildAuthResponse(
  overrides: Overrides<typeof AuthResponseSchema> = {},
): AuthResponse {
  return AuthResponseSchema.parse({
    accessToken: 'fixture.access.token',
    expiresIn: 900,
    user: buildMe(),
    ...overrides,
  });
}

export function buildRefreshResponse(
  overrides: Overrides<typeof RefreshResponseSchema> = {},
): RefreshResponse {
  return RefreshResponseSchema.parse({
    accessToken: 'fixture.refreshed.access.token',
    expiresIn: 900,
    ...overrides,
  });
}

export function buildStudent(overrides: Overrides<typeof StudentSchema> = {}): Student {
  return StudentSchema.parse({
    id: FIXTURE_IDS.studentLeo,
    firstName: 'Leo',
    age: 9,
    upcomingTrial: null,
    ...overrides,
  });
}

/** Leo (no trial yet) and Maya (already booked), the doc 07 pair. */
export function buildStudents(): Student[] {
  return [
    buildStudent(),
    buildStudent({
      id: FIXTURE_IDS.studentMaya,
      firstName: 'Maya',
      age: 12,
      upcomingTrial: { bookingId: FIXTURE_IDS.booking, start: '2026-10-27T17:00:00Z' },
    }),
  ];
}

export function buildSlot(overrides: Overrides<typeof SlotSchema> = {}): Slot {
  return SlotSchema.parse({
    start: '2026-10-24T16:00:00Z',
    end: '2026-10-24T17:00:00Z',
    ...overrides,
  });
}

export function buildBooking(overrides: Overrides<typeof BookingSchema> = {}): Booking {
  return BookingSchema.parse({
    id: FIXTURE_IDS.booking,
    reference: 'CY-7K3Q9P',
    status: 'CONFIRMED',
    start: '2026-10-24T16:00:00Z',
    end: '2026-10-24T17:00:00Z',
    timezone: FIXTURE_PARENT.timezone,
    student: { id: FIXTURE_IDS.studentLeo, firstName: 'Leo', age: 9 },
    mentor: { firstName: FIXTURE_MENTOR_FIRST_NAME },
    joinUrl: FIXTURE_JOIN_URL,
    canCancel: true,
    canReschedule: true,
    rescheduledFromId: null,
    rescheduledToId: null,
    createdAt: '2026-10-20T09:13:11Z',
    ...overrides,
  });
}

export function buildBookingSummary(
  overrides: Overrides<typeof BookingSummarySchema> = {},
): BookingSummary {
  const booking = buildBooking();
  return BookingSummarySchema.parse({
    id: booking.id,
    reference: booking.reference,
    status: booking.status,
    start: booking.start,
    end: booking.end,
    joinUrl: booking.joinUrl,
    canCancel: booking.canCancel,
    canReschedule: booking.canReschedule,
    rescheduledToId: booking.rescheduledToId,
    student: { firstName: booking.student.firstName },
    mentor: booking.mentor,
    ...overrides,
  });
}

export function buildBookingList(
  items: BookingSummary[] = [buildBookingSummary()],
  nextCursor: string | null = null,
): BookingListResponse {
  return BookingListResponseSchema.parse({ items, nextCursor });
}

export function buildBookingConfig(
  overrides: Overrides<typeof BookingConfigSchema> = {},
): BookingConfig {
  return BookingConfigSchema.parse({
    slotDurationMinutes: 60,
    slotGridMinutes: 30,
    horizonDays: 14,
    leadTimeMinutes: 240,
    rescheduleCutoffMinutes: 120,
    classroomOpensMinutesBefore: 10,
    mentorTimezone: 'Asia/Kolkata',
    ...overrides,
  });
}

export function buildZone(overrides: Overrides<typeof ZoneSchema> = {}): Zone {
  return ZoneSchema.parse({
    id: 'Europe/London',
    city: 'London',
    country: 'United Kingdom',
    group: 'UK',
    ...overrides,
  });
}

const SUGGESTED_ZONES: z.input<typeof ZoneSchema>[] = [
  { id: 'America/New_York', city: 'New York', country: 'United States', group: 'US' },
  { id: 'America/Chicago', city: 'Chicago', country: 'United States', group: 'US' },
  { id: 'America/Denver', city: 'Denver', country: 'United States', group: 'US' },
  { id: 'America/Los_Angeles', city: 'Los Angeles', country: 'United States', group: 'US' },
  { id: 'Europe/London', city: 'London', country: 'United Kingdom', group: 'UK' },
  { id: 'Asia/Kolkata', city: 'Kolkata', country: 'India', group: 'IN' },
];

export function buildTimezones(
  overrides: Overrides<typeof TimezonesResponseSchema> = {},
): TimezonesResponse {
  return TimezonesResponseSchema.parse({
    suggested: SUGGESTED_ZONES,
    all: [
      ...SUGGESTED_ZONES,
      { id: 'Europe/Dublin', city: 'Dublin', country: 'Ireland' },
      { id: 'America/Toronto', city: 'Toronto', country: 'Canada' },
      { id: 'Australia/Sydney', city: 'Sydney', country: 'Australia' },
    ],
    ...overrides,
  });
}

export function buildClassroomView(
  overrides: Overrides<typeof ClassroomViewSchema> = {},
): ClassroomView {
  return ClassroomViewSchema.parse({
    role: 'PARENT',
    status: 'CONFIRMED',
    start: '2026-10-24T16:00:00Z',
    end: '2026-10-24T17:00:00Z',
    childFirstName: 'Leo',
    mentorFirstName: FIXTURE_MENTOR_FIRST_NAME,
    parentFirstName: 'Hannah',
    timezone: FIXTURE_PARENT.timezone,
    serverTime: '2026-10-24T15:52:00Z',
    classroomOpensMinutesBefore: 10,
    ...overrides,
  });
}

export function buildWaitlistResponse(
  overrides: Overrides<typeof WaitlistResponseSchema> = {},
): WaitlistResponse {
  return WaitlistResponseSchema.parse({
    id: FIXTURE_IDS.waitlistEntry,
    status: 'OPEN',
    createdAt: FIXTURE_NOW,
    ...overrides,
  });
}

/** Members each code requires, filled with realistic defaults. */
const PROBLEM_DEFAULTS: Partial<Record<ErrorCode, Record<string, unknown>>> = {
  VALIDATION_FAILED: { errors: [{ path: 'student.firstName', message: 'Required' }] },
  WEAK_PASSWORD: { reasons: ['COMMON'] },
  NO_MENTOR_AVAILABLE: {
    detail: 'This time was just taken. Here are the nearest available times.',
    alternatives: [
      { start: '2026-10-24T17:00:00Z', end: '2026-10-24T18:00:00Z' },
      { start: '2026-10-27T17:00:00Z', end: '2026-10-27T18:00:00Z' },
    ],
  },
  STUDENT_ALREADY_HAS_TRIAL: { bookingId: FIXTURE_IDS.booking },
  BOOKING_NOT_MODIFIABLE: { reason: 'PAST_RESCHEDULE_CUTOFF' },
  RATE_LIMITED: { retryAfterSeconds: 30 },
  ACCOUNT_TEMPORARILY_LOCKED: { retryAfterSeconds: 720 },
  TEMPORARILY_UNAVAILABLE: { retryAfterSeconds: 2 },
};

/** An error body exactly as the API sends it; `extras` override code-specific members. */
export function buildProblem(code: ErrorCode, extras: Record<string, unknown> = {}): Problem {
  return ProblemSchema.parse({
    type: errorTypeUri(code),
    title: errorTitles[code],
    status: errorCodeStatus[code],
    code,
    traceId: '7f3a91c2-5b8e-4d6f-a0c1-9e2d3b4a5f60',
    ...PROBLEM_DEFAULTS[code],
    ...extras,
  });
}
