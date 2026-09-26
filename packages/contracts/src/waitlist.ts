import { z } from 'zod';

import {
  EmailSchema,
  FullNameSchema,
  IanaZoneSchema,
  IsoInstantSchema,
  UuidSchema,
} from './primitives.js';

/** `POST /waitlist`: 201 when created, 200 when an open entry for the email exists. */
export const WaitlistRequestSchema = z.object({
  fullName: FullNameSchema,
  email: EmailSchema,
  timezone: IanaZoneSchema,
  preferredTimes: z.string().trim().max(500).optional(),
});
export type WaitlistRequest = z.infer<typeof WaitlistRequestSchema>;

export const WaitlistResponseSchema = z.object({
  id: UuidSchema,
  status: z.literal('OPEN'),
  createdAt: IsoInstantSchema,
});
export type WaitlistResponse = z.infer<typeof WaitlistResponseSchema>;
