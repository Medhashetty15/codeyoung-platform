import { describe, expect, it } from 'vitest';

import indexHtml from '../../index.html?raw';

/**
 * Copy lint (doc 05 §13, doc 07 §9): every string a parent can see lives in these files. Tests,
 * mocks and the dev gallery are excluded; comments are stripped before the word checks.
 */
const sources = import.meta.glob<string>(
  ['../**/*.{ts,tsx}', '!../**/*.spec.{ts,tsx}', '!../test/**', '!../mocks/**', '!../dev/**'],
  { query: '?raw', import: 'default', eager: true },
);

const FILES = { ...sources, 'index.html': indexHtml };

/** Marketing filler that says nothing concrete (doc 07 §9 copy rules). */
const FILLER = [
  'seamless',
  'seamlessly',
  'elevate',
  'unleash',
  'revolutionize',
  'revolutionise',
  'next-gen',
  'effortless',
  'effortlessly',
  'empower',
  'supercharge',
  'cutting-edge',
  'game-changer',
  'world-class',
  'delve',
];

const withoutComments = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

function offenders(test: (line: string) => boolean, strip = false) {
  const found: string[] = [];
  for (const [file, raw] of Object.entries(FILES)) {
    const text = strip ? withoutComments(raw) : raw;
    text.split('\n').forEach((line, index) => {
      if (test(line))
        found.push(`${file.replace('../', 'src/')}:${String(index + 1)}: ${line.trim()}`);
    });
  }
  return found;
}

describe('copy lint', () => {
  it('scans the app sources', () => {
    expect(Object.keys(FILES).length).toBeGreaterThan(100);
  });

  it('has no em or en dashes anywhere', () => {
    expect(offenders((line) => /[\u2013\u2014]/.test(line))).toEqual([]);
  });

  it('has no emojis', () => {
    expect(offenders((line) => /\p{Extended_Pictographic}/u.test(line))).toEqual([]);
  });

  it('uses no filler words', () => {
    const pattern = new RegExp(`\\b(${FILLER.join('|')})\\b`, 'i');
    expect(offenders((line) => pattern.test(line), true)).toEqual([]);
  });

  it('uses at most one middle dot per line', () => {
    expect(offenders((line) => (line.match(/\u00b7/g) ?? []).length > 1, true)).toEqual([]);
  });
});
