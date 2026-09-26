import type { Page } from '@playwright/test';

/** A route plus what to wait for before checking it, so data views are checked loaded. */
export interface Screen {
  name: string;
  path: string;
  ready: (page: Page) => Promise<void>;
}

const heading = (name: string | RegExp) => async (page: Page) => {
  await page.getByRole('heading', { level: 1, name }).waitFor();
};

export function publicScreens(timezone: string, slotStart: string): Screen[] {
  return [
    {
      name: 'landing',
      path: '/',
      ready: async (page) => {
        await page.getByRole('link', { name: 'See all times' }).waitFor();
      },
    },
    {
      name: 'pick-a-time',
      path: `/book?tz=${encodeURIComponent(timezone)}`,
      ready: async (page) => {
        await page.getByRole('radiogroup', { name: 'Time' }).waitFor();
      },
    },
    {
      name: 'confirm-signed-out',
      path: `/book/confirm?slot=${encodeURIComponent(slotStart)}&tz=${encodeURIComponent(timezone)}`,
      ready: async (page) => {
        await page.getByRole('tab', { name: 'Create account' }).waitFor();
      },
    },
    { name: 'login', path: '/login', ready: heading('Log in') },
    { name: 'register', path: '/register', ready: heading(/account/i) },
    { name: 'forgot-password', path: '/forgot-password', ready: heading(/password/i) },
    { name: 'privacy', path: '/privacy', ready: heading('How we handle your data') },
    { name: 'terms', path: '/terms', ready: heading('Trial class terms') },
    { name: 'class-invalid', path: '/class/not-a-real-link', ready: heading('Class not found') },
    { name: 'not-found', path: '/no-such-page', ready: heading(/./) },
  ];
}

export function signedInScreens(bookingId: string, classPath: string): Screen[] {
  return [
    {
      name: 'my-bookings',
      path: '/bookings',
      ready: async (page) => {
        await page.getByRole('link', { name: 'Join class' }).first().waitFor();
      },
    },
    { name: 'booking-detail', path: `/bookings/${bookingId}`, ready: heading(/trial$/) },
    {
      name: 'reschedule',
      path: `/bookings/${bookingId}/reschedule`,
      ready: async (page) => {
        await page.getByRole('radiogroup', { name: 'Time' }).waitFor();
      },
    },
    {
      name: 'account',
      path: '/account',
      ready: async (page) => {
        await page.getByRole('button', { name: 'Change password' }).waitFor();
      },
    },
    { name: 'classroom', path: classPath, ready: heading(/trial class$/) },
  ];
}
