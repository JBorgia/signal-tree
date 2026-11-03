import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/__tests__/**/*.cjs', 'scripts/__tests__/*.cjs', '**/*.spec.ts'],
    globals: true,
    // Explicit nine-mode gate supplies GC and scenario/output configuration.
    exclude: [
      ...configDefaults.exclude,
      'packages/kernel/src/lib/forwarding-retention-probe.spec.ts',
    ],
  },
});
