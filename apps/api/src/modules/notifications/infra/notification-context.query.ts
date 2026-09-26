import { type EntityManager } from 'typeorm';

import { type BookingStatus } from '@app/contracts';
import { fromDate, type Temporal } from '@app/time';

import { firstName } from '../../../common/text/first-name';

export interface Contact {
  firstName: string;
  fullName: string;
  email: string;
  /** Zone the person reads times in: parent profile zone or mentor zone (A-11). */
  timezone: string;
}

export interface MentorContact extends Contact {
  id: string;
}

/** Current state of a booking and everyone on it, read when the email is sent (docs/03 §7.2). */
export interface BookingContext {
  id: string;
  reference: string;
  status: BookingStatus;
  cancelledBy: 'PARENT' | 'OPS' | null;
  startsAt: Temporal.Instant;
  endsAt: Temporal.Instant;
  icsSequence: number;
  parentJoinToken: string;
  mentorJoinToken: string;
  parent: Contact;
  child: { firstName: string; age: number };
  mentor: MentorContact;
}

interface BookingRow {
  id: string;
  reference: string;
  status: BookingStatus;
  cancelled_by: 'PARENT' | 'OPS' | null;
  starts_at: Date;
  ends_at: Date;
  ics_sequence: number;
  parent_join_token: string;
  mentor_join_token: string;
  parent_name: string;
  parent_email: string;
  parent_timezone: string;
  child_first_name: string;
  child_age: number;
  mentor_id: string;
  mentor_name: string;
  mentor_email: string;
  mentor_timezone: string;
}

interface PersonRow {
  id: string;
  full_name: string;
  email: string;
  timezone: string;
}

/** Read model joining a booking with its parent, child and mentor. */
export class NotificationContextQuery {
  constructor(private readonly manager: EntityManager) {}

  async booking(id: string): Promise<BookingContext | null> {
    const rows = await this.manager.query<BookingRow[]>(
      `SELECT b.id, b.reference, b.status, b.cancelled_by, b.starts_at, b.ends_at,
              b.ics_sequence, b.parent_join_token, b.mentor_join_token,
              u.full_name AS parent_name, u.email AS parent_email, u.timezone AS parent_timezone,
              s.first_name AS child_first_name, s.age AS child_age,
              m.id AS mentor_id, m.full_name AS mentor_name, m.email AS mentor_email,
              m.timezone AS mentor_timezone
         FROM bookings b
         JOIN users u ON u.id = b.parent_id
         JOIN students s ON s.id = b.student_id
         JOIN mentors m ON m.id = b.mentor_id
        WHERE b.id = $1`,
      [id],
    );
    const row = rows[0];
    if (row === undefined) return null;
    return {
      id: row.id,
      reference: row.reference,
      status: row.status,
      cancelledBy: row.cancelled_by,
      startsAt: fromDate(row.starts_at),
      endsAt: fromDate(row.ends_at),
      icsSequence: row.ics_sequence,
      parentJoinToken: row.parent_join_token,
      mentorJoinToken: row.mentor_join_token,
      parent: contact(row.parent_name, row.parent_email, row.parent_timezone),
      child: { firstName: row.child_first_name, age: row.child_age },
      mentor: {
        id: row.mentor_id,
        ...contact(row.mentor_name, row.mentor_email, row.mentor_timezone),
      },
    };
  }

  async mentor(id: string): Promise<MentorContact | null> {
    const rows = await this.manager.query<PersonRow[]>(
      'SELECT id, full_name, email, timezone FROM mentors WHERE id = $1',
      [id],
    );
    const row = rows[0];
    return row === undefined
      ? null
      : { id: row.id, ...contact(row.full_name, row.email, row.timezone) };
  }

  async user(id: string): Promise<Contact | null> {
    const rows = await this.manager.query<PersonRow[]>(
      'SELECT id, full_name, email, timezone FROM users WHERE id = $1',
      [id],
    );
    const row = rows[0];
    return row === undefined ? null : contact(row.full_name, row.email, row.timezone);
  }
}

function contact(fullName: string, email: string, timezone: string): Contact {
  return { firstName: firstName(fullName), fullName, email, timezone };
}
