import { QueryFailedError } from 'typeorm';

interface PgDriverError {
  code?: string;
  constraint?: string;
}

function driverError(error: unknown): PgDriverError | undefined {
  return error instanceof QueryFailedError ? (error.driverError as PgDriverError) : undefined;
}

/** SQLSTATE 23505, optionally for one named constraint or index. */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  const pg = driverError(error);
  return pg?.code === '23505' && (constraint === undefined || pg.constraint === constraint);
}

/** SQLSTATE 23P01 (exclusion constraint), optionally for one named constraint. */
export function isExclusionViolation(error: unknown, constraint?: string): boolean {
  const pg = driverError(error);
  return pg?.code === '23P01' && (constraint === undefined || pg.constraint === constraint);
}
