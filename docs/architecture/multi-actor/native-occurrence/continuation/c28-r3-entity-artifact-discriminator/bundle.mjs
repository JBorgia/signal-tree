import {build} from '/Users/jonathanborgia/code/signaltree/node_modules/esbuild/lib/main.js';
import {writeFileSync} from 'node:fs';
const root='/private/tmp/st-c28-r3-entity-artifact-discriminator';
const result=await build({entryPoints:[root+'/consumer.mjs'],outfile:root+'/consumer.production.mjs',bundle:true,minify:true,format:'esm',platform:'browser',treeShaking:true,define:{ngDevMode:'false','process.env.NODE_ENV':'"production"'},external:['@angular/*','rxjs','rxjs/*','tslib'],metafile:true,logLevel:'info'});
writeFileSync(root+'/production-metafile.json',JSON.stringify(result.metafile,null,2));
