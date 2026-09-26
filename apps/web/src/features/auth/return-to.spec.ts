import { describe, expect, it } from 'vitest';

import { loginPathFor, sanitizeReturnTo } from './return-to';

describe('sanitizeReturnTo', () => {
  it.each([
    ['/bookings', '/bookings'],
    [
      '/book/confirm?slot=2026-10-24T16:00:00Z&tz=Europe/London',
      '/book/confirm?slot=2026-10-24T16:00:00Z&tz=Europe/London',
    ],
    ['/bookings/abc#details', '/bookings/abc#details'],
    ['/a/../bookings', '/bookings'],
  ])('keeps relative path %j', (input, expected) => {
    expect(sanitizeReturnTo(input)).toBe(expected);
  });

  it.each([
    null,
    undefined,
    '',
    'bookings',
    'https://evil.example/phish',
    '//evil.example',
    '/\\evil.example',
    'javascript:alert(1)',
    '/\u0000bookings',
    `/${'a'.repeat(2048)}`,
  ])('rejects %j', (input) => {
    expect(sanitizeReturnTo(input)).toBeNull();
  });
});

describe('loginPathFor', () => {
  it('encodes the return path and drops a pointless return to the home page', () => {
    expect(loginPathFor('/bookings?scope=past')).toBe('/login?returnTo=%2Fbookings%3Fscope%3Dpast');
    expect(loginPathFor('/')).toBe('/login');
    expect(loginPathFor('https://evil.example')).toBe('/login');
  });
});
