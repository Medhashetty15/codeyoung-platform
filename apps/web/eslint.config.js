import eslintReact from '@eslint-react/eslint-plugin';
import { defineConfig } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

import { baseConfig } from '../../eslint.base.mjs';

/** Layering from doc 05 §12: shared <- features <- routes <- app; nothing imports routes or app. */
const LAYER_ZONES = [
  { target: './src/shared', from: './src/features', message: 'shared/ never imports features.' },
  { target: './src/shared', from: './src/routes', message: 'shared/ never imports routes.' },
  { target: './src/shared', from: './src/app', message: 'shared/ never imports app/.' },
  { target: './src/features', from: './src/routes', message: 'features never import routes.' },
  { target: './src/features', from: './src/app', message: 'features never import app/.' },
  { target: './src/routes', from: './src/app', message: 'routes never import app/.' },
  {
    target: './src',
    from: './src/dev',
    except: ['./app/router.tsx', './dev'],
    message: 'dev/ is the dev-only gallery.',
  },
];

export default defineConfig(
  baseConfig({ tsconfigRootDir: import.meta.dirname }),
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [
      eslintReact.configs['recommended-type-checked'],
      reactHooks.configs.flat['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: { globals: globals.browser },
    rules: {
      'import-x/no-restricted-paths': ['error', { zones: LAYER_ZONES }],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@phosphor-icons/core',
              message: 'Use shared/ui/icons (generated, regular weight only).',
            },
          ],
          patterns: [
            {
              group: ['@app/contracts/testing'],
              message: 'Fixture builders are for tests and mocks only.',
            },
          ],
        },
      ],
    },
  },
  {
    // The zone-aware display layer may use Date (docs/04 §1 rule 5); paths here are relative to this file.
    files: ['src/features/timezone/**'],
    rules: { 'no-restricted-syntax': 'off', 'no-restricted-properties': 'off' },
  },
  {
    files: ['src/**/*.spec.{ts,tsx}', 'src/test/**', 'src/mocks/**'],
    rules: {
      'no-restricted-imports': 'off',
      // Vitest and Testing Library matchers are typed loosely.
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    files: ['scripts/**', 'vite.config.ts', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
);
