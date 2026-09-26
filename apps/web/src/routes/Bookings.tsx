import { useSearchParams } from 'react-router';

import { BookingList, type BookingScope } from '../features/my-bookings';
import { PageTitle } from '../shared/ui/PageTitle';
import { SegmentedNav } from '../shared/ui/SegmentedNav';

/** /bookings?tab=past (doc 05 §6.2). The tab lives in the URL so Back and refresh keep it. */
export function Component() {
  const [searchParams] = useSearchParams();
  const scope: BookingScope = searchParams.get('tab') === 'past' ? 'past' : 'upcoming';

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 sm:py-10">
      <PageTitle>My bookings</PageTitle>
      <SegmentedNav
        label="Trials"
        className="sm:w-72"
        items={[
          { label: 'Upcoming', to: '/bookings', active: scope === 'upcoming' },
          { label: 'Past', to: '/bookings?tab=past', active: scope === 'past' },
        ]}
      />
      <BookingList key={scope} scope={scope} />
    </div>
  );
}
