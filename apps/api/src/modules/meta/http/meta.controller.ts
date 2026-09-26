import { Controller, Get, Header } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';

import { type BookingConfig, type TimezonesResponse } from '@app/contracts';

import { Public } from '../../../common/auth/public.decorator';
import { ApiProblems, BookingConfigDto, TimezonesResponseDto } from '../../../common/http/api-docs';
import { AppConfig } from '../../../config/app-config';
import { buildZoneCatalog } from '../application/zone-catalog';

@ApiTags('meta')
@Public()
@Controller('meta')
export class MetaController {
  private readonly zones: TimezonesResponse = buildZoneCatalog();

  constructor(private readonly config: AppConfig) {}

  /** Business knobs the UI must not hard-code (docs/03 §9, PD-03, PD-15). */
  @Get('booking-config')
  @ApiResponse({ status: 200, type: BookingConfigDto })
  @ApiProblems()
  @Header('Cache-Control', 'public, max-age=300')
  bookingConfig(): BookingConfig {
    const booking = this.config.booking;
    return {
      slotDurationMinutes: booking.trialDurationMinutes,
      slotGridMinutes: booking.slotGridMinutes,
      horizonDays: booking.horizonDays,
      leadTimeMinutes: booking.leadTimeMinutes,
      rescheduleCutoffMinutes: booking.rescheduleCutoffMinutes,
      classroomOpensMinutesBefore: booking.classroomOpensMinutesBefore,
      mentorTimezone: booking.mentorDisplayTimezone as BookingConfig['mentorTimezone'],
    };
  }

  @Get('timezones')
  @ApiResponse({ status: 200, type: TimezonesResponseDto })
  @ApiProblems()
  @Header('Cache-Control', 'public, max-age=86400')
  timezones(): TimezonesResponse {
    return this.zones;
  }
}
