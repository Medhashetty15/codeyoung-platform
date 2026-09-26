import { type EntityManager } from 'typeorm';

import { type BookingStatus, type ClassroomRole } from '@app/contracts';
import { fromDate, type Temporal } from '@app/time';

import { firstName } from '../../../common/text/first-name';

export interface ClassroomRecord {
  role: ClassroomRole;
  status: BookingStatus;
  startsAt: Temporal.Instant;
  endsAt: Temporal.Instant;
  childFirstName: string;
  mentorFirstName: string;
  parentFirstName: string;
  /** Parent: current profile zone (A-11); mentor: the mentor's zone. */
  timezone: string;
}

interface ClassroomRow {
  role: ClassroomRole;
  status: BookingStatus;
  starts_at: Date;
  ends_at: Date;
  child_first_name: string;
  mentor_name: string;
  parent_name: string;
  timezone: string;
}

/** The booking behind a join token, seen by whoever holds it (docs/03 §8). */
export class ClassroomQuery {
  constructor(private readonly manager: EntityManager) {}

  async byJoinToken(token: string): Promise<ClassroomRecord | null> {
    const rows = await this.manager.query<ClassroomRow[]>(
      `SELECT CASE WHEN b.parent_join_token = $1 THEN 'PARENT' ELSE 'MENTOR' END AS role,
              b.status, b.starts_at, b.ends_at,
              s.first_name AS child_first_name, m.full_name AS mentor_name,
              u.full_name AS parent_name,
              CASE WHEN b.parent_join_token = $1 THEN u.timezone ELSE m.timezone END AS timezone
         FROM bookings b
         JOIN students s ON s.id = b.student_id
         JOIN mentors m ON m.id = b.mentor_id
         JOIN users u ON u.id = b.parent_id
        WHERE b.parent_join_token = $1 OR b.mentor_join_token = $1`,
      [token],
    );
    const row = rows[0];
    if (row === undefined) return null;
    return {
      role: row.role,
      status: row.status,
      startsAt: fromDate(row.starts_at),
      endsAt: fromDate(row.ends_at),
      childFirstName: row.child_first_name,
      mentorFirstName: firstName(row.mentor_name),
      parentFirstName: firstName(row.parent_name),
      timezone: row.timezone,
    };
  }
}
