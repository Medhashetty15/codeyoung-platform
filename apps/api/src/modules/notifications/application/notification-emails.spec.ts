import { beforeAll, describe, expect, it } from 'vitest';

import { Temporal } from '@app/time';

import { type Clock } from '../../../common/clock/clock';
import { AppConfig } from '../../../config/app-config';
import { type MeetingProvider } from '../../classroom/domain/meeting-provider';
import { type BookingContext } from '../infra/notification-context.query';
import { EmailRenderer, type RenderedEmail } from '../mail/email-renderer';
import { EMAIL_TEMPLATES } from '../mail/email-templates';

import { AccountEmails } from './account-emails';
import { BookingEmails } from './booking-emails';
import { type PlannedEmail } from './planned-email';

const config = AppConfig.fromEnv({
  DATABASE_URL: 'postgres://localhost:5433/unit',
  JWT_ACCESS_SECRET: 'unit-test-secret-that-is-at-least-32-bytes',
});
const clock: Clock = { now: () => Temporal.Instant.from('2026-10-23T16:00:00Z') };
const meetings = {
  joinUrl: (token: string) => `http://localhost:5173/class/${token}`,
} as MeetingProvider;

const BOOKING: BookingContext = {
  id: '6f1c2d3e-4a5b-4c6d-8e7f-901a2b3c4d5e',
  reference: 'CY-7K3Q9',
  status: 'CONFIRMED',
  cancelledBy: null,
  startsAt: Temporal.Instant.from('2026-10-24T16:00:00Z'),
  endsAt: Temporal.Instant.from('2026-10-24T17:00:00Z'),
  icsSequence: 0,
  parentJoinToken: 'parent-token',
  mentorJoinToken: 'mentor-token',
  parent: {
    firstName: 'Hannah',
    fullName: 'Hannah Okafor',
    email: 'hannah@example.com',
    timezone: 'Europe/London',
  },
  child: { firstName: 'Leo', age: 9 },
  mentor: {
    id: 'm1',
    firstName: 'Priya',
    fullName: 'Priya Raghavan',
    email: 'priya@codeyoung.dev',
    timezone: 'Asia/Kolkata',
  },
};
const MOVED: BookingContext = {
  ...BOOKING,
  id: '7a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  reference: 'CY-8M4R2',
  startsAt: Temporal.Instant.from('2026-10-25T17:00:00Z'),
  endsAt: Temporal.Instant.from('2026-10-25T18:00:00Z'),
  parentJoinToken: 'new-parent-token',
  mentorJoinToken: 'new-mentor-token',
  mentor: { ...BOOKING.mentor, id: 'm2', firstName: 'Karthik', email: 'karthik@codeyoung.dev' },
};
const PREVIOUS_MENTOR = {
  ...BOOKING.mentor,
  id: 'm0',
  firstName: 'Anika',
  email: 'anika@codeyoung.dev',
};

let renderer: EmailRenderer;
const bookingEmails = new BookingEmails(config, meetings, clock);
const accountEmails = new AccountEmails(config);

beforeAll(() => {
  renderer = new EmailRenderer();
});

function render(email: PlannedEmail): RenderedEmail {
  return renderer.render(email.template, email.data, email.footer);
}

function renderFirst(emails: PlannedEmail[]): RenderedEmail {
  const [email] = emails;
  if (email === undefined) throw new Error('no email planned');
  return render(email);
}

function allEmails(): PlannedEmail[] {
  return [
    ...bookingEmails.confirmed(BOOKING),
    ...bookingEmails.cancelled({ ...BOOKING, status: 'CANCELLED', cancelledBy: 'PARENT' }),
    ...bookingEmails.cancelled({ ...BOOKING, status: 'CANCELLED', cancelledBy: 'OPS' }),
    ...bookingEmails.rescheduled({ ...BOOKING, status: 'RESCHEDULED' }, MOVED),
    ...bookingEmails.reassigned(BOOKING, PREVIOUS_MENTOR),
    ...bookingEmails.reminder(BOOKING),
    ...accountEmails.passwordReset(BOOKING.parent, 'reset-token'),
    ...accountEmails.passwordChanged(BOOKING.parent, 'CHANGED'),
    ...accountEmails.passwordChanged(BOOKING.parent, 'RESET'),
  ];
}

