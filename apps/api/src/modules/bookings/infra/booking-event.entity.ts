import {
  Column,
  CreateDateColumn,
  Entity,
  ForeignKey,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { BookingEntity } from './booking.entity';

export type BookingEventType =
  'CREATED' | 'CANCELLED' | 'RESCHEDULED_FROM' | 'RESCHEDULED_TO' | 'REASSIGNED' | 'COMPLETED';

/** Append-only audit trail. */
@Entity('booking_events')
@Index('booking_events_booking', ['bookingId', 'id'])
export class BookingEventEntity {
  /** bigint, read as a string. */
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ type: 'uuid' })
  @ForeignKey(() => BookingEntity)
  bookingId: string;

  @Column({ type: 'text' })
  type: BookingEventType;

  /** `parent:<uuid>`, `ops:<os-user>` or `system`. */
  @Column({ type: 'text' })
  actor: string;

  @Column({ type: 'jsonb', default: () => `'{}'` })
  payload: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
