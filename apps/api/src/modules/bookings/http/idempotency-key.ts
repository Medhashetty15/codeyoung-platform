import { type Request } from 'express';

import { ErrorCode, IDEMPOTENCY_KEY_HEADER, IdempotencyKeySchema } from '@app/contracts';

import { AppError } from '../../../common/errors/app-error';

/** The client-generated UUID that makes a booking write safe to retry (FR-B6). */
export function requireIdempotencyKey(request: Request): string {
  const parsed = IdempotencyKeySchema.safeParse(request.header(IDEMPOTENCY_KEY_HEADER));
  if (parsed.success) return parsed.data;
  throw new AppError(ErrorCode.VALIDATION_FAILED, {
    detail: `The ${IDEMPOTENCY_KEY_HEADER} header must be a UUID.`,
    extras: {
      errors: [
        { path: `headers.${IDEMPOTENCY_KEY_HEADER.toLowerCase()}`, message: 'Expected a UUID' },
      ],
    },
  });
}
