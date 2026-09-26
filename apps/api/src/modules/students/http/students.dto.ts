import { createZodDto } from 'nestjs-zod';

import { CreateStudentRequestSchema, UpdateStudentRequestSchema } from '@app/contracts';

export class CreateStudentDto extends createZodDto(CreateStudentRequestSchema) {}
export class UpdateStudentDto extends createZodDto(UpdateStudentRequestSchema) {}
