import { describe, expect, it } from 'vitest';

import { dstNoticeText } from './dst-copy';

describe('dstNoticeText', () => {
  it('describes the London fall-back in the parent locale', () => {
    const transition = {
      at: '2026-10-25T01:00:00Z',
      offsetBefore: '+01:00',
      offsetAfter: '+00:00',
    };
    expect(dstNoticeText(transition, 'Europe/London', 'en-GB')).toBe(
      'Clocks in London go back one hour on Sunday 25 October. Times after that are already adjusted.',
    );
  });

  it('describes the US spring-forward', () => {
    const transition = {
      at: '2026-03-08T07:00:00Z',
      offsetBefore: '-05:00',
      offsetAfter: '-04:00',
    };
    expect(dstNoticeText(transition, 'America/New_York', 'en-US')).toBe(
      'Clocks in New York go forward one hour on Sunday, March 8. Times after that are already adjusted.',
    );
  });

  it('never contains an en or em dash', () => {
    const transition = {
      at: '2026-10-04T15:30:00Z',
      offsetBefore: '+11:00',
      offsetAfter: '+10:30',
    };
    expect(dstNoticeText(transition, 'Australia/Lord_Howe', 'en-AU')).not.toMatch(/[\u2013\u2014]/);
  });
});
