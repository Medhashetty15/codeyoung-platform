/** Log paths whose values are secrets or PII (docs/01 §6 privacy). */
export const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'password',
  'currentPassword',
  'newPassword',
  'token',
  'accessToken',
  'refreshToken',
  'email',
  '*.password',
  '*.currentPassword',
  '*.newPassword',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.email',
];

/** `hannah.okafor@example.com` -> `h***@example.com`; keeps the domain for support triage. */
export function maskEmail(value: string): string {
  const at = value.lastIndexOf('@');
  if (at <= 0) return '[REDACTED]';
  return `${value.charAt(0)}***${value.slice(at)}`;
}

/** Pino `redact.censor`: emails are masked, everything else is removed. */
export function censor(value: unknown, path: string[]): unknown {
  const key = path.at(-1);
  if (key === 'email' && typeof value === 'string') return maskEmail(value);
  return '[REDACTED]';
}

// Path segments that are bearer credentials (classroom join links).
const TOKEN_IN_PATH = /(\/classroom\/)[^/?#]+/g;

/** Strips credentials embedded in request URLs before they reach the logs. */
export function redactUrl(url: string): string {
  return url.replace(TOKEN_IN_PATH, '$1[REDACTED]');
}
