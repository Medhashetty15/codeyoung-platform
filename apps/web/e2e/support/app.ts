import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const API = process.env.E2E_API ?? 'http://localhost:3001/api/v1';
export const PASSWORD = 'lanterns over the harbour';

/** A fresh parent per test run, so tests never share accounts or trials. */
export function uniqueEmail(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}@example.com`;
}

/** First names must be letters only (FirstNameSchema); a random tail keeps them unique. */
export function uniqueChild(base: string): string {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  let tail = '';
  for (let index = 0; index < 5; index += 1) tail += letters.charAt(Math.floor(Math.random() * 26));
  return `${base}${tail}`;
}

export async function registerViaUi(page: Page, email: string, fullName = 'Sophie Lindqvist') {
  const panel = page.getByRole('tabpanel', { name: 'Create account' });
  await panel.getByLabel('Full name').fill(fullName);
  await panel.getByLabel('Email').fill(email);
  await panel.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await panel.getByRole('button', { name: 'Create account' }).click();
}

export async function loginViaUi(page: Page, email: string, password = PASSWORD) {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
}

/** The Confirm step with a new child named inline, then "Confirm trial". */
export async function confirmWithNewChild(page: Page, child: string, age = '8') {
  await page.getByText('Add a child', { exact: true }).click();
  await page.getByLabel('First name').fill(child);
  await page.getByLabel('Age').selectOption(age);
  await page.getByRole('button', { name: 'Confirm trial' }).click();
}

export interface ApiSession {
  token: string;
  get: <T>(path: string) => Promise<T>;
  post: <T>(path: string, body: unknown, headers?: Record<string, string>) => Promise<T>;
}

/** Signs in through the API directly, for setup the test is not about. */
export async function apiSession(
  request: APIRequestContext,
  email: string,
  password = PASSWORD,
): Promise<ApiSession> {
  const login = await request.post(`${API}/auth/login`, { data: { email, password } });
  expect(login.ok()).toBe(true);
  const { accessToken } = (await login.json()) as { accessToken: string };
  const headers = { authorization: `Bearer ${accessToken}` };
  return {
    token: accessToken,
    get: async <T>(path: string) => {
      const response = await request.get(`${API}${path}`, { headers });
      expect(response.ok()).toBe(true);
      return (await response.json()) as T;
    },
    post: async <T>(path: string, body: unknown, extra: Record<string, string> = {}) => {
      const response = await request.post(`${API}${path}`, {
        data: body,
        headers: { ...headers, ...extra },
      });
      expect(response.ok(), await response.text()).toBe(true);
      return (await response.json()) as T;
    },
  };
}

/** Registers a parent through the API and books the first free time for a new child. */
export async function bookedParent(request: APIRequestContext, timezone: string) {
  const email = uniqueEmail('e2e-parent');
  const register = await request.post(`${API}/auth/register`, {
    data: { fullName: 'Daniel Reyes', email, password: PASSWORD, timezone },
  });
  expect(register.ok(), await register.text()).toBe(true);
  const session = await apiSession(request, email);
  const slots = await session.get<{ days: { slots: { start: string }[] }[] }>(
    `/availability/slots?tz=${encodeURIComponent(timezone)}`,
  );
  const slot = slots.days.flatMap((day) => day.slots)[0]!;
  const child = uniqueChild('Leo');
  const booking = await session.post<{ id: string; start: string; joinUrl: string }>(
    '/bookings',
    { slotStart: slot.start, timezone, student: { firstName: child, age: 9 } },
    { 'Idempotency-Key': crypto.randomUUID() },
  );
  return { email, child, booking, session };
}

/** A time that is still free right now, for screens that need an open slot. */
export async function freeSlot(session: ApiSession, timezone: string): Promise<string> {
  const slots = await session.get<{ days: { slots: { start: string }[] }[] }>(
    `/availability/slots?tz=${encodeURIComponent(timezone)}`,
  );
  return slots.days.flatMap((day) => day.slots)[0]!.start;
}
