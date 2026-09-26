import { Injectable } from '@nestjs/common';

import { AppConfig } from '../../../config/app-config';
import { type OutboxEvents } from '../domain/outbox-events';
import { type Contact } from '../infra/notification-context.query';

import { durationWords } from './email-wording';
import { FOOTERS, type PlannedEmail } from './planned-email';

/** Password emails (FR-N3). */
@Injectable()
export class AccountEmails {
  constructor(private readonly config: AppConfig) {}

  passwordReset(user: Contact, token: string): PlannedEmail[] {
    const resetUrl = new URL('/reset-password', this.config.webBaseUrl);
    resetUrl.searchParams.set('token', token);
    return [
      {
        template: 'password-reset',
        to: user,
        bookingId: null,
        data: {
          firstName: user.firstName,
          resetUrl: resetUrl.toString(),
          validFor: durationWords(this.config.auth.passwordResetTtlMinutes),
        },
        footer: FOOTERS.account,
      },
    ];
  }

  passwordChanged(
    user: Contact,
    reason: OutboxEvents['PasswordChanged']['reason'],
  ): PlannedEmail[] {
    return [
      {
        template: 'password-changed',
        to: user,
        bookingId: null,
        data: {
          firstName: user.firstName,
          wasReset: reason === 'RESET',
          forgotUrl: `${this.config.webBaseUrl}/forgot-password`,
        },
        footer: FOOTERS.account,
      },
    ];
  }
}
