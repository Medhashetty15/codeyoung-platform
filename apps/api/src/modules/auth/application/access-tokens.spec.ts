import { JwtService } from '@nestjs/jwt';
import { describe, expect, it } from 'vitest';

import { Temporal } from '@app/time';

import { Clock } from '../../../common/clock/clock';
import { AppConfig } from '../../../config/app-config';

import { AccessTokenService } from './access-tokens';

class FixedClock extends Clock {
  constructor(public instant: Temporal.Instant) {
    super();
  }

  now(): Temporal.Instant {
    return this.instant;
  }
}

const USER = { id: '6f1c2a4e-3b5d-4c7e-8f9a-0b1c2d3e4f50', role: 'PARENT' as const };
const SESSION = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

function service(clock: Clock, secret = 'unit-test-secret-at-least-32-bytes-long') {
  const config = AppConfig.fromEnv({
    DATABASE_URL: 'postgres://u:p@localhost:5432/db',
    JWT_ACCESS_SECRET: secret,
  });
  return new AccessTokenService(new JwtService(), config, clock);
}

describe('AccessTokenService', () => {
  const start = Temporal.Instant.from('2026-10-24T16:00:00Z');

  it('issues a 15-minute token carrying user, session and role', () => {
    const clock = new FixedClock(start);
    const tokens = service(clock);

    const issued = tokens.issue(USER, SESSION);
    const claims = JSON.parse(
      Buffer.from(issued.accessToken.split('.')[1] ?? '', 'base64url').toString(),
    ) as Record<string, unknown>;

    expect(issued.expiresIn).toBe(900);
    expect(claims).toMatchObject({
      sub: USER.id,
      sid: SESSION,
      role: 'PARENT',
      iss: 'codeyoung-api',
      aud: 'codeyoung-web',
      iat: start.epochMilliseconds / 1000,
      exp: start.epochMilliseconds / 1000 + 900,
    });
    expect(tokens.verify(issued.accessToken)).toEqual({
      userId: USER.id,
      sessionId: SESSION,
      role: 'PARENT',
    });
  });

  it('uses the injected clock for expiry', () => {
    const clock = new FixedClock(start);
    const tokens = service(clock);
    const { accessToken } = tokens.issue(USER, SESSION);

    clock.instant = start.add({ seconds: 899 });
    expect(tokens.verify(accessToken)).not.toBeNull();
    clock.instant = start.add({ seconds: 900 });
    expect(tokens.verify(accessToken)).toBeNull();
  });

  it('rejects tokens signed with another key and garbage', () => {
    const clock = new FixedClock(start);
    const other = service(clock, 'another-secret-that-is-also-32-bytes').issue(USER, SESSION);

    expect(service(clock).verify(other.accessToken)).toBeNull();
    expect(service(clock).verify('not.a.jwt')).toBeNull();
  });

  it('rejects well-signed tokens with unexpected claims', () => {
    const clock = new FixedClock(start);
    const secret = 'unit-test-secret-at-least-32-bytes-long';
    const forged = new JwtService().sign(
      { sub: 'not-a-uuid', sid: SESSION, role: 'ADMIN', iat: start.epochMilliseconds / 1000 },
      { secret, expiresIn: 900, issuer: 'codeyoung-api', audience: 'codeyoung-web' },
    );

    expect(service(clock, secret).verify(forged)).toBeNull();
  });
});
