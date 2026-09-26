// @vitest-environment node
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { OUTPUT, renderIcons } from '../../../scripts/generate-icons.mjs';

describe('generated icons', () => {
  it('are up to date with the icon list (run `npm run icons`)', async () => {
    expect(readFileSync(OUTPUT, 'utf8')).toBe(await renderIcons());
  });
});
