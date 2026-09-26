import { type EntityManager, In } from 'typeorm';

import { fromDate, type Temporal } from '@app/time';

import { BookingEntity } from './booking.entity';

export interface UpcomingTrial {
  bookingId: string;
  start: Temporal.Instant;
}

/** Read model for other modules: each child's confirmed trial (at most one, by index). */
export class UpcomingTrialsQuery {
  constructor(private readonly manager: EntityManager) {}

  withManager(manager: EntityManager): UpcomingTrialsQuery {
    return new UpcomingTrialsQuery(manager);
  }

  async byStudent(studentIds: readonly string[]): Promise<Map<string, UpcomingTrial>> {
    if (studentIds.length === 0) return new Map();
    const rows = await this.manager.find(BookingEntity, {
      select: { id: true, studentId: true, startsAt: true },
      where: { studentId: In([...studentIds]), status: 'CONFIRMED' },
    });
    return new Map(
      rows.map((row) => [row.studentId, { bookingId: row.id, start: fromDate(row.startsAt) }]),
    );
  }
}
