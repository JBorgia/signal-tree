import {defineConfig} from 'vitest/config';
const r='/private/tmp/st-c24-equal-owner-retention-independent';
export default defineConfig({root:r,resolve:{alias:{'@signal-tree/kernel/adapter':r+'/source/packages/kernel/src/adapter.ts','@signal-tree/kernel':r+'/source/packages/kernel/src/index.ts'}},test:{environment:'happy-dom',include:['specs/retention.spec.ts'],maxWorkers:1,globals:true}});
