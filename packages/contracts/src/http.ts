import { z } from 'zod';

/** Header carrying a client-generated UUID that makes booking writes idempotent. */
export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';
export const IdempotencyKeySchema = z.uuid();

/**
 * Required on cookie-authenticated endpoints (`/auth/refresh`, `/auth/logout`).
 * A custom header forces a CORS preflight, which makes these calls CSRF safe.
 */
export const REQUESTED_WITH_HEADER = ['X-Requested-With', 'cy-web'] as const;

/** httpOnly refresh-token cookie, scoped to `/api/v1/auth`. */
export const REFRESH_COOKIE_NAME = 'cy_rt';

export const API_BASE_PATH = '/api/v1';
