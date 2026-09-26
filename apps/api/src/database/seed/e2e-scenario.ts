import { randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';

import { type Slot } from '@app/contracts';
import {
  addDays,
  addMinutes,
  isoInstant,
  localDateOf,
  type LocalDate,
  startOfLocalDay,
  type Temporal,
  toDate,
  todayIn,
} from '@app/time';

import { Clock } from '../../common/clock/clock';
import { AppConfig } from '../../config/app-config';
import { AvailabilityService } from '../../modules/availability/application/availability.service';
import { newBookingReference } from '../../modules/bookings/domain/booking-reference';
import { BookingEntity } from '../../modules/bookings/infra/booking.entity';
import { MeetingProvider } from '../../modules/classroom/domain/meeting-provider';
import { MentorTimeOffEntity } from '../../modules/mentors/infra/mentor-time-off.entity';
import { MentorEntity } from '../../modules/mentors/infra/mentor.entity';
import { StudentEntity } from '../../modules/students/infra/student.entity';
import { PasswordHasher } from '../../modules/users/infra/password-hasher';
import { UserEntity } from '../../modules/users/infra/user.entity';

import { DatabaseSeeder } from './database-seeder';
import { DEFAULT_DEMO_PASSWORD, SEED_PARENT } from './seed-data';

/** Days after today (in the scenario zone) of the prepared days. */
const ONE_SLOT_LEFT_OFFSET = 2;
const FULLY_BOOKED_OFFSET = 3;
const FILLER_EMAIL = 'e2e.filler@example.com';

export interface E2eScenarioOptions {
  /** Zone whose calendar dates the prepared days follow (the browser zone of the e2e run). */
  timezone: string;
  /** Deactivate every mentor: the whole window is empty and nextAvailable is null. */
  empty: boolean;
}

export interface E2eScenarioSummary {
  timezone: string;
  today: LocalDate;
  demoParent: { email: string; password: string };
  /** A day with exactly one bookable slot left. Null with `empty`. */
  oneSlotLeft: { date: LocalDate; slot: Slot } | null;
  /** A day where mentors work but every slot is taken. Null with `empty`. */
  fullyBooked: { date: LocalDate } | null;
  empty: boolean;
}

/**
 * Deterministic end-to-end data relative to now (PD-10): the normal seed plus
 * filler bookings that leave one slot on one day and none on the next. Filler
 * bookings are written directly (no audit events, no emails).
 */
@Injectable()
export class E2eScenarioSeeder {
  constructor(
    private readonly dataSource: DataSource,
    private readonly seeder: DatabaseSeeder,
    private readonly availability: AvailabilityService,
    private readonly meetings: MeetingProvider,
    private readonly hasher: PasswordHasher,
    private readonly config: AppConfig,
    private readonly clock: Clock,
  ) {}

  async run(options: E2eScenarioOptions): Promise<E2eScenarioSummary> {
    await this.seeder.seed({ reset: true });
    const today = todayIn(options.timezone, this.clock.now());
    const summary: E2eScenarioSummary = {
      timezone: options.timezone,
      today,
      demoParent: {
        email: SEED_PARENT.email,
        password: this.config.seedDemoPassword ?? DEFAULT_DEMO_PASSWORD,
      },
      oneSlotLeft: null,
      fullyBooked: null,
      empty: options.empty,
    };
    if (options.empty) {
      await this.dataSource
        .getRepository(MentorEntity)
        .update({ isActive: true }, { isActive: false });
      return summary;
    }

    const fullDate = addDays(today, FULLY_BOOKED_OFFSET);
    const oneLeftDate = addDays(today, ONE_SLOT_LEFT_OFFSET);
    await this.dataSource.transaction(async (manager) => {
      await this.fillDay(manager, await this.fillerParent(manager), fullDate, options.timezone);
      await this.keepOneSlot(manager, oneLeftDate, options.timezone);
    });
    const [left] = await this.freeStartsOn(oneLeftDate, options.timezone);
    return {
      ...summary,
      fullyBooked: { date: fullDate },
      oneSlotLeft:
        left === undefined
          ? null
          : {
              date: oneLeftDate,
              slot: {
                start: isoInstant(left),
                end: isoInstant(addMinutes(left, this.config.booking.trialDurationMinutes)),
              },
            },
    };
  }

  /** Books the earliest free (slot, mentor) until the day is fully booked. */
  private async fillDay(
    manager: EntityManager,
    parentId: string,
    date: LocalDate,
    timezone: string,
  ): Promise<void> {
    for (;;) {
      const [next] = await this.freeOn(date, timezone, manager);
      const mentorId = next?.mentorIds[0];
      if (next === undefined || mentorId === undefined) return;
      await this.insertBooking(manager, parentId, mentorId, next.start);
    }
  }

  /**
   * Leaves exactly one start with one mentor on the day: every other mentor
   * with free time that day gets the whole day off, the chosen mentor gets
   * time off around the kept class. Taking that slot makes the day FULLY_BOOKED.
   */
  private async keepOneSlot(
    manager: EntityManager,
    date: LocalDate,
    timezone: string,
  ): Promise<void> {
    const free = await this.freeOn(date, timezone, manager);
    const kept = free[0];
    const keptMentor = kept?.mentorIds[0];
    if (kept === undefined || keptMentor === undefined) return;

    const booking = this.config.booking;
    const dayStart = startOfLocalDay(date, timezone);
    const dayEnd = startOfLocalDay(addDays(date, 1), timezone);
    const footprintEnd = addMinutes(
      kept.start,
      booking.trialDurationMinutes + booking.mentorBufferMinutes,
    );
    // Past the day end by one footprint, so no later start of the kept mentor survives either.
    const afterDay = addMinutes(dayEnd, booking.trialDurationMinutes + booking.mentorBufferMinutes);
    const mentorIds = [...new Set(free.flatMap((slot) => slot.mentorIds))];
    for (const mentorId of mentorIds) {
      const blocks: [Temporal.Instant, Temporal.Instant][] =
        mentorId === keptMentor
          ? [
              [dayStart, kept.start],
              [footprintEnd, afterDay],
            ]
          : [[dayStart, dayEnd]];
      for (const [startsAt, endsAt] of blocks) {
        if (startsAt.epochMilliseconds >= endsAt.epochMilliseconds) continue;
        await manager.save(
          manager.create(MentorTimeOffEntity, {
            mentorId,
            startsAt: toDate(startsAt),
            endsAt: toDate(endsAt),
            reason: 'e2e scenario: one slot left',
          }),
        );
      }
    }
  }

  private async freeOn(date: LocalDate, timezone: string, manager?: EntityManager) {
    return this.availability.freeSlots(
      startOfLocalDay(date, timezone),
      startOfLocalDay(addDays(date, 1), timezone),
      manager,
    );
  }

  private async freeStartsOn(date: LocalDate, timezone: string): Promise<Temporal.Instant[]> {
    return (await this.freeOn(date, timezone)).map((slot) => slot.start);
  }

  private async fillerParent(manager: EntityManager): Promise<string> {
    const parent = await manager.save(
      manager.create(UserEntity, {
        email: FILLER_EMAIL,
        fullName: 'Filler Family',
        timezone: 'UTC',
        passwordHash: await this.hasher.hash(randomBytes(24).toString('base64url')),
      }),
    );
    return parent.id;
  }

  private async insertBooking(
    manager: EntityManager,
    parentId: string,
    mentorId: string,
    start: Temporal.Instant,
  ): Promise<void> {
    const count = await manager.count(StudentEntity, { where: { parentId } });
    const student = await manager.save(
      manager.create(StudentEntity, { parentId, firstName: fillerName(count), age: 9 }),
    );
    const mentor = await manager.findOneByOrFail(MentorEntity, { id: mentorId });
    const meeting = this.meetings.createMeeting();
    const endsAt = addMinutes(start, this.config.booking.trialDurationMinutes);
    await manager.save(
      manager.create(BookingEntity, {
        reference: newBookingReference(),
        parentId,
        studentId: student.id,
        mentorId,
        startsAt: toDate(start),
        endsAt: toDate(endsAt),
        blockedUntil: toDate(addMinutes(endsAt, this.config.booking.mentorBufferMinutes)),
        mentorLocalDate: localDateOf(start, mentor.timezone),
        parentTimezone: 'UTC',
        mentorTimezone: mentor.timezone,
        parentJoinToken: meeting.parentJoinToken,
        mentorJoinToken: meeting.mentorJoinToken,
        meetingUrl: meeting.meetingUrl,
      }),
    );
  }
}

/** Letters-only unique child names: Fillera, Fillerb, ... Fillerba. */
function fillerName(index: number): string {
  let suffix = '';
  let rest = index;
  do {
    suffix = String.fromCharCode(97 + (rest % 26)) + suffix;
    rest = Math.floor(rest / 26) - 1;
  } while (rest >= 0);
  return `Filler${suffix}`;
}
