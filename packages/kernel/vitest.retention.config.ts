import { defineConfig } from 'vitest/config';

/**
 * The GC-requiring specs run on their own config because they need
 * `--expose-gc` in the worker, and the main suite deliberately excludes them:
 * DIAG-JOURNAL-1 F6 (journal eviction releases what it held) and A2-5 (a
 * durability capability releases the tree on destroy()).
 *
 * `poolOptions.forks.execArgv` was tried first and silently did nothing on
 * vitest 4, so the flag arrives via NODE_OPTIONS from `verify-gates.mjs`
 * (gate: `retention-gc`). The spec FAILS rather than skips without it.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    include: [
      'src/lib/internals/diagnostics/diag-journal-1-eviction.spec.ts',
      'src/enhancers/serialization/a2-5-lifetime.spec.ts',
      'src/lib/internals/location-runtime-retention.spec.ts',
    ],
  },
  define: { __DEV__: true },
  esbuild: { tsconfigRaw: '{}' },
});
