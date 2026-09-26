import { ConfigValidationError } from '../../config/app-config';
import { SeedRefusedError } from '../../database/seed/database-seeder';

import { ConfirmationRequiredError } from './prompt';

/** A command option with a value the command does not accept. */
export class InvalidOptionError extends Error {
  override readonly name = 'InvalidOptionError';
}

// Operator mistakes: a message is enough. Anything else keeps its stack trace.
const EXPECTED_ERRORS = [
  ConfirmationRequiredError,
  SeedRefusedError,
  ConfigValidationError,
  InvalidOptionError,
];

/** Prints a failed command's error and makes the process exit non-zero. */
export function reportCommandError(error: Error): void {
  const expected = EXPECTED_ERRORS.some((type) => error instanceof type);
  process.stderr.write(`${expected ? error.message : (error.stack ?? error.message)}\n`);
  process.exitCode = 1;
}