describe('notification emails', () => {
  it('covers every template of docs/03 §7.3', () => {
    expect(new Set(allEmails().map((email) => email.template))).toEqual(new Set(EMAIL_TEMPLATES));
  });

  it('never contains an en or em dash, in any part of any email', () => {
    for (const email of allEmails()) {
      const { subject, html, text } = render(email);
      expect(`${subject}${html}${text}`, email.template).not.toMatch(/[–—]/);
    }
  });

  it('writes times in each recipient zone with the UI wording (PD-06)', () => {
    const [parent, mentor] = bookingEmails.confirmed(BOOKING).map(render);

    expect(parent?.text).toContain(
      'When: Saturday, 24 October 2026, 5:00 to 6:00 PM London time (GMT+1)',
    );
    expect(parent?.subject).toBe("Booked: Leo's trial class on Saturday 24 October");
    expect(mentor?.text).toContain(
      'When: Saturday, 24 October 2026, 9:30 to 10:30 PM Kolkata time (GMT+5:30)',
    );
    expect(mentor?.text).toContain('For the family it is 5:00 to 6:00 PM London time (GMT+1).');
  });

  it('gives each participant their own join link', () => {
    const [parent, mentor] = bookingEmails.confirmed(BOOKING).map(render);

    expect(parent?.text).toContain('http://localhost:5173/class/parent-token');
    expect(parent?.text).not.toContain('mentor-token');
    expect(mentor?.text).toContain('http://localhost:5173/class/mentor-token');
    expect(mentor?.text).not.toContain('parent-token');
  });

  it('attaches an invite, a cancellation, or both for a new time', () => {
    const [confirmed] = bookingEmails.confirmed(BOOKING);
    const [cancelled] = bookingEmails.cancelled({
      ...BOOKING,
      status: 'CANCELLED',
      icsSequence: 1,
    });
    const [moved, movedAway, newMentor] = bookingEmails.rescheduled(
      { ...BOOKING, status: 'RESCHEDULED', icsSequence: 1 },
      MOVED,
    );

    expect(confirmed?.calendar?.method).toBe('REQUEST');
    expect(cancelled?.calendar?.method).toBe('CANCEL');
    expect(cancelled?.calendar?.content).toContain('SEQUENCE:1');
    expect(moved?.calendar?.content).toContain(`UID:${MOVED.id}@codeyoung`);
    expect(moved?.attachments?.[0]?.content).toContain(`UID:${BOOKING.id}@codeyoung`);
    expect(moved?.attachments?.[0]?.content).toContain('METHOD:CANCEL');
    expect(movedAway?.to.email).toBe('priya@codeyoung.dev');
    expect(movedAway?.calendar?.method).toBe('CANCEL');
    expect(newMentor?.to.email).toBe('karthik@codeyoung.dev');
    expect(newMentor?.calendar?.method).toBe('REQUEST');
  });

  it('says whether the parent or our team cancelled', () => {
    const byParent = renderFirst(
      bookingEmails.cancelled({ ...BOOKING, status: 'CANCELLED', cancelledBy: 'PARENT' }),
    );
    const byOps = renderFirst(
      bookingEmails.cancelled({ ...BOOKING, status: 'CANCELLED', cancelledBy: 'OPS' }),
    );

    expect(byParent.text).toContain('As you asked, we cancelled');
    expect(byOps.text).toContain('we had to cancel');
  });

  it('names the day of a reminder in the recipient zone', () => {
    const [parent, mentor] = bookingEmails.reminder(BOOKING).map(render);

    // Clock: Fri 23 Oct 17:00 London, 21:30 Kolkata. Class: Sat 17:00 London, 21:30 Kolkata.
    expect(parent?.subject).toBe(
      "Reminder: Leo's trial class is tomorrow at 5:00 PM London time (GMT+1)",
    );
    expect(mentor?.subject).toBe(
      'Reminder: trial class with Leo tomorrow at 9:30 PM Kolkata time (GMT+5:30)',
    );
  });

  it('escapes names in HTML but keeps plain text and subjects literal', () => {
    const parent = { ...BOOKING.parent, firstName: 'Ann<b>&' };
    const rendered = renderFirst(accountEmails.passwordReset(parent, 'token with/+chars'));

    expect(rendered.html).toContain('Ann&lt;b&gt;&amp;');
    expect(rendered.text).toContain('Hi Ann<b>&,');
    expect(rendered.text).toContain('/reset-password?token=token+with%2F%2Bchars');
    expect(rendered.text).toContain('for 30 minutes');
  });

  it('inlines the CSS so mail clients keep the layout', () => {
    const { html } = renderFirst(bookingEmails.confirmed(BOOKING));

    expect(html).not.toContain('<style>');
    expect(html).toMatch(/<a class="button" href="[^"]+" style="[^"]*background: #166a4e/);
  });
});
