import { type EntityManager } from 'typeorm';

import { addDays, fromDate, type LocalDate, type Temporal, toDate } from '@app/time';

import { MentorAvailabilityRuleEntity } from './mentor-availability-rule.entity';
import { MentorTimeOffEntity } from './mentor-time-off.entity';
import { MentorEntity } from './mentor.entity';

export interface MentorProfile {
  id: string;
  fullName: string;
  email: string;
  timezone: string;
  maxTrialsPerDay: number;
  isActive: boolean;
}

export interface MentorOverview extends MentorProfile {
  /** Confirmed classes on the mentor's own "today". */
  classesToday: number;
  /** Confirmed classes that have not started yet. */
  upcomingClasses: number;
}

export interface WeeklyWindow {
  /** ISO weekday, 1 = Monday. */
  weekday: number;
  /** "HH:MM" in the mentor's zone; an end at or before the start crosses midnight. */
  start: string;
  end: string;
}

export interface TimeOff {
  id: string;
  mentorId: string;
  startsAt: Temporal.Instant;
  endsAt: Temporal.Instant;
  reason: string | null;
}

interface OverviewRow {
  id: string;
  full_name: string;
  email: string;
  timezone: string;
  max_trials_per_day: number;
  is_active: boolean;
  classes_today: number;
  upcoming_classes: number;
}

/** Mentor writes for the ops CLI (docs/03 §10); capacity checks live with the callers. */
export class MentorAdminRepository {
  constructor(private readonly manager: EntityManager) {}

  withManager(manager: EntityManager): MentorAdminRepository {
    return new MentorAdminRepository(manager);
  }

  async findByEmail(email: string): Promise<MentorProfile | null> {
    const row = await this.manager.findOneBy(MentorEntity, { email });
    return row && toProfile(row);
  }

  async list(now: Temporal.Instant): Promise<MentorOverview[]> {
    const rows = await this.manager.query<OverviewRow[]>(
      `SELECT m.id, m.full_name, m.email, m.timezone, m.max_trials_per_day, m.is_active,
              count(b.id) FILTER (
                WHERE b.mentor_local_date = ($1::timestamptz AT TIME ZONE m.timezone)::date
              )::int AS classes_today,
              count(b.id) FILTER (WHERE b.starts_at > $1)::int AS upcoming_classes
         FROM mentors m
         LEFT JOIN bookings b ON b.mentor_id = m.id AND b.status = 'CONFIRMED'
        GROUP BY m.id
        ORDER BY m.is_active DESC, m.full_name`,
      [toDate(now)],
    );
    return rows.map((row) => ({
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      timezone: row.timezone,
      maxTrialsPerDay: row.max_trials_per_day,
      isActive: row.is_active,
      classesToday: row.classes_today,
      upcomingClasses: row.upcoming_classes,
    }));
  }

  async insert(mentor: Omit<MentorProfile, 'id' | 'isActive'>): Promise<MentorProfile> {
    const row = await this.manager.save(this.manager.create(MentorEntity, mentor));
    return toProfile(row);
  }

  async update(
    id: string,
    changes: Partial<Pick<MentorProfile, 'timezone' | 'maxTrialsPerDay' | 'isActive'>>,
  ): Promise<void> {
    await this.manager.update(MentorEntity, { id }, changes);
  }

  /**
   * Replaces the weekly windows from `from` on: earlier rules end the day
   * before, rules that would start later are dropped, history stays.
   */
  async replaceWeeklyWindows(
    mentorId: string,
    windows: readonly WeeklyWindow[],
    from: LocalDate,
  ): Promise<void> {
    await this.manager.query(
      `UPDATE mentor_availability_rules SET effective_to = $2
        WHERE mentor_id = $1 AND effective_from < $3
          AND (effective_to IS NULL OR effective_to >= $3)`,
      [mentorId, addDays(from, -1), from],
    );
    await this.manager.query(
      'DELETE FROM mentor_availability_rules WHERE mentor_id = $1 AND effective_from >= $2',
      [mentorId, from],
    );
    if (windows.length === 0) return;
    await this.manager.insert(
      MentorAvailabilityRuleEntity,
      windows.map((window) => ({
        mentorId,
        weekday: window.weekday,
        startLocal: window.start,
        endLocal: window.end,
        effectiveFrom: from,
        effectiveTo: null,
      })),
    );
  }

  async addTimeOff(
    mentorId: string,
    startsAt: Temporal.Instant,
    endsAt: Temporal.Instant,
    reason: string | null,
  ): Promise<string> {
    const row = await this.manager.save(
      this.manager.create(MentorTimeOffEntity, {
        mentorId,
        startsAt: toDate(startsAt),
        endsAt: toDate(endsAt),
        reason,
      }),
    );
    return row.id;
  }

  async findTimeOff(id: string): Promise<TimeOff | null> {
    const row = await this.manager.findOneBy(MentorTimeOffEntity, { id });
    return (
      row && {
        id: row.id,
        mentorId: row.mentorId,
        startsAt: fromDate(row.startsAt),
        endsAt: fromDate(row.endsAt),
        reason: row.reason,
      }
    );
  }

  async removeTimeOff(id: string): Promise<boolean> {
    const result = await this.manager.delete(MentorTimeOffEntity, { id });
    return result.affected === 1;
  }
}

function toProfile(row: MentorEntity): MentorProfile {
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    timezone: row.timezone,
    maxTrialsPerDay: row.maxTrialsPerDay,
    isActive: row.isActive,
  };
}
