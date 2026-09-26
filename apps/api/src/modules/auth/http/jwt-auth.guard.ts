import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ErrorCode } from '@app/contracts';

import { type AuthenticatedRequest } from '../../../common/auth/authenticated-user';
import { IS_PUBLIC } from '../../../common/auth/public.decorator';
import { ROLES } from '../../../common/auth/roles.decorator';
import { AppError } from '../../../common/errors/app-error';
import { type UserRole } from '../../users/infra/user.entity';
import { AccessTokenService } from '../application/access-tokens';

const BEARER = /^Bearer ([A-Za-z0-9._~+/-]+=*)$/;

/**
 * Global guard: every route needs a valid access token unless marked
 * `@Public()` (docs/03 §6.4). Verification is stateless (no database hit).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessTokens: AccessTokenService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC, targets) === true) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = BEARER.exec(request.header('authorization') ?? '')?.[1];
    const user = token === undefined ? null : this.accessTokens.verify(token);
    if (user === null) {
      throw new AppError(ErrorCode.UNAUTHENTICATED, { detail: 'Log in to continue.' });
    }

    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES, targets);
    // A wrong role is reported like a missing resource, never as "forbidden".
    if (roles !== undefined && !roles.includes(user.role)) throw new AppError(ErrorCode.NOT_FOUND);

    request.user = user;
    return true;
  }
}
