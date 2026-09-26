import { randomUUID } from 'node:crypto';

import { type INestApplication } from '@nestjs/common';
import { type DataSource } from 'typeorm';

import { AuthResponseSchema, type Booking, BookingSchema, StudentSchema } from '@app/contracts';

import { single } from './database';
import { api } from './test-app';

export const PASSWORD = 'violet-harbour-lantern';

export interface TestMentor {
  id: string;
  email: string;
  fullName: string;
}

/** A mentor in India teaching 19:00 to 23:00 IST (13:30Z to 17:30Z) every day. */
export async function addMentor(db: DataSource, fullName: string): Promise<TestMentor> {
  const email = `${randomUUID()}@mentors.example.com`;
  const { id } = single<{ id: string }>(
    await db.query(
      `INSERT INTO mentors (full_name, email, timezone) VALUES ($1, $2, 'Asia/Kolkata') RETURNING id`,
      [fullName, email],
    ),
  );
  await db.query(
    `INSERT INTO mentor_availability_rules (mentor_id, weekday, start_local, end_local, effective_from)
     SELECT $1::uuid, d, time '19:00', time '23:00', date '2026-01-01' FROM generate_series(1, 7) AS d`,
    [id],
  );
  return { id, email, fullName };
}

/** A registered parent driving the API with a bearer token. */
export class TestParent {
  private children = 0;

  private constructor(
    private readonly app: INestApplication,
    readonly email: string,
    private accessToken: string,
  ) {}

  static async signUp(
    app: INestApplication,
    timezone = 'Europe/London',
    fullName = 'Hannah Okafor',
  ): Promise<TestParent> {
    const email = `${randomUUID()}@parents.example.com`;
    const response = await api(app)
      .post('/api/v1/auth/register')
      .send({ fullName, email, password: PASSWORD, timezone })
      .expect(201);
    return new TestParent(app, email, AuthResponseSchema.parse(response.body).accessToken);
  }

  /** A fresh access token after the test clock jumped past its 15-minute lifetime. */
  async logInAgain(password = PASSWORD): Promise<void> {
    const response = await api(this.app)
      .post('/api/v1/auth/login')
      .send({ email: this.email, password })
      .expect(200);
    this.accessToken = AuthResponseSchema.parse(response.body).accessToken;
  }

  /** The bearer token, for requests the helpers do not cover. */
  get bearerToken(): string {
    return this.accessToken;
  }

  get(path: string) {
    return api(this.app).get(`/api/v1${path}`).set('Authorization', `Bearer ${this.accessToken}`);
  }

  post(path: string, body: object = {}, idempotencyKey?: string) {
    const request = api(this.app)
      .post(`/api/v1${path}`)
      .set('Authorization', `Bearer ${this.accessToken}`);
    if (idempotencyKey !== undefined) request.set('Idempotency-Key', idempotencyKey);
    return request.send(body);
  }

  patch(path: string, body: object) {
    return api(this.app)
      .patch(`/api/v1${path}`)
      .set('Authorization', `Bearer ${this.accessToken}`)
      .send(body);
  }

  async child(firstName: string, age = 9): Promise<string> {
    return StudentSchema.parse(
      (await this.post('/me/students', { firstName, age }).expect(201)).body,
    ).id;
  }

  /** Books with a new child each time unless a child id is given. */
  async book(slotStart: string, studentId?: string): Promise<Booking> {
    this.children += 1;
    const student =
      studentId ?? (await this.child(['Leo', 'Maya', 'Arjun', 'Zoe'][this.children - 1] ?? 'Sam'));
    const response = await this.post(
      '/bookings',
      { slotStart, timezone: 'Europe/London', student: { id: student } },
      randomUUID(),
    ).expect(201);
    return BookingSchema.parse(response.body);
  }

  async reschedule(bookingId: string, slotStart: string): Promise<Booking> {
    const response = await this.post(
      `/bookings/${bookingId}/reschedule`,
      { slotStart, timezone: 'Europe/London' },
      randomUUID(),
    ).expect(201);
    return BookingSchema.parse(response.body);
  }
}
