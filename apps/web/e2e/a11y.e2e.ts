import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { bookedParent, freeSlot, loginViaUi } from './support/app';
import { publicScreens, signedInScreens, type Screen } from './support/routes';

const THEMES = ['light', 'dark'] as const;

async function check(page: Page, screen: Screen, theme: (typeof THEMES)[number]) {
  await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
  await page.goto(screen.path);
  await screen.ready(page);
  // Measure the settled page: an entrance mid-fade would read as low contrast.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
        .map((animation) => animation.finished),
    ),
  );
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blocking = results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map(
      (violation) =>
        `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
    );
  expect(blocking, `${screen.name} (${theme})`).toEqual([]);
}

test('no serious or critical axe violations on any route, in both themes', async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(180_000);
  const timezone = testInfo.project.use.timezoneId!;
  const { email, booking, session } = await bookedParent(request, timezone);
  const free = await freeSlot(session, timezone);
  const classPath = new URL(booking.joinUrl).pathname;

  for (const theme of THEMES) {
    for (const screen of publicScreens(timezone, free)) await check(page, screen, theme);
  }
  await page.goto('/login');
  await loginViaUi(page, email);
  await expect(page).not.toHaveURL(/\/login/);
  for (const theme of THEMES) {
    for (const screen of signedInScreens(booking.id, classPath)) await check(page, screen, theme);
  }
});
