import { expect, test } from '@playwright/test';

import { bookedParent, freeSlot, loginViaUi } from './support/app';
import { publicScreens, signedInScreens } from './support/routes';

const SIZES = [
  { width: 375, height: 812 },
  { width: 1280, height: 800 },
];

/** Key screens at 375 and 1280, light and dark, attached to the report (not diff-gated, doc 05 §13). */
test('key screens at both sizes and themes', async ({ page, request }, testInfo) => {
  test.setTimeout(240_000);
  const timezone = testInfo.project.use.timezoneId!;
  const { email, booking, session } = await bookedParent(request, timezone);
  const free = await freeSlot(session, timezone);
  const classPath = new URL(booking.joinUrl).pathname;
  const pick = (names: string[]) => (screen: { name: string }) => names.includes(screen.name);

  const shoot = async (screens: ReturnType<typeof publicScreens>) => {
    for (const size of SIZES) {
      await page.setViewportSize(size);
      for (const theme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
        for (const screen of screens) {
          await page.goto(screen.path);
          await screen.ready(page);
          await testInfo.attach(`${screen.name}-${String(size.width)}-${theme}`, {
            body: await page.screenshot({ fullPage: true }),
            contentType: 'image/png',
          });
        }
      }
    }
  };

  await shoot(
    publicScreens(timezone, free).filter(
      pick(['landing', 'pick-a-time', 'confirm-signed-out', 'login']),
    ),
  );
  await page.goto('/login');
  await loginViaUi(page, email);
  await expect(page).not.toHaveURL(/\/login/);
  await shoot(signedInScreens(booking.id, classPath));
});
