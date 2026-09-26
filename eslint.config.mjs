import { defineConfig } from 'eslint/config';
import globals from 'globals';

import { baseConfig } from './eslint.base.mjs';

const DOMAIN_FORBIDDEN_IMPORTS = [
  {
    group: ['@nestjs/*', 'typeorm', 'typeorm/*', 'pg'],
    message: 'domain/ is framework free (docs/03 §1).',
  },
];

export default defineConfig(
  baseConfig({ tsconfigRootDir: import.meta.dirname }),
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: { globals: globals.node },
  },
  {
    // Shared packages run in the browser too: no Node built-ins, no process globals.
    files: ['packages/*/src/**/*.ts'],
    languageOptions: { globals: globals['shared-node-browser'] },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['node:*'], message: 'Shared packages must stay browser safe.' },
            {
              group: ['@nestjs/*', 'typeorm', '@app/api', '@app/web'],
              message: 'Packages never depend on apps.',
            },
          ],
        },
      ],
      'no-restricted-globals': ['error', 'process', 'Buffer', '__dirname', 'require'],
    },
  },
  {
    files: ['apps/api/**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: {
      // Nest modules are decorated, intentionally empty classes.
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
      'import-x/no-restricted-paths': [
        'error',
        {
          zones: [
            { target: './apps/api', from: './apps/web', message: 'API never imports web code.' },
            {
              target: './apps/api/src',
              from: './apps/api/test',
              message: 'Production code never imports tests.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/api/src/modules/*/domain/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: DOMAIN_FORBIDDEN_IMPORTS }] },
  },
  {
    files: ['apps/api/**/*.spec.ts', 'apps/api/test/**/*.ts'],
    rules: {
      // Vitest matchers (expect.any etc.) are typed as any.
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
);
