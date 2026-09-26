import { describe, expect, it } from 'vitest';

import { epochMs } from '@app/time';

import { durationPhrase, inAppPath, isClassWindowOpen, notModifiableText } from './booking-view';

describe('isClassWindowOpen', () => {
  const booking = {
    status: 'CONFIRMED' as const,
    start: '2026-10-24T16:00:00Z',
    end: '2026-10-24T17:00:00Z',
  };
  const at = (iso: string) => epochMs(iso);

  it('opens the configured minutes before the start and closes at the end', () => {
    expect(isClassWindowOpen(booking, at('2026-10-24T15:49:59Z'), 10)).toBe(false);
    expect(isClassWindowOpen(booking, at('2026-10-24T15:50:00Z'), 10)).toBe(true);
    expect(isClassWindowOpen(booking, at('2026-10-24T16:59:59Z'), 10)).toBe(true);
    expect(isClassWindowOpen(booking, at('2026-10-24T17:00:00Z'), 10)).toBe(false);
  });

  it('never opens for a trial that is no longer confirmed', () => {
    expect(
      isClassWindowOpen({ ...booking, status: 'CANCELLED' }, at('2026-10-24T16:10:00Z'), 10),
    ).toBe(false);
  });
});

describe('inAppPath', () => {
  it('keeps same-site class links inside the app', () => {
    expect(inAppPath('https://app.codeyoung.dev/class/abc?x=1', 'https://app.codeyoung.dev')).toBe(
      '/class/abc?x=1',
    );
    expect(inAppPath('https://meet.example.com/abc', 'https://app.codeyoung.dev')).toBeNull();
    expect(inAppPath('not a url', 'https://app.codeyoung.dev')).toBeNull();
  });
});

describe('copy', () => {
  it.each([
    [120, '2 hours'],
    [60, '1 hour'],
    [90, '90 minutes'],
  ])('%i minutes reads %j', (minutes, phrase) => {
    expect(durationPhrase(minutes)).toBe(phrase);
  });

  it('explains why a trial can no longer change', () => {
    expect(notModifiableText('PAST_RESCHEDULE_CUTOFF', 120)).toBe(
      'Trials can be moved up to 2 hours before they start.',
    );
    expect(notModifiableText('ALREADY_STARTED', 120)).toBe(
      'This trial has already started, so it can no longer be changed.',
    );
    expect(notModifiableText('NOT_CONFIRMED', 120)).toBe(
      'This trial was already cancelled or moved.',
    );
  });
});
