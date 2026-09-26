import { z } from 'zod';

/** docs/03 §6.3: 8 to 128 characters, not common, must not contain the email local part. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/** Local parts shorter than this are too generic to forbid inside a password. */
const MIN_LOCAL_PART_TO_CHECK = 3;

export const WeakPasswordReason = {
  TOO_SHORT: 'TOO_SHORT',
  TOO_LONG: 'TOO_LONG',
  COMMON: 'COMMON',
  CONTAINS_EMAIL: 'CONTAINS_EMAIL',
} as const;
export type WeakPasswordReason = (typeof WeakPasswordReason)[keyof typeof WeakPasswordReason];
export const WeakPasswordReasonSchema = z.enum(WeakPasswordReason);

/**
 * Every policy rule the password breaks, in a stable order (empty when it is
 * acceptable). Shared by the API (authoritative) and the web app (live hints).
 * `isCommon` is injected so the web app can load the list lazily
 * (`@app/contracts/common-passwords`).
 */
export function passwordPolicyViolations(
  password: string,
  email: string | undefined,
  isCommon: (password: string) => boolean,
): WeakPasswordReason[] {
  const reasons: WeakPasswordReason[] = [];
  // Length in code points, so an emoji counts once (not as two UTF-16 units).
  const length = Array.from(password).length;
  if (length < PASSWORD_MIN_LENGTH) reasons.push(WeakPasswordReason.TOO_SHORT);
  if (length > PASSWORD_MAX_LENGTH) reasons.push(WeakPasswordReason.TOO_LONG);
  if (isCommon(password)) reasons.push(WeakPasswordReason.COMMON);
  const localPart = email?.split('@')[0]?.trim().toLowerCase() ?? '';
  if (localPart.length >= MIN_LOCAL_PART_TO_CHECK && password.toLowerCase().includes(localPart)) {
    reasons.push(WeakPasswordReason.CONTAINS_EMAIL);
  }
  return reasons;
}
