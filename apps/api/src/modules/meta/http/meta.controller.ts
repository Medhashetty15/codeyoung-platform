import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { type BookingConfig, type TimezonesResponse } from '@app/contracts';

import { Public } from '../../../common/auth/public.decorator';
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
  @Header('Cache-Control', 'public, max-age=86400')
  timezones(): TimezonesResponse {
    return this.zones;
  }
}
