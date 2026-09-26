import { randomBytes } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';

import {
  type AuthResponse,
  ErrorCode,
  type LoginRequest,
  type RefreshResponse,
  type RegisterRequest,
} from '@app/contracts';
import { type Temporal } from '@app/time';

import { Clock } from '../../../common/clock/clock';
import { AppError } from '../../../common/errors/app-error';
import { maskEmail } from '../../../common/logging/redaction';
import { AppConfig } from '../../../config/app-config';
import { isUniqueViolation } from '../../../database/pg-errors';
import { toMe } from '../../users/domain/me';
import { type User } from '../../users/domain/user';
import { PasswordHasher } from '../../users/infra/password-hasher';
import { UsersRepository } from '../../users/infra/users.repository';
import { lockedUntil, type LoginFailureState, registerFailure } from '../domain/lockout';
import { decideRefresh } from '../domain/refresh-decision';
import { RefreshTokensRepository } from '../infra/refresh-tokens.repository';
import { type Session, SessionsRepository } from '../infra/sessions.repository';

import { AccessTokenService } from './access-tokens';
import { hashOpaqueToken, newOpaqueToken } from './opaque-token';
import { PasswordPolicy } from './password-policy';

/** Where a login or registration came from, stored on the session. */
export interface ClientContext {
  userAgent: string | null;
  ip: string | null;
}

/** A refresh token to hand to the client as the httpOnly cookie. */
export interface IssuedRefreshToken {
  token: string;
  maxAgeSeconds: number;
}

export interface SessionGrant<T> {
  body: T;
  refresh: IssuedRefreshToken;
}

type LoginOutcome =
  | { kind: 'ok'; grant: SessionGrant<AuthResponse> }
  | { kind: 'invalid' }
  | { kind: 'locked'; until: Temporal.Instant };

type RefreshOutcome =
  | { kind: 'ok'; grant: SessionGrant<RefreshResponse> }
  | { kind: 'invalid' }
  | { kind: 'reused'; userId: string };

