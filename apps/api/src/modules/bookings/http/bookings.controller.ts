import { Body, Controller, Get, HttpStatus, Param, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type Request, type Response } from 'express';

import { type Booking } from '@app/contracts';

import { type AuthenticatedUser, CurrentUser } from '../../../common/auth/authenticated-user';
import { KeyedRateLimiter } from '../../../common/http/keyed-rate-limiter';
import { BookingViews } from '../application/booking-views';
import { CreateBookingService } from '../application/create-booking.service';

import { CreateBookingDto } from './bookings.dto';
import { requireIdempotencyKey } from './idempotency-key';

/** docs/03 §6.5: booking writes, 10 per minute per parent. */
const BOOKING_WRITES = { name: 'booking-writes', limit: 10, ttlMs: 60_000 };

@ApiTags('bookings')
@ApiBearerAuth()
@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly creator: CreateBookingService,
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

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<Booking> {
    return this.views.get(user.userId, id);
  }
}
