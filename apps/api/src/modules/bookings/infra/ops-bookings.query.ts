import { type EntityManager } from 'typeorm';

import { type BookingStatus } from '@app/contracts';
import { fromDate, type Temporal, toDate } from '@app/time';

/** One line of the ops booking list (docs/03 §10). */
export interface OpsBookingLine {
  id: string;
  reference: string;
  status: BookingStatus;
  startsAt: Temporal.Instant;
  endsAt: Temporal.Instant;
  parentName: string;
  parentEmail: string;
  /** The parent's current profile zone (A-11). */
  parentTimezone: string;
  childFirstName: string;
  childAge: number;
  mentorName: string;
  mentorEmail: string;
}

export interface OpsBookingFilter {
  from: Temporal.Instant;
  to: Temporal.Instant;
  mentorEmail?: string;
  status?: BookingStatus;
}

interface OpsBookingRow {
  id: string;
  reference: string;
  status: BookingStatus;
  starts_at: Date;
  ends_at: Date;
  parent_name: string;
  parent_email: string;
  parent_timezone: string;
  child_first_name: string;
  child_age: number;
  mentor_name: string;
  mentor_email: string;
}

const SELECT = `
  SELECT b.id, b.reference, b.status, b.starts_at, b.ends_at,
         u.full_name AS parent_name, u.email AS parent_email, u.timezone AS parent_timezone,
         s.first_name AS child_first_name, s.age AS child_age,
         m.full_name AS mentor_name, m.email AS mentor_email
    FROM bookings b
    JOIN users u ON u.id = b.parent_id
    JOIN students s ON s.id = b.student_id
    JOIN mentors m ON m.id = b.mentor_id`;

/** Read model for the ops CLI: bookings with parent, child and mentor. */
export class OpsBookingsQuery {
  constructor(private readonly manager: EntityManager) {}

  /** Classes starting in `[from, to)`, in start order. */
  async list(filter: OpsBookingFilter): Promise<OpsBookingLine[]> {
    const rows = await this.manager.query<OpsBookingRow[]>(
      `${SELECT}
        WHERE b.starts_at >= $1 AND b.starts_at < $2
          AND ($3::citext IS NULL OR m.email = $3)
          AND ($4::text IS NULL OR b.status = $4)
        ORDER BY b.starts_at, b.reference`,
      [toDate(filter.from), toDate(filter.to), filter.mentorEmail ?? null, filter.status ?? null],
    );
    return rows.map(toLine);
  }

  async byReference(reference: string): Promise<OpsBookingLine | null> {
    const rows = await this.manager.query<OpsBookingRow[]>(`${SELECT} WHERE b.reference = $1`, [
      reference.toUpperCase(),
    ]);
    const row = rows[0];
    return row === undefined ? null : toLine(row);
  }
}

function toLine(row: OpsBookingRow): OpsBookingLine {
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    startsAt: fromDate(row.starts_at),
    endsAt: fromDate(row.ends_at),
    parentName: row.parent_name,
    parentEmail: row.parent_email,
    parentTimezone: row.parent_timezone,
    childFirstName: row.child_first_name,
    childAge: row.child_age,
    mentorName: row.mentor_name,
    mentorEmail: row.mentor_email,
  };
}