/**
 * Registration, login, refresh rotation and logout (docs/03 §6.2, ADR 0007).
 * Outcomes that must be persisted even though the request fails (a counted
 * login failure, a session revoked for token reuse) are committed first and
 * turned into errors afterwards.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  /** Verified for unknown emails so every failed login costs the same time (E-20). */
  private readonly dummyHash: Promise<string>;

  constructor(
    private readonly dataSource: DataSource,
    private readonly users: UsersRepository,
    private readonly sessions: SessionsRepository,
    private readonly refreshTokens: RefreshTokensRepository,
    private readonly hasher: PasswordHasher,
    private readonly passwordPolicy: PasswordPolicy,
    private readonly accessTokens: AccessTokenService,
    private readonly config: AppConfig,
    private readonly clock: Clock,
  ) {
    this.dummyHash = hasher.hash(randomBytes(16).toString('hex'));
  }

  async register(
    request: RegisterRequest,
    client: ClientContext,
  ): Promise<SessionGrant<AuthResponse>> {
    this.passwordPolicy.assertAcceptable(request.password, request.email);
    if ((await this.users.findByEmail(request.email)) !== null) throw emailTaken();
    const passwordHash = await this.hasher.hash(request.password);

    try {
      return await this.dataSource.transaction(async (manager) => {
        const user = await this.users.withManager(manager).insert({
          email: request.email,
          passwordHash,
          fullName: request.fullName,
          phone: request.phone ?? null,
          timezone: request.timezone,
        });
        return this.startSession(manager, user, client);
      });
    } catch (error) {
      // Two registrations for one email racing past the pre-check.
      if (isUniqueViolation(error, 'users_email_key')) throw emailTaken();
      throw error;
    }
  }

  async login(request: LoginRequest, client: ClientContext): Promise<SessionGrant<AuthResponse>> {
    const outcome = await this.dataSource.transaction(async (manager): Promise<LoginOutcome> => {
      const users = this.users.withManager(manager);
      const user = await users.lockByEmail(request.email);
      if (user === null) {
        await this.hasher.verify(await this.dummyHash, request.password);
        return { kind: 'invalid' };
      }

      const now = this.clock.now();
      const failures: LoginFailureState = {
        failedAttempts: user.failedLoginAttempts,
        windowStartedAt: user.failedLoginWindowStartedAt,
        lockedUntil: user.lockedUntil,
      };
      const lockedAt = lockedUntil(failures, now);
      if (lockedAt !== null) return { kind: 'locked', until: lockedAt };

      if (!(await this.hasher.verify(user.passwordHash, request.password))) {
        const next = registerFailure(failures, now, {
          threshold: this.config.auth.loginLockThreshold,
          minutes: this.config.auth.loginLockMinutes,
        });
        await users.saveLoginFailures(user.id, next);
        const lockedNow = lockedUntil(next, now);
        if (lockedNow === null) return { kind: 'invalid' };
        this.logger.warn({ user: user.id, email: maskEmail(user.email) }, 'Login locked');
        return { kind: 'locked', until: lockedNow };
      }

      const rehash = this.hasher.needsRehash(user.passwordHash)
        ? await this.hasher.hash(request.password)
        : undefined;
      await users.recordLogin(user.id, now, rehash);
      return { kind: 'ok', grant: await this.startSession(manager, user, client) };
    });

    switch (outcome.kind) {
      case 'ok':
        return outcome.grant;
      case 'invalid':
        throw new AppError(ErrorCode.INVALID_CREDENTIALS);
      case 'locked': {
        const seconds = secondsUntil(this.clock.now(), outcome.until);
        throw new AppError(ErrorCode.ACCOUNT_TEMPORARILY_LOCKED, {
          detail: 'Too many failed attempts. Try again later.',
          headers: { 'Retry-After': String(seconds) },
        });
      }
    }
  }

  async refresh(token: string | undefined): Promise<SessionGrant<RefreshResponse>> {
    if (token === undefined) throw new AppError(ErrorCode.REFRESH_TOKEN_INVALID);

    const outcome = await this.dataSource.transaction(async (manager): Promise<RefreshOutcome> => {
      const refreshTokens = this.refreshTokens.withManager(manager);
      const sessions = this.sessions.withManager(manager);
      // Lock order token -> session, the same everywhere, so refreshes cannot deadlock.
      const stored = await refreshTokens.lockByHash(hashOpaqueToken(token));
      if (stored === null) return { kind: 'invalid' };
      const session = await sessions.lockById(stored.sessionId);
      if (session === null) return { kind: 'invalid' };
      const now = this.clock.now();

      switch (decideRefresh(stored, session, now, this.config.auth.refreshReuseGraceSeconds)) {
        case 'INVALID':
          return { kind: 'invalid' };
        case 'REUSED':
          // Someone replayed a rotated token: revoke the whole family (E-19).
          await sessions.revoke(session.id, 'REUSE_DETECTED', now);
          return { kind: 'reused', userId: session.userId };
        case 'ROTATE':
          await refreshTokens.markUsed(stored.id, now);
          break;
        case 'GRACE':
          break;
      }

      const user = await this.users.withManager(manager).findById(session.userId);
      if (user === null) return { kind: 'invalid' };
      await sessions.touch(session.id, now);
      const refresh = await this.issueRefreshToken(manager, session, now);
      return { kind: 'ok', grant: { body: this.accessTokens.issue(user, session.id), refresh } };
    });

    switch (outcome.kind) {
      case 'ok':
        return outcome.grant;
      case 'invalid':
        throw new AppError(ErrorCode.REFRESH_TOKEN_INVALID);
      case 'reused':
        this.logger.warn({ user: outcome.userId }, 'Refresh token reuse detected; session revoked');
        throw new AppError(ErrorCode.REFRESH_TOKEN_REUSED);
    }
  }

  /** Revokes the session behind the cookie. Idempotent: unknown tokens are ignored. */
  async logout(token: string | undefined): Promise<void> {
    if (token === undefined) return;
    await this.dataSource.transaction(async (manager) => {
      const stored = await this.refreshTokens
        .withManager(manager)
        .lockByHash(hashOpaqueToken(token));
      if (stored === null) return;
      await this.sessions.withManager(manager).revoke(stored.sessionId, 'LOGOUT', this.clock.now());
    });
  }

  private async startSession(
    manager: EntityManager,
    user: User,
    client: ClientContext,
  ): Promise<SessionGrant<AuthResponse>> {
    const now = this.clock.now();
    const session = await this.sessions.withManager(manager).insert({
      userId: user.id,
      expiresAt: now.add({ hours: 24 * this.config.auth.sessionMaxDays }),
      userAgent: client.userAgent,
      ip: client.ip,
    });
    const refresh = await this.issueRefreshToken(manager, session, now);
    return { body: { ...this.accessTokens.issue(user, session.id), user: toMe(user) }, refresh };
  }

  /** A new token in the session, never outliving the session's absolute cap. */
  private async issueRefreshToken(
    manager: EntityManager,
    session: Session,
    now: Temporal.Instant,
  ): Promise<IssuedRefreshToken> {
    const byTtl = now.add({ hours: 24 * this.config.auth.refreshTtlDays });
    const expiresAt =
      byTtl.epochMilliseconds < session.expiresAt.epochMilliseconds ? byTtl : session.expiresAt;
    const { token, hash } = newOpaqueToken();
    await this.refreshTokens.withManager(manager).insert(session.id, hash, expiresAt);
    return {
      token,
      maxAgeSeconds: Math.floor((expiresAt.epochMilliseconds - now.epochMilliseconds) / 1000),
    };
  }
}

function secondsUntil(now: Temporal.Instant, until: Temporal.Instant): number {
  return Math.max(1, Math.ceil((until.epochMilliseconds - now.epochMilliseconds) / 1000));
}

function emailTaken(): AppError {
  return new AppError(ErrorCode.EMAIL_ALREADY_REGISTERED, {
    detail: 'An account with this email already exists.',
  });
}
