import { type DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { canonicalZone } from '@app/time';

import { AppConfig } from '../../src/config/app-config';
import { DatabaseSeeder } from '../../src/database/seed/database-seeder';
import { E2eScenarioSeeder } from '../../src/database/seed/e2e-scenario';
import { AvailabilityService } from '../../src/modules/availability/application/availability.service';
import { ConfirmedBookingsQuery } from '../../src/modules/bookings/infra/confirmed-bookings.query';
import { DummyMeetingProvider } from '../../src/modules/classroom/infra/dummy-meeting-provider';
import { MentorScheduleQuery } from '../../src/modules/mentors/infra/mentor-schedule.query';
import { PasswordHasher } from '../../src/modules/users/infra/password-hasher';
import { connectMigrated, createTestDatabase, type TestDatabase } from '../support/database';
import { ManualClock } from '../support/manual-clock';
import { TEST_JWT_SECRET } from '../support/test-app';

let database: TestDatabase;
let db: DataSource;
let availability: AvailabilityService;
let scenario: E2eScenarioSeeder;
const clock = new ManualClock('2026-10-20T09:00:00Z');

beforeAll(async () => {
  database = await createTestDatabase();
  db = await connectMigrated(database.url);
  const config = AppConfig.fromEnv({
    DATABASE_URL: database.url,
    JWT_ACCESS_SECRET: TEST_JWT_SECRET,
  });
  const hasher = new PasswordHasher();
  availability = new AvailabilityService(
    new MentorScheduleQuery(db.manager),
    new ConfirmedBookingsQuery(db.manager),
    config,
    clock,
  );
  scenario = new E2eScenarioSeeder(
    db,
    new DatabaseSeeder(db, hasher, config),
    availability,
    new DummyMeetingProvider(config),
    hasher,
    config,
    clock,
  );
});

afterAll(async () => {
  await db.destroy();
  await database.drop();
});

describe('db:seed --scenario e2e (PD-10)', () => {
  it.each(['Europe/London', 'America/Los_Angeles'])(
    'prepares a one-slot-left day and a fully booked day in %s, relative to now',
    async (timezone) => {
      const summary = await scenario.run({ timezone, empty: false });

      expect(summary).toMatchObject({
        timezone,
        demoParent: { email: 'hannah.okafor@example.com', password: 'violet-harbour-lantern' },
        fullyBooked: { date: expect.any(String) },
        empty: false,
      });
      const slots = await availability.slots({
        tz: canonicalZone(timezone),
        from: summary.today,
        days: 5,
      });
      const day = (date: string | undefined) => slots.days.find((item) => item.date === date);
      expect(day(summary.oneSlotLeft?.date)).toMatchObject({
        status: 'AVAILABLE',
        slots: [summary.oneSlotLeft?.slot],
      });
      expect(day(summary.fullyBooked?.date)).toMatchObject({ status: 'FULLY_BOOKED', slots: [] });
      // Other days still have normal availability.
      expect(
        slots.days.filter((item) => item.status === 'AVAILABLE').length,
      ).toBeGreaterThanOrEqual(2);
    },
  );

  it('can empty the whole window so families see the waitlist', async () => {
    const summary = await scenario.run({ timezone: 'Europe/London', empty: true });

    const slots = await availability.slots({ tz: canonicalZone('Europe/London'), days: 14 });
    expect(summary).toMatchObject({ empty: true, oneSlotLeft: null, fullyBooked: null });
    expect(slots.nextAvailable).toBeNull();
    expect(slots.days.every((day) => day.status === 'NO_AVAILABILITY')).toBe(true);
  });
});
