import { type EntityManager } from 'typeorm';

import { BookingEventEntity, type BookingEventType } from './booking-event.entity';

/** Append-only audit trail; rows are never updated or deleted. */
export class BookingEventsRepository {
  constructor(private readonly manager: EntityManager) {}

  withManager(manager: EntityManager): BookingEventsRepository {
    return new BookingEventsRepository(manager);
  }

  async append(
    bookingId: string,
    type: BookingEventType,
    actor: string,
    payload: Record<string, unknown> = {},
  ): Promise<void> {
    await this.manager.save(
      this.manager.create(BookingEventEntity, { bookingId, type, actor, payload }),
    );
  }
}
