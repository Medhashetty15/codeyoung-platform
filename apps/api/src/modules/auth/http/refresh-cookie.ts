import { type CookieOptions, type Request, type Response } from 'express';

import { ErrorCode, REFRESH_COOKIE_NAME, REQUESTED_WITH_HEADER } from '@app/contracts';

import { AppError } from '../../../common/errors/app-error';

/** The cookie is only ever sent to the auth endpoints (docs/03 §6.1). */
const REFRESH_COOKIE_PATH = '/api/v1/auth';

function cookieOptions(secure: boolean): CookieOptions {
  return { httpOnly: true, secure, sameSite: 'strict', path: REFRESH_COOKIE_PATH };
}

export function setRefreshCookie(
  response: Response,
  token: string,
  maxAgeSeconds: number,
  secure: boolean,
): void {
  response.cookie(REFRESH_COOKIE_NAME, token, {
    ...cookieOptions(secure),
    maxAge: maxAgeSeconds * 1000,
  });
}

export function clearRefreshCookie(response: Response, secure: boolean): void {
  response.clearCookie(REFRESH_COOKIE_NAME, cookieOptions(secure));
}

export function readRefreshCookie(request: Request): string | undefined {
  const cookies = request.cookies as Record<string, unknown> | undefined;
  const value = cookies?.[REFRESH_COOKIE_NAME];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Cookie-authenticated endpoints require `X-Requested-With: cy-web`. A custom
 * header forces a CORS preflight, so other sites cannot trigger them (CSRF).
 */
export function assertRequestedWith(request: Request): void {
  const [name, value] = REQUESTED_WITH_HEADER;
  if (request.header(name) !== value) {
    throw new AppError(ErrorCode.VALIDATION_FAILED, {
      detail: `The ${name} header is required.`,
      extras: { errors: [{ path: `headers.${name.toLowerCase()}`, message: `Expected ${value}` }] },
    });
  }
}
