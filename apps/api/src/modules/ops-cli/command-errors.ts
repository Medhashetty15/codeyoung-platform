import { errorTitles } from '@app/contracts';

import { AppError } from '../../common/errors/app-error';
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
  process.stderr.write(`${describeCommandError(error)}\n`);
  process.exitCode = 1;
}

/** What the operator reads: the message for expected refusals, the stack for bugs. */
export function describeCommandError(error: Error): string {
  if (error instanceof AppError) {
    const title = errorTitles[error.code];
    return error.detail === undefined ? title : `${title}: ${error.detail}`;
  }
  const expected = EXPECTED_ERRORS.some((type) => error instanceof type);
  return expected ? error.message : (error.stack ?? error.message);
}
