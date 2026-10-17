import { fileURLToPath } from 'node:url';
import { mergeConfig } from 'vitest/config';
import original from '../../../../../packages/kernel/vitest.config';
export default mergeConfig(original, { root: fileURLToPath(new URL('../../../../../packages/kernel', import.meta.url)), test: { setupFiles: [fileURLToPath(new URL('./select-b.ts', import.meta.url))] } });
