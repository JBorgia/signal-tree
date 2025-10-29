import type { Config } from 'jest';

const config: Config = {
  displayName: 'core-enhancers',
  preset: '../../../jest.preset.js',
  testMatch: ['<rootDir>/**/*.spec.ts'],
  rootDir: '.',
  setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
  coverageDirectory: '../../../../coverage/core-enhancers',
  transform: {
    '^.+\\.(ts|mjs|js|html)': [
      'jest-preset-angular',
      {
        tsconfig: '<rootDir>/tsconfig.json',
        stringifyContentPathRegex: '\\.(html|svg)',
      },
    ],
  },
  transformIgnorePatterns: ['node_modules/(?!(.*\\.mjs$|lodash-es))'],
  moduleNameMapper: {
    '^lodash-es$': 'lodash',
  },
};

export default config;
