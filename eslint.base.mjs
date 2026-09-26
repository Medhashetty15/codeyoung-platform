// Shared ESLint flat config for every workspace.
// The root eslint.config.mjs applies it to apps/api and packages/*; apps/web extends it
// from its own eslint.config.js (ESLint resolves the nearest config per linted file).
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import importX from 'eslint-plugin-import-x';
import tseslint from 'typescript-eslint';

/** Files allowed to touch JavaScript `Date` directly (docs/04 §1 rule 5). */
export const DATE_SAFE_FILES = ['packages/time/src/**', 'apps/web/src/features/timezone/**'];

const DATE_MESSAGE =
  'Use @app/time (Temporal) or the injected Clock; raw Date math is not zone safe.';

/** Bans implicit-local-time Date APIs. See docs/04-timezones-and-dst.md. */
export const dateSafetyRules = {
  'no-restricted-syntax': [
    'error',
    { selector: "NewExpression[callee.name='Date']", message: DATE_MESSAGE },
    {
      selector:
        'CallExpression[callee.property.name=/^(get|set)(UTC)?(FullYear|Month|Date|Day|Hours|Minutes|Seconds|Milliseconds)$/]',
      message: DATE_MESSAGE,
    },
    {
      selector:
        'CallExpression[callee.property.name=/^(getTimezoneOffset|toLocaleDateString|toLocaleTimeString)$/]',
      message: DATE_MESSAGE,
    },
  ],
  'no-restricted-properties': [
    'error',
    { object: 'Date', property: 'now', message: DATE_MESSAGE },
    { object: 'Date', property: 'parse', message: DATE_MESSAGE },
    { object: 'Date', property: 'UTC', message: DATE_MESSAGE },
  ],
};

export const baseIgnores = {
  ignores: [
    '**/node_modules/**',
    '**/dist/**',
    '**/coverage/**',
    '.worktrees/**',
    '**/*.tsbuildinfo',
  ],
};

/**
 * @param {{ tsconfigRootDir: string }} options directory containing the calling eslint config
 */
export function baseConfig({ tsconfigRootDir }) {
  return defineConfig(
    baseIgnores,
    js.configs.recommended,
    tseslint.configs.strictTypeChecked,
    {
      languageOptions: {
        parserOptions: { projectService: true, tsconfigRootDir },
      },
      plugins: { 'import-x': importX },
      linterOptions: { reportUnusedDisableDirectives: 'error' },
      rules: {
        ...dateSafetyRules,
        eqeqeq: ['error', 'always'],
        'no-console': 'error',
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/consistent-type-imports': [
          'error',
          { fixStyle: 'inline-type-imports', disallowTypeAnnotations: false },
        ],
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'all' },
        ],
        '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
        'import-x/no-duplicates': 'error',
        'import-x/first': 'error',
        'import-x/no-self-import': 'error',
        'import-x/order': [
          'error',
          {
            groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
            pathGroups: [{ pattern: '@app/**', group: 'internal' }],
            pathGroupsExcludedImportTypes: ['builtin'],
            'newlines-between': 'always',
            alphabetize: { order: 'asc', caseInsensitive: true },
          },
        ],
      },
    },
    {
      files: ['**/*.{js,mjs,cjs}'],
      extends: [tseslint.configs.disableTypeChecked],
    },
    {
      files: DATE_SAFE_FILES,
      rules: { 'no-restricted-syntax': 'off', 'no-restricted-properties': 'off' },
    },
    prettier,
  );
}
