import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadEnvFile } from './load-env-file';

function envFile(content: string): string {
  const path = join(mkdtempSync(join(tmpdir(), 'cy-env-')), '.env');
  writeFileSync(path, content);
  return path;
}

describe('loadEnvFile', () => {
  it('adds variables that are not set yet', () => {
    const target: NodeJS.ProcessEnv = {};

    loadEnvFile(envFile('PORT=3001\n# comment\nLOG_LEVEL="debug"\n'), target);

    expect(target).toEqual({ PORT: '3001', LOG_LEVEL: 'debug' });
  });

  it('never overrides the real environment', () => {
    const target: NodeJS.ProcessEnv = { PORT: '4000' };

    loadEnvFile(envFile('PORT=3001\n'), target);

    expect(target.PORT).toBe('4000');
  });

  it('ignores a missing file', () => {
    const target: NodeJS.ProcessEnv = {};

    loadEnvFile(join(tmpdir(), 'definitely-missing', '.env'), target);

    expect(target).toEqual({});
  });
});
