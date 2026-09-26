import { defaultServerConditions } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resolve @app/time to its TypeScript sources: no pre-build needed.
  ssr: { resolve: { conditions: ['@app/source', ...defaultServerConditions] } },
  test: {
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts'],
      // docs/01 §6: at least 90 % on domain and time code.
      thresholds: { statements: 90, branches: 90, functions: 90, lines: 90 },
    },
  },
});
