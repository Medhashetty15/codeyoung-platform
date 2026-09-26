import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildBookingConfig, slotsScenarios } from '@app/contracts/testing';
import { formatDate, formatTime, localHour } from '@app/time';

import { nextFreeTimes } from '../features/landing/next-free-times';
import { useZoneStore } from '../features/timezone/zone-store';
import { server } from '../test/msw';
import { renderApp } from '../test/render-app';

let stop: () => void = () => {};
beforeEach(() => {
  useZoneStore.setState({ chosen: 'Europe/London', saved: null });
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-GB']);
});
afterEach(() => {
  stop();
});

function open() {
  const app = renderApp('/');
  stop = app.stop;
  return app;
}

describe('landing', () => {
  it('shows the next four free times in the visitor zone, each going straight to Confirm', async () => {
    const response = slotsScenarios.available();
    server.use(http.get('/api/v1/availability/slots', () => HttpResponse.json(response)));
    const { router } = open();
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Book a free coding class for your child',
      }),
    ).toBeInTheDocument();

    const tray = (await screen.findByRole('heading', { name: 'Next free times' })).closest(
      'div',
    )!.parentElement!;
    expect(within(tray).getByText('London time (GMT+1)')).toBeInTheDocument();
    const first = nextFreeTimes(response, 1, 'Europe/London')[0]!;
    const links = await within(tray).findAllByRole('link', { name: /^\w{3} \d{1,2} \w{3}/ });
    expect(links).toHaveLength(4);
    expect(links[0]).toHaveTextContent(
      `${formatDate(first.start, 'Europe/London', 'short', 'en-GB')}${formatTime(first.start, 'Europe/London', 'en-GB')}`,
    );

    await userEvent.click(links[0]!);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/book/confirm');
    });
    expect(new URLSearchParams(router.state.location.search).get('slot')).toBe(first.start);
  });

  it('shows a New York visitor daytime times first, not the small hours', async () => {
    useZoneStore.setState({ chosen: 'America/New_York', saved: null });
    const response = slotsScenarios.available();
    server.use(http.get('/api/v1/availability/slots', () => HttpResponse.json(response)));
    open();
    const tray = (await screen.findByRole('heading', { name: 'Next free times' })).closest(
      'div',
    )!.parentElement!;
    const links = await within(tray).findAllByRole('link', { name: /^\w{3} \d{1,2} \w{3}/ });
    const starts = links.map((link) =>
      new URLSearchParams(link.getAttribute('href')!.split('?')[1]).get('slot')!,
    );
    for (const start of starts) {
      const hour = localHour(start, 'America/New_York');
      expect(hour).toBeGreaterThanOrEqual(7);
      expect(hour).toBeLessThan(21);
    }
  });

  it('offers the waitlist in the tray when nothing is free', async () => {
    server.use(
      http.get('/api/v1/availability/slots', () => HttpResponse.json(slotsScenarios.windowEmpty())),
    );
    open();
    expect(
      await screen.findByText('All trial classes for the next two weeks are taken'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Join the waitlist' })).toHaveAttribute(
      'href',
      '/book?tz=Europe%2FLondon',
    );
  });

  it('reads the next free time in the visitor and mentor zones', async () => {
    const response = slotsScenarios.available();
    server.use(http.get('/api/v1/availability/slots', () => HttpResponse.json(response)));
    open();
    const first = nextFreeTimes(response, 1, 'Europe/London')[0]!;
    const band = await screen.findByRole('region', {
      name: 'Every time is shown in your time zone',
    });
    expect(
      await within(band).findByText(
        `${formatDate(first.start, 'Europe/London', 'weekday', 'en-GB')} ${formatTime(first.start, 'Europe/London', 'en-GB')} London time`,
      ),
    ).toBeInTheDocument();
    expect(
      within(band).getByText(
        `${formatDate(first.start, 'Asia/Kolkata', 'weekday', 'en-GB')} ${formatTime(first.start, 'Asia/Kolkata', 'en-GB')} Kolkata time`,
      ),
    ).toBeInTheDocument();
  });

  it('answers questions with the live booking settings', async () => {
    server.use(
      http.get('/api/v1/meta/booking-config', () =>
        HttpResponse.json(
          buildBookingConfig({ slotDurationMinutes: 45, rescheduleCutoffMinutes: 180 }),
        ),
      ),
    );
    open();
    const faq = await screen.findByRole('region', { name: 'Questions' });
    const length = within(faq).getByRole('button', { name: 'How long is the class?' });
    expect(length).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(length);
    expect(length).toHaveAttribute('aria-expanded', 'true');
    expect(
      await within(faq).findByText('45 minutes, live on video, with one mentor and your child.'),
    ).toBeVisible();
    await userEvent.click(within(faq).getByRole('button', { name: 'Can I reschedule?' }));
    expect(
      within(faq).getByText(
        'Yes. You can move or cancel the trial from My bookings up to 3 hours before it starts.',
      ),
    ).toBeVisible();
    // One label for the booking intent across the page.
    expect(screen.getAllByRole('link', { name: 'Book a free trial' }).length).toBeGreaterThan(1);
  });
});
