import { type Provider } from '@nestjs/common';

import { AppConfig } from '../config/app-config';
import { CredentialCleanupService } from '../modules/auth/application/credential-cleanup.service';
import { CompleteBookingsService } from '../modules/bookings/application/complete-bookings.service';
import { OutboxRelay, RELAY_BATCH_SIZE } from '../modules/notifications/application/outbox-relay';

import { PERIODIC_JOBS, type PeriodicJob } from './job-scheduler';

const MINUTE_MS = 60_000;

/** The worker's jobs and cadences (docs/03 §7.1). */
export const workerJobsProvider: Provider = {
  provide: PERIODIC_JOBS,
  inject: [AppConfig, OutboxRelay, CompleteBookingsService, CredentialCleanupService],
  useFactory: (
    config: AppConfig,
    relay: OutboxRelay,
    completion: CompleteBookingsService,
    cleanup: CredentialCleanupService,
  ): PeriodicJob[] => [
    {
      name: 'outbox-relay',
      everyMs: config.outbox.pollMs,
      // Keep draining while batches come back full; wait for the next poll otherwise.
      run: async (signal) => {
        while (!signal.aborted) {
          const { claimed } = await relay.runBatch();
          if (claimed < RELAY_BATCH_SIZE) return;
        }
      },
    },
    { name: 'outbox-reaper', everyMs: MINUTE_MS, run: () => relay.releaseStuck() },
    { name: 'complete-bookings', everyMs: 5 * MINUTE_MS, run: () => completion.run() },
    { name: 'credential-cleanup', everyMs: 24 * 60 * MINUTE_MS, run: () => cleanup.run() },
  ],
};
