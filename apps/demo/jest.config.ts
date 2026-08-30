module.exports = {
  displayName: 'demo',
  preset: '../../jest.preset.js',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  coverageDirectory: '../../coverage/apps/demo',
  maxWorkers: 2,
  testPathIgnorePatterns: ['demo-e2e'],
  moduleNameMapper: {
    '^@signal-tree/angular$': '<rootDir>/../../packages/angular/src/index.ts',
    '^@signal-tree/kernel$': '<rootDir>/../../packages/kernel/src/index.ts',
    '^@signal-tree/kernel/adapter$':
      '<rootDir>/../../packages/kernel/src/adapter.ts',
    // Flat-file subpaths (no index.ts inside a same-named directory) — must be
    // matched before the generic `/$1/index.ts` fallback below, which only
    // resolves subpaths that ARE directories (e.g. `enhancers`).
    '^@signal-tree/kernel/(authoring)$':
      '<rootDir>/../../packages/kernel/src/$1.ts',
    '^@signal-tree/kernel/(.*)$': '<rootDir>/../../packages/kernel/src/$1/index.ts',
    '^@signaltree/(.*)$': '<rootDir>/../../packages/$1/src/index.ts',
    '^@app/(.*)$': '<rootDir>/src/app/$1',
    '^@benchmark/(.*)$': '<rootDir>/src/app/services/benchmark/$1',
    '^@api/(.*)$': '<rootDir>/../../api/$1',
    '^@packages/(.*)$': '<rootDir>/../../packages/$1',
    '^@types/(.*)$': '<rootDir>/../../types/$1',
    '^(akita-benchmark-service|elf-benchmark-service|ngrx-benchmark-service|ngrx-signals-benchmark-service|ngxs-benchmark-service|signaltree-benchmark-service|realistic-benchmark-service)$':
      '<rootDir>/src/app/tests/__mocks__/$1.ts',
    '^\\.\\./services/realistic-benchmark\\.service$':
      '<rootDir>/src/app/tests/__mocks__/realistic-benchmark.service.ts',
  },
  transform: {
    '^.+\\.(ts|mjs|js|html)$': [
      'jest-preset-angular',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        stringifyContentPathRegex: '\\.(html|svg)$',
      },
    ],
  },
  transformIgnorePatterns: [
    // `marked` ships pure ESM with no .mjs extension (package.json "type":
    // "module", main -> lib/marked.esm.js) — needs to be transformed like the
    // .mjs-suffixed packages below, or importing DocumentationComponent (which
    // imports `marked` for README rendering) fails every spec with
    // "SyntaxError: Unexpected token 'export'".
    //
    // Under pnpm, the real (post-symlink) path is nested twice, e.g.
    // node_modules/.pnpm/marked@16.4.2/node_modules/marked/lib/marked.esm.js
    // — a bare `marked` alternative only clears the *inner* `node_modules/`
    // occurrence; the outer one (immediately followed by `.pnpm/...`) still
    // matches the "ignore" pattern and short-circuits `.test()` to true. The
    // `.mjs$` alternative dodges this because it's anchored to end-of-string
    // via `.*`, so it matches regardless of nesting depth — `marked` needs
    // the same nesting-agnostic treatment since its bundle is `.esm.js`, not
    // `.mjs`. Both the bare and the nesting-agnostic form are required.
    'node_modules/(?!(@ngrx|@ngxs|elf|@signaltree|marked|.*\\.mjs$|@angular|@angular/.*|.*node_modules/marked/))',
  ],
  snapshotSerializers: [
    'jest-preset-angular/build/serializers/no-ng-attributes',
    'jest-preset-angular/build/serializers/ng-snapshot',
    'jest-preset-angular/build/serializers/html-comment',
  ],
};
