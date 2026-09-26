import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

/**
 * Loads KEY=value pairs from a local `.env` file into `process.env` for local
 * development. Variables already set in the real environment always win, and a
 * missing file is not an error (production injects env vars directly).
 */
export function loadEnvFile(path = '.env', target: NodeJS.ProcessEnv = process.env): void {
  if (!existsSync(path)) return;
  const parsed = parseEnv(readFileSync(path, 'utf8'));
  for (const [key, value] of Object.entries(parsed)) {
    if (target[key] === undefined && value !== undefined) target[key] = value;
  }
}
