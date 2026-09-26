import { z } from 'zod';

import {
  FirstNameSchema,
  IanaZoneSchema,
  IsoInstantSchema,
  StudentAgeSchema,
  UuidSchema,
} from './primitives.js';

export const BookingStatus = {
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
  RESCHEDULED: 'RESCHEDULED',
  COMPLETED: 'COMPLETED',
} as const;
export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];
export const BookingStatusSchema = z.enum(BookingStatus);

/** Parent-selected cancellation reason (PD-14); ops cancellations use free text. */
export const CancelReason = {
  SCHEDULE_CHANGED: 'SCHEDULE_CHANGED',
  CHILD_UNAVAILABLE: 'CHILD_UNAVAILABLE',
  BOOKED_BY_MISTAKE: 'BOOKED_BY_MISTAKE',
  OTHER: 'OTHER',
} as const;
export type CancelReason = (typeof CancelReason)[keyof typeof CancelReason];
export const CancelReasonSchema = z.enum(CancelReason);

/** Human booking reference: `CY-` plus 6 Crockford base32 characters. */
export const BookingReferenceSchema = z.string().regex(/^CY-[0-9A-HJKMNP-TV-Z]{6}$/);

export const BookingSchema = z.object({
  id: UuidSchema,
  reference: BookingReferenceSchema,
  status: BookingStatusSchema,
  start: IsoInstantSchema,
  end: IsoInstantSchema,
  /** Parent's zone when the booking was made. */
  timezone: IanaZoneSchema,
  student: z.object({ id: UuidSchema, firstName: FirstNameSchema, age: StudentAgeSchema }),
  mentor: z.object({ firstName: z.string().min(1) }),
  joinUrl: z.url(),
  canCancel: z.boolean(),
  canReschedule: z.boolean(),
  rescheduledFromId: UuidSchema.nullable(),
  rescheduledToId: UuidSchema.nullable(),
  createdAt: IsoInstantSchema,
});
export type Booking = z.infer<typeof BookingSchema>;

export const BookingSummarySchema = BookingSchema.pick({
  id: true,
  reference: true,
  status: true,
  start: true,
  end: true,
  joinUrl: true,
  canCancel: true,
  canReschedule: true,
  rescheduledToId: true,
}).extend({
  student: z.object({ firstName: FirstNameSchema }),
  mentor: z.object({ firstName: z.string().min(1) }),
});
export type BookingSummary = z.infer<typeof BookingSummarySchema>;

export const BOOKING_LIST_DEFAULT_LIMIT = 20;
export const BOOKING_LIST_MAX_LIMIT = 50;

export const BookingListQuerySchema = z.object({
  scope: z.enum(['upcoming', 'past']).default('upcoming'),
  /** Opaque cursor from the previous page's `nextCursor`. */
  cursor: z.string().min(1).max(200).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(BOOKING_LIST_MAX_LIMIT)
    .default(BOOKING_LIST_DEFAULT_LIMIT),
});
export type BookingListQuery = z.infer<typeof BookingListQuerySchema>;
export type BookingListQueryInput = z.input<typeof BookingListQuerySchema>;

export const BookingListResponseSchema = z.object({
  items: z.array(BookingSummarySchema),
  nextCursor: z.string().nullable(),
});
export type BookingListResponse = z.infer<typeof BookingListResponseSchema>;

/** An existing child by id, or a new child created inline while booking. */
export const BookingStudentSchema = z.union([
  z.strictObject({ id: UuidSchema }),
  z.strictObject({ firstName: FirstNameSchema, age: StudentAgeSchema }),
]);
export type BookingStudent = z.infer<typeof BookingStudentSchema>;

/** `POST /bookings` with header `Idempotency-Key`. */
export const CreateBookingRequestSchema = z.object({
  slotStart: IsoInstantSchema,
  /** Zone the parent confirmed on the review step; saved to the profile. */
  timezone: IanaZoneSchema,
  student: BookingStudentSchema,
});
export type CreateBookingRequest = z.infer<typeof CreateBookingRequestSchema>;
export type CreateBookingRequestInput = z.input<typeof CreateBookingRequestSchema>;

export const CancelBookingRequestSchema = z.object({ reason: CancelReasonSchema.optional() });
export type CancelBookingRequest = z.infer<typeof CancelBookingRequestSchema>;

/** `POST /bookings/:id/reschedule` with header `Idempotency-Key`. */
export const RescheduleBookingRequestSchema = z.object({
  slotStart: IsoInstantSchema,
  timezone: IanaZoneSchema,
});
export type RescheduleBookingRequest = z.infer<typeof RescheduleBookingRequestSchema>;
