import { type DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addDays,
  addMinutes,
  isAfter,
  isBefore,
  isoWeekday,
  localDateOf,
  wallTimeToInstant,
  wallWindowToInstants,
} from '@app/time';

import { AppConfig } from '../../src/config/app-config';
import { MIGRATIONS } from '../../src/database/migrations';
import { DatabaseSeeder, SeedRefusedError } from '../../src/database/seed/database-seeder';
import { type E2eScenarioSeeder } from '../../src/database/seed/e2e-scenario';
import {
  DEFAULT_DEMO_PASSWORD,
  SEED_MENTORS,
  SEED_PARENT,
} from '../../src/database/seed/seed-data';
import { InvalidOptionError } from '../../src/modules/ops-cli/command-errors';
import { DbDriftCommand } from '../../src/modules/ops-cli/database/db-drift.command';
import { DbRevertCommand } from '../../src/modules/ops-cli/database/db-revert.command';
import { DbSeedCommand } from '../../src/modules/ops-cli/database/db-seed.command';
import { type CliOutput } from '../../src/modules/ops-cli/output';
import { type Prompt } from '../../src/modules/ops-cli/prompt';
import { PasswordHasher } from '../../src/modules/users/infra/password-hasher';
import {
  connectMigrated,
  createTestDatabase,
  single,
  type TestDatabase,
} from '../support/database';
import { TEST_JWT_SECRET } from '../support/test-app';

let database: TestDatabase;
let db: DataSource;

function config(env: Record<string, string> = {}): AppConfig {
  return AppConfig.fromEnv({
    DATABASE_URL: database.url,
    JWT_ACCESS_SECRET: TEST_JWT_SECRET,
    NODE_ENV: 'test',
    ...env,
  });
}

function fakeOutput() {
  const lines: string[] = [];
  const errors: string[] = [];
  const output = {
    line: (text = '') => lines.push(text),
    error: (text: string) => errors.push(text),
  } as unknown as CliOutput;
  return { output, lines, errors };
}

function fakePrompt(answer: boolean) {
  const confirm = vi.fn((_question: string, options: { yes: boolean }) =>
    Promise.resolve(options.yes || answer),
  );
  return { prompt: { confirm } as unknown as Prompt, confirm };
}

async function count(table: string): Promise<number> {
  const [row]: { count: string }[] = await db.query(`SELECT count(*) FROM "${table}"`);
  return Number(row?.count);
}

beforeAll(async () => {
  database = await createTestDatabase();
  db = await connectMigrated(database.url);
});

afterAll(async () => {
  await db.destroy();
  await database.drop();
});

describe('DatabaseSeeder', () => {
  const hasher = new PasswordHasher();

  beforeEach(async () => {
    await new DatabaseSeeder(db, hasher, config()).seed({ reset: true });
  });

  it('creates ten IST mentors with weekly windows and the default cap', async () => {
    const mentors: { timezone: string; max_trials_per_day: number; is_active: boolean }[] =
      await db.query(`SELECT timezone, max_trials_per_day, is_active FROM mentors`);

    expect(mentors).toHaveLength(10);
    expect(new Set(mentors.map((mentor) => mentor.timezone))).toEqual(new Set(['Asia/Kolkata']));
    expect(mentors.every((mentor) => mentor.max_trials_per_day === 2 && mentor.is_active)).toBe(
      true,
    );
    expect(await count('mentor_availability_rules')).toBe(
      SEED_MENTORS.reduce(
        (total, mentor) =>
          total + mentor.windows.reduce((sum, window) => sum + window.weekdays.length, 0),
        0,
      ),
    );
  });

  it.each([
    ['UK weekday evening, summer', '2026-10-21', '17:00', 'Europe/London'],
    ['UK weekday evening, winter', '2026-11-04', '17:00', 'Europe/London'],
    ['US East after school, summer', '2026-10-21', '16:00', 'America/New_York'],
    ['US East after school, winter', '2026-11-04', '16:00', 'America/New_York'],
    ['US West after school, summer', '2026-10-21', '16:00', 'America/Los_Angeles'],
    ['US West after school, winter', '2026-11-04', '16:00', 'America/Los_Angeles'],
    ['UK Saturday morning', '2026-10-24', '10:00', 'Europe/London'],
    ['US East Saturday morning', '2026-10-24', '10:00', 'America/New_York'],
  ])('offers a mentor for %s (%s %s)', async (_label, date, time, zone) => {
    const rules: { weekday: number; start_local: string; end_local: string }[] = await db.query(
      `SELECT weekday, start_local, end_local FROM mentor_availability_rules`,
    );
    const start = wallTimeToInstant(date, time, zone, 'start');
    const end = addMinutes(start, 60);
    const istDate = localDateOf(start, 'Asia/Kolkata');

    // A window starting on the previous IST day can run past midnight.
    const covered = [addDays(istDate, -1), istDate].some((day) =>
      rules
        .filter((rule) => rule.weekday === isoWeekday(day))
        .some((rule) => {
          const window = wallWindowToInstants(
            day,
            rule.start_local,
            rule.end_local,
            'Asia/Kolkata',
          );
          return window !== null && !isAfter(window.start, start) && !isBefore(window.end, end);
        }),
    );

    expect(covered).toBe(true);
  });

  it('creates the demo parent with a real argon2id hash and two children', async () => {
    const parent = single<{ id: string; timezone: string; password_hash: string }>(
      await db.query(`SELECT id, timezone, password_hash FROM users WHERE email = $1`, [
        SEED_PARENT.email,
      ]),
    );
    const children: { first_name: string; age: number }[] = await db.query(
      `SELECT first_name, age FROM students WHERE parent_id = $1 ORDER BY first_name`,
      [parent.id],
    );

    expect(parent.timezone).toBe('Europe/London');
    expect(await hasher.verify(parent.password_hash, DEFAULT_DEMO_PASSWORD)).toBe(true);
    expect(children).toEqual([
      { first_name: 'Leo', age: 9 },
      { first_name: 'Maya', age: 12 },
    ]);
  });

  it('is idempotent', async () => {
    const summary = await new DatabaseSeeder(db, hasher, config()).seed({ reset: false });

    expect(summary).toMatchObject({ mentorsCreated: 0, mentorsSkipped: 10, parentCreated: false });
    expect(await count('mentors')).toBe(10);
    expect(await count('users')).toBe(1);
    expect(await count('students')).toBe(2);
  });

  it('uses SEED_DEMO_PASSWORD when set', async () => {
    await new DatabaseSeeder(
      db,
      hasher,
      config({ SEED_DEMO_PASSWORD: 'amber-kestrel-orchard' }),
    ).seed({
      reset: true,
    });
    const parent = single<{ password_hash: string }>(
      await db.query(`SELECT password_hash FROM users`),
    );

    expect(await hasher.verify(parent.password_hash, 'amber-kestrel-orchard')).toBe(true);
  });

  it('empties every table on reset, keeping the migration history', async () => {
    await db.query(`INSERT INTO outbox_messages (type, payload) VALUES ('Leftover', '{}')`);

    await new DatabaseSeeder(db, hasher, config()).seed({ reset: true });

    expect(await count('outbox_messages')).toBe(0);
    expect(await count('mentors')).toBe(10);
    expect(await count('schema_migrations')).toBeGreaterThan(0);
  });

  it('refuses to run against production', async () => {
    const seeder = new DatabaseSeeder(db, hasher, config({ NODE_ENV: 'production' }));

    await expect(seeder.seed({ reset: false })).rejects.toBeInstanceOf(SeedRefusedError);
  });
});

