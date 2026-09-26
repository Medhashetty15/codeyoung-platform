import { createZodDto } from 'nestjs-zod';

import {
  BookingListQuerySchema,
  CancelBookingRequestSchema,
  CreateBookingRequestSchema,
  RescheduleBookingRequestSchema,
} from '@app/contracts';

export class CreateBookingDto extends createZodDto(CreateBookingRequestSchema) {}
export class BookingListQueryDto extends createZodDto(BookingListQuerySchema) {}
export class CancelBookingDto extends createZodDto(CancelBookingRequestSchema) {}
export class RescheduleBookingDto extends createZodDto(RescheduleBookingRequestSchema) {}
