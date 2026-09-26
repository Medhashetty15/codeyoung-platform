import { type DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { MIGRATIONS } from '../../src/database/migrations';
import { pendingSchemaChanges } from '../../src/database/schema-drift';
import { connect, createTestDatabase, type TestDatabase } from '../support/database';

const TABLES = [
  'auth_sessions',
  'booking_events',
  'bookings',
  'email_deliveries',
  'mentor_availability_rules',
  'mentor_time_off',
  'mentors',
  'outbox_messages',
  'password_reset_tokens',
  'refresh_tokens',
  'students',
  'users',
  'waitlist_entries',
];

async function publicTables(dataSource: DataSource): Promise<string[]> {
  const rows: { table_name: string }[] = await dataSource.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name <> 'schema_migrations' ORDER BY table_name`,
  );
  return rows.map((row) => row.table_name);
}

describe('migrations on an empty database', () => {
  let database: TestDatabase;
  let dataSource: DataSource;

  beforeAll(async () => {
    database = await createTestDatabase();
    dataSource = await connect(database.url);
  });

  afterAll(async () => {
    await dataSource.destroy();
    await database.drop();
  });

  it('apply every migration and create every table', async () => {
    const applied = await dataSource.runMigrations({ transaction: 'each' });

    expect(applied.map((migration) => migration.name)).toEqual(
      MIGRATIONS.map((migration) => migration.name),
    );
    expect(await publicTables(dataSource)).toEqual(TABLES);
  });

  it('leave no drift between migrations and entities', async () => {
    expect(await pendingSchemaChanges(dataSource)).toEqual([]);
  });

  it('install the extensions the schema relies on', async () => {
    const rows: { extname: string }[] = await dataSource.query(
      `SELECT extname FROM pg_extension WHERE extname IN ('pgcrypto', 'citext', 'btree_gist') ORDER BY extname`,
    );

    expect(rows.map((row) => row.extname)).toEqual(['btree_gist', 'citext', 'pgcrypto']);
  });

  it('create the documented constraints and indexes by name', async () => {
    const constraints: { conname: string }[] = await dataSource.query(
      `SELECT conname FROM pg_constraint WHERE conname IN (
         'bookings_no_mentor_overlap', 'bookings_parent_id_idempotency_key_key', 'bookings_time_order_check')`,
    );
    const indexes: { indexname: string; indexdef: string }[] = await dataSource.query(
      `SELECT indexname, indexdef FROM pg_indexes WHERE indexname IN (
         'bookings_one_upcoming_per_student', 'bookings_parent_start', 'students_parent_name',
         'waitlist_one_open_per_email', 'outbox_due')`,
    );
    const definition = (name: string) =>
      indexes.find((index) => index.indexname === name)?.indexdef;

    expect(constraints).toHaveLength(3);
    expect(definition('bookings_one_upcoming_per_student')).toMatch(
      /UNIQUE .* WHERE \(status = 'CONFIRMED'/,
    );
    expect(definition('bookings_parent_start')).toContain('starts_at DESC');
    expect(definition('students_parent_name')).toContain('lower(first_name)');
    expect(definition('waitlist_one_open_per_email')).toMatch(/UNIQUE .* WHERE \(status = 'OPEN'/);
    expect(definition('outbox_due')).toMatch(/WHERE \(status = 'PENDING'/);
  });

  it('run database sessions in UTC', async () => {
    const [row]: { timezone: string }[] = await dataSource.query(
      `SELECT current_setting('TimeZone') AS timezone`,
    );

    expect(row?.timezone).toBe('UTC');
  });

  it('revert cleanly and re-apply without drift', async () => {
    for (let index = 0; index < MIGRATIONS.length; index += 1) {
      await dataSource.undoLastMigration({ transaction: 'each' });
    }
    expect(await publicTables(dataSource)).toEqual([]);

    await dataSource.runMigrations({ transaction: 'each' });
    expect(await publicTables(dataSource)).toEqual(TABLES);
    expect(await pendingSchemaChanges(dataSource)).toEqual([]);
  });
});
