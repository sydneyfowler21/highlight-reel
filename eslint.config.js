import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['node_modules/**', 'dist/**', 'build/**', 'coverage/**'],
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
      },
    },
  },
  {
    files: ['**/*.ts'],
    rules: {
      // More than 5 named imports from one module: use a namespace import.
      // To change the limit, change the nth-child number to limit + 1.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportDeclaration > ImportSpecifier:nth-child(6)',
          message:
            'More than 5 named imports from one module. Use `import * as name from "..."` and dot notation instead.',
        },
      ],
    },
  },
  {
    files: ['src/__tests__/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  eslintConfigPrettier,
);
