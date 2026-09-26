import { describe, expect, it } from 'vitest';

import { censor, maskEmail, redactUrl } from './redaction';

describe('maskEmail', () => {
  it('keeps the first character and the domain', () => {
    expect(maskEmail('hannah.okafor@example.com')).toBe('h***@example.com');
  });

  it('fully redacts values that are not emails', () => {
    expect(maskEmail('not-an-email')).toBe('[REDACTED]');
    expect(maskEmail('@example.com')).toBe('[REDACTED]');
  });
});

describe('censor', () => {
  it('masks emails and removes every other redacted value', () => {
    expect(censor('hannah.okafor@example.com', ['user', 'email'])).toBe('h***@example.com');
    expect(censor('hunter22', ['body', 'password'])).toBe('[REDACTED]');
    expect(censor(42, ['email'])).toBe('[REDACTED]');
  });
});

describe('redactUrl', () => {
  it('removes classroom join tokens from paths', () => {
    expect(redactUrl('/api/v1/classroom/Zm9vYmFy0123?x=1')).toBe(
      '/api/v1/classroom/[REDACTED]?x=1',
    );
  });

  it('leaves other URLs untouched', () => {
    expect(redactUrl('/api/v1/bookings?scope=upcoming')).toBe('/api/v1/bookings?scope=upcoming');
  });
});
