import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { type Request } from 'express';

import { type UserRole } from '../../modules/users/infra/user.entity';

/** Identity taken from a verified access token (no database lookup). */
export interface AuthenticatedUser {
  userId: string;
  sessionId: string;
  role: UserRole;
}

export type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

/** Injects the authenticated user into a controller method. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    // The global guard runs first; reaching here without a user is a wiring bug.
    if (user === undefined) throw new Error('CurrentUser used on a public route');
    return user;
  },
);

/** The user on a public route when a valid token was sent, otherwise null. */
export const OptionalUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser | null =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user ?? null,
);
