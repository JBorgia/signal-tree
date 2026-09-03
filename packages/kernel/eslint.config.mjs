import nx from '@nx/eslint-plugin';

import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    ignores: ['coverage/**'],
  },
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: [
            '{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}',
            // Test-runner configs are build-time, not runtime peers. The main
            // vitest.config.ts predates this rule being enforced here;
            // vitest.retention.config.ts is the DIAG-JOURNAL-1 F6 gate's config.
            '{projectRoot}/vitest.config.ts',
            '{projectRoot}/vitest.retention.config.ts',
          ],
          ignoredDependencies: [
            'tslib',
            // Build-time dependencies (not runtime peer dependencies)
            '@nx/rollup',
            '@rollup/plugin-commonjs',
            '@rollup/plugin-node-resolve',
            '@rollup/plugin-typescript',
            'rollup',
            'rollup-plugin-dts',
            'typescript',
          ],
        },
      ],
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
  ...nx.configs['flat/angular'],
  ...nx.configs['flat/angular-template'],
  {
    files: ['**/*.ts'],
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'lib',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'lib',
          style: 'kebab-case',
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    // Override or add rules here
    rules: {},
  },
];
