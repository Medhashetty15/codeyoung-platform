import { Injectable } from '@nestjs/common';

import { localDateOf, type Temporal } from '@app/time';

import { MentorsRepository } from '../../mentors/infra/mentors.repository';
import { type MentorLoad } from '../domain/assignment-strategy';
import { ConfirmedBookingsQuery } from '../infra/confirmed-bookings.query';

const WEEK_HOURS = 7 * 24;

/** Builds the assignment strategy's inputs for the candidates of one slot. */
@Injectable()
export class MentorLoads {
  constructor(
    private readonly mentors: MentorsRepository,
    private readonly bookings: ConfirmedBookingsQuery,
  ) {}

  async forSlot(mentorIds: readonly string[], slotStart: Temporal.Instant): Promise<MentorLoad[]> {
    const info = await this.mentors.assignmentInfo(mentorIds);
    const bookings = await this.bookings.forMentors(
      mentorIds,
      slotStart.subtract({ hours: WEEK_HOURS }),
      slotStart.add({ hours: 48 }),
    );
    return mentorIds.map((mentorId) => {
      const mentor = info.get(mentorId);
      const slotDate = mentor === undefined ? null : localDateOf(slotStart, mentor.timezone);
      const own = bookings.filter((booking) => booking.mentorId === mentorId);
      return {
        mentorId,
        classesThatDay: own.filter((booking) => booking.mentorLocalDate === slotDate).length,
        classesPastWeek: own.filter(
          (booking) => booking.startsAt.epochMilliseconds < slotStart.epochMilliseconds,
        ).length,
        lastAssignedAt: mentor?.lastAssignedAt ?? null,
      };
    });
  }
}
