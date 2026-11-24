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
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'inline-type-imports' },
      ],
      // More than 5 named value imports from one module: use a namespace
      // import. Default and type-only imports don't count. To change the
      // limit, change how many times the specifier repeats in the selector.
      'no-restricted-syntax': [
        'error',
        {
          selector: [
            "ImportDeclaration:not([importKind='type']):has(>",
            Array(6)
              .fill("ImportSpecifier:not([importKind='type'])")
              .join(' ~ '),
            ')',
          ].join(' '),
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
