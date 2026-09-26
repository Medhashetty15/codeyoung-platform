import { Logger } from '@nestjs/common';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { JobScheduler, type PeriodicJob } from './job-scheduler';

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = () => {
      done();
    };
  });
  return {
    promise,
    resolve: () => {
      resolve();
    },
  };
}

describe('JobScheduler', () => {
  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs each job at start, then again the interval after each run ends', async () => {
    const run = vi.fn(() => Promise.resolve());
    const scheduler = new JobScheduler([{ name: 'tick', everyMs: 1000, run }]);

    scheduler.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(999);
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(2);

    await scheduler.onModuleDestroy();
  });

  it('never overlaps a slow run with the next one', async () => {
    const slow = deferred();
    const run = vi.fn(() => slow.promise);
    const scheduler = new JobScheduler([{ name: 'slow', everyMs: 100, run }]);

    scheduler.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(1000);
    expect(run).toHaveBeenCalledTimes(1);

    slow.resolve();
    await vi.advanceTimersByTimeAsync(100);
    expect(run).toHaveBeenCalledTimes(2);

    await scheduler.onModuleDestroy();
  });

  it('keeps the loop going after a failed run', async () => {
    const run = vi
      .fn<PeriodicJob['run']>()
      .mockRejectedValueOnce(new Error('database restarting'))
      .mockResolvedValue(undefined);
    const scheduler = new JobScheduler([{ name: 'flaky', everyMs: 50, run }]);

    scheduler.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(50);

    expect(run).toHaveBeenCalledTimes(2);
    await scheduler.onModuleDestroy();
  });

  it('on shutdown waits for runs in progress, signals them, and schedules nothing new', async () => {
    const inFlight = deferred();
    let signal: AbortSignal | undefined;
    const run = vi.fn((abort: AbortSignal) => {
      signal = abort;
      return inFlight.promise;
    });
    const scheduler = new JobScheduler([{ name: 'relay', everyMs: 10, run }]);
    scheduler.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(0);

    let stopped = false;
    const stopping = scheduler.onModuleDestroy().then(() => {
      stopped = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(signal?.aborted).toBe(true);
    expect(stopped).toBe(false);

    inFlight.resolve();
    await stopping;
    await vi.advanceTimersByTimeAsync(1000);
    expect(stopped).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
