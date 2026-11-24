import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import tseslint from 'typescript-eslint';

const MAX_NAMED_VALUE_IMPORTS = 5;

function importDeclarationWithMoreNamedValueImportsThan(limit) {
  const namedValueImport = "ImportSpecifier:not([importKind='type'])";
  const tooManyNamedValueImports = Array(limit + 1)
    .fill(namedValueImport)
    .join(' ~ ');
  return `ImportDeclaration:not([importKind='type']):has(> ${tooManyNamedValueImports})`;
}

const noComments = {
  meta: {
    type: 'problem',
    messages: {
      noComment:
        'Comments are not allowed. Express intent through naming, structure, or tests.',
    },
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (comment.type === 'Shebang') continue;
          context.report({ loc: comment.loc, messageId: 'noComment' });
        }
      },
    };
  },
};

export default tseslint.config(
  {
    ignores: ['node_modules/**', 'dist/**', 'build/**', 'coverage/**'],
  },
  {
    linterOptions: {
      noInlineConfig: true,
    },
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['**/*.{js,cjs,mjs,ts}'],
    plugins: {
      local: { rules: { 'no-comments': noComments } },
    },
    rules: {
      'local/no-comments': 'error',
    },
  },
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
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': true,
          'ts-ignore': true,
          'ts-nocheck': true,
          'ts-check': true,
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'inline-type-imports' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: importDeclarationWithMoreNamedValueImportsThan(
            MAX_NAMED_VALUE_IMPORTS,
          ),
          message: `More than ${MAX_NAMED_VALUE_IMPORTS} named imports from one module. Use \`import * as name from "..."\` and dot notation instead.`,
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
