import { Body, Controller, Get, HttpException, Post } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { ErrorCode, IanaZoneSchema } from '@app/contracts';

import { Public } from '../../src/common/auth/public.decorator';
import { Roles } from '../../src/common/auth/roles.decorator';
import { AppError } from '../../src/common/errors/app-error';
import { type UserRole } from '../../src/modules/users/infra/user.entity';

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

/** Test-only routes behind the global guard, to exercise `@Roles()` (docs/03 §6.4). */
@Controller('__probe/roles')
export class RolesProbeController {
  @Get('parents')
  @Roles('PARENT')
  parents(): { ok: true } {
    return { ok: true };
  }

  @Get('staff')
  // No such role exists yet (MVP has PARENT only); it stands for a future MENTOR or ADMIN.
  @Roles('ADMIN' as UserRole)
  staff(): { ok: true } {
    return { ok: true };
  }
}
