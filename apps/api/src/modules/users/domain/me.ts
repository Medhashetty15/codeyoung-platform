import { type Me } from '@app/contracts';

import { type User } from './user';

/** The profile a parent sees (`GET /me`); never exposes hashes or counters. */
export function toMe(user: User): Me {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    // Stored zones are canonical (IanaZoneSchema at every boundary).
    timezone: user.timezone as Me['timezone'],
  };
}
