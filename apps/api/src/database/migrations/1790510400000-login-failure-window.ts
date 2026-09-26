import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * Lockout counts failures inside a fixed window that starts at the first
 * failure ("10 failures within 15 minutes", docs/03 §6.2).
 */
export class LoginFailureWindow1790510400000 implements MigrationInterface {
  name = 'LoginFailureWindow1790510400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "failed_login_window_started_at" timestamptz`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "failed_login_window_started_at"`);
  }
}