describe('database commands', () => {
  const seeder = () => new DatabaseSeeder(db, new PasswordHasher(), config());
  // These tests never ask for a scenario.
  const noScenario = {} as E2eScenarioSeeder;

  it('db:seed --reset asks before deleting and does nothing on no', async () => {
    await seeder().seed({ reset: true });
    await db.query(`INSERT INTO outbox_messages (type, payload) VALUES ('Keep', '{}')`);
    const { output, lines } = fakeOutput();
    const { prompt, confirm } = fakePrompt(false);

    await new DbSeedCommand(seeder(), noScenario, prompt, output).run([], { reset: true });

    expect(confirm).toHaveBeenCalledWith('Delete all this data?', { yes: false });
    expect(lines.at(-1)).toBe('Nothing changed.');
    expect(await count('outbox_messages')).toBe(1);
  });

  it('db:seed reports what it created', async () => {
    const { output, lines } = fakeOutput();

    await new DbSeedCommand(seeder(), noScenario, fakePrompt(true).prompt, output).run([], {
      reset: true,
      yes: true,
    });

    expect(lines).toContain('Mentors: 10 created, 0 already present (53 availability rules).');
    expect(lines).toContain(`Demo parent ${SEED_PARENT.email} created with 2 children.`);
  });

  it('db:seed refuses unknown scenarios and zones before touching data', async () => {
    const { output } = fakeOutput();
    const { prompt, confirm } = fakePrompt(true);
    const command = new DbSeedCommand(seeder(), noScenario, prompt, output);

    await expect(command.run([], { scenario: 'demo' })).rejects.toBeInstanceOf(InvalidOptionError);
    await expect(command.run([], { scenario: 'e2e', tz: 'Mars/Olympus' })).rejects.toThrow(
      'Unknown time zone "Mars/Olympus"',
    );
    expect(confirm).not.toHaveBeenCalled();
  });

  it('db:drift reports no drift on a migrated database', async () => {
    const { output, lines, errors } = fakeOutput();

    await new DbDriftCommand(db, output).run();

    expect(errors).toEqual([]);
    expect(lines).toEqual(['No drift: the schema matches the entities.']);
  });

  it('db:revert asks first and leaves the schema alone on no', async () => {
    const { output, lines } = fakeOutput();

    await new DbRevertCommand(db, fakePrompt(false).prompt, output).run([], { yes: false });

    expect(lines[0]).toMatch(new RegExp(`^Will revert ${MIGRATIONS.at(-1)?.name ?? ''}`));
    expect(lines.at(-1)).toBe('Nothing changed.');
    expect(await count('schema_migrations')).toBe(MIGRATIONS.length);
  });
});
