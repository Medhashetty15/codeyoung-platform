import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';

/** A background job the worker runs again `everyMs` after each run ends (docs/03 §7.1). */
export interface PeriodicJob {
  readonly name: string;
  readonly everyMs: number;
  /** `signal` aborts at shutdown; long runs check it between units of work. */
  run(signal: AbortSignal): Promise<unknown>;
}

export const PERIODIC_JOBS = Symbol('PERIODIC_JOBS');

/**
 * Runs each job in its own loop: the next run is scheduled only after the
 * current one finished, so a slow run never overlaps the next. On shutdown it
 * stops scheduling and waits for runs in progress (graceful drain).
 */
@Injectable()
export class JobScheduler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(JobScheduler.name);
  private readonly stopping = new AbortController();
  private readonly timers = new Set<NodeJS.Timeout>();
  private readonly running = new Set<Promise<void>>();

  constructor(@Inject(PERIODIC_JOBS) private readonly jobs: readonly PeriodicJob[]) {}

  onApplicationBootstrap(): void {
    for (const job of this.jobs) this.schedule(job, 0);
    this.logger.log({ jobs: this.jobs.map((job) => job.name) }, 'Jobs scheduled');
  }

  /**
   * First shutdown phase: runs in progress finish while SMTP and the database
   * are still open (they close in onApplicationShutdown).
   */
  async onModuleDestroy(): Promise<void> {
    this.stopping.abort();
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    await Promise.all(this.running);
  }

  private schedule(job: PeriodicJob, delayMs: number): void {
    if (this.stopping.signal.aborted) return;
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      const run = this.runOnce(job).finally(() => {
        this.running.delete(run);
        this.schedule(job, job.everyMs);
      });
      this.running.add(run);
    }, delayMs);
    this.timers.add(timer);
  }

  private async runOnce(job: PeriodicJob): Promise<void> {
    try {
      await job.run(this.stopping.signal);
    } catch (error) {
      // One failed run (database restart, SMTP outage) must not stop the loop.
      this.logger.error({ job: job.name, err: error }, 'Job run failed');
    }
  }
}
