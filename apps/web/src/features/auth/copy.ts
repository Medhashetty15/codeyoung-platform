import type { z } from 'zod';

import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, type WeakPasswordReason } from '@app/contracts';

/** Doc 07 §9 copy for weak password reasons (server `reasons` and the live checklist). */
export const WEAK_PASSWORD_COPY: Record<WeakPasswordReason, string> = {
  TOO_SHORT: `Use at least ${String(PASSWORD_MIN_LENGTH)} characters.`,
  TOO_LONG: `Use at most ${String(PASSWORD_MAX_LENGTH)} characters.`,
  COMMON: 'This password is too common. Try a longer phrase only you would think of.',
  CONTAINS_EMAIL: "Don't use your email address in your password.",
};

export const CHECKLIST_COPY: Record<'length' | 'common' | 'email', string> = {
  length: `At least ${String(PASSWORD_MIN_LENGTH)} characters`,
  common: 'Not a common password',
  email: "Doesn't contain your email",
};

/**
 * Turns contract-schema issues into our copy, so forms validate with the exact server schemas
 * (doc 05 §2) but never show zod's default English.
 */
export const formErrorMap: z.core.$ZodErrorMap = (issue) => {
  const field = issue.path?.[0];
  const empty = issue.input === undefined || issue.input === '';
  switch (field) {
    case 'email':
      return empty ? 'Enter your email address.' : 'Enter an email address like name@example.com.';
    case 'password':
    case 'currentPassword':
      return 'Enter your password.';
    case 'newPassword':
      return empty ? 'Enter a new password.' : 'Use at most 1024 characters.';
    case 'fullName':
      return empty ? 'Enter your full name.' : 'Use at most 100 characters for your name.';
    case 'phone':
      return 'Enter a phone number using digits, spaces and an optional +.';
    default:
      return undefined;
  }
};
