import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import prettierConfig from 'eslint-config-prettier/flat';
import globals from 'globals';

const baseRules = {
  'consistent-return': 'error',
  'no-console': ['error', {allow: ['debug', 'info', 'warn', 'error']}],
  'sort-keys': 'off',
  'no-duplicate-imports': 'error',
  'no-restricted-imports': [
    'error',
    {
      patterns: ['@malloydata/malloy/src/*'],
      paths: [
        {
          name: 'lodash',
          message: 'Import [module] from lodash/[module] instead',
        },
      ],
    },
  ],
  'no-throw-literal': 'error',
  '@typescript-eslint/consistent-type-imports': 'off',
  '@typescript-eslint/no-empty-function': 'off',
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/no-non-null-assertion': 'off',
  '@typescript-eslint/no-unused-vars': [
    'error',
    {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
    },
  ],
  '@typescript-eslint/no-unused-expressions': [
    'error',
    {allowShortCircuit: true, allowTernary: true},
  ],
  '@typescript-eslint/no-empty-object-type': [
    'error',
    {allowInterfaces: 'with-single-extends'},
  ],
  'react-hooks/set-state-in-effect': 'off',
  '@typescript-eslint/parameter-properties': [
    'error',
    {prefer: 'parameter-property'},
  ],
};

export default tseslint.config(
  {
    ignores: [
      '**/*.d.ts',
      'node_modules/**',
      'dist/**',
      'build/**',
      'out/**',
      'third_party/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  react.configs.flat.recommended,
  reactHooks.configs.flat.recommended,
  prettierConfig,
  prettierRecommended,
  {
    settings: {
      react: {version: 'detect'},
    },
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: baseRules,
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        warnOnUnsupportedTypeScriptVersion: false,
        project: ['./tsconfig.json'],
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },
  {
    files: ['scripts/**/*.ts'],
    languageOptions: {
      parserOptions: {
        warnOnUnsupportedTypeScriptVersion: false,
        project: ['./scripts/tsconfig.json'],
      },
    },
  },
  {
    files: ['integration/**/*.ts'],
    languageOptions: {
      parserOptions: {
        warnOnUnsupportedTypeScriptVersion: false,
        project: ['./tsconfig.integration.json'],
      },
    },
  },
  {
    files: ['src/server/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {patterns: ['**/extension/**', 'vscode']},
      ],
    },
  },
  {
    files: ['src/worker/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {patterns: ['**/extension/**', '**/server/**', 'vscode']},
      ],
    },
  },
  {
    files: ['src/extension/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {patterns: ['**/worker/**', '**/server/**']},
      ],
    },
  },
  {
    files: ['src/common/**'],
    rules: {
      'no-restricted-imports': ['error', {patterns: ['vscode']}],
    },
  },
  {
    files: ['**/browser/**'],
    rules: {
      'no-restricted-imports': ['error', {patterns: ['fs', 'path']}],
    },
  },
  {
    files: ['scripts/**', 'test/**', 'integration/**'],
    rules: {
      'no-console': 'off',
    },
  }
);
