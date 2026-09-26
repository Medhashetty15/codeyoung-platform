import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { z } from 'zod';

import { type AuthenticatedUser } from '../../../common/auth/authenticated-user';
import { Clock } from '../../../common/clock/clock';
import { AppConfig } from '../../../config/app-config';
import { type UserRole } from '../../users/infra/user.entity';

export const ACCESS_TOKEN_ISSUER = 'codeyoung-api';
export const ACCESS_TOKEN_AUDIENCE = 'codeyoung-web';

const ClaimsSchema = z.object({
  sub: z.uuid(),
  sid: z.uuid(),
  role: z.literal('PARENT'),
});

export interface IssuedAccessToken {
  accessToken: string;
  /** Lifetime in seconds. */
  expiresIn: number;
}

/**
 * Stateless HS256 access tokens (ADR 0007): `sub`, `sid`, `role`, `iss`, `aud`,
 * `iat`, `exp`. Times come from the injected Clock so tests can expire tokens.
 */
@Injectable()
export class AccessTokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfig,
    private readonly clock: Clock,
  ) {}

  issue(user: { id: string; role: UserRole }, sessionId: string): IssuedAccessToken {
    const expiresIn = this.config.auth.accessTtlSeconds;
    const accessToken = this.jwt.sign(
      { sub: user.id, sid: sessionId, role: user.role, iat: this.nowSeconds() },
      {
        secret: this.config.auth.accessSecret,
        algorithm: 'HS256',
        expiresIn,
        issuer: ACCESS_TOKEN_ISSUER,
        audience: ACCESS_TOKEN_AUDIENCE,
      },
    );
    return { accessToken, expiresIn };
  }

  /** The token's user, or null when it is malformed, forged, expired or for another audience. */
  verify(token: string): AuthenticatedUser | null {
    let payload: unknown;
    try {
      payload = this.jwt.verify(token, {
        secret: this.config.auth.accessSecret,
        algorithms: ['HS256'],
        issuer: ACCESS_TOKEN_ISSUER,
        audience: ACCESS_TOKEN_AUDIENCE,
        clockTimestamp: this.nowSeconds(),
      });
    } catch {
      return null;
    }
    const claims = ClaimsSchema.safeParse(payload);
    return claims.success
      ? { userId: claims.data.sub, sessionId: claims.data.sid, role: claims.data.role }
      : null;
  }

  private nowSeconds(): number {
    return Math.floor(this.clock.now().epochMilliseconds / 1000);
  }
}
