import { type DataSource, type EntityManager, QueryFailedError } from 'typeorm';

import { ErrorCode } from '@app/contracts';

import { AppError } from '../common/errors/app-error';

const SERIALIZATION_FAILURE = '40001';
const DEADLOCK_DETECTED = '40P01';
const LOCK_NOT_AVAILABLE = '55P03';

/** Seconds a client should wait after losing a lock wait (docs/03 §5.1). */
const LOCK_RETRY_AFTER_SECONDS = 2;

function sqlState(error: unknown): string | undefined {
  return error instanceof QueryFailedError
    ? (error.driverError as { code?: string }).code
    : undefined;
}

/**
 * Runs `work` in a transaction with a lock timeout. Serialization failures and
 * deadlocks are retried once; a lock wait that times out becomes
 * `503 TEMPORARILY_UNAVAILABLE` with Retry-After.
 */
export async function inLockingTransaction<T>(
  dataSource: DataSource,
  work: (manager: EntityManager) => Promise<T>,
  options: { lockTimeoutMs: number } = { lockTimeoutMs: 3000 },
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await dataSource.transaction(async (manager) => {
        await manager.query(`SET LOCAL lock_timeout = '${Math.trunc(options.lockTimeoutMs)}ms'`);
        return work(manager);
      });
    } catch (error) {
      const state = sqlState(error);
      if (state === LOCK_NOT_AVAILABLE) {
        throw new AppError(ErrorCode.TEMPORARILY_UNAVAILABLE, {
          detail: 'Many families are booking right now. Please try again in a moment.',
          headers: { 'Retry-After': String(LOCK_RETRY_AFTER_SECONDS) },
          cause: error,
        });
      }
      if (attempt === 1 && (state === SERIALIZATION_FAILURE || state === DEADLOCK_DETECTED)) {
        continue;
      }
      throw error;
    }
  }
}
