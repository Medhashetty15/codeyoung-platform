import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

import { ApiError } from '../../shared/api/ApiError';

/**
 * VALIDATION_FAILED carries `errors[].path` as request field names (contract B2); put each message
 * under its field. Returns false when nothing matched a known field.
 */
export function applyServerFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): boolean {
  if (!(error instanceof ApiError) || error.code !== 'VALIDATION_FAILED') return false;
  let applied = false;
  for (const { path, message } of error.errors) {
    const field = fields.find((name) => name === path);
    if (field) {
      setError(field, { type: 'server', message }, { shouldFocus: !applied });
      applied = true;
    }
  }
  return applied;
}
