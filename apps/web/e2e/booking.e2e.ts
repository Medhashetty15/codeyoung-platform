import { expect, test } from '@playwright/test';

import { addMinutes, formatTimeRange, isoInstant, zoneLabel } from '@app/time';

import { confirmWithNewChild, registerViaUi, uniqueChild, uniqueEmail } from './support/app';
import { waitForMail } from './support/mailpit';

test('a new parent books a trial in their own zone; both emails show the right times', async ({
  page,
}, testInfo) => {
  const timezone = testInfo.project.use.timezoneId!;
  const email = uniqueEmail('e2e-book');
  const child = uniqueChild('Maya');

  // Pick a time: the first time on the first day that has one, shown in the device zone.
  await page.goto('/book');
  const grid = page.getByRole('radiogroup', { name: 'Time' });
  await grid.locator('label').first().click();
  const chosen = await grid.locator('input:checked').getAttribute('value');
  await page.getByRole('button', { name: 'Continue' }).first().click();

  // Account panel inline, then Confirm with a new child.
  await expect(page.getByRole('tab', { name: 'Create account' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await registerViaUi(page, email);
  await confirmWithNewChild(page, child);

  await expect(
    page.getByRole('heading', { level: 1, name: `${child}'s trial is booked` }),
  ).toBeVisible();
  await expect(page.getByText(`We have emailed the details to ${email}.`)).toBeVisible();
  const reference = (await page.locator('.select-all').first().textContent())!.trim();

  // Parent email: the parent's zone. Mentor email: IST plus the family's time.
  const parentMail = await waitForMail(`to:"${email}"`, (mail) =>
    mail.Subject.startsWith('Booked:'),
  );
  const range = formatTimeRange(chosen!, addHour(chosen!), timezone, 'en-US');
  expect(parentMail.Text).toContain(zoneLabel(timezone, chosen!));
  expect(parentMail.Text).toContain(range);
  expect(parentMail.Text).toContain(reference);

  const mentorMail = await waitForMail(
    child,
    (mail) => !mail.To.some((to) => to.Address === email),
  );
  expect(mentorMail.Text).toContain('Kolkata time (GMT+5:30)');
  expect(mentorMail.Text).toContain(
    `For the family it is ${range} ${zoneLabel(timezone, chosen!)}`,
  );

  // The session survives a reload.
  await page.reload();
  await expect(
    page.getByRole('heading', { level: 1, name: `${child}'s trial is booked` }),
  ).toBeVisible();

  // Logging out goes home and leaves nothing of this parent behind.
  await page.getByRole('button', { name: /account menu/i }).click();
  await page.getByRole('menuitem', { name: 'Log out' }).click();
  await expect(page).toHaveURL('/');
  await page.goto('/bookings');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText(child)).toHaveCount(0);
});

const addHour = (iso: string) => isoInstant(addMinutes(iso, 60));
