import {
  addDays,
  addMinutes,
  dstTransitionsBetween,
  isoInstant,
  localDateOf,
  localDates,
  startOfLocalDay,
  wallWindowToInstants,
} from '@app/time';

import {
  type DayStatus,
  type SlotDay,
  type SlotsResponse,
  SlotsResponseSchema,
} from '../availability.js';
import { type Slot } from '../primitives.js';

import { FIXTURE_NOW } from './ids.js';

const SLOT_MINUTES = 60;
const GRID_MINUTES = 30;
const MENTOR_ZONE = 'Asia/Kolkata';

/**
 * Daily fixture mentor windows in IST, like the seed data: late evening for UK
 * families and night for US after-school hours (docs/03 §10 `db:seed`).
 */
const MENTOR_WINDOWS: readonly (readonly [string, string])[] = [
  ['21:30', '00:30'],
  ['01:30', '05:30'],
];

export interface DayOverride {
  status: DayStatus;
  /** Defaults to no slots for FULLY_BOOKED / NO_AVAILABILITY and the generated ones otherwise. */
  slots?: Slot[];
}

export interface SlotsFixtureOptions {
  /** Requested display zone. Default `Europe/London`. */
  timezone?: string;
  /** First date of the window in `timezone`. Default `2026-10-24` (covers London fall-back). */
  from?: string;
  /** Window length. Default 14. */
  days?: number;
  /** Replace the generated state of specific dates. */
  dayOverrides?: Record<string, DayOverride>;
  /** Default: the first slot left in the window, or null when there is none. */
  nextAvailable?: Slot | null;
  generatedAt?: string;
}

/** Every 60-minute slot on the 30-minute UTC grid inside the fixture mentor windows. */
function mentorSlots(firstIstDate: string, lastIstDate: string): Slot[] {
  const slots: Slot[] = [];
  for (let date = firstIstDate; date <= lastIstDate; date = addDays(date, 1)) {
    for (const [start, end] of MENTOR_WINDOWS) {
      const window = wallWindowToInstants(date, start, end, MENTOR_ZONE);
      if (window === null) continue;
      for (
        let slotStart = window.start;
        addMinutes(slotStart, SLOT_MINUTES).epochMilliseconds <= window.end.epochMilliseconds;
        slotStart = addMinutes(slotStart, GRID_MINUTES)
      ) {
        slots.push({
          start: isoInstant(slotStart),
          end: isoInstant(addMinutes(slotStart, SLOT_MINUTES)),
        });
      }
    }
  }
  // Windows of one IST date are not in UTC order (01:30 IST precedes 21:30 IST).
  return slots.sort((a, b) => a.start.localeCompare(b.start));
}

/**
 * A realistic, deterministic `GET /availability/slots` response: slots grouped
 * by date in the requested zone, DST transitions on their day, every date of
 * the window present. Parsed with the contract schema.
 */
export function buildSlotsResponse(options: SlotsFixtureOptions = {}): SlotsResponse {
  const timezone = options.timezone ?? 'Europe/London';
  const from = options.from ?? '2026-10-24';
  const dates = localDates(from, options.days ?? 14);
  const windowStart = startOfLocalDay(from, timezone);
  const windowEnd = startOfLocalDay(addDays(from, dates.length), timezone);
  const generated = mentorSlots(
    addDays(localDateOf(windowStart, MENTOR_ZONE), -1),
    localDateOf(windowEnd, MENTOR_ZONE),
  );
  const transitions = dstTransitionsBetween(windowStart, windowEnd, timezone);

  const days: SlotDay[] = dates.map((date) => {
    const override = options.dayOverrides?.[date];
    const own = generated.filter((slot) => localDateOf(slot.start, timezone) === date);
    const slots =
      override?.slots ?? (override === undefined || override.status === 'AVAILABLE' ? own : []);
    const status: DayStatus =
      override?.status ?? (slots.length > 0 ? 'AVAILABLE' : 'NO_AVAILABILITY');
    const dstTransition = transitions.find(
      (transition) => localDateOf(transition.at, timezone) === date,
    );
    return { date, status, slots, ...(dstTransition === undefined ? {} : { dstTransition }) };
  });

  const firstSlot = days.flatMap((day) => day.slots)[0] ?? null;
  return SlotsResponseSchema.parse({
    timezone,
    slotDurationMinutes: SLOT_MINUTES,
    generatedAt: options.generatedAt ?? FIXTURE_NOW,
    days,
    nextAvailable: options.nextAvailable === undefined ? firstSlot : options.nextAvailable,
  });
}

function allDays(status: DayStatus, from = '2026-10-24', count = 14): Record<string, DayOverride> {
  return Object.fromEntries(localDates(from, count).map((date) => [date, { status }]));
}

/**
 * Ready-made slot states for MSW handlers and component tests. Each call returns
 * a fresh object. London scenarios start on Sat 24 Oct 2026, so the 25 Oct
 * fall-back is always in view.
 */
export const slotsScenarios = {
  /** 14 days, slots every day. */
  available: () => buildSlotsResponse(),
  /** Mon 26 Oct: mentors work but every slot is booked. */
  fullyBookedDay: () =>
    buildSlotsResponse({ dayOverrides: { '2026-10-26': { status: 'FULLY_BOOKED' } } }),
  /** Tue 27 Oct: no mentor time at all. */
  noAvailabilityDay: () =>
    buildSlotsResponse({ dayOverrides: { '2026-10-27': { status: 'NO_AVAILABILITY' } } }),
  /** Whole horizon full: no slots anywhere, `nextAvailable` null, show the waitlist. */
  windowEmpty: () =>
    buildSlotsResponse({
      dayOverrides: {
        ...allDays('FULLY_BOOKED'),
        '2026-10-25': { status: 'NO_AVAILABILITY' },
      },
      nextAvailable: null,
    }),
  /** Sat 24 to Sat 31 Oct: the London clocks go back on Sun 25 Oct. */
  dstWeek: () => buildSlotsResponse({ days: 8 }),
  /** New York view; its clocks go back on Sun 1 Nov. */
  availableNewYork: () => buildSlotsResponse({ timezone: 'America/New_York' }),
  availableLosAngeles: () => buildSlotsResponse({ timezone: 'America/Los_Angeles' }),
} as const;
