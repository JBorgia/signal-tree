import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// Rule 7 (BRIEF.md section 2): nothing named or living under experimental,
// research, prototype or spike may be imported by shipping code. This catches
// direct imports; ci/boundaries.mjs checks reachability from every public
// entry point.
const restrictedWords = ['experimental', 'research', 'prototype', 'spike'];

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['ci/**/*.mjs'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly', URL: 'readonly' } },
  },
  {
    files: ['packages/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: restrictedWords.flatMap((word) => [
            { group: [`**/${word}`, `**/${word}/**`, `**/${word}[-_.]*`, `**/*[-_.]${word}`, `**/*[-_.]${word}[-_.]*`], message: `Rule 7: modules named or living under "${word}" stay out of shipping code.` },
          ]),
        },
      ],
    },
  },
);
