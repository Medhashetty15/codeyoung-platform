// @vitest-environment node
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

/** Guards the colour contract in doc 07 §2: every text/control pairing meets WCAG AA in both themes. */
const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

function themeTokens(selector: string): Record<string, string> {
  const block =
    css.match(new RegExp(`${selector.replace(/[[\]"]/g, '\\$&')}\\s*{([^}]*)}`))?.[1] ?? '';
  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map(
      ([, name = '', hex = '']): [string, string] => [name, hex],
    ),
  );
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

const TEXT = 4.5;
const NON_TEXT = 3; // WCAG 1.4.11: control edges, focus ring, icons; also disabled labels (team bar)

const pairs: [foreground: string, background: string, minimum: number][] = [
  ['ink', 'canvas', TEXT],
  ['ink', 'surface', TEXT],
  ['ink', 'surface-sunken', TEXT],
  ['ink', 'caution-tint', TEXT],
  ['ink', 'danger-tint', TEXT],
  ['ink-muted', 'canvas', TEXT],
  ['ink-muted', 'surface', TEXT],
  ['ink-muted', 'surface-sunken', TEXT],
  ['ink-faint', 'surface', NON_TEXT],
  ['ink-faint', 'surface-sunken', NON_TEXT],
  ['canvas', 'ink', TEXT],
  ['on-accent', 'accent', TEXT],
  ['on-accent', 'accent-hover', TEXT],
  ['on-danger', 'danger', TEXT],
  ['accent', 'surface', TEXT],
  ['accent', 'canvas', TEXT],
  ['accent-ink', 'accent-tint', TEXT],
  ['danger', 'surface', TEXT],
  ['danger', 'canvas', TEXT],
  ['caution', 'caution-tint', NON_TEXT],
  ['line-control', 'surface', NON_TEXT],
];

describe.each([
  ['light', themeTokens(':root')],
  ['dark', themeTokens(":root[data-theme='dark']")],
])('%s theme', (_, tokens) => {
  it.each(pairs)('%s on %s meets %d:1', (foreground, background, minimum) => {
    const fg = tokens[foreground];
    const bg = tokens[background];
    expect(fg, `--${foreground} missing`).toBeDefined();
    expect(bg, `--${background} missing`).toBeDefined();
    expect(contrast(fg!, bg!)).toBeGreaterThanOrEqual(minimum);
  });
});
