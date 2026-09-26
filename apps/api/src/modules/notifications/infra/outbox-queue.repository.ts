import { type EntityManager } from 'typeorm';

import { fromDate, type Temporal, toDate } from '@app/time';

export interface ClaimedMessage {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  /** Attempts before this one. */
  attempts: number;
  /** Fencing value: finishing only applies while the claim is still ours. */
  lockedAt: Temporal.Instant;
}

interface ClaimedRow {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  attempts: number;
  run_after: Date;
  locked_at: Date;
}

/** The worker's side of the transactional outbox (docs/03 §7.1, ADR 0005). */
export class OutboxQueueRepository {
  constructor(private readonly manager: EntityManager) {}

  /**
   * Claims up to `limit` due messages, oldest first. SKIP LOCKED lets several
   * workers poll at once without ever claiming the same row.
   */
  async claimDue(limit: number, now: Temporal.Instant): Promise<ClaimedMessage[]> {
    const [rows] = await this.manager.query<[ClaimedRow[], number]>(
      `UPDATE outbox_messages SET status = 'PROCESSING', locked_at = $1
        WHERE id IN (
          SELECT id FROM outbox_messages
           WHERE status = 'PENDING' AND run_after <= $1
           ORDER BY run_after, id
           LIMIT $2
           FOR UPDATE SKIP LOCKED)
        RETURNING id, type, payload, attempts, run_after, locked_at`,
      [toDate(now), limit],
    );
    return rows
      .sort(
        (a, b) =>
          a.run_after.getTime() - b.run_after.getTime() || Number(BigInt(a.id) - BigInt(b.id)),
      )
      .map((row) => ({
        id: row.id,
        type: row.type,
        payload: row.payload,
        attempts: row.attempts,
        lockedAt: fromDate(row.locked_at),
      }));
  }

  /** Marks a handled message DONE and stores its payload without secrets. */
  async complete(
    message: ClaimedMessage,
    payload: Record<string, unknown>,
    now: Temporal.Instant,
  ): Promise<boolean> {
    return this.finish(
      message,
      `status = 'DONE', attempts = attempts + 1, processed_at = $3, last_error = NULL,
       payload = $4`,
      [toDate(now), JSON.stringify(payload)],
    );
  }

  /** Puts a failed message back in the queue until `runAfter`. */
  async retryLater(
    message: ClaimedMessage,
    error: string,
    runAfter: Temporal.Instant,
  ): Promise<boolean> {
    return this.finish(
      message,
      `status = 'PENDING', attempts = attempts + 1, run_after = $3, last_error = $4`,
      [toDate(runAfter), error],
    );
  }

  /** Gives up on a message; ops can inspect and replay it (docs/03 §10). */
  async markDead(
    message: ClaimedMessage,
    error: string,
    payload: Record<string, unknown>,
    now: Temporal.Instant,
  ): Promise<boolean> {
    return this.finish(
      message,
      `status = 'DEAD', attempts = attempts + 1, processed_at = $3, last_error = $4,
       payload = $5`,
      [toDate(now), error, JSON.stringify(payload)],
    );
  }

  /**
   * Returns messages stuck in PROCESSING (their worker died) to the queue. The
   * lost run counts as an attempt, so a message that crashes every worker still
   * ends DEAD instead of looping forever.
   */
  async releaseStuck(
    olderThan: Temporal.Instant,
    maxAttempts: number,
  ): Promise<{ released: number; dead: number }> {
    const [rows] = await this.manager.query<[{ status: string }[], number]>(
      `UPDATE outbox_messages
          SET attempts = attempts + 1,
              status = CASE WHEN attempts + 1 >= $2 THEN 'DEAD' ELSE 'PENDING' END,
              locked_at = NULL,
              last_error = 'Processing did not finish (worker stopped)'
        WHERE status = 'PROCESSING' AND locked_at < $1
        RETURNING status`,
      [toDate(olderThan), maxAttempts],
    );
    const dead = rows.filter((row) => row.status === 'DEAD').length;
    return { released: rows.length - dead, dead };
  }

  private async finish(
    message: ClaimedMessage,
    assignments: string,
    values: unknown[],
  ): Promise<boolean> {
    const [, affected] = await this.manager.query<[unknown, number]>(
      `UPDATE outbox_messages SET ${assignments}, locked_at = NULL
        WHERE id = $1 AND status = 'PROCESSING' AND locked_at = $2`,
      [message.id, toDate(message.lockedAt), ...values],
    );
    return affected === 1;
  }
}
