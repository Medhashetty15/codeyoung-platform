import { Controller, Get, Header, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { type SlotsResponse } from '@app/contracts';

import { Public } from '../../../common/auth/public.decorator';
import { AvailabilityService } from '../application/availability.service';

import { SlotsQueryDto } from './slots.dto';

@ApiTags('availability')
@Public()
@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  /** Bookable slots grouped by the requester's local date (docs/03 §9). */
  @Get('slots')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  // Availability changes with every booking: always revalidate.
  @Header('Cache-Control', 'no-cache')
  slots(@Query() query: SlotsQueryDto): Promise<SlotsResponse> {
    return this.availability.slots(query);
  }
}
