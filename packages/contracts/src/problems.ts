import { z } from 'zod';

import { ErrorCode, FieldErrorSchema, ProblemDetailsSchema } from './errors.js';
import { WeakPasswordReasonSchema } from './password-policy.js';
import { SlotSchema, UuidSchema } from './primitives.js';

/** Why a booking can no longer be cancelled or rescheduled. */
export const BookingNotModifiableReason = {
  NOT_CONFIRMED: 'NOT_CONFIRMED',
  ALREADY_STARTED: 'ALREADY_STARTED',
  PAST_RESCHEDULE_CUTOFF: 'PAST_RESCHEDULE_CUTOFF',
} as const;
export type BookingNotModifiableReason =
  (typeof BookingNotModifiableReason)[keyof typeof BookingNotModifiableReason];
export const BookingNotModifiableReasonSchema = z.enum(BookingNotModifiableReason);

/** Most alternatives returned with NO_MENTOR_AVAILABLE. */
export const MAX_ALTERNATIVES = 3;

export const ValidationFailedProblemSchema = ProblemDetailsSchema.extend({
  code: z.literal(ErrorCode.VALIDATION_FAILED),
  errors: z.array(FieldErrorSchema),
});

export const WeakPasswordProblemSchema = ProblemDetailsSchema.extend({
  code: z.literal(ErrorCode.WEAK_PASSWORD),
  reasons: z.array(WeakPasswordReasonSchema).min(1),
});

export const NoMentorAvailableProblemSchema = ProblemDetailsSchema.extend({
  code: z.literal(ErrorCode.NO_MENTOR_AVAILABLE),
  alternatives: z.array(SlotSchema).max(MAX_ALTERNATIVES),
});

export const StudentAlreadyHasTrialProblemSchema = ProblemDetailsSchema.extend({
  code: z.literal(ErrorCode.STUDENT_ALREADY_HAS_TRIAL),
  bookingId: UuidSchema,
});

export const BookingNotModifiableProblemSchema = ProblemDetailsSchema.extend({
  code: z.literal(ErrorCode.BOOKING_NOT_MODIFIABLE),
  reason: BookingNotModifiableReasonSchema,
});

export const RetryableProblemSchema = ProblemDetailsSchema.extend({
  code: z.enum([
    ErrorCode.RATE_LIMITED,
    ErrorCode.ACCOUNT_TEMPORARILY_LOCKED,
    ErrorCode.TEMPORARILY_UNAVAILABLE,
  ]),
  retryAfterSeconds: z.int().nonnegative(),
});

const SPECIFIC_CODES = [
  ErrorCode.VALIDATION_FAILED,
  ErrorCode.WEAK_PASSWORD,
  ErrorCode.NO_MENTOR_AVAILABLE,
  ErrorCode.STUDENT_ALREADY_HAS_TRIAL,
  ErrorCode.BOOKING_NOT_MODIFIABLE,
  ErrorCode.RATE_LIMITED,
  ErrorCode.ACCOUNT_TEMPORARILY_LOCKED,
  ErrorCode.TEMPORARILY_UNAVAILABLE,
] as const;

type SpecificCode = (typeof SPECIFIC_CODES)[number];
const GENERIC_CODES = Object.values(ErrorCode).filter(
  (code): code is Exclude<ErrorCode, SpecificCode> =>
    !(SPECIFIC_CODES as readonly string[]).includes(code),
) as [Exclude<ErrorCode, SpecificCode>, ...Exclude<ErrorCode, SpecificCode>[]];

/** Problems whose only members are the common ones (INVALID_TIMEZONE may carry `errors`). */
export const GenericProblemSchema = ProblemDetailsSchema.extend({
  code: z.enum(GENERIC_CODES),
});

/** Any error response, narrowed by `code` to the members that code carries. */
export const ProblemSchema = z.discriminatedUnion('code', [
  ValidationFailedProblemSchema,
  WeakPasswordProblemSchema,
  NoMentorAvailableProblemSchema,
  StudentAlreadyHasTrialProblemSchema,
  BookingNotModifiableProblemSchema,
  RetryableProblemSchema,
  GenericProblemSchema,
]);
export type Problem = z.infer<typeof ProblemSchema>;
export type ValidationFailedProblem = z.infer<typeof ValidationFailedProblemSchema>;
export type WeakPasswordProblem = z.infer<typeof WeakPasswordProblemSchema>;
export type NoMentorAvailableProblem = z.infer<typeof NoMentorAvailableProblemSchema>;
export type StudentAlreadyHasTrialProblem = z.infer<typeof StudentAlreadyHasTrialProblemSchema>;
export type BookingNotModifiableProblem = z.infer<typeof BookingNotModifiableProblemSchema>;
export type RetryableProblem = z.infer<typeof RetryableProblemSchema>;
