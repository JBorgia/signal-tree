import {defineConfig} from 'vitest/config';
export default defineConfig({test:{globals:true,environment:'happy-dom',include:['src/lib/forwarding-retention-probe.spec.ts'],maxWorkers:1},define:{__DEV__:true},esbuild:{tsconfigRaw:'{}'}});
