/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defaultClientConditions, defaultServerConditions, defineConfig, loadEnv } from 'vite';

import { preloadFonts } from './scripts/preload-fonts.ts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, 'VITE_');
  // Same-origin API keeps the SameSite=Strict refresh cookie working (doc 05 §2).
  const proxy = {
    '/api': { target: env.VITE_API_PROXY_TARGET ?? 'http://localhost:3001', changeOrigin: false },
  };
  return {
    plugins: [react(), tailwindcss(), preloadFonts()],
    resolve: {
      // Workspace packages resolve to their TypeScript sources: no rebuild while developing.
      conditions: ['@app/source', ...defaultClientConditions],
    },
    // Specs running in the node environment resolve through SSR; keep them on sources too.
    ssr: { resolve: { conditions: ['@app/source', ...defaultServerConditions] } },
    server: { port: 5173, strictPort: true, proxy },
    // The built app, served for end-to-end tests in CI (doc 05 §13).
    preview: { port: 4173, strictPort: true, proxy },
    build: {
      target: 'es2022',
      sourcemap: true,
      // Read by scripts/bundle-budget.mjs to measure what each route really downloads.
      manifest: true,
    },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.spec.{ts,tsx}', 'scripts/**/*.spec.{ts,mjs}'],
      setupFiles: ['./src/test/setup.ts'],
      css: false,
      restoreMocks: true,
      // Transform workspace packages instead of letting Node load them, so @app/source applies.
      server: { deps: { inline: [/^@app\//] } },
    },
  };
});
