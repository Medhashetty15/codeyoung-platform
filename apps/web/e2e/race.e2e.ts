import { expect, test } from '@playwright/test';

import { registerViaUi, uniqueChild, uniqueEmail } from './support/app';
import { readSeed } from './support/seed';

test('two families race for the last mentor: one books, the other is offered other times', async ({
  browser,
}, testInfo) => {
  const timezone = testInfo.project.use.timezoneId!;
  const seed = readSeed(timezone);
  const confirmUrl = `/book/confirm?slot=${encodeURIComponent(seed.oneSlotLeft.slot.start)}&tz=${encodeURIComponent(timezone)}`;
  const options = { timezoneId: timezone, locale: testInfo.project.use.locale };

  const first = await browser.newContext(options);
  const second = await browser.newContext(options);
  const hannah = await first.newPage();
  const sophie = await second.newPage();

  await hannah.goto(confirmUrl);
  await hannah.getByRole('tab', { name: 'Log in' }).click();
  const loginPanel = hannah.getByRole('tabpanel', { name: 'Log in' });
  await loginPanel.getByLabel('Email').fill(seed.demoParent.email);
  await loginPanel.getByLabel('Password', { exact: true }).fill(seed.demoParent.password);
  await loginPanel.getByRole('button', { name: 'Log in' }).click();

  await sophie.goto(confirmUrl);
  await registerViaUi(sophie, uniqueEmail('e2e-race'));

  // Both are on Confirm for the same, last free time.
  for (const page of [hannah, sophie]) {
    await page.getByText('Add a child', { exact: true }).click();
    await page.getByLabel('First name').fill(uniqueChild('Arjun'));
    await page.getByLabel('Age').selectOption('10');
  }
  await Promise.all(
    [hannah, sophie].map((page) => page.getByRole('button', { name: 'Confirm trial' }).click()),
  );

  const outcomes = await Promise.all(
    [hannah, sophie].map(async (page) => {
      const booked = page.getByRole('heading', { level: 1, name: /trial is booked$/ });
      const taken = page.getByRole('dialog', { name: 'That time was just booked' });
      await expect(booked.or(taken)).toBeVisible();
      return (await booked.isVisible()) ? 'booked' : 'taken';
    }),
  );
  expect(outcomes.sort()).toEqual(['booked', 'taken']);

  await first.close();
  await second.close();
});
