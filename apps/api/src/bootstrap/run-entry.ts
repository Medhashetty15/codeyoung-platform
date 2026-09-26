import { AppConfig, ConfigValidationError } from '../config/app-config';
import { loadEnvFile } from '../config/load-env-file';

/**
 * Common start-up for every process: UTC process time zone (docs/04 §1 rule 6),
 * optional local `.env`, configuration validated before Nest boots, and a clean
 * non-zero exit when start-up fails.
 */
export function runEntry(name: string, start: () => Promise<void>): void {
  process.env.TZ = 'UTC';
  loadEnvFile();
  Promise.resolve()
    .then(() => {
      AppConfig.fromEnv(process.env);
      return start();
    })
    .catch((error: unknown) => {
      process.stderr.write(`[${name}] failed to start: ${describe(error)}\n`);
      process.exit(1);
    });
}

function describe(error: unknown): string {
  if (error instanceof ConfigValidationError) return error.message;
  if (error instanceof Error) return error.stack ?? error.message;
  return String(error);
}
