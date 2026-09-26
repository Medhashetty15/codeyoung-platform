import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildAuthResponse,
  buildMe,
  buildProblem,
  buildRefreshResponse,
} from '@app/contracts/testing';

import { server } from '../../test/msw';
import { renderApp } from '../../test/render-app';

import { useSessionStore } from './session-store';

const problem = (code: Parameters<typeof buildProblem>[0], extras?: Record<string, unknown>) => {
  const body = buildProblem(code, extras);
  return HttpResponse.json(body, { status: body.status });
};

let stop: () => void = () => {};
beforeEach(() => {
  useSessionStore.setState({ status: 'unknown', accessToken: null, endedBy: null });
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-GB']);
});
afterEach(() => {
  stop();
});

async function openPage(path: string) {
  const app = renderApp(path, { session: true });
  stop = app.stop;
  await waitFor(() => {
    expect(useSessionStore.getState().status).toBe('anonymous');
  });
  await screen.findByRole('heading', { level: 1 });
  return app;
}

describe('log in', () => {
  it('checks the fields with our copy and summarises several problems', async () => {
    await openPage('/login');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('Check 2 fields before continuing')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Enter your email address.');
    expect(screen.getByLabelText('Email')).toHaveFocus();
  });

  it('shows the credentials error without revealing which part was wrong', async () => {
    server.use(http.post('/api/v1/auth/login', () => problem('INVALID_CREDENTIALS')));
    await openPage('/login');
    await userEvent.type(screen.getByLabelText('Email'), 'hannah@okafor.co.uk');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "That email and password don't match.",
    );
  });

  it('tells a locked-out parent when to try again', async () => {
    server.use(
      http.post('/api/v1/auth/login', () =>
        problem('ACCOUNT_TEMPORARILY_LOCKED', { retryAfterSeconds: 720 }),
      ),
    );
    await openPage('/login');
    await userEvent.type(screen.getByLabelText('Email'), 'hannah@okafor.co.uk');
    await userEvent.type(screen.getByLabelText('Password'), 'whatever-it-is');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many attempts. Try again in 12 minutes.',
    );
  });

  it('logs in and continues to the page the parent came from', async () => {
    let body: unknown;
    server.use(
      http.post('/api/v1/auth/login', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(buildAuthResponse());
      }),
    );
    const { router } = await openPage('/login?returnTo=%2Fbookings%3Fscope%3Dpast');
    await userEvent.type(screen.getByLabelText('Email'), '  Hannah@Okafor.co.uk ');
    await userEvent.type(screen.getByLabelText('Password'), 'correct horse battery');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/bookings');
    });
    expect(router.state.location.search).toBe('?scope=past');
    expect(body).toEqual({ email: 'hannah@okafor.co.uk', password: 'correct horse battery' });
    expect(useSessionStore.getState().status).toBe('authenticated');
  });

  it('keeps the destination when moving to register or reset', async () => {
    await openPage('/login?returnTo=%2Fbook%2Fconfirm%3Fslot%3Dx');
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute(
      'href',
      '/forgot-password?returnTo=%2Fbook%2Fconfirm%3Fslot%3Dx',
    );
    expect(screen.getByRole('link', { name: 'Create account' })).toHaveAttribute(
      'href',
      '/register?returnTo=%2Fbook%2Fconfirm%3Fslot%3Dx',
    );
  });

  it('ignores an unsafe returnTo', async () => {
    await openPage('/login?returnTo=https%3A%2F%2Fevil.example');
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });
});

