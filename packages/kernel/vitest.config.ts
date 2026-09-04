import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      // ⚠️ THE BARREL, RESOLVABLE FROM A SPEC. Every spec here imports through a
      // relative path, so nothing could testify about the PUBLIC export list —
      // deleting a re-export left specs green because they reached past it. This
      // alias lets `public-barrel-carrier.spec.ts` import from
      // '@signal-tree/kernel' and fail when a symbol leaves the barrel.
      {
        find: '@signal-tree/kernel/adapter',
        replacement: fileURLToPath(
          new URL('./src/adapter.ts', import.meta.url)
        ),
      },
      {
        find: '@signal-tree/kernel',
        replacement: fileURLToPath(
          new URL('./src/index.ts', import.meta.url)
        ),
      },
      {
        find: '@signal-tree/angular',
        replacement: fileURLToPath(
          new URL('../angular/src/index.ts', import.meta.url)
        ),
      },
    ],
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    maxWorkers: process.env['CI'] ? 2 : undefined,
    include: [
      '**/*.spec.ts',
      'tests/**/*.spec.ts',
      'src/**/*.spec.ts',
      'src/**/lib/**/*.spec.ts',
    ],
    exclude: [
      '**/node_modules/**',
      '**/typing/**',
      '**/*.generated.spec.ts',
      '**/all-chains.spec.ts',
      '**/all-subsets.spec.ts',
      // Exclude type-only spec files generated for typing checks
      '**/*/typing.spec.ts',
      '**/lib/typing.spec.ts',
      '**/*typing-chain.spec.ts',
      '**/*typing*.spec.ts',
      // DIAG-JOURNAL-1 F6 measures a retention property observable only across
      // a real garbage collection, so it needs `--expose-gc`. Handing the
      // workers that flag via `poolOptions.forks.execArgv` was tried first and
      // silently did nothing on vitest 4 — a config knob that quietly fails is
      // the exact shape of defect this release keeps finding, so it is not
      // used. These files run as their own gate instead (`retention-gc` in
      // tools/verify-gates.mjs) and FAIL rather than skipping without the
      // flag: a skipped retention test reads as evidence in a green run.
      //
      // ⚠️ Adding a GC-requiring spec means editing THREE places — this
      // exclude, `vitest.retention.config.ts`'s include, and the gate. Missing
      // this one showed up immediately as two failures in `nx test core`.
      '**/diag-journal-1-eviction.spec.ts',
      '**/a2-5-lifetime.spec.ts',
      '**/location-runtime-retention.spec.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['**/*.spec.ts', '**/__tests__/**', '**/index.ts', '**/noop.ts'],
    },
  },
  define: {
    __DEV__: true,
  },
  esbuild: {
    tsconfigRaw: '{}',
  },
});
