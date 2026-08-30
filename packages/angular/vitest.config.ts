import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@signal-tree/angular': fileURLToPath(
        new URL('./src/index.ts', import.meta.url)
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
    environment: 'happy-dom',
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/*typing*.spec.ts'],
  },
});
