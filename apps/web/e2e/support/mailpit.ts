import { expect } from '@playwright/test';

const MAILPIT = process.env.E2E_MAILPIT ?? 'http://localhost:8025/api/v1';

export interface Mail {
  ID: string;
  Subject: string;
  To: { Address: string }[];
  Text: string;
}

interface Summary {
  ID: string;
  Subject: string;
  To: { Address: string }[];
}

/** Waits for the worker to deliver a message matching a Mailpit search, then returns it in full. */
export async function waitForMail(
  query: string,
  match: (mail: Summary) => boolean = () => true,
): Promise<Mail> {
  let found: Summary | undefined;
  await expect
    .poll(
      async () => {
        const response = await fetch(`${MAILPIT}/search?query=${encodeURIComponent(query)}`);
        const body = (await response.json()) as { messages: Summary[] };
        found = body.messages.find(match);
        return Boolean(found);
      },
      { timeout: 20_000, message: `email matching ${query}` },
    )
    .toBe(true);
  const response = await fetch(`${MAILPIT}/message/${found!.ID}`);
  return (await response.json()) as Mail;
}
