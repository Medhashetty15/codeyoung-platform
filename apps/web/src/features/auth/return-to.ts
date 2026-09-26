const MAX_LENGTH = 2048;

/**
 * Accepts only same-origin relative paths: must start with a single "/", never "//" or "/\",
 * no scheme, no control characters (doc 05 §9, no open redirects). Anything else yields null.
 */
export function sanitizeReturnTo(value: string | null | undefined): string | null {
  if (!value || value.length > MAX_LENGTH) return null;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null;
  // eslint-disable-next-line no-control-regex -- rejecting control characters is the point
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const url = new URL(value, 'https://codeyoung.invalid');
    if (url.origin !== 'https://codeyoung.invalid') return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/** "/login?returnTo=/bookings%3Fscope%3Dpast" for a guard redirect. */
export function loginPathFor(returnTo: string): string {
  const safe = sanitizeReturnTo(returnTo);
  return safe && safe !== '/' ? `/login?returnTo=${encodeURIComponent(safe)}` : '/login';
}
