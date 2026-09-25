#!/usr/bin/env node
// Targeted check: does observeEnqueue account for d2218eb0's jump, or is the
// increase spread across that 125-file commit?
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
const root=process.cwd(); const out=mkdtempSync(resolve(tmpdir(),'st-tgt-'));
const TX='packages/kernel/src/enhancers/transactions/transactions.ts';
const mk=async(rev,ablate)=>{
  const b=await build({
    stdin:{contents:`export {signalTree} from './packages/kernel/src/index';
export {transactions} from './packages/kernel/src/enhancers/transactions/transactions';`,
      resolveDir:root,sourcefile:'t.ts',loader:'ts'},
    absWorkingDir:root,bundle:true,write:false,platform:'node',format:'esm',target:'node24',
    plugins:[{name:'r',setup(bb){ bb.onLoad({filter:/\/packages\/kernel\/src\/.*\.ts$/},({path})=>{
      let s=execFileSync('git',['show',`${rev}:${relative(root,path)}`],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024});
      if(ablate && relative(root,path)===TX && s.includes('notifier.observeEnqueue('))
        s=s.replace('notifier.observeEnqueue(','((..._a: never[])=>(()=>undefined))(');
      return {contents:s,loader:'ts',resolveDir:dirname(path)}; }); }}],
  });
  const p=resolve(out,`${rev.slice(0,8)}-${ablate?'abl':'full'}.mjs`); writeFileSync(p,b.outputFiles[0].text);
  return import(p); };
const N=150000,TRIALS=9,D=2;
const bench=async(K)=>{
  const A={B:()=>K.signalTree({a:0}),D:()=>K.signalTree({a:0},{enhancers:[K.transactions()]})};
  const t_=t=>{const s=process.hrtime.bigint();for(let i=0;i<N;i++)t.$.a(i);return Number(process.hrtime.bigint()-s)/1e6;};
  for(let w=0;w<3;w++) for(const n of ['B','D']){const t=A[n]();for(let i=0;i<15000;i++)t.$.a(i);t.destroy();}
  const r={B:[],D:[]};
  for(let i=0;i<TRIALS;i++) for(const n of (i%2?['D','B']:['B','D'])){const t=A[n]();r[n].push(t_(t));t.destroy();}
  const med=a=>{const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)];};
  const b=med(r.B.slice(D)),d=med(r.D.slice(D));
  return {b,d,pct:(d-b)/b*100}; };
for(const [label,rev,abl] of [
  ['7ade0e3e  (parent, clean)','7ade0e3e',false],
  ['d2218eb0  full','d2218eb0',false],
  ['d2218eb0  observeEnqueue ABLATED','d2218eb0',true],
]){
  const r=await bench(await mk(rev,abl));
  console.log(`${label.padEnd(36)} base ${r.b.toFixed(1)}ms  dormant ${r.d.toFixed(1)}ms  +${r.pct.toFixed(0)}%`);
}
