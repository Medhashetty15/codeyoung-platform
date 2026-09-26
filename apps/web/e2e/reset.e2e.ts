import { expect, test } from '@playwright/test';

import { API, loginViaUi, PASSWORD, uniqueEmail } from './support/app';
import { waitForMail } from './support/mailpit';

test('a parent resets a forgotten password from the emailed link', async ({ page, request }) => {
  const email = uniqueEmail('e2e-reset');
  const register = await request.post(`${API}/auth/register`, {
    data: { fullName: 'Hannah Okafor', email, password: PASSWORD, timezone: 'Europe/London' },
  });
  expect(register.ok()).toBe(true);

  await page.goto('/forgot-password');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: /Send/ }).click();

  const mail = await waitForMail(
    `to:"${email}"`,
    (m) => m.Subject === 'Reset your Codeyoung password',
  );
  const link = /https?:\/\/\S+\/reset-password\?token=\S+/.exec(mail.Text)![0];
  await page.goto(new URL(link).pathname + new URL(link).search);

  const next = 'sunflowers in october';
  await page.getByLabel('New password', { exact: true }).fill(next);
  await page.getByLabel('Confirm new password').fill(next);
  await page.getByRole('button', { name: 'Save new password' }).click();
  await expect(page).toHaveURL(/\/login/);

  await loginViaUi(page, email, next);
  await expect(page).not.toHaveURL(/\/login/);
});
