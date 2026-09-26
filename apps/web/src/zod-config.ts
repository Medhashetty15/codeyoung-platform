/**
 * zod 4 probes `new Function` once to pick its fast parse path; under our Content Security Policy
 * (no 'unsafe-eval') the browser reports that probe as a violation. `jitless` skips it. zod reads
 * this object from globalThis when it first loads, so setting it here keeps zod itself out of the
 * entry chunk. It must run before the first parse (the probe is lazy), which main.tsx guarantees.
 */
declare global {
  var __zod_globalConfig: { jitless?: boolean } | undefined;
}

// Mutate rather than replace: if zod's core is already loaded it holds a reference to this object.
Object.assign((globalThis.__zod_globalConfig ??= {}), { jitless: true });

export {};
