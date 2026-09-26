/**
 * Demo data for `db:seed` (docs/03 §10). Mentors teach in Asia/Kolkata; the
 * windows are IST wall-clock times chosen to cover the hours families want:
 *
 * | Families want                          | IST (summer / winter)              | IST weekday of the window |
 * |----------------------------------------|------------------------------------|---------------------------|
 * | UK weekday evening, 5 to 8 PM          | 21:30 to 00:30 / 22:30 to 01:30    | Mon to Fri                |
 * | US East after school, 4 to 7 PM        | 01:30 to 04:30 / 02:30 to 05:30    | Tue to Sat (next IST day) |
 * | US West after school, 4 to 7 PM        | 04:30 to 07:30 / 05:30 to 08:30    | Tue to Sat (next IST day) |
 * | UK weekend morning, 9 AM to 1 PM       | 13:30 to 17:30 / 14:30 to 18:30    | Sat, Sun                  |
 * | US East weekend morning, 9 AM to 1 PM  | 18:30 to 22:30 / 19:30 to 23:30    | Sat, Sun                  |
 *
 * Each mentor keeps the default cap of 2 trials per IST day.
 */

export const SEED_MENTOR_ZONE = 'Asia/Kolkata';
/** Rules apply from this date on; far enough back for any demo date. */
export const SEED_EFFECTIVE_FROM = '2026-01-01';

export interface SeedWindow {
  /** ISO weekdays in the mentor's zone (1 = Monday). */
  weekdays: readonly number[];
  start: string;
  /** At or before `start` means the window ends the next day. */
  end: string;
}

export interface SeedMentor {
  fullName: string;
  email: string;
  windows: readonly SeedWindow[];
}

const WEEKDAYS = [1, 2, 3, 4, 5] as const;
const TUE_TO_SAT = [2, 3, 4, 5, 6] as const;
const WEEKEND = [6, 7] as const;

export const SEED_MENTORS: readonly SeedMentor[] = [
  {
    fullName: 'Priya Raghavan',
    email: 'priya.raghavan@example.com',
    // Sunday 01:30 to 05:30 is the docs/04 §2 worked example.
    windows: [
      { weekdays: WEEKDAYS, start: '21:00', end: '01:30' },
      { weekdays: [7], start: '01:30', end: '05:30' },
    ],
  },
  {
    fullName: 'Karthik Menon',
    email: 'karthik.menon@example.com',
    windows: [{ weekdays: TUE_TO_SAT, start: '01:30', end: '05:30' }],
  },
  {
    fullName: 'Ananya Iyer',
    email: 'ananya.iyer@example.com',
    windows: [{ weekdays: TUE_TO_SAT, start: '04:30', end: '08:30' }],
  },
  {
    fullName: 'Rohan Deshpande',
    email: 'rohan.deshpande@example.com',
    windows: [
      { weekdays: [1, 2, 3, 4], start: '21:00', end: '01:30' },
      { weekdays: [6], start: '13:30', end: '18:30' },
    ],
  },
  {
    fullName: 'Meera Krishnan',
    email: 'meera.krishnan@example.com',
    windows: [
      { weekdays: TUE_TO_SAT, start: '02:00', end: '05:30' },
      { weekdays: WEEKEND, start: '18:30', end: '23:30' },
    ],
  },
  {
    fullName: 'Vikram Nair',
    email: 'vikram.nair@example.com',
    windows: [
      { weekdays: [2, 3, 4, 5], start: '21:30', end: '01:30' },
      { weekdays: [7], start: '13:30', end: '18:30' },
    ],
  },
  {
    fullName: 'Sneha Kulkarni',
    email: 'sneha.kulkarni@example.com',
    windows: [
      { weekdays: TUE_TO_SAT, start: '05:00', end: '08:30' },
      { weekdays: [7], start: '21:30', end: '02:30' },
    ],
  },
  {
    fullName: 'Aditya Rao',
    email: 'aditya.rao@example.com',
    windows: [
      { weekdays: [3, 4], start: '01:30', end: '05:30' },
      { weekdays: WEEKEND, start: '18:30', end: '23:30' },
    ],
  },
  {
    fullName: 'Kavya Subramanian',
    email: 'kavya.subramanian@example.com',
    windows: [
      { weekdays: [1, 3, 5], start: '21:00', end: '00:30' },
      { weekdays: WEEKEND, start: '13:30', end: '18:30' },
    ],
  },
  {
    fullName: 'Nikhil Joshi',
    email: 'nikhil.joshi@example.com',
    windows: [{ weekdays: TUE_TO_SAT, start: '03:00', end: '07:00' }],
  },
];

export const SEED_PARENT = {
  fullName: 'Hannah Okafor',
  email: 'hannah.okafor@example.com',
  phone: '+44 20 7946 0958',
  timezone: 'Europe/London',
  children: [
    { firstName: 'Leo', age: 9 },
    { firstName: 'Maya', age: 12 },
  ],
} as const;

/** Demo login; override with SEED_DEMO_PASSWORD. Documented in README and .env.example. */
export const DEFAULT_DEMO_PASSWORD = 'violet-harbour-lantern';
