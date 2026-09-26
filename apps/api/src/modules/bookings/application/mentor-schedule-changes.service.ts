import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';

import { type LocalDate, type Temporal } from '@app/time';

import { Clock } from '../../../common/clock/clock';
import { inLockingTransaction } from '../../../database/transactions';
import { AvailabilityService } from '../../availability/application/availability.service';
import {
  MentorAdminRepository,
  type MentorProfile,
  type WeeklyWindow,
} from '../../mentors/infra/mentor-admin.repository';
import { MentorsRepository } from '../../mentors/infra/mentors.repository';
import { type BookingRecord, BookingsRepository } from '../infra/bookings.repository';

import { ReassignBookingService } from './reassign-booking.service';

/** A schedule change would strand confirmed classes; nothing was changed. */
export class ScheduleConflictError extends Error {
  override readonly name = 'ScheduleConflictError';
}

export class MentorNotFoundError extends Error {
  override readonly name = 'MentorNotFoundError';
}

export interface ChangeOptions {
  /** Move stranded classes to other mentors (all or nothing) instead of refusing. */
  reassign: boolean;
  /** Recorded in booking_events for moved classes. */
  actor: string;
}

export interface ChangeOutcome<T> {
  mentor: MentorProfile;
  value: T;
  /** Classes the change strands; moved to other mentors when the change was applied. */
  affected: BookingRecord[];
  moved: { reference: string; mentorId: string }[];
}

/** Carries a dry run's findings out of the transaction it rolls back. */
class DryRun<T> extends Error {
  constructor(readonly outcome: ChangeOutcome<T>) {
    super('dry run');
  }
}

/** Which confirmed classes a change can strand. */
type Affected = 'every-upcoming' | 'no-longer-fits';

/**
 * Mentor changes that reduce capacity (docs/03 §3.4, §10): time off,
 * deactivation, zone, weekly windows and cap. Each runs under the mentor's
 * lock; afterwards every upcoming class the changed schedule no longer holds
 * (availability, time off, buffer; the cap only limits future bookings) is
 * either moved to another mentor (`reassign`, all or nothing) or the change
 * is refused. `dryRun` applies the same change and rolls it back.
 */
@Injectable()
export class MentorScheduleChanges {
  constructor(
    private readonly dataSource: DataSource,
    private readonly admin: MentorAdminRepository,
    private readonly mentors: MentorsRepository,
    private readonly bookings: BookingsRepository,
    private readonly availability: AvailabilityService,
    private readonly reassigner: ReassignBookingService,
    private readonly clock: Clock,
  ) {}

  addTimeOff(
    email: string,
    range: { from: Temporal.Instant; to: Temporal.Instant; reason: string | null },
    options: ChangeOptions & { dryRun?: boolean },
  ): Promise<ChangeOutcome<string>> {
    return this.change(
      email,
      'no-longer-fits',
      (manager, mentor) =>
        this.admin.withManager(manager).addTimeOff(mentor.id, range.from, range.to, range.reason),
      options,
    );
  }

  update(
    email: string,
    changes: { timezone?: string; maxTrialsPerDay?: number; isActive?: boolean },
    options: ChangeOptions & { dryRun?: boolean },
  ): Promise<ChangeOutcome<null>> {
    return this.change(
      email,
      changes.isActive === false ? 'every-upcoming' : 'no-longer-fits',
      async (manager, mentor) => {
        await this.admin.withManager(manager).update(mentor.id, changes);
        return null;
      },
      options,
    );
  }

  setWeeklyWindows(
    email: string,
    windows: readonly WeeklyWindow[],
    from: LocalDate,
    options: ChangeOptions & { dryRun?: boolean },
  ): Promise<ChangeOutcome<null>> {
    return this.change(
      email,
      'no-longer-fits',
      async (manager, mentor) => {
        await this.admin.withManager(manager).replaceWeeklyWindows(mentor.id, windows, from);
        return null;
      },
      options,
    );
  }

  private async change<T>(
    email: string,
    affectedBy: Affected,
    apply: (manager: EntityManager, mentor: MentorProfile) => Promise<T>,
    options: ChangeOptions & { dryRun?: boolean },
  ): Promise<ChangeOutcome<T>> {
    try {
      return await inLockingTransaction(this.dataSource, async (manager) => {
        const mentor = await this.admin.withManager(manager).findByEmail(email);
        if (mentor === null) throw new MentorNotFoundError(`No mentor with email ${email}`);
        // Capacity-reducing write: serialise with bookings for this mentor (docs/03 §3.4).
        await this.mentors.withManager(manager).lockById(mentor.id);
        const value = await apply(manager, mentor);
        const affected = await this.stranded(manager, mentor.id, affectedBy);
        const outcome: ChangeOutcome<T> = { mentor, value, affected, moved: [] };
        if (options.dryRun === true) throw new DryRun(outcome);
        if (affected.length === 0) return outcome;
        if (!options.reassign) {
          throw new ScheduleConflictError(
            `This change strands ${describe(affected)}. Re-run with --reassign to move ` +
              'them to other mentors, or cancel them first (booking:cancel).',
          );
        }
        for (const booking of affected) {
          const cover = await this.reassigner.rankedCover(booking);
          const moved = await this.reassigner.moveWithin(
            manager,
            booking.reference,
            cover,
            options.actor,
          );
          if (moved === null) {
            throw new ScheduleConflictError(
              `No other mentor is free for ${booking.reference}; nothing was changed. ` +
                `Cancel it first: booking:cancel ${booking.reference} --reason "<why>"`,
            );
          }
          outcome.moved.push({ reference: booking.reference, mentorId: moved.booking.mentorId });
        }
        return outcome;
      });
    } catch (error) {
      if (error instanceof DryRun) return error.outcome as ChangeOutcome<T>;
      throw error;
    }
  }

  /** Upcoming classes the changed schedule no longer holds, read inside the transaction. */
  private async stranded(
    manager: EntityManager,
    mentorId: string,
    affectedBy: Affected,
  ): Promise<BookingRecord[]> {
    const upcoming = await this.bookings
      .withManager(manager)
      .upcomingForMentor(mentorId, this.clock.now());
    if (affectedBy === 'every-upcoming') return upcoming;
    const stranded: BookingRecord[] = [];
    for (const booking of upcoming) {
      if (!(await this.availability.stillFits(manager, mentorId, booking))) stranded.push(booking);
    }
    return stranded;
  }
}

function describe(bookings: readonly BookingRecord[]): string {
  const references = bookings.map((booking) => booking.reference).join(', ');
  return bookings.length === 1
    ? `1 booked class (${references})`
    : `${String(bookings.length)} booked classes (${references})`;
}
