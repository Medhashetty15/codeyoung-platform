import { config } from '../shared/config';
import { PageTitle } from '../shared/ui/PageTitle';
import { textLinkClassName } from '../shared/ui/text-link';

import { PolicySection } from './PolicySection';

/** Plain-language data notice (PD-22): only facts about what this system does. */
export function Component() {
  const email = (
    <a href={`mailto:${config.supportEmail}`} className={textLinkClassName}>
      {config.supportEmail}
    </a>
  );
  return (
    <article className="mx-auto flex max-w-content flex-col gap-8 px-4 py-6 sm:py-10">
      <PageTitle>How we handle your data</PageTitle>
      <div className="flex max-w-prose flex-col gap-8">
        <PolicySection title="What we keep">
          <p>
            For your account: your full name, email address, phone number if you give one, your time
            zone, and your password in a scrambled form we cannot read back.
          </p>
          <p>For each child you add: their first name and age. Nothing else about them.</p>
          <p>
            For each trial: the time, the time zone you booked in, the mentor, its status and its
            reference. If you join the waitlist we keep your name, email and time zone.
          </p>
        </PolicySection>
        <PolicySection title="Why we keep it">
          <p>
            To book trials, match a mentor, show your bookings and send you the emails about them.
            Mentors see your first name, your child&apos;s first name and age, and your time zone,
            so they can prepare and teach at the right time.
          </p>
        </PolicySection>
        <PolicySection title="Emails">
          <p>
            We only email you about your account and your bookings: confirmations, reminders,
            changes, cancellations and password resets. No newsletters or marketing.
          </p>
        </PolicySection>
        <PolicySection title="Cookies and tracking">
          <p>
            One cookie keeps you logged in. Scripts on the page cannot read it and it is only sent
            to our login service. There are no analytics or advertising trackers. Your browser
            remembers your light or dark theme choice on your device.
          </p>
        </PolicySection>
        <PolicySection title="How long we keep it, and deleting it">
          <p>
            We keep your account until you ask us to delete it. Write to {email} from the email
            address on your account. We then remove your name, email, phone number and your
            children&apos;s names. Past trials stay in our records without those details so mentor
            schedules remain accurate.
          </p>
        </PolicySection>
        <PolicySection title="Payments">
          <p>The trial is free. We never ask for card or bank details.</p>
        </PolicySection>
      </div>
    </article>
  );
}
