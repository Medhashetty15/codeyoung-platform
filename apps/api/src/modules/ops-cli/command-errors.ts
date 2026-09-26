import { ConfigValidationError } from '../../config/app-config';
import { SeedRefusedError } from '../../database/seed/database-seeder';

import { ConfirmationRequiredError } from './prompt';

// Operator mistakes: a message is enough. Anything else keeps its stack trace.
const EXPECTED_ERRORS = [ConfirmationRequiredError, SeedRefusedError, ConfigValidationError];

/** Prints a failed command's error and makes the process exit non-zero. */
export function reportCommandError(error: Error): void {
  const expected = EXPECTED_ERRORS.some((type) => error instanceof type);
  process.stderr.write(`${expected ? error.message : (error.stack ?? error.message)}\n`);
  process.exitCode = 1;
}
