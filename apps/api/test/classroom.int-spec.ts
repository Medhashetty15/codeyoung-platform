/**
 * The demo classroom behind a personal join link (FR-R1, docs/03 §8, PD-16):
 * the token is the credential, each role sees its own zone, and a moved
 * class never reveals the booking that replaced it.
 */
import { type NestExpressApplication } from '@nestjs/platform-express';
import { type DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ClassroomViewSchema, ProblemSchema } from '@app/contracts';

import { addMentor, TestParent } from './support/booking-fixtures';
import { connectMigrated, createTestDatabase, single, type TestDatabase } from './support/database';
import { ManualClock } from './support/manual-clock';
import { api, createTestApp } from './support/test-app';

let database: TestDatabase;
let db: DataSource;
let app: NestExpressApplication;
const clock = new ManualClock('2026-10-20T00:00:00Z');

beforeAll(async () => {
  database = await createTestDatabase();
  db = await connectMigrated(database.url);
  app = await createTestApp({
    clock,
    env: { DATABASE_URL: database.url, RATE_LIMIT_MULTIPLIER: '100' },
  });
});

afterAll(async () => {
  await app.close();
  await db.destroy();
  await database.drop();
});

beforeEach(async () => {
  clock.set('2026-10-20T00:00:00Z');
  await db.query('TRUNCATE users, mentors RESTART IDENTITY CASCADE');
});

function tokenOf(joinUrl: string): string {
  return joinUrl.slice(joinUrl.lastIndexOf('/') + 1);
}

function classroom(token: string) {
  return api(app).get(`/api/v1/classroom/${token}`);
}

describe('GET /classroom/:joinToken', () => {
  it('shows the parent their class in their profile zone, without logging in', async () => {
    await addMentor(db, 'Priya Raghavan');
    const parent = await TestParent.signUp(app);
    const booking = await parent.book('2026-10-24T16:00:00Z');
    clock.set('2026-10-24T15:52:00Z');

    const response = await classroom(tokenOf(booking.joinUrl)).expect(200);

    expect(response.headers['cache-control']).toBe('no-store');
    expect(ClassroomViewSchema.parse(response.body)).toEqual({
      role: 'PARENT',
      status: 'CONFIRMED',
      start: '2026-10-24T16:00:00Z',
      end: '2026-10-24T17:00:00Z',
      childFirstName: 'Leo',
      mentorFirstName: 'Priya',
      parentFirstName: 'Hannah',
      timezone: 'Europe/London',
      serverTime: '2026-10-24T15:52:00Z',
      classroomOpensMinutesBefore: 10,
    });
  });

  it('shows the mentor the same class in the mentor zone', async () => {
    await addMentor(db, 'Priya Raghavan');
    const parent = await TestParent.signUp(app);
    const booking = await parent.book('2026-10-24T16:00:00Z');
    const { mentor_join_token: token } = single<{ mentor_join_token: string }>(
      await db.query('SELECT mentor_join_token FROM bookings WHERE id = $1', [booking.id]),
    );

    const view = ClassroomViewSchema.parse((await classroom(token).expect(200)).body);

    expect(view).toMatchObject({ role: 'MENTOR', timezone: 'Asia/Kolkata', childFirstName: 'Leo' });
  });

  it('follows the parent profile zone when it changes after booking (A-11)', async () => {
    await addMentor(db, 'Priya Raghavan');
    const parent = await TestParent.signUp(app);
    const booking = await parent.book('2026-10-24T16:00:00Z');
    await parent.patch('/me', { timezone: 'Asia/Calcutta' }).expect(200);

    const view = ClassroomViewSchema.parse((await classroom(tokenOf(booking.joinUrl))).body);

    expect(view.timezone).toBe('Asia/Kolkata');
  });

  it('marks a moved class RESCHEDULED and never reveals the new booking', async () => {
    await addMentor(db, 'Priya Raghavan');
    const parent = await TestParent.signUp(app);
    const original = await parent.book('2026-10-24T16:00:00Z');
    const moved = await parent.reschedule(original.id, '2026-10-25T16:00:00Z');

    const response = await classroom(tokenOf(original.joinUrl)).expect(200);

    expect(ClassroomViewSchema.parse(response.body)).toMatchObject({
      status: 'RESCHEDULED',
      start: '2026-10-24T16:00:00Z',
    });
    expect(JSON.stringify(response.body)).not.toContain(moved.id);
    expect(JSON.stringify(response.body)).not.toContain(tokenOf(moved.joinUrl));
    expect(ClassroomViewSchema.parse((await classroom(tokenOf(moved.joinUrl))).body).status).toBe(
      'CONFIRMED',
    );
  });

  it('answers 404 CLASSROOM_NOT_FOUND for unknown and malformed tokens alike', async () => {
    for (const token of ['A'.repeat(43), 'short', `${'A'.repeat(42)}!`, 'A'.repeat(200)]) {
      const response = await classroom(encodeURIComponent(token)).expect(404);
      expect(ProblemSchema.parse(response.body).code).toBe('CLASSROOM_NOT_FOUND');
    }
  });
});
