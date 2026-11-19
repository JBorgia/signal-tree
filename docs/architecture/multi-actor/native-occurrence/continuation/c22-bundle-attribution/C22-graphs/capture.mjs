import {build as original} from '/Users/jonathanborgia/code/signaltree/node_modules/esbuild/lib/main.js';
import {writeFileSync} from 'node:fs';
let n=0; export async function build(options){const out=await original({...options,metafile:true});const id=String(++n);writeFileSync(new URL(id+'.options.json',import.meta.url),JSON.stringify(options,null,2));writeFileSync(new URL(id+'.meta.json',import.meta.url),JSON.stringify(out.metafile,null,2));writeFileSync(new URL(id+'.js',import.meta.url),out.outputFiles[0].contents);return out;}
