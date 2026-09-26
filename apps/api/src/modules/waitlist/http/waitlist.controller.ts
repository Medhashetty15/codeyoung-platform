import { Body, Controller, HttpStatus, Post, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { type Response } from 'express';
import { createZodDto } from 'nestjs-zod';

import { type WaitlistResponse, WaitlistRequestSchema } from '@app/contracts';
import { isoInstant } from '@app/time';

import { type AuthenticatedUser, OptionalUser } from '../../../common/auth/authenticated-user';
import { Public } from '../../../common/auth/public.decorator';
import { WaitlistService } from '../application/waitlist.service';

class JoinWaitlistDto extends createZodDto(WaitlistRequestSchema) {}

const HOUR = 3_600_000;

@ApiTags('waitlist')
@Public()
@Controller('waitlist')
export class WaitlistController {
  constructor(private readonly waitlist: WaitlistService) {}

  /** 201 for a new entry, 200 when this email is already waiting (docs/03 §9). */
  @Post()
  @Throttle({ default: { limit: 5, ttl: HOUR } })
  async join(
    @Body() body: JoinWaitlistDto,
    @OptionalUser() user: AuthenticatedUser | null,
    @Res({ passthrough: true }) response: Response,
  ): Promise<WaitlistResponse> {
    const { entry, created } = await this.waitlist.join(body, user?.userId ?? null);
    response.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return { id: entry.id, status: 'OPEN', createdAt: isoInstant(entry.createdAt) };
  }
}
