import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * Initial schema (docs/03 §3). Generated from the entities, then reviewed and
 * edited by hand: extensions, the expression and DESC indexes the entities
 * cannot express, and readable formatting. The drift check keeps entities
 * and this SQL in sync.
 */
export class InitialSchema1790424000000 implements MigrationInterface {
  name = 'InitialSchema1790424000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // gen_random_uuid(), case-insensitive emails, uuid equality inside the gist exclusion.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS citext`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS btree_gist`);

    // ---- Identity & auth -------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"                    uuid        NOT NULL DEFAULT gen_random_uuid(),
        "email"                 citext      NOT NULL,
        "password_hash"         text        NOT NULL,
        "full_name"             text        NOT NULL,
        "phone"                 text,
        "timezone"              text        NOT NULL,
        "role"                  text        NOT NULL DEFAULT 'PARENT',
        "failed_login_attempts" integer     NOT NULL DEFAULT 0,
        "locked_until"          timestamptz,
        "password_changed_at"   timestamptz NOT NULL DEFAULT now(),
        "last_login_at"         timestamptz,
        "created_at"            timestamptz NOT NULL DEFAULT now(),
        "updated_at"            timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "users_email_key" UNIQUE ("email"),
        CONSTRAINT "users_role_check" CHECK ("role" IN ('PARENT'))
      )`);

    await queryRunner.query(`
      CREATE TABLE "auth_sessions" (
        "id"            uuid        NOT NULL DEFAULT gen_random_uuid(),
        "user_id"       uuid        NOT NULL,
        "created_at"    timestamptz NOT NULL DEFAULT now(),
        "last_used_at"  timestamptz NOT NULL DEFAULT now(),
        "expires_at"    timestamptz NOT NULL,
        "revoked_at"    timestamptz,
        "revoke_reason" text,
        "user_agent"    text,
        "ip"            inet,
        CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id")
          REFERENCES "users" ("id") ON DELETE CASCADE,
        CONSTRAINT "auth_sessions_revoke_reason_check"
          CHECK ("revoke_reason" IN ('LOGOUT', 'PASSWORD_CHANGED', 'PASSWORD_RESET', 'REUSE_DETECTED'))
      )`);
    await queryRunner.query(
      `CREATE INDEX "auth_sessions_user_active" ON "auth_sessions" ("user_id") WHERE "revoked_at" IS NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id"         uuid        NOT NULL DEFAULT gen_random_uuid(),
        "session_id" uuid        NOT NULL,
        "token_hash" bytea       NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "used_at"    timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "refresh_tokens_token_hash_key" UNIQUE ("token_hash"),
        CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id")
          REFERENCES "auth_sessions" ("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(
      `CREATE INDEX "refresh_tokens_session_id_idx" ON "refresh_tokens" ("session_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "password_reset_tokens" (
        "id"         uuid        NOT NULL DEFAULT gen_random_uuid(),
        "user_id"    uuid        NOT NULL,
        "token_hash" bytea       NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "used_at"    timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "password_reset_tokens_token_hash_key" UNIQUE ("token_hash"),
        CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id")
          REFERENCES "users" ("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(
      `CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens" ("user_id")`,
    );

    // ---- Students & mentors ----------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "students" (
        "id"         uuid        NOT NULL DEFAULT gen_random_uuid(),
        "parent_id"  uuid        NOT NULL,
        "first_name" text        NOT NULL,
        "age"        smallint    NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "students_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "students_parent_id_fkey" FOREIGN KEY ("parent_id")
          REFERENCES "users" ("id") ON DELETE CASCADE,
        CONSTRAINT "students_age_check" CHECK ("age" BETWEEN 4 AND 18)
      )`);
    // One child name per parent, case-insensitively.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "students_parent_name" ON "students" ("parent_id", lower("first_name"))`,
    );

    await queryRunner.query(`
      CREATE TABLE "mentors" (
        "id"                 uuid        NOT NULL DEFAULT gen_random_uuid(),
        "full_name"          text        NOT NULL,
        "email"              citext      NOT NULL,
        "timezone"           text        NOT NULL,
        "max_trials_per_day" smallint    NOT NULL DEFAULT 2,
        "is_active"          boolean     NOT NULL DEFAULT true,
        "last_assigned_at"   timestamptz,
        "created_at"         timestamptz NOT NULL DEFAULT now(),
        "updated_at"         timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "mentors_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "mentors_email_key" UNIQUE ("email"),
        CONSTRAINT "mentors_max_trials_per_day_check" CHECK ("max_trials_per_day" > 0)
      )`);

    await queryRunner.query(`
      CREATE TABLE "mentor_availability_rules" (
        "id"             uuid     NOT NULL DEFAULT gen_random_uuid(),
        "mentor_id"      uuid     NOT NULL,
        "weekday"        smallint NOT NULL,
        "start_local"    time     NOT NULL,
        "end_local"      time     NOT NULL,
        "effective_from" date     NOT NULL,
        "effective_to"   date,
        CONSTRAINT "mentor_availability_rules_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "mentor_availability_rules_mentor_id_fkey" FOREIGN KEY ("mentor_id")
          REFERENCES "mentors" ("id") ON DELETE CASCADE,
        CONSTRAINT "mentor_availability_rules_weekday_check" CHECK ("weekday" BETWEEN 1 AND 7),
        CONSTRAINT "mentor_availability_rules_window_check" CHECK ("start_local" <> "end_local"),
        CONSTRAINT "mentor_availability_rules_effective_check"
          CHECK ("effective_to" IS NULL OR "effective_to" >= "effective_from")
      )`);
    await queryRunner.query(
      `CREATE INDEX "mentor_availability_rules_mentor_id_idx" ON "mentor_availability_rules" ("mentor_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "mentor_time_off" (
        "id"        uuid        NOT NULL DEFAULT gen_random_uuid(),
        "mentor_id" uuid        NOT NULL,
        "starts_at" timestamptz NOT NULL,
        "ends_at"   timestamptz NOT NULL,
        "reason"    text,
        CONSTRAINT "mentor_time_off_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "mentor_time_off_mentor_id_fkey" FOREIGN KEY ("mentor_id")
          REFERENCES "mentors" ("id") ON DELETE CASCADE,
        CONSTRAINT "mentor_time_off_range_check" CHECK ("ends_at" > "starts_at")
      )`);
    await queryRunner.query(
      `CREATE INDEX "mentor_time_off_mentor_id_starts_at_idx" ON "mentor_time_off" ("mentor_id", "starts_at")`,
    );

    // ---- Bookings ------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "bookings" (
        "id"                  uuid        NOT NULL DEFAULT gen_random_uuid(),
        "reference"           text        NOT NULL,
        "parent_id"           uuid        NOT NULL,
        "student_id"          uuid        NOT NULL,
        "mentor_id"           uuid        NOT NULL,
        "starts_at"           timestamptz NOT NULL,
        "ends_at"             timestamptz NOT NULL,
        "blocked_until"       timestamptz NOT NULL,
        "mentor_local_date"   date        NOT NULL,
        "parent_timezone"     text        NOT NULL,
        "mentor_timezone"     text        NOT NULL,
        "status"              text        NOT NULL DEFAULT 'CONFIRMED',
        "cancelled_by"        text,
        "cancel_reason"       text,
        "cancelled_at"        timestamptz,
        "rescheduled_from_id" uuid,
        "parent_join_token"   text        NOT NULL,
        "mentor_join_token"   text        NOT NULL,
        "meeting_url"         text        NOT NULL,
        "ics_sequence"        integer     NOT NULL DEFAULT 0,
        "idempotency_key"     text,
        "request_fingerprint" text,
        "created_at"          timestamptz NOT NULL DEFAULT now(),
        "updated_at"          timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "bookings_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "bookings_reference_key" UNIQUE ("reference"),
        CONSTRAINT "bookings_parent_join_token_key" UNIQUE ("parent_join_token"),
        CONSTRAINT "bookings_mentor_join_token_key" UNIQUE ("mentor_join_token"),
        CONSTRAINT "bookings_parent_id_idempotency_key_key" UNIQUE ("parent_id", "idempotency_key"),
        CONSTRAINT "bookings_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "users" ("id"),
        CONSTRAINT "bookings_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id"),
        CONSTRAINT "bookings_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "mentors" ("id"),
        CONSTRAINT "bookings_rescheduled_from_id_fkey" FOREIGN KEY ("rescheduled_from_id")
          REFERENCES "bookings" ("id"),
        CONSTRAINT "bookings_status_check"
          CHECK ("status" IN ('CONFIRMED', 'CANCELLED', 'RESCHEDULED', 'COMPLETED')),
        CONSTRAINT "bookings_cancelled_by_check" CHECK ("cancelled_by" IN ('PARENT', 'OPS')),
        CONSTRAINT "bookings_time_order_check"
          CHECK ("ends_at" > "starts_at" AND "blocked_until" >= "ends_at"),
        -- A mentor never has two confirmed classes whose [start, end + buffer) ranges meet.
        CONSTRAINT "bookings_no_mentor_overlap" EXCLUDE USING gist (
          "mentor_id" WITH =,
          tstzrange("starts_at", "blocked_until", '[)') WITH &&
        ) WHERE ("status" = 'CONFIRMED')
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "bookings_one_upcoming_per_student" ON "bookings" ("student_id") WHERE "status" = 'CONFIRMED'`,
    );
    await queryRunner.query(
      `CREATE INDEX "bookings_mentor_day" ON "bookings" ("mentor_id", "mentor_local_date") WHERE "status" = 'CONFIRMED'`,
    );
    await queryRunner.query(
      `CREATE INDEX "bookings_confirmed_start" ON "bookings" ("starts_at") WHERE "status" = 'CONFIRMED'`,
    );
    await queryRunner.query(
      `CREATE INDEX "bookings_parent_start" ON "bookings" ("parent_id", "starts_at" DESC)`,
    );

    await queryRunner.query(`
      CREATE TABLE "booking_events" (
        "id"         bigserial   NOT NULL,
        "booking_id" uuid        NOT NULL,
        "type"       text        NOT NULL,
        "actor"      text        NOT NULL,
        "payload"    jsonb       NOT NULL DEFAULT '{}',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "booking_events_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "booking_events_booking_id_fkey" FOREIGN KEY ("booking_id")
          REFERENCES "bookings" ("id")
      )`);
    await queryRunner.query(
      `CREATE INDEX "booking_events_booking" ON "booking_events" ("booking_id", "id")`,
    );

    // ---- Messaging & waitlist ----------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "outbox_messages" (
        "id"           bigserial   NOT NULL,
        "type"         text        NOT NULL,
        "payload"      jsonb       NOT NULL,
        "status"       text        NOT NULL DEFAULT 'PENDING',
        "attempts"     integer     NOT NULL DEFAULT 0,
        "run_after"    timestamptz NOT NULL DEFAULT now(),
        "locked_at"    timestamptz,
        "last_error"   text,
        "created_at"   timestamptz NOT NULL DEFAULT now(),
        "processed_at" timestamptz,
        CONSTRAINT "outbox_messages_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "outbox_messages_status_check"
          CHECK ("status" IN ('PENDING', 'PROCESSING', 'DONE', 'DEAD'))
      )`);
    await queryRunner.query(
      `CREATE INDEX "outbox_due" ON "outbox_messages" ("run_after") WHERE "status" = 'PENDING'`,
    );

    await queryRunner.query(`
      CREATE TABLE "email_deliveries" (
        "id"                  uuid        NOT NULL DEFAULT gen_random_uuid(),
        "outbox_message_id"   bigint      NOT NULL,
        "template"            text        NOT NULL,
        "recipient_email"     citext      NOT NULL,
        "recipient_timezone"  text        NOT NULL,
        "booking_id"          uuid,
        "provider_message_id" text,
        "sent_at"             timestamptz,
        CONSTRAINT "email_deliveries_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "email_deliveries_outbox_message_id_template_recipient_email_key"
          UNIQUE ("outbox_message_id", "template", "recipient_email"),
        CONSTRAINT "email_deliveries_outbox_message_id_fkey" FOREIGN KEY ("outbox_message_id")
          REFERENCES "outbox_messages" ("id"),
        CONSTRAINT "email_deliveries_booking_id_fkey" FOREIGN KEY ("booking_id")
          REFERENCES "bookings" ("id")
      )`);

    await queryRunner.query(`
      CREATE TABLE "waitlist_entries" (
        "id"              uuid        NOT NULL DEFAULT gen_random_uuid(),
        "user_id"         uuid,
        "full_name"       text        NOT NULL,
        "email"           citext      NOT NULL,
        "timezone"        text        NOT NULL,
        "preferred_times" text,
        "status"          text        NOT NULL DEFAULT 'OPEN',
        "created_at"      timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "waitlist_entries_user_id_fkey" FOREIGN KEY ("user_id")
          REFERENCES "users" ("id") ON DELETE SET NULL,
        CONSTRAINT "waitlist_entries_status_check" CHECK ("status" IN ('OPEN', 'CONTACTED', 'CLOSED'))
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "waitlist_one_open_per_email" ON "waitlist_entries" ("email") WHERE "status" = 'OPEN'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse dependency order. Extensions stay: other databases objects may use them.
    for (const table of [
      'waitlist_entries',
      'email_deliveries',
      'outbox_messages',
      'booking_events',
      'bookings',
      'mentor_time_off',
      'mentor_availability_rules',
      'mentors',
      'students',
      'password_reset_tokens',
      'refresh_tokens',
      'auth_sessions',
      'users',
    ]) {
      await queryRunner.query(`DROP TABLE "${table}"`);
    }
  }
}
