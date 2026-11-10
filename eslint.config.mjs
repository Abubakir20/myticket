// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // Frontend: brauzer ES modullari (public/js) va ularning testlari (test/web)
    files: ['public/js/**/*.js', 'test/web/**/*.mjs'],
    languageOptions: {
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: {
        projectService: false,
        project: ['./public/tsconfig.json', './test/web/tsconfig.json'],
      },
    },
  },
  {
    files: ['public/js/boot.js'],
    languageOptions: { sourceType: 'script' },
    rules: { 'no-var': 'off' },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },
  {
    // node:test'ning test() chaqiruvlari promise qaytaradi — runner o'zi kutadi
    files: ['test/web/**/*.mjs'],
    rules: { '@typescript-eslint/no-floating-promises': 'off' },
  },
);
