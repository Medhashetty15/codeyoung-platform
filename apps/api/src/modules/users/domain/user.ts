import { type Temporal } from '@app/time';

import { type UserRole } from '../infra/user.entity';

/** A parent account as the application sees it (instants, not Dates). */
export interface User {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  phone: string | null;
  timezone: string;
  role: UserRole;
  failedLoginAttempts: number;
  failedLoginWindowStartedAt: Temporal.Instant | null;
  lockedUntil: Temporal.Instant | null;
  passwordChangedAt: Temporal.Instant;
}

/** Failed-login bookkeeping stored on the user row (see auth/domain/lockout). */
export interface LoginCounters {
  failedAttempts: number;
  windowStartedAt: Temporal.Instant | null;
  lockedUntil: Temporal.Instant | null;
}
