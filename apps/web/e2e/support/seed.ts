import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** What `db:seed --scenario e2e` prints (API doc 03 §11). */
export interface Seed {
  timezone: string;
  today: string;
  demoParent: { email: string; password: string };
  oneSlotLeft: { date: string; slot: { start: string; end: string } };
  fullyBooked: { date: string };
  empty: boolean;
}

export function seedFile(timezone: string): string {
  return fileURLToPath(
    new URL(`../../e2e-results/.seed/${timezone.replace('/', '-')}.json`, import.meta.url),
  );
}

export function readSeed(timezone: string): Seed {
  return JSON.parse(readFileSync(seedFile(timezone), 'utf8')) as Seed;
}
