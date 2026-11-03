import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join,relative} from 'node:path';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const base=resolve(process.argv[2]??'.');
const {build,version}=createRequire(join(base,'paired/package.json'))('esbuild');
const hash=b=>createHash('sha256').update(b).digest('hex');
const rows=[];
for(const arm of ['incumbent','prepair','paired',...process.argv.slice(3)]){
 const root=join(base,arm), CORE=join(root,'dist/packages/kernel/dist/index.js');
 const gate=readFileSync(join(root,'tools/check-bundle-budget.mjs'),'utf8');
 const targets=vm.runInNewContext(gate.slice(gate.indexOf('const TARGETS ='),gate.indexOf('const EXTERNAL ='))+'\nTARGETS',{CORE,JSON});
 const outdir=join(base,'results',arm);mkdirSync(outdir,{recursive:true});
 for(const [name,t] of Object.entries(targets))for(const mode of ['prod','dev']){
  const entry=join(outdir,name+'.js');writeFileSync(entry,t.code);
  const options={entryPoints:[entry],bundle:true,minify:true,format:'esm',platform:'browser',treeShaking:true,external:['@angular/*','rxjs','rxjs/*','tslib'],nodePaths:[join(root,'node_modules')],write:false,legalComments:'none',logLevel:'silent',define:mode==='prod'?{ngDevMode:'false'}:{},metafile:true};
  const result=await build(options), bytes=result.outputFiles[0].contents;
  const stem=join(outdir,name+'-'+mode);writeFileSync(stem+'.mjs',bytes);writeFileSync(stem+'.meta.json',JSON.stringify(result.metafile,null,2));
  const context=vm.createContext({console,queueMicrotask,setTimeout,clearTimeout});
  vm.runInContext(Buffer.from(bytes).toString(),context);
  const observed=JSON.parse(JSON.stringify(context.__sink));
  const expected=name==='signaltree-bare'?[1,'b']:[{id:1,name:'b'}];
  if(JSON.stringify(observed)!==JSON.stringify(expected))throw Error('fixture failed '+arm+' '+name+' '+JSON.stringify(observed));
  const contributions=Object.entries(Object.values(result.metafile.outputs)[0].inputs).map(([p,v])=>({module:p.includes('/dist/packages/')?p.slice(p.indexOf('/dist/packages/')+1):p,bytes:v.bytesInOutput})).filter(x=>x.bytes>0).sort((a,b)=>b.bytes-a.bytes);
  const gzip=gzipSync(bytes,{level:9}).length, ceiling=(mode==='prod'?t.prodKB:t.devKB)*1024;
  rows.push({arm,fixture:name,mode,bytes:bytes.length,gzip,ceilingBytes:ceiling,headroomBytes:Math.floor(ceiling)-gzip,sha256:hash(bytes),observed,contributions});
 }
}
writeFileSync(join(base,'results.json'),JSON.stringify({node:process.version,esbuild:version,rows},null,2));
console.log(JSON.stringify(rows.map(({contributions,...row})=>row),null,2));
