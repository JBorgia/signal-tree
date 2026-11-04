const fs=require('node:fs');const path=require('node:path');const esbuild=require('/Users/jonathanborgia/code/signaltree/node_modules/esbuild');
const c='/Users/jonathanborgia/code/signaltree/.worktrees/v16-sparse-responsibility-0',p='/private/tmp/st-v16-sparse-responsibility-0';
const source=fs.readFileSync(path.join(c,'packages/kernel/src/lib/entity-granular-reactivity.spec.ts'),'utf8');const start=source.indexOf('function countIteratedElements'),end=source.indexOf("\ndescribe('entityMap —",start);const helper='export '+source.slice(start,end);
fs.writeFileSync(path.join(p,'original-counter.ts'),helper);fs.writeFileSync(path.join(p,'original-counter.mjs'),esbuild.transformSync(helper,{loader:'ts',format:'esm',target:'node24'}).code);
