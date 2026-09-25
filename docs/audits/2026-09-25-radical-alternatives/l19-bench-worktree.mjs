#!/usr/bin/env node
// Dormant benchmark against the WORKING TREE (no revision loader), with paired
// per-trial differences. Used to gate the L19 fix before committing it.
import { build } from 'esbuild';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
const root=process.cwd(); const out=mkdtempSync(resolve(tmpdir(),'st-wt-'));
const b=await build({stdin:{contents:`export {signalTree} from './packages/kernel/src/index';
export {transactions} from './packages/kernel/src/enhancers/transactions/transactions';`,
  resolveDir:root,sourcefile:'wt.ts',loader:'ts'},absWorkingDir:root,bundle:true,write:false,
  platform:'node',format:'esm',target:'node24'});
const p=resolve(out,'wt.mjs'); writeFileSync(p,b.outputFiles[0].text); const K=await import(p);
const N=200000,TRIALS=15,D=3;
const A={B:()=>K.signalTree({a:0}),D:()=>K.signalTree({a:0},{enhancers:[K.transactions()]})};
const t_=t=>{const s=process.hrtime.bigint();for(let i=0;i<N;i++)t.$.a(i);return Number(process.hrtime.bigint()-s)/1e6;};
for(let w=0;w<3;w++) for(const n of ['B','D']){const t=A[n]();for(let i=0;i<20000;i++)t.$.a(i);t.destroy();}
const r={B:[],D:[]};
for(let i=0;i<TRIALS;i++) for(const n of (i%2?['D','B']:['B','D'])){const t=A[n]();r[n].push(t_(t));t.destroy();}
const kb=r.B.slice(D),kd=r.D.slice(D);
const med=a=>{const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)];};
const pairs=kd.map((d,i)=>d-kb[i]).sort((x,y)=>x-y);
console.log(`base ${med(kb).toFixed(1)}ms  dormant ${med(kd).toFixed(1)}ms  +${((med(kd)-med(kb))/med(kb)*100).toFixed(0)}%`);
console.log(`paired: median ${pairs[Math.floor(pairs.length/2)].toFixed(1)}ms range [${pairs[0].toFixed(1)}, ${pairs[pairs.length-1].toFixed(1)}]`);
