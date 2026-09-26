import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The web image's Content-Security-Policy (infra/web/Caddyfile) allows inline blocks by hash
 * only. This recomputes each hash from its source, so editing the theme script in index.html or
 * upgrading Sonner or NumberFlow fails here until the header lists the new hash.
 */
const root = resolve(import.meta.dirname, '../../..');

function sha256(text: string): string {
  return `'sha256-${createHash('sha256').update(text).digest('base64')}'`;
}

function policy(): Map<string, string[]> {
  const caddyfile = readFileSync(resolve(root, 'infra/web/Caddyfile'), 'utf8');
  const header = /Content-Security-Policy "([^"]+)"/.exec(caddyfile)?.[1] ?? '';
  return new Map(
    header.split(';').map((directive) => {
      const [name = '', ...values] = directive.trim().split(/\s+/);
      return [name, values];
    }),
  );
}

function hashesIn(directive: string): string[] {
  return (policy().get(directive) ?? []).filter((value) => value.startsWith("'sha256-")).sort();
}

describe('Content-Security-Policy of the web image', () => {
  it('allows exactly the inline scripts of index.html', () => {
    const html = readFileSync(resolve(root, 'apps/web/index.html'), 'utf8');
    const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(
      (match) => sha256(match[1] ?? ''),
    );

    expect(inline.length).toBeGreaterThan(0);
    expect(hashesIn('script-src')).toEqual(inline.sort());
  });

  it('allows exactly the <style> blocks Sonner and NumberFlow inject', async () => {
    await import('sonner');
    const sonner = [...document.head.querySelectorAll('style')]
      .map((style) => style.textContent)
      .filter((css) => css.includes('[data-sonner-toaster]'));
    // NumberFlow's shadow-root <style> is the third of its CSP-friendly style exports.
    const { buildStyles } = await import('number-flow/csp');
    const numberFlow = buildStyles()[2];

    // Sonner appends its <style> empty, then fills it; browsers check the empty block too.
    const empty = '';

    expect(sonner).toHaveLength(1);
    expect(hashesIn('style-src')).toEqual([...sonner, numberFlow, empty].map(sha256).sort());
  });

  it('keeps everything else same-origin and never allows unsafe-inline or eval', () => {
    const directives = policy();

    expect(directives.get('default-src')).toEqual(["'self'"]);
    expect(directives.get('connect-src')).toEqual(["'self'"]);
    expect(directives.get('font-src')).toEqual(["'self'", 'data:']);
    expect(directives.get('frame-ancestors')).toEqual(["'none'"]);
    expect([...directives.values()].flat()).not.toContain("'unsafe-inline'");
    expect([...directives.values()].flat()).not.toContain("'unsafe-eval'");
  });
});
