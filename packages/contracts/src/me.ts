import { z } from 'zod';

import {
  EmailSchema,
  FullNameSchema,
  IanaZoneSchema,
  PhoneSchema,
  UuidSchema,
} from './primitives.js';

export const MeSchema = z.object({
  id: UuidSchema,
  email: EmailSchema,
  fullName: FullNameSchema,
  phone: z.string().nullable(),
  timezone: IanaZoneSchema,
});
export type Me = z.infer<typeof MeSchema>;

/** Partial profile update; `phone: null` clears the phone number. */
export const UpdateMeRequestSchema = z
  .object({
    fullName: FullNameSchema.optional(),
    phone: PhoneSchema.nullable().optional(),
    timezone: IanaZoneSchema.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'Provide at least one field to update',
  });
export type UpdateMeRequest = z.infer<typeof UpdateMeRequestSchema>;
