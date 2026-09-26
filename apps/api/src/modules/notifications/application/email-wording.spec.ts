import { describe, expect, it } from 'vitest';

import {
  classTime,
  classWhen,
  durationWords,
  relativeDay,
  shortDate,
  startTime,
} from './email-wording';

const START = '2026-10-24T16:00:00Z';
const END = '2026-10-24T17:00:00Z';

describe('email wording', () => {
  it('describes the class in each recipient zone like the UI does', () => {
    expect(classWhen(START, END, 'Europe/London')).toBe(
      'Saturday, 24 October 2026, 5:00 to 6:00 PM London time (GMT+1)',
    );
    expect(classWhen(START, END, 'Asia/Kolkata')).toBe(
      'Saturday, 24 October 2026, 9:30 to 10:30 PM Kolkata time (GMT+5:30)',
    );
    expect(classTime(START, END, 'America/New_York')).toBe('12:00 to 1:00 PM Eastern Time (GMT-4)');
    expect(shortDate(START, 'Asia/Kolkata')).toBe('Saturday 24 October');
    expect(startTime(START, 'Europe/London')).toBe('5:00 PM London time (GMT+1)');
  });

  it('never uses a dash in a range', () => {
    expect(classWhen('2026-10-24T11:30:00Z', '2026-10-24T12:30:00Z', 'Europe/London')).not.toMatch(
      /[–—]/,
    );
  });

  it('names the day in the recipient zone', () => {
    const now = '2026-10-24T09:00:00Z';

    expect(relativeDay(START, 'Europe/London', now)).toBe('today');
    expect(relativeDay('2026-10-25T16:00:00Z', 'Europe/London', now)).toBe('tomorrow');
    expect(relativeDay('2026-10-26T16:00:00Z', 'Europe/London', now)).toBe('on Monday 26 October');
    // 20:00Z Saturday is already Sunday 01:30 in India.
    expect(relativeDay('2026-10-24T20:00:00Z', 'Asia/Kolkata', now)).toBe('tomorrow');
  });

  it('counts calendar days across a DST change, not 24-hour periods', () => {
    // London springs forward on Sun 29 Mar (a 23-hour day). The 24-hour reminder
    // for Mon 00:30 goes out Sat 23:30: the class is two calendar days away.
    expect(relativeDay('2026-03-29T23:30:00Z', 'Europe/London', '2026-03-28T23:30:00Z')).toBe(
      'on Monday 30 March',
    );
    // London falls back on Sun 25 Oct (a 25-hour day). The 24-hour reminder for
    // Sun 23:30 goes out Sun 00:30: the class is the same day.
    expect(relativeDay('2026-10-25T23:30:00Z', 'Europe/London', '2026-10-24T23:30:00Z')).toBe(
      'today',
    );
  });

  it('writes durations in words', () => {
    expect(durationWords(10)).toBe('10 minutes');
    expect(durationWords(1)).toBe('1 minute');
    expect(durationWords(60)).toBe('1 hour');
    expect(durationWords(120)).toBe('2 hours');
    expect(durationWords(90)).toBe('90 minutes');
  });
});
