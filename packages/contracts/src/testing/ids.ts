/** Deterministic ids and values shared by every fixture (docs/07 §9 names). */
export const FIXTURE_IDS = {
  parent: '6f1c2a4e-3b5d-4c7e-8f9a-0b1c2d3e4f50',
  studentLeo: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  studentMaya: '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e',
  booking: '0b6c3d5e-8f4a-4c1b-9d2e-7a6b5c4d3e2f',
  rescheduledBooking: '3c4d5e6f-7a8b-4c9d-8e0f-2a3b4c5d6e7f',
  waitlistEntry: '4d5e6f7a-8b9c-4d0e-9f1a-3b4c5d6e7f80',
} as const;

/** "Now" for fixtures: the server clock when the slots were generated. */
export const FIXTURE_NOW = '2026-10-20T09:12:03Z';

export const FIXTURE_PARENT = {
  fullName: 'Hannah Okafor',
  email: 'hannah@okafor.co.uk',
  timezone: 'Europe/London',
} as const;

export const FIXTURE_MENTOR_FIRST_NAME = 'Priya';
export const FIXTURE_JOIN_URL = 'https://app.codeyoung.dev/class/k3Jd9sQxW2mPq7Lr4tYz8vBn5cHf6gAe';
