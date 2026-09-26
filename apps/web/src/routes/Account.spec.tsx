import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildMe,
  buildProblem,
  buildRefreshResponse,
  buildStudent,
  buildStudents,
} from '@app/contracts/testing';

import { useSessionStore } from '../features/auth';
import { useZoneStore } from '../features/timezone/zone-store';
import { server } from '../test/msw';
import { renderApp } from '../test/render-app';

const problem = (code: Parameters<typeof buildProblem>[0], extras?: Record<string, unknown>) => {
  const body = buildProblem(code, extras);
  return HttpResponse.json(body, { status: body.status });
};

let stop: () => void = () => {};
beforeEach(() => {
  useSessionStore.setState({ status: 'unknown', accessToken: null, endedBy: null });
  useZoneStore.setState({ chosen: null, saved: null });
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-GB']);
  server.use(
    http.post('/api/v1/auth/refresh', () => HttpResponse.json(buildRefreshResponse())),
    http.get('/api/v1/me', () => HttpResponse.json(buildMe())),
    http.get('/api/v1/me/students', () => HttpResponse.json(buildStudents())),
  );
});
afterEach(() => {
  stop();
});

function open() {
  const app = renderApp('/account', { session: true });
  stop = app.stop;
  return app;
}

const section = (name: string) => screen.getByRole('region', { name });

describe('profile', () => {
  it('saves only what changed, clears an emptied phone and keeps the email read-only', async () => {
    let body: unknown;
    server.use(
      http.get('/api/v1/me', () => HttpResponse.json(buildMe({ phone: '+44 7700 900123' }))),
      http.patch('/api/v1/me', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(buildMe({ fullName: 'Hannah Okafor-Reyes', phone: null }));
      }),
    );
    open();
    const profile = await screen.findByRole('region', { name: 'Profile' });
    // The form code loads after the page.
    const save = await within(profile).findByRole('button', { name: 'Save changes' });
    expect(save).toBeDisabled();
    expect(within(profile).getByText('hannah@okafor.co.uk')).toBeInTheDocument();
    expect(within(profile).queryByRole('textbox', { name: 'Email' })).toBeNull();

    const name = within(profile).getByLabelText('Full name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Hannah Okafor-Reyes');
    await userEvent.clear(within(profile).getByLabelText(/Phone/));
    await userEvent.click(save);

    await waitFor(() => {
      expect(body).toEqual({ fullName: 'Hannah Okafor-Reyes', phone: null });
    });
    await waitFor(() => {
      expect(within(profile).getByRole('button', { name: 'Save changes' })).toBeDisabled();
    });
  });

  it('checks the phone format before sending', async () => {
    open();
    const profile = await screen.findByRole('region', { name: 'Profile' });
    const phone = await within(profile).findByLabelText(/Phone/);
    await userEvent.clear(phone);
    await userEvent.type(phone, 'call me');
    await userEvent.click(within(profile).getByRole('button', { name: 'Save changes' }));
    expect(
      await within(profile).findByText(
        'Enter a phone number using digits, spaces and an optional +.',
      ),
    ).toBeInTheDocument();
  });
});

describe('children', () => {
  it('renames a child and explains a name clash', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.patch('/api/v1/me/students/:id', async ({ request }) => {
        bodies.push(await request.json());
        return bodies.length === 1
          ? problem('STUDENT_NAME_TAKEN')
          : HttpResponse.json(buildStudent({ firstName: 'Leon' }));
      }),
    );
    open();
    await screen.findByRole('region', { name: 'Children' });
    const children = section('Children');
    expect(await within(children).findByText('Maya, 12')).toBeInTheDocument();
    expect(within(children).getByRole('link', { name: 'Trial on Tue 27 Oct' })).toBeInTheDocument();

    await userEvent.click(await within(children).findByRole('button', { name: 'Edit Leo' }));
    const form = within(children).getByRole('form', { name: 'Edit Leo' });
    const name = within(form).getByLabelText('First name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Maya');
    await userEvent.click(within(form).getByRole('button', { name: 'Save' }));
    expect(
      await within(form).findByText('You already have a child called Maya.'),
    ).toBeInTheDocument();

    await userEvent.clear(name);
    await userEvent.type(name, 'Leon');
    await userEvent.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(within(children).queryByRole('form')).toBeNull();
    });
    expect(bodies.at(-1)).toEqual({ firstName: 'Leon', age: 9 });
  });

  it('adds a child after checking the name and age', async () => {
    let body: unknown;
    server.use(
      http.post('/api/v1/me/students', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(buildStudent({ firstName: 'Arjun', age: 7 }), { status: 201 });
      }),
    );
    open();
    await screen.findByRole('region', { name: 'Children' });
    const children = section('Children');
    await userEvent.click(await within(children).findByRole('button', { name: 'Add a child' }));
    const form = within(children).getByRole('form', { name: 'Add a child' });
    await userEvent.click(within(form).getByRole('button', { name: 'Add child' }));
    expect(within(form).getByText("Enter your child's first name.")).toBeInTheDocument();
    expect(within(form).getByText('Choose an age.')).toBeInTheDocument();

    await userEvent.type(within(form).getByLabelText('First name'), ' Arjun ');
    await userEvent.selectOptions(within(form).getByLabelText('Age'), '7');
    await userEvent.click(within(form).getByRole('button', { name: 'Add child' }));
    await waitFor(() => {
      expect(body).toEqual({ firstName: 'Arjun', age: 7 });
    });
  });
});

describe('password', () => {
  it('flags a wrong current password, then clears the form after a change', async () => {
    let calls = 0;
    server.use(
      http.post('/api/v1/auth/password/change', () => {
        calls += 1;
        return calls === 1
          ? problem('INVALID_CREDENTIALS')
          : new HttpResponse(null, { status: 204 });
      }),
    );
    const { router } = open();
    await screen.findByRole('region', { name: 'Password' });
    const password = section('Password');
    const current = await within(password).findByLabelText('Current password');
    const next = within(password).getByLabelText('New password');
    await userEvent.type(current, 'wrong guess');
    await userEvent.type(next, 'lanterns over the harbour');
    await userEvent.click(within(password).getByRole('button', { name: 'Change password' }));
    expect(
      await within(password).findByText("That isn't your current password."),
    ).toBeInTheDocument();
    // A wrong current password is not an expired session.
    expect(router.state.location.pathname).toBe('/account');

    await userEvent.clear(current);
    await userEvent.type(current, 'violet-harbour-lantern');
    await userEvent.click(within(password).getByRole('button', { name: 'Change password' }));
    await waitFor(() => {
      expect(current).toHaveValue('');
    });
    expect(next).toHaveValue('');
  });

  it('refuses a new password that contains the email before sending it', async () => {
    const change = vi.fn();
    server.use(
      http.post('/api/v1/auth/password/change', () => {
        change();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    open();
    await screen.findByRole('region', { name: 'Password' });
    const password = section('Password');
    await userEvent.type(
      await within(password).findByLabelText('Current password'),
      'violet-harbour',
    );
    await userEvent.type(
      within(password).getByLabelText('New password'),
      'hannah@okafor.co.uk forever',
    );
    await userEvent.click(within(password).getByRole('button', { name: 'Change password' }));
    expect(
      await within(password).findByText("Don't use your email address in your password."),
    ).toBeInTheDocument();
    expect(change).not.toHaveBeenCalled();
  });
});
