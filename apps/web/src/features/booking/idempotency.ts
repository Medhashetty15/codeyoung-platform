const PREFIX = 'cy-idem:';

function storageKey(parts: readonly string[]): string {
  return `${PREFIX}${parts.join('|')}`;
}

/**
 * One Idempotency-Key per booking selection (slot, child, zone), kept in sessionStorage so a
 * retry or a refresh re-sends the same key and gets the same booking back (doc 05 §5.3, E-2).
 * A different selection yields a different key, as the API requires.
 */
export function idempotencyKeyFor(parts: readonly string[]): string {
  const key = storageKey(parts);
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const created = crypto.randomUUID();
    sessionStorage.setItem(key, created);
    return created;
  } catch {
    // Storage blocked: still idempotent within this call chain, just not across a refresh.
    return crypto.randomUUID();
  }
}

/** Forget the key once the booking exists, so a later booking of the same selection is new. */
export function forgetIdempotencyKey(parts: readonly string[]): void {
  try {
    sessionStorage.removeItem(storageKey(parts));
  } catch {
    // Nothing to clean up when storage is unavailable.
  }
}
