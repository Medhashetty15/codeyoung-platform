import { type EntityManager } from 'typeorm';

import { type Temporal, toDate } from '@app/time';

export interface AccountToDelete {
  userId: string;
  fullName: string;
  children: number;
  bookings: number;
  /** Confirmed classes that have not started: they must be cancelled first. */
  upcomingReferences: string[];
}

export interface Anonymised {
  sessions: number;
  waitlistEntries: number;
  deliveries: number;
  pendingMessages: number;
}

/** Raw writes of an account deletion request (A-14): the person goes, booking history stays. */
export class AccountDeletionRepository {
  constructor(private readonly manager: EntityManager) {}

  withManager(manager: EntityManager): AccountDeletionRepository {
    return new AccountDeletionRepository(manager);
  }

  /** Row-locks the account and describes what it holds; null when there is none. */
  async lockByEmail(email: string, now: Temporal.Instant): Promise<AccountToDelete | null> {
    const [user] = await this.manager.query<{ id: string; full_name: string }[]>(
      'SELECT id, full_name FROM users WHERE email = $1 FOR UPDATE',
      [email],
    );
    if (user === undefined) return null;
    const [counts] = await this.manager.query<{ children: number; bookings: number }[]>(
      `SELECT (SELECT count(*) FROM students WHERE parent_id = $1)::int AS children,
              (SELECT count(*) FROM bookings WHERE parent_id = $1)::int AS bookings`,
      [user.id],
    );
    const upcoming = await this.manager.query<{ reference: string }[]>(
      `SELECT reference FROM bookings
        WHERE parent_id = $1 AND status = 'CONFIRMED' AND starts_at > $2 ORDER BY starts_at`,
      [user.id, toDate(now)],
    );
    return {
      userId: user.id,
      fullName: user.full_name,
      children: counts?.children ?? 0,
      bookings: counts?.bookings ?? 0,
      upcomingReferences: upcoming.map((row) => row.reference),
    };
  }

  /**
   * Replaces every personal detail: name, email, phone and password of the
   * parent, the children's names; signs out everywhere; drops waitlist
   * entries and pending account emails; rewrites delivery records to the
   * placeholder address. Bookings keep their rows for mentor history.
   */
  async anonymise(
    account: { userId: string; oldEmail: string; placeholderEmail: string; passwordHash: string },
    now: Temporal.Instant,
  ): Promise<Anonymised> {
    const { userId, oldEmail, placeholderEmail } = account;
    await this.manager.query(
      `UPDATE users SET email = $2, full_name = 'Deleted account', phone = NULL,
              password_hash = $3, failed_login_attempts = 0, locked_until = NULL,
              failed_login_window_started_at = NULL, updated_at = $4
        WHERE id = $1`,
      [userId, placeholderEmail, account.passwordHash, toDate(now)],
    );
    await this.manager.query(
      `WITH numbered AS (
         SELECT id, row_number() OVER (ORDER BY created_at, id) AS n
           FROM students WHERE parent_id = $1)
       UPDATE students s SET first_name = 'Child ' || numbered.n
         FROM numbered WHERE s.id = numbered.id`,
      [userId],
    );
    const [, sessions] = await this.manager.query<[unknown, number]>(
      'DELETE FROM auth_sessions WHERE user_id = $1',
      [userId],
    );
    await this.manager.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);
    const [, waitlistEntries] = await this.manager.query<[unknown, number]>(
      'DELETE FROM waitlist_entries WHERE user_id = $1 OR email = $2',
      [userId, oldEmail],
    );
    const [, deliveries] = await this.manager.query<[unknown, number]>(
      'UPDATE email_deliveries SET recipient_email = $2 WHERE recipient_email = $1',
      [oldEmail, placeholderEmail],
    );
    const [, pendingMessages] = await this.manager.query<[unknown, number]>(
      `UPDATE outbox_messages SET status = 'DONE', processed_at = $2,
              last_error = 'Account deleted before sending'
        WHERE status = 'PENDING' AND payload ->> 'userId' = $1`,
      [userId, toDate(now)],
    );
    return { sessions, waitlistEntries, deliveries, pendingMessages };
  }
}