describe('create account', () => {
  async function fill(password: string) {
    await userEvent.type(screen.getByLabelText('Full name'), 'Hannah Okafor');
    await userEvent.type(screen.getByLabelText('Email'), 'hannah@okafor.co.uk');
    await userEvent.type(screen.getByLabelText('Password'), password);
  }

  it('ticks the password rules as the parent types, including the common-password check', async () => {
    await openPage('/register');
    await userEvent.type(screen.getByLabelText('Email'), 'hannah@okafor.co.uk');
    await userEvent.click(screen.getByLabelText('Password'));
    await userEvent.type(screen.getByLabelText('Password'), 'sunflowers in october');
    const rules = within(screen.getByRole('list'));
    await waitFor(() => {
      expect(rules.getByText('Not a common password')).toHaveTextContent('(done)');
    });
    expect(rules.getByText('At least 8 characters')).toHaveTextContent('(done)');
    expect(rules.getByText("Doesn't contain your email")).toHaveTextContent('(done)');
  });

  it('refuses a common password before calling the API', async () => {
    const registerCall = vi.fn();
    server.use(http.post('/api/v1/auth/register', registerCall));
    await openPage('/register');
    await fill('password1');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText(/This password is too common/)).toBeInTheDocument();
    expect(registerCall).not.toHaveBeenCalled();
  });

  it('offers log in and reset when the email is taken, keeping the destination', async () => {
    server.use(http.post('/api/v1/auth/register', () => problem('EMAIL_ALREADY_REGISTERED')));
    await openPage('/register?returnTo=%2Fbook');
    await fill('sunflowers in october');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    const notice = await screen.findByRole('alert');
    expect(notice).toHaveTextContent('An account with this email already exists.');
    expect(within(notice).getByRole('link', { name: 'Log in' })).toHaveAttribute(
      'href',
      '/login?returnTo=%2Fbook',
    );
    expect(within(notice).getByRole('link', { name: 'Reset password' })).toHaveAttribute(
      'href',
      '/forgot-password?returnTo=%2Fbook',
    );
  });

  it('shows server password reasons under the field', async () => {
    server.use(
      http.post('/api/v1/auth/register', () =>
        problem('WEAK_PASSWORD', { reasons: ['CONTAINS_EMAIL'] }),
      ),
    );
    await openPage('/register');
    await fill('sunflowers in october');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(
      await screen.findByText("Don't use your email address in your password."),
    ).toBeInTheDocument();
  });

  it('registers with the display time zone and continues', async () => {
    let body: unknown;
    server.use(
      http.post('/api/v1/auth/register', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(buildAuthResponse(), { status: 201 });
      }),
      http.get('/api/v1/me', () => HttpResponse.json(buildMe())),
    );
    const { router } = await openPage('/register?tz=America/New_York');
    await fill('sunflowers in october');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/bookings');
    });
    expect(body).toEqual({
      fullName: 'Hannah Okafor',
      email: 'hannah@okafor.co.uk',
      password: 'sunflowers in october',
      timezone: 'America/New_York',
    });
  });
});

describe('forgot password', () => {
  it('gives the same answer whether or not the account exists', async () => {
    await openPage('/forgot-password');
    server.use(
      http.post('/api/v1/auth/password/forgot', () => new HttpResponse(null, { status: 202 })),
    );
    await userEvent.type(screen.getByLabelText('Email'), 'nobody@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(
      await screen.findByText('If an account exists for that email, we have sent a reset link.'),
    ).toBeInTheDocument();
  });
});

describe('reset password', () => {
  it('removes the token from the address and saves the new password', async () => {
    let body: unknown;
    server.use(
      http.post('/api/v1/auth/password/reset', async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { router } = await openPage('/reset-password?token=abc123');
    await waitFor(() => {
      expect(router.state.location.search).toBe('');
    });
    await userEvent.type(screen.getByLabelText('New password'), 'sunflowers in october');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'sunflowers in october');
    await userEvent.click(screen.getByRole('button', { name: 'Save new password' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login');
    });
    expect(body).toEqual({ token: 'abc123', newPassword: 'sunflowers in october' });
  });

  it('catches a mistyped confirmation', async () => {
    await openPage('/reset-password?token=abc123');
    await userEvent.type(screen.getByLabelText('New password'), 'sunflowers in october');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'sunflowers in octobre');
    await userEvent.click(screen.getByRole('button', { name: 'Save new password' }));
    expect(await screen.findByText("The passwords don't match.")).toBeInTheDocument();
  });

  it('explains an expired link and offers a new one', async () => {
    server.use(http.post('/api/v1/auth/password/reset', () => problem('RESET_TOKEN_INVALID')));
    await openPage('/reset-password?token=old');
    await userEvent.type(screen.getByLabelText('New password'), 'sunflowers in october');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'sunflowers in october');
    await userEvent.click(screen.getByRole('button', { name: 'Save new password' }));
    expect(
      await screen.findByText('This link has expired or was already used.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Send a new link' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });
});

describe('log out', () => {
  it('goes home from a protected page instead of bouncing to the login page', async () => {
    server.use(
      http.post('/api/v1/auth/refresh', () => HttpResponse.json(buildRefreshResponse())),
      http.get('/api/v1/me', () => HttpResponse.json(buildMe())),
    );
    const app = renderApp('/bookings', { session: true });
    stop = app.stop;
    await screen.findByRole('heading', { level: 1, name: 'My bookings' });
    await userEvent.click(await screen.findByRole('button', { name: 'Account menu' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Log out' }));
    await waitFor(() => {
      expect(app.router.state.location.pathname).toBe('/');
    });
    expect(app.router.state.location.search).toBe('');
    expect(useSessionStore.getState().status).toBe('anonymous');
  });
});
