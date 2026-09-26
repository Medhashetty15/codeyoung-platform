import { expect, test } from '@playwright/test';

import { bookedParent, loginViaUi } from './support/app';
import { waitForMail } from './support/mailpit';

test('a parent moves a trial, then cancels it; lists and emails follow', async ({
  page,
  request,
}, testInfo) => {
  const timezone = testInfo.project.use.timezoneId!;
  const { email, child } = await bookedParent(request, timezone);

  await page.goto('/login?returnTo=%2Fbookings');
  await loginViaUi(page, email);
  const row = page.getByRole('listitem').filter({ hasText: `${child} with` });
  await expect(row).toBeVisible();

  // Reschedule from the row menu: the booked time is marked and cannot be picked.
  await row.getByRole('button', { name: `More actions for ${child}'s trial` }).click();
  await page.getByRole('menuitem', { name: 'Reschedule' }).click();
  const grid = page.getByRole('radiogroup', { name: 'Time' });
  await expect(grid.getByRole('radio', { name: /Current/ })).toBeDisabled();
  await grid.locator('label:not(:has(input:disabled))').first().click();
  await page.getByRole('button', { name: 'Move trial' }).first().click();
  const move = page.getByRole('dialog', { name: `Move ${child}'s trial?` });
  await move.getByRole('button', { name: 'Move trial' }).click();
  await expect(page).toHaveURL(/moved=1/);
  await expect(page.getByText(/^Your trial has moved to /)).toBeVisible();
  await waitForMail(`to:"${email}"`, (mail) => mail.Subject.startsWith(`New time for ${child}`));

  // Cancel from the detail page with a reason.
  await page.getByRole('button', { name: 'Cancel trial' }).click();
  const cancel = page.getByRole('dialog', { name: new RegExp(`^Cancel ${child}'s trial on `) });
  await cancel.getByLabel(/Reason/).selectOption('SCHEDULE_CHANGED');
  await cancel.getByRole('button', { name: 'Cancel trial' }).click();
  await expect(page.getByText('Trial cancelled')).toBeVisible();
  await waitForMail(`to:"${email}"`, (mail) => mail.Subject.startsWith('Cancelled:'));

  // Upcoming is empty; Past shows the moved and the cancelled trial.
  await page.goto('/bookings');
  await expect(page.getByText('No trial booked yet.')).toBeVisible();
  await page.getByRole('link', { name: 'Past' }).click();
  await expect(page.getByText('Moved')).toBeVisible();
  await expect(page.getByText('Cancelled')).toBeVisible();
});
