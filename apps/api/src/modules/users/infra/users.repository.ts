import { type EntityManager } from 'typeorm';

import { fromDate, type Temporal, toDate } from '@app/time';

import { type LoginCounters, type User } from '../domain/user';

import { UserEntity } from './user.entity';

export interface NewUser {
  email: string;
  passwordHash: string;
  fullName: string;
  phone: string | null;
  timezone: string;
}

export interface ProfileChanges {
  fullName?: string;
  phone?: string | null;
  timezone?: string;
}

function toUser(row: UserEntity): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.passwordHash,
    fullName: row.fullName,
    phone: row.phone,
    timezone: row.timezone,
    role: row.role,
    failedLoginAttempts: row.failedLoginAttempts,
    failedLoginWindowStartedAt:
      row.failedLoginWindowStartedAt && fromDate(row.failedLoginWindowStartedAt),
    lockedUntil: row.lockedUntil && fromDate(row.lockedUntil),
    passwordChangedAt: fromDate(row.passwordChangedAt),
  };
}

const optionalDate = (instant: Temporal.Instant | null) =>
  instant === null ? null : toDate(instant);

/** Users table access. Bind to a transaction with `withManager`. */
export class UsersRepository {
  constructor(private readonly manager: EntityManager) {}

  withManager(manager: EntityManager): UsersRepository {
    return new UsersRepository(manager);
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.manager.findOneBy(UserEntity, { id });
    return row && toUser(row);
  }

  /** Case-insensitive (citext). */
  async findByEmail(email: string): Promise<User | null> {
    const row = await this.manager.findOneBy(UserEntity, { email });
    return row && toUser(row);
  }

  /** Row-locks the user for the rest of the transaction (login counters). */
  async lockByEmail(email: string): Promise<User | null> {
    const row = await this.manager.findOne(UserEntity, {
      where: { email },
      lock: { mode: 'pessimistic_write' },
    });
    return row && toUser(row);
  }

  async insert(user: NewUser): Promise<User> {
    const row = await this.manager.save(this.manager.create(UserEntity, user));
    return toUser(row);
  }

  async updateProfile(id: string, changes: ProfileChanges): Promise<void> {
    await this.manager.update(UserEntity, { id }, changes);
  }

  async saveLoginFailures(id: string, state: LoginCounters): Promise<void> {
    await this.manager.update(
      UserEntity,
      { id },
      {
        failedLoginAttempts: state.failedAttempts,
        failedLoginWindowStartedAt: optionalDate(state.windowStartedAt),
        lockedUntil: optionalDate(state.lockedUntil),
      },
    );
  }

  /**
   * The zone the parent confirmed while booking becomes the profile zone, so
   * emails and reminders follow it (A-11).
   */
  async syncTimezone(id: string, timezone: string): Promise<void> {
    await this.manager
      .createQueryBuilder()
      .update(UserEntity)
      .set({ timezone })
      .where('id = :id AND timezone <> :timezone', { id, timezone })
      .execute();
  }

  /** Successful login: counters cleared, hash upgraded when the parameters changed. */
  async recordLogin(id: string, at: Temporal.Instant, newPasswordHash?: string): Promise<void> {
    await this.manager.update(
      UserEntity,
      { id },
      {
        failedLoginAttempts: 0,
        failedLoginWindowStartedAt: null,
        lockedUntil: null,
        lastLoginAt: toDate(at),
        ...(newPasswordHash === undefined ? {} : { passwordHash: newPasswordHash }),
      },
    );
  }

  /** New password: also clears any lockout (the owner proved control of the account). */
  async setPassword(id: string, passwordHash: string, at: Temporal.Instant): Promise<void> {
    await this.manager.update(
      UserEntity,
      { id },
      {
        passwordHash,
        passwordChangedAt: toDate(at),
        failedLoginAttempts: 0,
        failedLoginWindowStartedAt: null,
        lockedUntil: null,
      },
    );
  }
}
