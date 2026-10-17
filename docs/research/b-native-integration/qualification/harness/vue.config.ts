import { fileURLToPath } from 'node:url';
import { mergeConfig } from 'vitest/config';
import original from '../../../../../packages/vue/vitest.config';
export default mergeConfig(original, { test: { setupFiles: [fileURLToPath(new URL('./select-b.ts', import.meta.url))] } });
