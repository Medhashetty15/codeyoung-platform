import { Brackets, type EntityManager } from 'typeorm';

import { fromDate, type LocalDate, type Temporal, toDate } from '@app/time';

import { MentorAvailabilityRuleEntity } from './mentor-availability-rule.entity';
import { MentorTimeOffEntity } from './mentor-time-off.entity';
import { MentorEntity } from './mentor.entity';

export interface MentorRule {
  weekday: number;
  startLocal: string;
  endLocal: string;
  effectiveFrom: LocalDate;
  effectiveTo: LocalDate | null;
}

export interface MentorScheduleRecord {
  id: string;
  timezone: string;
  maxTrialsPerDay: number;
  rules: MentorRule[];
  timeOff: { startsAt: Temporal.Instant; endsAt: Temporal.Instant }[];
}

export interface ScheduleWindow {
  /** Instants the caller cares about. */
  from: Temporal.Instant;
  to: Temporal.Instant;
  /** Mentor-local dates the rules must cover (range padded by a day on each side). */
  firstDate: LocalDate;
  lastDate: LocalDate;
}

/** Read model for the slot engine: active mentors with their rules and time off. */
export class MentorScheduleQuery {
  constructor(private readonly manager: EntityManager) {}

  withManager(manager: EntityManager): MentorScheduleQuery {
    return new MentorScheduleQuery(manager);
  }

  async activeSchedules(
    window: ScheduleWindow,
    mentorIds?: readonly string[],
  ): Promise<MentorScheduleRecord[]> {
    const query = this.manager
      .createQueryBuilder(MentorEntity, 'mentor')
      .where('mentor.isActive = true')
      .orderBy('mentor.id');
    if (mentorIds !== undefined) query.andWhere('mentor.id IN (:...mentorIds)', { mentorIds });
    const mentors = await query.getMany();
    if (mentors.length === 0) return [];
    const ids = mentors.map((mentor) => mentor.id);

    const rules = await this.manager
      .createQueryBuilder(MentorAvailabilityRuleEntity, 'rule')
      .where('rule.mentorId IN (:...ids)', { ids })
      .andWhere('rule.effectiveFrom <= :lastDate', { lastDate: window.lastDate })
      .andWhere(
        new Brackets((clause) => {
          clause
            .where('rule.effectiveTo IS NULL')
            .orWhere('rule.effectiveTo >= :firstDate', { firstDate: window.firstDate });
        }),
      )
      .getMany();
    const timeOff = await this.manager
      .createQueryBuilder(MentorTimeOffEntity, 'off')
      .where('off.mentorId IN (:...ids)', { ids })
      .andWhere('off.startsAt < :to AND off.endsAt > :from', {
        from: toDate(window.from),
        to: toDate(window.to),
      })
      .getMany();

    return mentors.map((mentor) => ({
      id: mentor.id,
      timezone: mentor.timezone,
      maxTrialsPerDay: mentor.maxTrialsPerDay,
      rules: rules
        .filter((rule) => rule.mentorId === mentor.id)
        .map((rule) => ({
          weekday: rule.weekday,
          startLocal: rule.startLocal,
          endLocal: rule.endLocal,
          effectiveFrom: rule.effectiveFrom,
          effectiveTo: rule.effectiveTo,
        })),
      timeOff: timeOff
        .filter((off) => off.mentorId === mentor.id)
        .map((off) => ({ startsAt: fromDate(off.startsAt), endsAt: fromDate(off.endsAt) })),
    }));
  }
}
