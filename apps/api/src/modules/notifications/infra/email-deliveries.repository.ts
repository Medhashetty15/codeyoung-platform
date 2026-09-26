import { type EntityManager } from 'typeorm';

import { type Temporal, toDate } from '@app/time';

export interface DeliveryKey {
  outboxMessageId: string;
  template: string;
  recipientEmail: string;
}

export interface SentDelivery extends DeliveryKey {
  recipientTimezone: string;
  bookingId: string | null;
  providerMessageId: string;
  sentAt: Temporal.Instant;
}

/** One row per email of a message, so a retry never re-sends a delivered one (FR-N4). */
export class EmailDeliveriesRepository {
  constructor(private readonly manager: EntityManager) {}

  async wasSent(key: DeliveryKey): Promise<boolean> {
    const rows = await this.manager.query<unknown[]>(
      `SELECT 1 FROM email_deliveries
        WHERE outbox_message_id = $1 AND template = $2 AND recipient_email = $3
          AND sent_at IS NOT NULL`,
      [key.outboxMessageId, key.template, key.recipientEmail],
    );
    return rows.length > 0;
  }

  async recordSent(delivery: SentDelivery): Promise<void> {
    await this.manager.query(
      `INSERT INTO email_deliveries (outbox_message_id, template, recipient_email,
         recipient_timezone, booking_id, provider_message_id, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (outbox_message_id, template, recipient_email)
       DO UPDATE SET provider_message_id = EXCLUDED.provider_message_id,
                     sent_at = EXCLUDED.sent_at`,
      [
        delivery.outboxMessageId,
        delivery.template,
        delivery.recipientEmail,
        delivery.recipientTimezone,
        delivery.bookingId,
        delivery.providerMessageId,
        toDate(delivery.sentAt),
      ],
    );
  }
}
