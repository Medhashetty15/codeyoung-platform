import { createZodDto } from 'nestjs-zod';

import { CreateBookingRequestSchema } from '@app/contracts';

export class CreateBookingDto extends createZodDto(CreateBookingRequestSchema) {}
