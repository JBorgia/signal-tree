import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.spec.ts', 'ci/**/*.spec.ts'],
    passWithNoTests: true,
  },
});
