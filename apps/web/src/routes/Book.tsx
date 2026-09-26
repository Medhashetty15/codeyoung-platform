import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import type { Slot } from '@app/contracts';
import { localDateOf, type LocalDate } from '@app/time';

import {
  DateStrip,
  DayNotice,
  defaultDate,
  findSlot,
  firstTransition,
  isWindowEmpty,
  MobileSummaryBar,
  nextFreeAfter,
  parseBookSearch,
  SlotGrid,
  slotsQuery,
  SlotsSkeleton,
  TimeTraySummary,
  WindowEmpty,
} from '../features/availability';
import { DstNotice, useDisplayZone, ZoneChip } from '../features/timezone';
import { Button } from '../shared/ui/Button';
import { Notice } from '../shared/ui/Notice';
import { notify } from '../shared/ui/notify';
import { PageTitle } from '../shared/ui/PageTitle';
import { Stepper } from '../shared/ui/Stepper';

import { BOOKING_STEPS } from './booking-steps';

const loadConfirm = () => import('./BookConfirm');

/** /book?tz=&date=&slot= (doc 05 §5.1). All wizard state lives in the URL (ADR 0013). */
export function Component() {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = parseBookSearch(searchParams);
  const { zone, locale } = useDisplayZone();
  const navigate = useNavigate();
  const slots = useQuery(slotsQuery(zone));
  const [animateGrid, setAnimateGrid] = useState(false);

  const data = slots.data;
  const selected = data ? findSlot(data, search.slot) : null;
  const date: LocalDate | null = data
    ? defaultDate(data.days, search.date ?? (search.slot ? localDateOf(search.slot, zone) : null))
    : null;
  const day = data?.days.find((candidate) => candidate.date === date);

  const update = (next: { date?: LocalDate | null; slot?: string | null }) => {
    setSearchParams(
      (params) => {
        params.set('tz', zone);
        for (const [key, value] of Object.entries(next)) {
          if (value) params.set(key, value);
          else params.delete(key);
        }
        return params;
      },
      { replace: true },
    );
  };

  // The chosen time vanished on a refetch or never existed on a shared link (doc 05 §5.1).
  const vanished = Boolean(data && search.slot && !selected);
  useEffect(() => {
    if (!vanished) return;
    notify('That time was just booked. Please choose another.', { id: 'slot-vanished' });
    setSearchParams(
      (params) => {
        params.delete('slot');
        return params;
      },
      { replace: true },
    );
  }, [vanished, setSearchParams]);

  const choose = (slot: Slot) => {
    update({ date: localDateOf(slot.start, zone), slot: slot.start });
    void loadConfirm();
  };
  const next = () => {
    if (!selected) return;
    void navigate(
      `/book/confirm?slot=${encodeURIComponent(selected.start)}&tz=${encodeURIComponent(zone)}`,
    );
  };

  const transition = data ? firstTransition(data) : null;

  return (
    <div className="mx-auto max-w-content px-4 pt-6 pb-32 sm:pt-10 lg:pb-16">
      <Stepper steps={BOOKING_STEPS} currentId="time" />
      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <PageTitle>Pick a time</PageTitle>
            <ZoneChip at={date ? `${date}T12:00:00Z` : undefined} />
          </div>
          {transition && <DstNotice transition={transition} />}

          {slots.isPending && <SlotsSkeleton />}

          {slots.isError && (
            <Notice
              tone="danger"
              role="alert"
              action={
                <Button size="compact" variant="secondary" onClick={() => void slots.refetch()}>
                  Try again
                </Button>
              }
            >
              We couldn&apos;t load available times.
            </Notice>
          )}

          {data && isWindowEmpty(data) && <WindowEmpty zone={zone} />}

          {data && !isWindowEmpty(data) && date && day && (
            // Row 5: the loaded strip and grid fade in once where the skeleton was.
            <div className="motion-fade-in flex flex-col gap-6">
              <DateStrip
                days={data.days}
                value={date}
                locale={locale}
                onChange={(nextDate, via) => {
                  setAnimateGrid(via === 'pointer');
                  update({ date: nextDate });
                }}
              />
              <div key={date}>
                {day.slots.length > 0 ? (
                  <SlotGrid
                    slots={day.slots}
                    zone={zone}
                    locale={locale}
                    value={selected?.start ?? null}
                    animate={animateGrid}
                    onChange={(start) => {
                      const slot = day.slots.find((candidate) => candidate.start === start);
                      if (slot) choose(slot);
                    }}
                  />
                ) : (
                  <DayNotice
                    day={day}
                    next={nextFreeAfter(data, date)}
                    zone={zone}
                    locale={locale}
                    onJump={(slot) => {
                      setAnimateGrid(false);
                      choose(slot);
                    }}
                  />
                )}
              </div>
            </div>
          )}
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
