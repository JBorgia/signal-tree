import { defineConfig } from 'vitest/config';

/**
 * The GC-requiring specs run on their own config because they need
 * `--expose-gc` in the worker, and the main suite deliberately excludes them:
 * diagnostic journal eviction, derived recipes, entity add effects and Link
 * ownership. Live/released controls distinguish collection from non-retention.
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
      'src/lib/internals/location-runtime-retention.spec.ts',
      'src/lib/entity-add-effect-retention.spec.ts',
      'src/lib/internals/link-lifetime-retention.spec.ts',
    ],
  },
  define: { __DEV__: true },
  esbuild: { tsconfigRaw: '{}' },
});
