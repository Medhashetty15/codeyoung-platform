import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';

import { AppConfig } from '../../../config/app-config';

import { MailTransport, type OutgoingMail } from './mail-transport';

const SECOND_MS = 1000;

/** SMTP via Nodemailer: Mailpit locally, SES or SendGrid SMTP in production. */
@Injectable()
export class SmtpMailTransport extends MailTransport implements OnApplicationShutdown {
  private readonly transporter: Transporter;

  constructor(config: AppConfig) {
    super();
    const { smtpUrl, from } = config.mail;
    const url = new URL(smtpUrl);
    this.transporter = createTransport(
      {
        host: url.hostname,
        port: Number(url.port || (url.protocol === 'smtps:' ? 465 : 587)),
        secure: url.protocol === 'smtps:',
        ...(url.username === ''
          ? {}
          : {
              auth: {
                user: decodeURIComponent(url.username),
                pass: decodeURIComponent(url.password),
              },
            }),
        // Fail fast so a stuck provider shows up as a retry, not a hung worker.
        connectionTimeout: 10 * SECOND_MS,
        greetingTimeout: 10 * SECOND_MS,
        socketTimeout: 30 * SECOND_MS,
      },
      { from: { name: from.name, address: from.email } },
    );
  }

  async send(mail: OutgoingMail): Promise<{ messageId: string }> {
    const info = await this.transporter.sendMail({
      to: { name: mail.to.name, address: mail.to.email },
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      ...(mail.calendar === undefined
        ? {}
        : {
            icalEvent: {
              method: mail.calendar.method,
              filename: mail.calendar.filename,
              content: mail.calendar.content,
            },
          }),
      attachments: (mail.attachments ?? []).map((attachment) => ({ ...attachment })),
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    return { messageId: info.messageId };
  }

  /** Last shutdown phase, after the job scheduler drained in-flight sends. */
  onApplicationShutdown(): void {
    this.transporter.close();
  }
}
