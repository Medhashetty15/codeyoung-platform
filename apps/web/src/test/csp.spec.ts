import { describe, expect, it } from 'vitest';

import csp from '../../csp.json';
import indexHtml from '../../index.html?raw';
import { inlineScriptHashes } from '../../scripts/csp-hashes.mjs';

/** The Caddy CSP allows exactly these inline scripts (README "Content Security Policy"). */
describe('CSP script hashes', () => {
  it('match the inline scripts in index.html', () => {
    expect(inlineScriptHashes(indexHtml)).toEqual(csp.scriptSrcHashes);
  });
});
