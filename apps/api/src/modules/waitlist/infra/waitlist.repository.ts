import { type EntityManager } from 'typeorm';

import { fromDate, type Temporal, toDate } from '@app/time';

import { type WaitlistStatus } from './waitlist-entry.entity';

export interface WaitlistEntry {
  id: string;
  userId: string | null;
  fullName: string;
  email: string;
  timezone: string;
  preferredTimes: string | null;
  status: WaitlistStatus;
  createdAt: Temporal.Instant;
}

export interface NewWaitlistEntry {
  userId: string | null;
  fullName: string;
  email: string;
  timezone: string;
  preferredTimes: string | null;
  createdAt: Temporal.Instant;
}

interface WaitlistRow {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string;
  timezone: string;
  preferred_times: string | null;
  status: WaitlistStatus;
  created_at: Date;
}

const COLUMNS = 'id, user_id, full_name, email, timezone, preferred_times, status, created_at';

/** Demand captured when the horizon is full (FR-W1). */
export class WaitlistRepository {
  constructor(private readonly manager: EntityManager) {}

  /**
   * Adds an open entry, or returns the one this email already has: the
   * partial unique index makes concurrent duplicates collapse into one row.
   */
  async addOpen(
    entry: NewWaitlistEntry,
    retried = false,
  ): Promise<{ entry: WaitlistEntry; created: boolean }> {
    const inserted = await this.manager.query<WaitlistRow[]>(
      `INSERT INTO waitlist_entries (user_id, full_name, email, timezone, preferred_times, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) WHERE status = 'OPEN' DO NOTHING
       RETURNING ${COLUMNS}`,
      [
        entry.userId,
        entry.fullName,
        entry.email,
        entry.timezone,
        entry.preferredTimes,
        toDate(entry.createdAt),
      ],
    );
    const created = inserted[0];
    if (created !== undefined) return { entry: toEntry(created), created: true };
    const existing = await this.manager.query<WaitlistRow[]>(
      `SELECT ${COLUMNS} FROM waitlist_entries WHERE email = $1 AND status = 'OPEN'`,
      [entry.email],
    );
    const open = existing[0];
    // The open entry was closed between the two statements: add a fresh one, once.
    if (open === undefined && !retried) return this.addOpen(entry, true);
    if (open === undefined) throw new Error('Waitlist entry changed concurrently');
    return { entry: toEntry(open), created: false };
  }

  async list(status: WaitlistStatus | null): Promise<WaitlistEntry[]> {
    const rows = await this.manager.query<WaitlistRow[]>(
      `SELECT ${COLUMNS} FROM waitlist_entries
        WHERE $1::text IS NULL OR status = $1 ORDER BY created_at, id`,
      [status],
    );
    return rows.map(toEntry);
  }

  /** Moves an entry on (OPEN -> CONTACTED -> CLOSED); false when there is no such entry. */
  async mark(id: string, status: WaitlistStatus): Promise<boolean> {
    const [, affected] = await this.manager.query<[unknown, number]>(
      'UPDATE waitlist_entries SET status = $2 WHERE id = $1',
      [id, status],
    );
    return affected === 1;
  }
}

function toEntry(row: WaitlistRow): WaitlistEntry {
  return {
    id: row.id,
    userId: row.user_id,
    fullName: row.full_name,
    email: row.email,
    timezone: row.timezone,
    preferredTimes: row.preferred_times,
    status: row.status,
    createdAt: fromDate(row.created_at),
  };
}
