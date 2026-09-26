import { Injectable, Logger } from '@nestjs/common';

import { Clock } from '../../../common/clock/clock';
import { maskEmail } from '../../../common/logging/redaction';
import { AppConfig } from '../../../config/app-config';
import { scrubPayload } from '../domain/outbox-events';
import { afterFailure } from '../domain/retry-policy';
import { EmailDeliveriesRepository } from '../infra/email-deliveries.repository';
import { type ClaimedMessage, OutboxQueueRepository } from '../infra/outbox-queue.repository';
import { EmailRenderer } from '../mail/email-renderer';
import { MailTransport } from '../mail/mail-transport';

import { NotificationPlanner, PermanentFailure } from './notification-planner';
import { type PlannedEmail } from './planned-email';

/** Messages claimed per poll (docs/03 §7.1). */
export const RELAY_BATCH_SIZE = 20;
/** A claim older than this belongs to a worker that died (docs/03 §7.1). */
const STUCK_AFTER_MINUTES = 5;
/** Stored error text is for ops triage, not a stack dump. */
const MAX_ERROR_LENGTH = 1000;

export interface BatchResult {
  claimed: number;
  done: number;
  retried: number;
  dead: number;
}

/**
 * Worker side of the outbox (ADR 0005): claim due messages, send their emails
 * once each, then mark them DONE or back off. Safe with several workers.
 */
@Injectable()
export class OutboxRelay {
  private readonly logger = new Logger(OutboxRelay.name);

  constructor(
    private readonly queue: OutboxQueueRepository,
    private readonly deliveries: EmailDeliveriesRepository,
    private readonly planner: NotificationPlanner,
    private readonly renderer: EmailRenderer,
    private readonly transport: MailTransport,
    private readonly config: AppConfig,
    private readonly clock: Clock,
  ) {}

  /** Handles one batch of due messages, one after another. */
  async runBatch(): Promise<BatchResult> {
    const messages = await this.queue.claimDue(RELAY_BATCH_SIZE, this.clock.now());
    const result: BatchResult = { claimed: messages.length, done: 0, retried: 0, dead: 0 };
    for (const message of messages) {
      result[await this.process(message)] += 1;
    }
    return result;
  }

  /** Requeues messages whose worker stopped mid-way (the reaper). */
  async releaseStuck(): Promise<void> {
    const cutoff = this.clock.now().subtract({ minutes: STUCK_AFTER_MINUTES });
    const { released, dead } = await this.queue.releaseStuck(
      cutoff,
      this.config.outbox.maxAttempts,
    );
    if (released + dead > 0) this.logger.warn({ released, dead }, 'Requeued stuck outbox messages');
  }

  private async process(message: ClaimedMessage): Promise<'done' | 'retried' | 'dead'> {
    const log = { messageId: message.id, type: message.type, attempt: message.attempts + 1 };
    try {
      const emails = await this.planner.plan(message.type, message.payload);
      for (const email of emails) await this.deliver(message, email);
      await this.queue.complete(
        message,
        scrubPayload(message.type, message.payload),
        this.clock.now(),
      );
      this.logger.log({ ...log, emails: emails.length }, 'Outbox message handled');
      return 'done';
    } catch (error) {
      const reason = describe(error);
      const decision =
        error instanceof PermanentFailure
          ? ({ kind: 'dead' } as const)
          : afterFailure(message.attempts + 1, this.config.outbox.maxAttempts);
      if (decision.kind === 'dead') {
        await this.queue.markDead(
          message,
          reason,
          scrubPayload(message.type, message.payload),
          this.clock.now(),
        );
        this.logger.error({ ...log, reason }, 'Outbox message is dead');
        return 'dead';
      }
      await this.queue.retryLater(
        message,
        reason,
        this.clock.now().add({ minutes: decision.delayMinutes }),
      );
      this.logger.warn(
        { ...log, reason, retryInMinutes: decision.delayMinutes },
        'Outbox message failed',
      );
      return 'retried';
    }
  }

  /** Sends one email unless an earlier attempt already did (FR-N4). */
  private async deliver(message: ClaimedMessage, email: PlannedEmail): Promise<void> {
    const key = {
      outboxMessageId: message.id,
      template: email.template,
      recipientEmail: email.to.email,
    };
    if (await this.deliveries.wasSent(key)) return;
    const rendered = this.renderer.render(email.template, email.data, email.footer);
    const { messageId } = await this.transport.send({
      to: { name: email.to.fullName, email: email.to.email },
      ...rendered,
      ...(email.calendar === undefined ? {} : { calendar: email.calendar }),
      ...(email.attachments === undefined ? {} : { attachments: email.attachments }),
    });
    await this.deliveries.recordSent({
      ...key,
      recipientTimezone: email.to.timezone,
      bookingId: email.bookingId,
      providerMessageId: messageId,
      sentAt: this.clock.now(),
    });
    this.logger.log(
      { messageId: message.id, template: email.template, to: maskEmail(email.to.email) },
      'Email sent',
    );
  }
}

const EMAIL_ADDRESS = /[^\s<>"'@]+@[^\s<>"']+/g;

/** Error text for last_error and logs; SMTP replies can quote the recipient, so mask it. */
function describe(error: unknown): string {
  const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return text.replace(EMAIL_ADDRESS, maskEmail).slice(0, MAX_ERROR_LENGTH);
}
