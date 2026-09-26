import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test as setup } from '@playwright/test';

import { seedFile } from './support/seed';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

/** Resets the e2e database to the scenario for this project's zone (API doc 03 §11). */
// eslint-disable-next-line no-empty-pattern -- Playwright requires a destructured fixtures argument.
setup('seed the e2e scenario', ({}, testInfo) => {
  setup.setTimeout(120_000);
  const timezone = testInfo.project.use.timezoneId ?? 'Europe/London';
  const output = execFileSync(
    'npm',
    ['run', 'db:seed', '--', '--scenario', 'e2e', '--tz', timezone, '--yes'],
    { cwd: ROOT, encoding: 'utf8' },
  );
  const json = output.slice(output.indexOf('\n{') + 1);
  const file = seedFile(timezone);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, json);
});
