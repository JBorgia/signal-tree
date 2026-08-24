import { defineConfig } from 'vitest/config';

/**
 * DIAG-JOURNAL-1 F6 runs on its own config because it needs `--expose-gc` in the
 * worker, and the main suite deliberately excludes it.
 *
 * `poolOptions.forks.execArgv` was tried first and silently did nothing on
 * vitest 4, so the flag arrives via NODE_OPTIONS from `verify-gates.mjs`
 * (gate: `journal-retention`). The spec FAILS rather than skips without it.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['src/test-setup.ts'],
    include: ['src/lib/internals/diagnostics/diag-journal-1-eviction.spec.ts'],
  },
  define: { __DEV__: true },
  esbuild: { tsconfigRaw: '{}' },
});
