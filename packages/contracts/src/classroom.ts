import { z } from 'zod';

import { BookingStatusSchema } from './bookings.js';
import { IanaZoneSchema, IsoInstantSchema } from './primitives.js';

export const ClassroomRole = { PARENT: 'PARENT', MENTOR: 'MENTOR' } as const;
export type ClassroomRole = (typeof ClassroomRole)[keyof typeof ClassroomRole];

/**
 * `GET /classroom/:joinToken` (PD-16). `status` is the booking status; the
 * client derives upcoming / open / live / ended from `start`, `end`,
 * `classroomOpensMinutesBefore` and `serverTime` (clock-skew corrected).
 * RESCHEDULED means "this class was moved"; the new booking is never exposed.
 */
export const ClassroomViewSchema = z.object({
  role: z.enum(ClassroomRole),
  status: BookingStatusSchema,
  start: IsoInstantSchema,
  end: IsoInstantSchema,
  childFirstName: z.string().min(1),
  mentorFirstName: z.string().min(1),
  parentFirstName: z.string().min(1),
  /** Display zone for this participant: parent profile zone or mentor zone. */
  timezone: IanaZoneSchema,
  serverTime: IsoInstantSchema,
  classroomOpensMinutesBefore: z.int().nonnegative(),
});
export type ClassroomView = z.infer<typeof ClassroomViewSchema>;
