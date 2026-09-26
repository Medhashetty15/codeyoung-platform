import { useNavigate } from 'react-router';

import {
  MobileSummaryBar,
  SlotPicker,
  TimeTraySummary,
  usePickTime,
  WindowEmpty,
} from '../features/availability';
import { ZoneChip } from '../features/timezone';
import { PageTitle } from '../shared/ui/PageTitle';
import { Stepper } from '../shared/ui/Stepper';

import { BOOKING_STEPS } from './booking-steps';

const loadConfirm = () => import('./BookConfirm');

/** /book?tz=&date=&slot= (doc 05 §5.1). All wizard state lives in the URL (ADR 0013). */
export function Component() {
  const navigate = useNavigate();
  const picker = usePickTime({ onChoose: () => void loadConfirm() });
  const { zone, locale, date, selected } = picker;

  const next = () => {
    if (!selected) return;
    void navigate(
      `/book/confirm?slot=${encodeURIComponent(selected.start)}&tz=${encodeURIComponent(zone)}`,
    );
  };

  return (
    <div className="mx-auto max-w-content px-4 pt-6 pb-32 sm:pt-10 lg:pb-16">
      <Stepper steps={BOOKING_STEPS} currentId="time" />
      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <PageTitle>Pick a time</PageTitle>
            <ZoneChip at={date ? `${date}T12:00:00Z` : undefined} />
          </div>
          <SlotPicker picker={picker} empty={<WindowEmpty zone={zone} />} />
        </div>

        <aside aria-label="Your trial" className="hidden lg:block">
          <div className="sticky top-24">
            <TimeTraySummary
              slot={selected}
              zone={zone}
              locale={locale}
              actionLabel="Continue"
              onAction={next}
            />
          </div>
        </aside>
      </div>
      <MobileSummaryBar
        slot={selected}
        zone={zone}
        locale={locale}
        actionLabel="Continue"
        onAction={next}
      />
    </div>
  );
}
