import { type DataSource, type EntityManager, QueryFailedError } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { AppError } from '../common/errors/app-error';

import { inLockingTransaction } from './transactions';

function pgError(code: string): QueryFailedError {
  return new QueryFailedError('SELECT 1', [], Object.assign(new Error('pg'), { code }));
}

function fakeDataSource(outcomes: (() => unknown)[]) {
  const query = vi.fn();
  const manager = { query } as unknown as EntityManager;
  let call = 0;
  const transaction = vi.fn(async (work: (manager: EntityManager) => Promise<unknown>) => {
    const outcome = outcomes[call];
    call += 1;
    await work(manager);
    return outcome?.();
  });
  return { dataSource: { transaction } as unknown as DataSource, transaction, query };
}

describe('inLockingTransaction', () => {
  it('sets a lock timeout and returns the result', async () => {
    const { dataSource, query } = fakeDataSource([() => 'done']);

    await expect(inLockingTransaction(dataSource, () => Promise.resolve('ignored'))).resolves.toBe(
      'done',
    );
    expect(query).toHaveBeenCalledWith("SET LOCAL lock_timeout = '3000ms'");
  });

  it.each(['40001', '40P01'])('retries once after %s', async (code) => {
    const { dataSource, transaction } = fakeDataSource([
      () => {
        throw pgError(code);
      },
      () => 'second try',
    ]);

    await expect(inLockingTransaction(dataSource, () => Promise.resolve(undefined))).resolves.toBe(
      'second try',
    );
    expect(transaction).toHaveBeenCalledTimes(2);
  });

  it('gives up after the second deadlock', async () => {
    const { dataSource } = fakeDataSource([
      () => {
        throw pgError('40P01');
      },
      () => {
        throw pgError('40P01');
      },
    ]);

    await expect(
      inLockingTransaction(dataSource, () => Promise.resolve(undefined)),
    ).rejects.toBeInstanceOf(QueryFailedError);
  });

  it('answers a lock wait timeout with TEMPORARILY_UNAVAILABLE and Retry-After', async () => {
    const { dataSource } = fakeDataSource([
      () => {
        throw pgError('55P03');
      },
    ]);

    const error = await inLockingTransaction(dataSource, () => Promise.resolve(undefined)).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({
      code: 'TEMPORARILY_UNAVAILABLE',
      headers: { 'Retry-After': '2' },
    });
  });
});
