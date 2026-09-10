import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: import.meta.dirname,
  resolve: {
    alias: {
      '@signal-tree/kernel/adapter': fileURLToPath(
        new URL('../../packages/kernel/src/adapter.ts', import.meta.url)
      ),
      '@signal-tree/kernel/internals': fileURLToPath(
        new URL('../../packages/kernel/src/internals.ts', import.meta.url)
      ),
      '@signal-tree/kernel': fileURLToPath(
        new URL('../../packages/kernel/src/index.ts', import.meta.url)
      ),
      '@signal-tree/studio-adapter': fileURLToPath(
        new URL('../../packages/studio-adapter/src/index.ts', import.meta.url)
      ),
      '@signal-tree/studio-query': fileURLToPath(
        new URL('../../packages/studio-query/src/index.ts', import.meta.url)
      ),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
});
