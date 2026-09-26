import { describe, expect, it } from 'vitest';

import commonPasswords, { isCommonPassword } from './common-passwords.js';
import { PASSWORD_MAX_LENGTH, passwordPolicyViolations } from './password-policy.js';

const EMAIL = 'hannah@okafor.co.uk';

describe('passwordPolicyViolations', () => {
  it('accepts a long, uncommon password', () => {
    expect(passwordPolicyViolations('violet-harbour-lantern', EMAIL, isCommonPassword)).toEqual([]);
  });

  it('reports every rule broken, in a stable order', () => {
    expect(passwordPolicyViolations('hannah', EMAIL, () => true)).toEqual([
      'TOO_SHORT',
      'COMMON',
      'CONTAINS_EMAIL',
    ]);
  });

  it('counts characters, not UTF-16 units', () => {
    expect(passwordPolicyViolations('🙂🙂🙂🙂🙂🙂🙂', EMAIL, isCommonPassword)).toEqual([
      'TOO_SHORT',
    ]);
  });

  it('rejects passwords over the maximum length', () => {
    expect(
      passwordPolicyViolations('x'.repeat(PASSWORD_MAX_LENGTH + 1), EMAIL, isCommonPassword),
    ).toEqual(['TOO_LONG']);
  });

  it('matches the email local part case-insensitively', () => {
    expect(passwordPolicyViolations('MyHANNAHpass!', EMAIL, isCommonPassword)).toEqual([
      'CONTAINS_EMAIL',
    ]);
  });

  it('ignores very short local parts and a missing email', () => {
    expect(
      passwordPolicyViolations('abandoned-kite-7', 'ab@example.com', isCommonPassword),
    ).toEqual([]);
    expect(passwordPolicyViolations('abandoned-kite-7', undefined, isCommonPassword)).toEqual([]);
  });
});

describe('common passwords', () => {
  it('knows the classics, case-insensitively', () => {
    expect(isCommonPassword('password1')).toBe(true);
    expect(isCommonPassword('PassWord1')).toBe(true);
    expect(isCommonPassword('qwertyuiop')).toBe(true);
    expect(isCommonPassword('violet-harbour-lantern')).toBe(false);
  });

  it('only stores entries that can pass the length rule', () => {
    expect(commonPasswords.size).toBeGreaterThan(2000);
    for (const password of commonPasswords)
      expect(Array.from(password).length).toBeGreaterThanOrEqual(8);
  });
});
