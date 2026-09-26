import swc from 'unplugin-swc';
import { defaultServerConditions } from 'vite';
import { defineConfig } from 'vitest/config';

// Nest DI needs decorator metadata, which only SWC (not oxc/esbuild) emits.
const decorators = swc.vite({ module: { type: 'es6' } });

// Resolve @app/* workspace packages to their TypeScript sources: no pre-build needed.
const ssr = { resolve: { conditions: ['@app/source', ...defaultServerConditions] } };

export default defineConfig({
  plugins: [decorators],
  ssr,
  test: {
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/main.ts', 'src/worker.ts', 'src/cli.ts'],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.spec.ts'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['test/**/*.int-spec.ts'],
          environment: 'node',
          globalSetup: ['test/support/global-setup.ts'],
          testTimeout: 30_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
