import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync,existsSync,mkdtempSync} from 'node:fs';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const dir=dirname(fileURLToPath(import.meta.url));
const root=resolve(dir,'../../..');
const oldRoot='@proof';
const deps=process.env.ST_PROOF_DEPS || root;
const require=createRequire(deps+'/package.json'),{build}=require('esbuild');
const [lane,entry,control='suite',label='first']=process.argv.slice(2);
if(!['base','D2','P','P2','DP','DP2','P3','DP3'].includes(lane))throw Error('Unknown lane');
const probe=[resolve(dir,entry),resolve(dir,'../operation-record-boundary-0',entry),resolve(dir,'../atomic-capture-boundary-0',entry)].find(existsSync);
if(!/^[a-z0-9-]+\.mjs$/.test(entry)||!probe)throw Error('Unknown probe');
const evidence=process.env.ST_PROOF_OUTPUT || '/private/tmp/st-publication-replay';
mkdirSync(evidence,{recursive:true});
const candidate=mkdtempSync(resolve(evidence,lane+'-'));
const base='19a5bd034d5ebef262f637c397bb41fe50a6a1e3';
const git=(args,cwd=root)=>{const r=spawnSync('git',args,{cwd,encoding:'utf8'});if(r.status!==0)throw Error(r.stderr||r.stdout);return r.stdout;};
const capture=['../atomic-installation-capture-0/candidate.patch','../atomic-capture-boundary-0/B.patch','../atomic-capture-boundary-0/B2.patch','../atomic-capture-boundary-0/B3.patch','../operation-record-boundary-0/D.patch','../operation-record-boundary-0/D2.patch'];
const patches=[...(['D2','DP','DP2','DP3'].includes(lane)?capture:[]),...(['P','DP'].includes(lane)?['P.patch']:['P2','DP2'].includes(lane)?['P2.patch']:['P3','DP3'].includes(lane)?['P3.patch']:[])].map(p=>resolve(dir,p));
const files=new Set(patches.flatMap(f=>[...readFileSync(f,'utf8').matchAll(/^--- a\/(.+)$/gm)].map(m=>m[1])));
for(const rel of files){const f=resolve(candidate,rel);mkdirSync(dirname(f),{recursive:true});writeFileSync(f,git(['show',base+':'+rel]));}
for(const patch of patches)git(['apply',patch],candidate);
const exact=resolve(evidence,'exact-base');
const out=resolve(evidence,'runs',`${lane}-${entry}-${control}-${label}`);mkdirSync(out,{recursive:true});
if(existsSync(out+'/manifest.json'))throw Error('Preserve existing run; use new label');
const inputs=[],hash=x=>createHash('sha256').update(x).digest('hex');
const result=await build({entryPoints:[probe],bundle:true,platform:'node',format:'esm',target:'node24',write:false,nodePaths:[deps+'/node_modules'],tsconfigRaw:{compilerOptions:{}},plugins:[{name:'exact-base-candidate',setup(b){
 b.onResolve({filter:/^@signal-tree\/kernel\/adapter$/},()=>({path:root+'/packages/kernel/src/adapter.ts'}));
 b.onResolve({filter:/^@signal-tree\/kernel$/},()=>({path:root+'/packages/kernel/src/index.ts'}));
 b.onResolve({filter:/^solid-js$/},()=>({path:require.resolve('solid-js/dist/solid.js')}));
 b.onResolve({filter:/^@proof\//},a=>({path:a.path.replace(oldRoot,root)}));
 b.onLoad({filter:/\.(mjs|js|ts|json)$/},args=>{
  const rel=args.path.startsWith(root+'/')?args.path.slice(root.length+1):undefined;
  const overlay=rel&&resolve(candidate,rel);
  let actual=lane!=='base'&&overlay&&existsSync(overlay)?overlay:args.path;
  if(rel?.startsWith('packages/') && actual===args.path){actual=resolve(exact,rel);mkdirSync(dirname(actual),{recursive:true});writeFileSync(actual,git(['show',base+':'+rel]));}
  const bytes=readFileSync(actual);let contents=bytes.toString();
  // Fault at the common rich entity decomposition entrance, before any effects.
  if(rel==='packages/kernel/src/enhancers/transactions/transactions.ts'){
   const marker='  const captureEffects = (';const start=contents.indexOf(marker);const at=contents.indexOf('    const membership = plainBranchMembershipEffects(meta);',start);
   if(start<0||at<0)throw Error('capture seam missing');
   contents=contents.slice(0,at)+'    (globalThis as any).__entityCaptureProbe?.(path, next, prev, subjectIds);\n'+contents.slice(at);
  }
  if(rel==='packages/kernel/src/enhancers/transactions/transactions.ts') contents=contents.replace('const retained=authority.getPendingTurn(turnId)?.__effects ?? [];', 'const retained=(authority.getPendingTurn(turnId)?.__effects ?? []).filter(e => !(globalThis as any).__dropDisposition?.(e));');
  if(rel==='packages/kernel/src/lib/entity-signal.ts') contents=contents.replace('  function updateSignals(): void {','  function updateSignals(): void {\n    (globalThis as any).__publicationTrace?.("collection:updateSignals");').replace('      deriveLocation(version, (value) => value + 1);','      (globalThis as any).__publicationTrace?.("collection:stage-version");\n      deriveLocation(version, (value) => value + 1);');
  inputs.push({path:actual,resolvedAs:args.path,sha256:hash(bytes),loadedSha256:hash(contents)});
  return {contents,loader:extname(args.path)==='.ts'?'ts':extname(args.path)==='.json'?'json':'js',resolveDir:dirname(args.path)};
 });
}}]});
writeFileSync(out+'/bundle.mjs',result.outputFiles[0].text);
const r=spawnSync(process.execPath,[out+'/bundle.mjs',control],{encoding:'utf8',timeout:20000,maxBuffer:8*1024*1024});
writeFileSync(out+'/stdout.json',r.stdout);writeFileSync(out+'/stderr.txt',r.stderr);
const stable=inputs.every(i=>hash(readFileSync(i.path))===i.sha256);
writeFileSync(out+'/manifest.json',JSON.stringify({node:process.version,base:'19a5bd03',lane,entry,control,exit:r.status,signal:r.signal,stable,inputs,bundle:hash(result.outputFiles[0].text)},null,2));
console.log(JSON.stringify({lane,entry,control,exit:r.status,stable,out}));process.exitCode=r.status===0&&stable?0:1;
