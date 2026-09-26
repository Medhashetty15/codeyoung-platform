import { z } from 'zod';

import { FirstNameSchema, IsoInstantSchema, StudentAgeSchema, UuidSchema } from './primitives.js';

export const StudentSchema = z.object({
  id: UuidSchema,
  firstName: FirstNameSchema,
  age: StudentAgeSchema,
  /** The child's upcoming confirmed trial, if any (PD-04): one per child at a time. */
  upcomingTrial: z.object({ bookingId: UuidSchema, start: IsoInstantSchema }).nullable(),
});
export type Student = z.infer<typeof StudentSchema>;

export const StudentListSchema = z.array(StudentSchema);

export const CreateStudentRequestSchema = z.object({
  firstName: FirstNameSchema,
  age: StudentAgeSchema,
});
export type CreateStudentRequest = z.infer<typeof CreateStudentRequestSchema>;

export const UpdateStudentRequestSchema = CreateStudentRequestSchema.partial().refine(
  (body) => body.firstName !== undefined || body.age !== undefined,
  { message: 'Provide at least one field to update' },
);
export type UpdateStudentRequest = z.infer<typeof UpdateStudentRequestSchema>;
