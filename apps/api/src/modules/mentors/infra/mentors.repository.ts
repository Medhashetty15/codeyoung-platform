import { type EntityManager, In } from 'typeorm';

import { fromDate, type Temporal, toDate } from '@app/time';

import { MentorEntity } from './mentor.entity';

export interface LockedMentor {
  id: string;
  timezone: string;
  isActive: boolean;
  maxTrialsPerDay: number;
  lastAssignedAt: Temporal.Instant | null;
}

/** Mentor rows for booking writes: the per-mentor lock serialises capacity (docs/03 §3.4). */
export class MentorsRepository {
  constructor(private readonly manager: EntityManager) {}

  withManager(manager: EntityManager): MentorsRepository {
    return new MentorsRepository(manager);
  }

  /** `SELECT ... FOR UPDATE`: every capacity-consuming write for this mentor waits here. */
  async lockById(id: string): Promise<LockedMentor | null> {
    const row = await this.manager.findOne(MentorEntity, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    return (
      row && {
        id: row.id,
        timezone: row.timezone,
        isActive: row.isActive,
        maxTrialsPerDay: row.maxTrialsPerDay,
        lastAssignedAt: row.lastAssignedAt && fromDate(row.lastAssignedAt),
      }
    );
  }

  async touchLastAssigned(id: string, at: Temporal.Instant): Promise<void> {
    await this.manager.update(MentorEntity, { id }, { lastAssignedAt: toDate(at) });
  }

  /** Zone and last assignment of each mentor: inputs of the assignment strategy. */
  async assignmentInfo(
    ids: readonly string[],
  ): Promise<Map<string, { timezone: string; lastAssignedAt: Temporal.Instant | null }>> {
    if (ids.length === 0) return new Map();
    const rows = await this.manager.find(MentorEntity, {
      select: { id: true, timezone: true, lastAssignedAt: true },
      where: { id: In([...ids]) },
    });
    return new Map(
      rows.map((row) => [
        row.id,
        {
          timezone: row.timezone,
          lastAssignedAt: row.lastAssignedAt && fromDate(row.lastAssignedAt),
        },
      ]),
    );
  }

  /** First names only: parents learn their mentor's first name after booking (A-9). */
  async firstNames(ids: readonly string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const rows = await this.manager.find(MentorEntity, {
      select: { id: true, fullName: true },
      where: { id: In([...ids]) },
    });
    return new Map(rows.map((row) => [row.id, firstName(row.fullName)]));
  }
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}
