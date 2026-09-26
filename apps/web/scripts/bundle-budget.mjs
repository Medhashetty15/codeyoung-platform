/**
 * Initial-JS budget check (doc 05 §12.4: <= 180 KB gzip). For each entry route, sums the gzip size
 * of the entry chunk, the route's lazy chunk and every chunk they import statically (modulepreloads).
 * Run after `vite build`: `node scripts/bundle-budget.mjs`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = 180;
const ROUTES = [
  'src/routes/Landing.tsx',
  'src/routes/Book.tsx',
  'src/routes/BookConfirm.tsx',
  'src/routes/Bookings.tsx',
  'src/routes/BookingDetail.tsx',
  'src/routes/Reschedule.tsx',
];

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const manifest = JSON.parse(readFileSync(`${dist}.vite/manifest.json`, 'utf8'));
const entry = Object.values(manifest).find((chunk) => chunk.isEntry);

function staticClosure(key, seen = new Set()) {
  if (seen.has(key)) return seen;
  seen.add(key);
  for (const next of manifest[key]?.imports ?? []) staticClosure(next, seen);
  return seen;
}

const gzipKb = (file) => gzipSync(readFileSync(`${dist}${file}`)).length / 1024;
let failed = false;

for (const route of ROUTES) {
  const keys = new Set([...staticClosure(entry.src), ...staticClosure(route)]);
  const total = [...keys].reduce((sum, key) => sum + gzipKb(manifest[key].file), 0);
  const ok = total <= BUDGET_KB;
  failed ||= !ok;
  process.stdout.write(
    `${ok ? 'ok  ' : 'OVER'} ${route.padEnd(28)} ${total.toFixed(1)} KB gzip (budget ${BUDGET_KB})\n`,
  );
}

process.exitCode = failed ? 1 : 0;
