import {build} from '/Users/jonathanborgia/code/signaltree/node_modules/esbuild/lib/main.js';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const root='/private/tmp/st-c28-r3-diagnostic-reduction', baseline='/private/tmp/st-c28-r3-registration-lint-combined';
const results=[];mkdirSync(`${root}/graphs`,{recursive:true});
for(const arm of ['baseline','candidate'])for(const target of ['bare','entities'])for(const mode of ['prod','dev']){
 const source=readFileSync(`${baseline}/tmp/st-budget-MWWORX/signaltree-${target}.js`,'utf8');
 const entry=`${root}/graphs/${arm}-${target}-${mode}.entry.js`;
 writeFileSync(entry,arm==='baseline'?source:source.replaceAll(`${baseline}/candidate`,`${root}/candidate`));
 const out=await build({entryPoints:[entry],bundle:true,minify:true,format:'esm',platform:'browser',treeShaking:true,external:['@angular/*','rxjs','rxjs/*','tslib'],nodePaths:[`${root}/candidate/node_modules`],write:false,legalComments:'none',logLevel:'silent',define:mode==='prod'?{ngDevMode:'false'}:{},metafile:true});
 const bytes=out.outputFiles[0].contents;writeFileSync(`${root}/graphs/${arm}-${target}-${mode}.js`,bytes);writeFileSync(`${root}/graphs/${arm}-${target}-${mode}.meta.json`,JSON.stringify(out.metafile,null,2));
 results.push({arm,target,mode,minifiedBytes:bytes.length,gzipBytes:gzipSync(bytes,{level:9}).length,sha256:createHash('sha256').update(bytes).digest('hex'),churnWarning:Buffer.from(bytes).includes('[ST2026]'),wrongMethodHints:Buffer.from(bytes).includes('updateOne(id, changes) / updateMany(ids, changes)')});
}
writeFileSync(`${root}/MEASUREMENTS.json`,JSON.stringify(results,null,2)+'\n');
for(const target of ['bare','entities'])for(const mode of ['prod','dev']){
 const b=results.find(x=>x.arm==='baseline'&&x.target===target&&x.mode===mode),c=results.find(x=>x.arm==='candidate'&&x.target===target&&x.mode===mode);console.log(JSON.stringify({target,mode,before:b.gzipBytes,after:c.gzipBytes,delta:c.gzipBytes-b.gzipBytes,warningPresent:c.churnWarning,hintsPresent:c.wrongMethodHints}));
}
