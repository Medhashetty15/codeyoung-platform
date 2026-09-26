import { useSearchParams } from 'react-router';

import { BookingList, type BookingScope } from '../features/my-bookings';
import { PageTitle } from '../shared/ui/PageTitle';
import { Tabs } from '../shared/ui/Tabs';

/** /bookings?tab=past (doc 05 §6.2). The tab lives in the URL so Back and refresh keep it. */
export function Component() {
  const [searchParams, setSearchParams] = useSearchParams();
  const scope: BookingScope = searchParams.get('tab') === 'past' ? 'past' : 'upcoming';

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 sm:py-10">
      <PageTitle>My bookings</PageTitle>
      <Tabs
        label="Trials"
        value={scope}
        onValueChange={(next) => {
          setSearchParams(next === 'past' ? { tab: 'past' } : {}, { replace: true });
        }}
        listClassName="sm:w-72"
        items={[
          { value: 'upcoming', label: 'Upcoming', panel: <BookingList scope="upcoming" /> },
          { value: 'past', label: 'Past', panel: <BookingList scope="past" /> },
        ]}
      />
    </div>
  );
}
