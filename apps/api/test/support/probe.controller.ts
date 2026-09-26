import { Body, Controller, Get, HttpException, Post } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { ErrorCode, IanaZoneSchema } from '@app/contracts';

import { Public } from '../../src/common/auth/public.decorator';
import { AppError } from '../../src/common/errors/app-error';

class ProbeBodyDto extends createZodDto(
  z.object({
    student: z.object({ firstName: z.string().trim().min(1).max(50) }),
    age: z.int().min(4).max(18),
  }),
) {}

class ProbeZoneDto extends createZodDto(z.object({ timezone: IanaZoneSchema })) {}

/** Test-only routes that trigger each error path of the HTTP pipeline. */
@Public()
@Controller('__probe')
export class ProbeController {
  @Post('validate')
  validate(@Body() body: ProbeBodyDto): ProbeBodyDto {
    return body;
  }

  @Post('zone')
  zone(@Body() body: ProbeZoneDto): ProbeZoneDto {
    return body;
  }

  @Get('app-error')
  appError(): never {
    throw new AppError(ErrorCode.NO_MENTOR_AVAILABLE, {
      detail: 'This time was just taken.',
      extras: { alternatives: [{ start: '2026-10-24T17:00:00Z', end: '2026-10-24T18:00:00Z' }] },
    });
  }

  @Get('crash')
  crash(): never {
    throw new Error('connection terminated: password authentication failed for user "codeyoung"');
  }

  @Get('unavailable')
  unavailable(): never {
    throw new HttpException('lock timeout', 503);
  }
}
