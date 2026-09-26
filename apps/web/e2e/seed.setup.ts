import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test as setup } from '@playwright/test';

import { seedFile } from './support/seed';

const API_DIR = fileURLToPath(new URL('../../api/', import.meta.url));
const CLI = 'dist/cli.js';

/**
 * Resets the e2e database to the scenario for this project's zone (API doc 03 §11). Runs the
 * built CLI directly: `npm run db:seed` would rebuild apps/api/dist (deleting it first) under the
 * API and worker that are running from it. The CLI reads apps/api/.env from its working directory;
 * CI passes the same settings as environment variables.
 */
// eslint-disable-next-line no-empty-pattern -- Playwright requires a destructured fixtures argument.
setup('seed the e2e scenario', ({}, testInfo) => {
  if (!existsSync(`${API_DIR}${CLI}`)) {
    throw new Error(
      'Build the API first (npm run build -w @app/api): apps/api/dist/cli.js is missing.',
    );
  }
  const timezone = testInfo.project.use.timezoneId ?? 'Europe/London';
  const output = execFileSync(
    process.execPath,
    [CLI, 'db:seed', '--scenario', 'e2e', '--tz', timezone, '--yes'],
    { cwd: API_DIR, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
  );
  const json = output.slice(output.indexOf('{'));
  const file = seedFile(timezone);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, json);
});
