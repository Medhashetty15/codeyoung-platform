import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type Request, type Response } from 'express';

import { type Booking, type BookingListResponse } from '@app/contracts';

import { type AuthenticatedUser, CurrentUser } from '../../../common/auth/authenticated-user';
import { KeyedRateLimiter } from '../../../common/http/keyed-rate-limiter';
import { BookingViews } from '../application/booking-views';
import { CancelBookingService } from '../application/cancel-booking.service';
import { CreateBookingService } from '../application/create-booking.service';
import { RescheduleBookingService } from '../application/reschedule-booking.service';

import {
  BookingListQueryDto,
  CancelBookingDto,
  CreateBookingDto,
  RescheduleBookingDto,
} from './bookings.dto';
import { requireIdempotencyKey } from './idempotency-key';

/** docs/03 §6.5: booking writes, 10 per minute per parent. */
const BOOKING_WRITES = { name: 'booking-writes', limit: 10, ttlMs: 60_000 };

@ApiTags('bookings')
@ApiBearerAuth()
@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly creator: CreateBookingService,
    private readonly canceller: CancelBookingService,
    private readonly rescheduler: RescheduleBookingService,
    private readonly views: BookingViews,
    private readonly limiter: KeyedRateLimiter,
  ) {}

  /** 201 with the new booking; 200 with the same booking when the key is replayed. */
  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateBookingDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Booking> {
    const key = requireIdempotencyKey(request);
    await this.limiter.consume(BOOKING_WRITES, user.userId);
    const outcome = await this.creator.create(user.userId, body, key);
    response.status(outcome.replayed ? HttpStatus.OK : HttpStatus.CREATED);
    return this.views.toBooking(outcome.booking);
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: BookingListQueryDto,
  ): Promise<BookingListResponse> {
    return this.views.list(user.userId, query);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<Booking> {
    return this.views.get(user.userId, id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: CancelBookingDto,
  ): Promise<Booking> {
    return this.views.toBooking(await this.canceller.cancel(user.userId, id, body.reason));
  }

  /** 201 with the new booking (the old one becomes RESCHEDULED); 200 on replay. */
  @Post(':id/reschedule')
  async reschedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: RescheduleBookingDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Booking> {
    const key = requireIdempotencyKey(request);
    await this.limiter.consume(BOOKING_WRITES, user.userId);
    const outcome = await this.rescheduler.reschedule(user.userId, id, body, key);
    response.status(outcome.replayed ? HttpStatus.OK : HttpStatus.CREATED);
    return this.views.toBooking(outcome.booking);
  }

  @Get(':id/calendar.ics')
  async calendar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<string> {
    const file = await this.views.calendarFile(user.userId, id);
    response
      .type('text/calendar; charset=utf-8')
      .setHeader('Content-Disposition', `attachment; filename="${file.filename}"`)
      .setHeader('Cache-Control', 'no-store');
    return file.body;
  }
}
