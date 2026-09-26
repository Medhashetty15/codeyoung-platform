import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildClassroomView, buildProblem } from '@app/contracts/testing';

import { useZoneStore } from '../features/timezone/zone-store';
import { server } from '../test/msw';
import { renderApp } from '../test/render-app';

const PATH = '/class/k3Jd9sQxW2mPq7Lr4tYz8vBn5cHf6gAe';

function serve(overrides: Parameters<typeof buildClassroomView>[0] = {}) {
  server.use(
    http.get('/api/v1/classroom/:token', () => HttpResponse.json(buildClassroomView(overrides))),
  );
}

let stop: () => void = () => {};
beforeEach(() => {
  useZoneStore.setState({ chosen: 'Europe/London', saved: null });
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-GB']);
});
afterEach(() => {
  stop();
});

function open() {
  const app = renderApp(PATH);
  stop = app.stop;
  return app;
}

describe('classroom', () => {
  it('uses the server clock, not the device clock, to open the room', async () => {
    // The device clock is weeks early; serverTime says the class starts in 8 minutes.
    serve({ serverTime: '2026-10-24T15:52:00Z' });
    open();
    expect(
      await screen.findByRole('heading', { level: 1, name: "Leo's trial class" }),
    ).toBeInTheDocument();
    expect(screen.getByText('Saturday 24 October, 17:00 to 18:00 London time')).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
    // One zone chip, next to the time; the header does not repeat it here.
    expect(screen.getAllByRole('button', { name: /change time zone$/ })).toHaveLength(1);

    await userEvent.click(screen.getByRole('button', { name: 'Join class' }));
    const room = screen.getByRole('region', { name: "Leo's trial class" });
    expect(within(room).getByText(/This is a demo classroom\./)).toBeInTheDocument();
    expect(within(room).getByRole('img', { name: 'Priya' })).toBeInTheDocument();
    expect(within(room).getByRole('img', { name: 'Leo' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: "Leo's trial class" })).toHaveFocus();

    await userEvent.click(within(room).getByRole('button', { name: 'Leave class' }));
    expect(screen.getByRole('button', { name: 'Join class' })).toBeInTheDocument();
  });

  it('counts down before the room opens', async () => {
    serve({ serverTime: '2026-10-24T13:00:00Z' });
    open();
    // Server time 13:00, class at 16:00: a moment has passed since the response.
    expect(await screen.findByText('The class starts in 2 hours 59 minutes.')).toBeInTheDocument();
    expect(
      screen.getByText('The classroom opens 10 minutes before the class.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Join class' })).toBeNull();
    expect(screen.queryByText('Live')).toBeNull();
  });

  it('offers a parent another trial after the class, and nothing to a mentor', async () => {
    serve({ serverTime: '2026-10-24T17:30:00Z' });
    const first = open();
    expect(await screen.findByText('This class has ended.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Book another trial' })).toHaveAttribute(
      'href',
      '/book',
    );
    first.unmount();
    stop();

    serve({ serverTime: '2026-10-24T17:30:00Z', role: 'MENTOR' });
    open();
    expect(await screen.findByText('This class has ended.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Book another trial' })).toBeNull();
  });

  it('explains a moved class and points the parent to their bookings', async () => {
    serve({ status: 'RESCHEDULED' });
    open();
    expect(await screen.findByText('This class was moved to a new time.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to My bookings' })).toHaveAttribute(
      'href',
      '/bookings',
    );
  });

  it('says so when the link is not valid', async () => {
    server.use(
      http.get('/api/v1/classroom/:token', () => {
        const body = buildProblem('CLASSROOM_NOT_FOUND');
        return HttpResponse.json(body, { status: body.status });
      }),
    );
    open();
    expect(
      await screen.findByText("This class link isn't valid. Check the link in your email."),
    ).toBeInTheDocument();
  });
});
