/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defaultClientConditions, defineConfig, loadEnv } from 'vite';

import { preloadFonts } from './scripts/preload-fonts.ts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, 'VITE_');
  return {
    plugins: [react(), tailwindcss(), preloadFonts()],
    resolve: {
      // Workspace packages resolve to their TypeScript sources: no rebuild while developing.
      conditions: ['@app/source', ...defaultClientConditions],
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        // Same-origin API keeps the SameSite=Strict refresh cookie working (doc 05 §2).
        '/api': {
          target: env.VITE_API_PROXY_TARGET ?? 'http://localhost:3001',
          changeOrigin: false,
        },
      },
    },
    build: {
      target: 'es2022',
      sourcemap: true,
    },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.spec.{ts,tsx}', 'scripts/**/*.spec.{ts,mjs}'],
      setupFiles: ['./src/test/setup.ts'],
      css: false,
      restoreMocks: true,
    },
  };
});
