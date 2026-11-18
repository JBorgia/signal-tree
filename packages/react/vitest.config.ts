/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  root: import.meta.dirname,
  plugins: [
    react(),
    // Follow this project's lib/spec references; historical audit tsconfigs are
    // evidence artifacts, not inputs to the live workspace graph.
    tsconfigPaths({
      projects: [fileURLToPath(new URL('./tsconfig.json', import.meta.url))],
    }),
  ],
  resolve: {
    alias: {
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
    environment: 'jsdom',
    include: ['src/**/*.spec.tsx'],
  },
});
