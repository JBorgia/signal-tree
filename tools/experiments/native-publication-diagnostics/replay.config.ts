import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import kernelConfig from '../../../packages/kernel/vitest.config';

// Replace discovery rather than merging the ordinary include globs.
export default defineConfig({
  ...kernelConfig,
  root: fileURLToPath(new URL('../../../', import.meta.url)),
  test: {
    ...kernelConfig.test,
    include: [
      'tools/experiments/native-publication-diagnostics/native-netzero-diagnostic.replay.ts',
      'tools/experiments/native-publication-diagnostics/native-equal-inverse-diagnostic.replay.ts',
    ],
    maxWorkers: 1,
    fileParallelism: false,
  },
});
