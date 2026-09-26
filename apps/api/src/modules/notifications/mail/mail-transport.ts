import { type Mailbox } from '../../../config/app-config';

/** A calendar invitation sent as a text/calendar alternative plus an .ics attachment. */
export interface MailCalendar {
  method: 'REQUEST' | 'CANCEL';
  filename: string;
  content: string;
}

export interface MailAttachment {
  filename: string;
  content: string;
  contentType: string;
}

export interface OutgoingMail {
  to: Mailbox;
  subject: string;
  html: string;
  text: string;
  calendar?: MailCalendar;
  attachments?: readonly MailAttachment[];
}

/** Sends one email; resolves once the provider accepted it (docs/03 §7.4). */
export abstract class MailTransport {
  abstract send(mail: OutgoingMail): Promise<{ messageId: string }>;
}
