import {build} from '/Users/jonathanborgia/code/signaltree/node_modules/esbuild/lib/main.js';
import {writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
const common={bundle:true,minify:true,format:'esm',platform:'browser',treeShaking:true,define:{ngDevMode:'false','process.env.NODE_ENV':'"production"'},external:['@angular/*','rxjs','rxjs/*','tslib'],metafile:true,logLevel:'info'};
for(const name of ['consumer','lifecycle-consumer','no-link']){
 const result=await build({...common,entryPoints:[root+name+'.mjs'],outfile:root+name+'.production.mjs'});
 writeFileSync(root+name+'.metafile.json',JSON.stringify(result.metafile,null,2));
}
mkdirSync(root+'split',{recursive:true});
const split=await build({...common,entryPoints:[root+'early.mjs',root+'late.mjs'],outdir:root+'split',outExtension:{'.js':'.mjs'},splitting:true});
writeFileSync(root+'split.metafile.json',JSON.stringify(split.metafile,null,2));
