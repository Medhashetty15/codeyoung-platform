import { Module } from '@nestjs/common';

import { repositoryProvider } from '../../database/repository-provider';
import { ClassroomModule } from '../classroom/classroom.module';

import { AccountEmails } from './application/account-emails';
import { BookingEmails } from './application/booking-emails';
import { NotificationPlanner } from './application/notification-planner';
import { OutboxRelay } from './application/outbox-relay';
import { EmailDeliveriesRepository } from './infra/email-deliveries.repository';
import { NotificationContextQuery } from './infra/notification-context.query';
import { OutboxQueueRepository } from './infra/outbox-queue.repository';
import { EmailRenderer } from './mail/email-renderer';
import { MailTransport } from './mail/mail-transport';
import { SmtpMailTransport } from './mail/smtp-mail-transport';

/** Outbox relay, templates and SMTP: the worker process only (docs/03 §7). */
@Module({
  imports: [ClassroomModule],
  providers: [
    repositoryProvider(OutboxQueueRepository),
    repositoryProvider(EmailDeliveriesRepository),
    repositoryProvider(NotificationContextQuery),
    EmailRenderer,
    BookingEmails,
    AccountEmails,
    NotificationPlanner,
    OutboxRelay,
    { provide: MailTransport, useClass: SmtpMailTransport },
  ],
  exports: [OutboxRelay],
})
export class NotificationsWorkerModule {}
