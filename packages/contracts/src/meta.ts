import { z } from 'zod';

import { IanaZoneSchema } from './primitives.js';

/** Business knobs the UI must not hard-code (`GET /meta/booking-config`). */
export const BookingConfigSchema = z.object({
  slotDurationMinutes: z.int().positive(),
  slotGridMinutes: z.int().positive(),
  horizonDays: z.int().positive(),
  leadTimeMinutes: z.int().nonnegative(),
  rescheduleCutoffMinutes: z.int().nonnegative(),
  /** How early the classroom opens before the start (PD-15). */
  classroomOpensMinutesBefore: z.int().nonnegative(),
  /** Zone mentors teach in, for copy such as "Your mentor: Sat 9:30 PM India time" (PD-03). */
  mentorTimezone: IanaZoneSchema,
});
export type BookingConfig = z.infer<typeof BookingConfigSchema>;

export const ZoneGroup = { US: 'US', UK: 'UK', IN: 'IN' } as const;
export type ZoneGroup = (typeof ZoneGroup)[keyof typeof ZoneGroup];

export const ZoneSchema = z.object({
  id: IanaZoneSchema,
  city: z.string().min(1),
  country: z.string().min(1),
  group: z.enum(ZoneGroup).optional(),
});
export type Zone = z.infer<typeof ZoneSchema>;

/** `GET /meta/timezones`: canonical ids only; labels are computed client side per date. */
export const TimezonesResponseSchema = z.object({
  suggested: z.array(ZoneSchema),
  all: z.array(ZoneSchema),
});
export type TimezonesResponse = z.infer<typeof TimezonesResponseSchema>;
