import { type Contact } from '../infra/notification-context.query';
import { type TemplateData } from '../mail/email-renderer';
import { type EmailTemplate } from '../mail/email-templates';
import { type MailAttachment, type MailCalendar } from '../mail/mail-transport';

/** One email a message produces, before rendering; deduplicated per (message, template, recipient). */
export interface PlannedEmail {
  template: EmailTemplate;
  to: Contact;
  bookingId: string | null;
  data: TemplateData;
  footer: string;
  calendar?: MailCalendar;
  attachments?: readonly MailAttachment[];
}

export const FOOTERS = {
  parent: 'You get this email because you booked a free trial class with Codeyoung.',
  mentor: 'You get this email because you teach trial classes with Codeyoung.',
  account: 'You get this email because you have a Codeyoung account.',
} as const;
