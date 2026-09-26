import { expect, inject, vi } from 'vitest';

export interface MailPart {
  PartID: string;
  FileName: string;
  ContentType: string;
}

export interface Mail {
  ID: string;
  Subject: string;
  To: { Name: string; Address: string }[];
  Text: string;
  HTML: string;
  Attachments: MailPart[];
  Inline: MailPart[];
}

interface Summary {
  ID: string;
}

async function call(path: string): Promise<Response> {
  const response = await fetch(new URL(path, inject('mailpitUrl')));
  expect(response.ok, `Mailpit ${path}`).toBe(true);
  return response;
}

/**
 * Emails delivered to one address, oldest first. Test files share one Mailpit,
 * so every test addresses its own unique recipients.
 */
export async function mailsTo(address: string): Promise<Mail[]> {
  const query = new URLSearchParams({ query: `to:"${address}"` }).toString();
  const { messages } = (await (await call(`/api/v1/search?${query}`)).json()) as {
    messages: Summary[];
  };
  const mails = await Promise.all(
    messages.map(async ({ ID }) => (await (await call(`/api/v1/message/${ID}`)).json()) as Mail),
  );
  return mails.reverse();
}

/** Waits until `count` emails reached the address (SMTP accept to Mailpit index is async). */
export async function waitForMails(address: string, count: number): Promise<Mail[]> {
  return vi.waitFor(
    async () => {
      const mails = await mailsTo(address);
      expect(mails).toHaveLength(count);
      return mails;
    },
    { timeout: 5000, interval: 50 },
  );
}

/** The decoded .ics parts of an email (invitation alternative and attachments). */
export async function calendarsOf(mail: Mail | undefined): Promise<string[]> {
  if (mail === undefined) throw new Error('expected an email');
  const parts = [...mail.Attachments, ...mail.Inline].filter(
    (part) => part.ContentType.startsWith('text/calendar') || part.FileName.endsWith('.ics'),
  );
  const contents = await Promise.all(
    parts.map(async (part) =>
      (await call(`/api/v1/message/${mail.ID}/part/${part.PartID}`)).text(),
    ),
  );
  // Unfold RFC 5545 continuation lines so assertions see whole properties.
  return [...new Set(contents.map((content) => content.replace(/\r\n[ \t]/g, '')))];
}
