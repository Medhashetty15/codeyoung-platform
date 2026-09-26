// CSP hashes for the inline scripts in index.html (the theme applied before first paint).
// `node scripts/csp-hashes.mjs` prints them; `--check <html>` fails when csp.json has drifted from
// that file, so the build (and the Docker image) cannot ship a script the CSP would block.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));

/** `'sha256-...'` for every inline (non-module, no src) script in the HTML. */
export function inlineScriptHashes(html) {
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
    ([, body]) => `'sha256-${createHash('sha256').update(body).digest('base64')}'`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const checkIndex = process.argv.indexOf('--check');
  const file = checkIndex === -1 ? 'index.html' : process.argv[checkIndex + 1];
  const actual = inlineScriptHashes(readFileSync(root(file), 'utf8'));
  if (checkIndex === -1) {
    process.stdout.write(`${actual.join(' ')}\n`);
  } else {
    const expected = JSON.parse(readFileSync(root('csp.json'), 'utf8')).scriptSrcHashes;
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      process.stderr.write(`csp.json is stale for ${file}: expected ${actual.join(' ')}\n`);
      process.exit(1);
    }
    process.stdout.write(`ok   CSP script hashes match ${file}\n`);
  }
}
