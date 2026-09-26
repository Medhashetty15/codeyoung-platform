import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';

import {
  AuthResponseSchema,
  BookingConfigSchema,
  BookingListResponseSchema,
  BookingSchema,
  ClassroomViewSchema,
  type ErrorCode,
  errorCodeStatus,
  MeSchema,
  ProblemDetailsSchema,
  RefreshResponseSchema,
  SlotsResponseSchema,
  StudentSchema,
  TimezonesResponseSchema,
  WaitlistResponseSchema,
} from '@app/contracts';

/**
 * Response bodies for the OpenAPI document (docs/03 §9), generated from the
 * same zod schemas the web app parses, so the document cannot drift.
 */
export class AuthResponseDto extends createZodDto(AuthResponseSchema) {}
export class RefreshResponseDto extends createZodDto(RefreshResponseSchema) {}
export class MeDto extends createZodDto(MeSchema) {}
export class StudentDto extends createZodDto(StudentSchema) {}
export class BookingDto extends createZodDto(BookingSchema) {}
export class BookingListResponseDto extends createZodDto(BookingListResponseSchema) {}
export class SlotsResponseDto extends createZodDto(SlotsResponseSchema) {}
export class ClassroomViewDto extends createZodDto(ClassroomViewSchema) {}
export class BookingConfigDto extends createZodDto(BookingConfigSchema) {}
export class TimezonesResponseDto extends createZodDto(TimezonesResponseSchema) {}
export class WaitlistResponseDto extends createZodDto(WaitlistResponseSchema) {}
export class ProblemDto extends createZodDto(ProblemDetailsSchema) {}

/**
 * Documents the problem responses an endpoint can return, grouped by status,
 * each listing its stable `code`s (RFC 7807, application/problem+json).
 */
export function ApiProblems(...codes: ErrorCode[]): MethodDecorator & ClassDecorator {
  const byStatus = new Map<number, ErrorCode[]>();
  for (const code of new Set([...codes, 'VALIDATION_FAILED', 'RATE_LIMITED'] as ErrorCode[])) {
    const status = errorCodeStatus[code];
    byStatus.set(status, [...(byStatus.get(status) ?? []), code]);
  }
  return applyDecorators(
    ...[...byStatus.entries()].map(([status, list]) =>
      ApiResponse({
        status,
        description: `Problem with code ${list.join(' or ')}`,
        content: {
          'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDto' } },
        },
      }),
    ),
    ApiResponse({
      status: 'default',
      description: 'Any other problem (500 INTERNAL_ERROR)',
      type: ProblemDto,
    }),
  );
}
