#!/usr/bin/env node
// A/B gate for the L19 fix: HEAD vs WORKING TREE, both arms (unenhanced and
// dormant-enhanced) interleaved in ONE process at the same N, so the two builds
// share run conditions. Paired per-trial differences reported.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
const root=process.cwd(); const out=mkdtempSync(resolve(tmpdir(),'st-ab-'));
const mk=async(label,rev)=>{
  const b=await build({stdin:{contents:`export {signalTree} from './packages/kernel/src/index';
export {transactions} from './packages/kernel/src/enhancers/transactions/transactions';`,
    resolveDir:root,sourcefile:`${label}.ts`,loader:'ts'},absWorkingDir:root,bundle:true,write:false,
    platform:'node',format:'esm',target:'node24',
    plugins: rev?[{name:'rev',setup(bb){ bb.onLoad({filter:/\/packages\/kernel\/src\/.*\.ts$/},({path})=>({
      contents:execFileSync('git',['show',`${rev}:${relative(root,path)}`],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024}),
      loader:'ts',resolveDir:dirname(path)})); }}]:[]});
  const p=resolve(out,`${label}.mjs`); writeFileSync(p,b.outputFiles[0].text); return import(p); };
const H=await mk('head','HEAD'), W=await mk('fix',null);
const MODE=process.argv[2]??'dormant';
const EVERY=MODE==='active-100'?1:MODE==='active-1'?100:0;
const N=200000,TRIALS=15,D=3;
const ARMS={
  'HEAD unenhanced':()=>H.signalTree({a:0}),
  'HEAD dormant':   ()=>H.signalTree({a:0},{enhancers:[H.transactions()]}),
  'FIX  unenhanced':()=>W.signalTree({a:0}),
  'FIX  dormant':   ()=>W.signalTree({a:0},{enhancers:[W.transactions()]}),
};
const names=Object.keys(ARMS);
// ACTIVE modes open-and-confirm a transaction every EVERY writes. That is the
// worst case for lazy registration: each transaction registers the observer and
// each confirm releases it, because the tree goes quiescent in between.
const t_=t=>{const s=process.hrtime.bigint();
  for(let i=0;i<N;i++){ if(EVERY && t.transact && i%EVERY===0) t.transact(()=>t.$.a(i)).confirm(); else t.$.a(i); }
  return Number(process.hrtime.bigint()-s)/1e6;};
for(let w=0;w<3;w++) for(const n of names){const t=ARMS[n]();for(let i=0;i<20000;i++)t.$.a(i);t.destroy();}
const r=Object.fromEntries(names.map(n=>[n,[]]));
for(let i=0;i<TRIALS;i++) for(const n of (i%2?[...names].reverse():names)){const t=ARMS[n]();r[n].push(t_(t));t.destroy();}
const k=Object.fromEntries(names.map(n=>[n,r[n].slice(D)]));
const med=a=>{const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)];};
for(const n of names) console.log(`${n.padEnd(18)} ${med(k[n]).toFixed(1)}ms`);
const pct=(d,b)=>((med(k[d])-med(k[b]))/med(k[b])*100).toFixed(0);
console.log(`\nHEAD dormant penalty vs its unenhanced: +${pct('HEAD dormant','HEAD unenhanced')}%`);
console.log(`FIX  dormant penalty vs its unenhanced: +${pct('FIX  dormant','FIX  unenhanced')}%`);
const pairs=k['FIX  dormant'].map((f,i)=>f-k['HEAD dormant'][i]).sort((x,y)=>x-y);
const faster=pairs.filter(x=>x<0).length;
console.log(`paired FIX-HEAD dormant: median ${pairs[Math.floor(pairs.length/2)].toFixed(1)}ms range [${pairs[0].toFixed(1)}, ${pairs[pairs.length-1].toFixed(1)}] fix faster in ${faster}/${pairs.length}`);
const up=k['FIX  unenhanced'].map((f,i)=>f-k['HEAD unenhanced'][i]).sort((x,y)=>x-y);
console.log(`paired FIX-HEAD unenhanced (control, expect ~0): median ${up[Math.floor(up.length/2)].toFixed(1)}ms`);
