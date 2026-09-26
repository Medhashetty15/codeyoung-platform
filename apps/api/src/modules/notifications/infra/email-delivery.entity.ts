import { Column, Entity, ForeignKey, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { BookingEntity } from '../../bookings/infra/booking.entity';

import { OutboxMessageEntity } from './outbox-message.entity';

/** One email per (message, template, recipient); the unique key stops re-sends on retry. */
@Entity('email_deliveries')
@Unique('email_deliveries_outbox_message_id_template_recipient_email_key', [
  'outboxMessageId',
  'template',
  'recipientEmail',
])
export class EmailDeliveryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'bigint' })
  @ForeignKey(() => OutboxMessageEntity)
  outboxMessageId: string;

  @Column({ type: 'text' })
  template: string;

  @Column({ type: 'citext' })
  recipientEmail: string;

  @Column({ type: 'text' })
  recipientTimezone: string;

  @Column({ type: 'uuid', nullable: true })
  @ForeignKey(() => BookingEntity)
  bookingId: string | null;

  @Column({ type: 'text', nullable: true })
  providerMessageId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt: Date | null;
}
