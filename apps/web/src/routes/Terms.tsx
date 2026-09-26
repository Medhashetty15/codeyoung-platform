import { config } from '../shared/config';
import { PageTitle } from '../shared/ui/PageTitle';
import { textLinkClassName } from '../shared/ui/text-link';

import { PolicySection } from './PolicySection';

/** Plain-language trial terms (PD-22), matching how the booking system actually behaves. */
export function Component() {
  return (
    <article className="mx-auto flex max-w-content flex-col gap-8 px-4 py-6 sm:py-10">
      <PageTitle>Trial class terms</PageTitle>
      <div className="flex max-w-prose flex-col gap-8">
        <PolicySection title="The trial">
          <p>
            A trial is a free, live, one-on-one coding class for your child with one of our mentors.
            You choose the time; we match a mentor who is free then.
          </p>
        </PolicySection>
        <PolicySection title="Booking">
          <p>
            A parent or guardian books with their own account. Each child can have one upcoming
            trial at a time, and can book again after it has taken place or been cancelled.
          </p>
          <p>
            Times are shown in your time zone. Your confirmation email and the calendar invite carry
            the same time.
          </p>
        </PolicySection>
        <PolicySection title="Changing or cancelling">
          <p>
            You can cancel any time before the class starts. You can move a trial to another time
            until shortly before it starts; your booking page shows the exact cut-off. When you
            cancel, the time is offered to another family.
          </p>
          <p>
            If your mentor becomes unavailable, we move the class to another mentor at the same time
            where we can, and email you either way.
          </p>
        </PolicySection>
        <PolicySection title="Class links">
          <p>
            Your class link is personal and works without a password, so please do not share it.
            Anyone with the link can open the class page.
          </p>
        </PolicySection>
        <PolicySection title="Questions">
          <p>
            Write to{' '}
            <a href={`mailto:${config.supportEmail}`} className={textLinkClassName}>
              {config.supportEmail}
            </a>{' '}
            and we will reply.
          </p>
        </PolicySection>
      </div>
    </article>
  );
}
