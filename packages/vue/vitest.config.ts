import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: import.meta.dirname,
  resolve: {
    alias: {
      // Before the root alias: the supported tooling entry is its own source.
      '@signal-tree/kernel/internals': fileURLToPath(
        new URL('../kernel/src/internals.ts', import.meta.url)
      ),
      '@signal-tree/kernel/adapter': fileURLToPath(
        new URL('../kernel/src/adapter.ts', import.meta.url)
      ),
      '@signal-tree/kernel': fileURLToPath(
        new URL('../kernel/src/index.ts', import.meta.url)
      ),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    exclude: ['**/*typing*.spec.ts'],
  },
});
