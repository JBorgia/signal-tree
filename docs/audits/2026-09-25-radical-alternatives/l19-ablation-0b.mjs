#!/usr/bin/env node
// L19-ABLATION-0B — rerun with the exclusion rule FIXED IN ADVANCE.
//
// PREREGISTERED BEFORE ANY RESULT WAS SEEN:
//   trials per arm          15
//   discarded               the first 3 of every arm, unconditionally, as
//                           warm-up -- not chosen by inspecting outliers
//   statistic               median
//   dispersion              relative IQR = (Q3-Q1)/median, NOT the full range,
//                           which is a single-outlier-sensitive and far too
//                           coarse a threshold
//   claim threshold         an arm differs from BASE only if |delta| exceeds
//                           3x the largest relative IQR among the arms
//
// 0A discarded its first trial AFTER seeing a 111.8% range on BASE. That was
// post-hoc and is not repeated here.
import { build } from 'esbuild';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
const here=dirname(fileURLToPath(import.meta.url)); const root=resolve(here,'../../..');
const bundled=await build({
  stdin:{contents:`export {signalTree} from './packages/kernel/src/index';
export {transactions} from './packages/kernel/src/enhancers/transactions/transactions';
export {batching} from './packages/kernel/src/enhancers/batching/batching';
export {ENHANCER_META} from './packages/kernel/src/lib/types';`,
    resolveDir:root,sourcefile:'abl0b.ts',loader:'ts'},
  absWorkingDir:root,bundle:true,write:false,platform:'node',format:'esm',target:'node24'});
const p=resolve(tmpdir(),'st-l19-abl0b.mjs'); writeFileSync(p,bundled.outputFiles[0].text);
const K=await import(p);

const emptyEnhancer=()=>{ const fn=t=>t; const meta={name:'empty',provides:[]};
  fn.metadata=meta; fn[K.ENHANCER_META]=meta; return fn; };
const ARMS={
  BASE:            ()=>K.signalTree({a:0,b:0,c:0}),
  'EMPTY-ENHANCER':()=>K.signalTree({a:0,b:0,c:0},{enhancers:[emptyEnhancer()]}),
  BATCHING:        ()=>K.signalTree({a:0,b:0,c:0},{enhancers:[K.batching()]}),
  'TX-FULL':       ()=>K.signalTree({a:0,b:0,c:0},{enhancers:[K.transactions()]}),
};
const names=Object.keys(ARMS);
const N=200000, TRIALS=15, DISCARD=3;
const timeWrites=t=>{const t0=process.hrtime.bigint();for(let i=0;i<N;i++)t.$.a(i);
  return Number(process.hrtime.bigint()-t0)/1e6;};
for(let w=0;w<3;w++) for(const n of names){const t=ARMS[n]();for(let i=0;i<20000;i++)t.$.a(i);t.destroy();}

const raw=Object.fromEntries(names.map(n=>[n,[]]));
for(let i=0;i<TRIALS;i++){
  const order = i%2===0 ? names : [...names].reverse();
  for(const n of order){const t=ARMS[n]();raw[n].push(timeWrites(t));t.destroy();}
}
const q=(a,f)=>{const s=[...a].sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.floor(s.length*f))];};
const median=a=>q(a,0.5);
const relIQR=a=>(q(a,0.75)-q(a,0.25))/median(a)*100;
const kept=Object.fromEntries(names.map(n=>[n,raw[n].slice(DISCARD)]));
const m=Object.fromEntries(names.map(n=>[n,median(kept[n])]));
const disp=Object.fromEntries(names.map(n=>[n,relIQR(kept[n])]));
const worstIQR=Math.max(...names.map(n=>disp[n]));
const threshold=worstIQR*3;
const baseM=m.BASE;
console.log(`${'arm'.padEnd(16)}${'median'.padStart(9)}${'relIQR'.padStart(9)}${'vs BASE'.padStart(10)}`);
for(const n of names)
  console.log(`${n.padEnd(16)}${m[n].toFixed(1).padStart(7)}ms${(disp[n].toFixed(1)+'%').padStart(9)}${(((m[n]-baseM)/baseM*100).toFixed(0)+'%').padStart(10)}`);
console.log(`\nworst relIQR ${worstIQR.toFixed(1)}%  ->  claim threshold ${threshold.toFixed(1)}%\n`);
const checks=[]; const check=(ok,l,d)=>{checks.push({label:l,ok,detail:d});console.log(`${ok?'PASS':'FAIL'}  ${l}${d?`  -- ${d}`:''}`);};
const pct=n=>(m[n]-baseM)/baseM*100;
check(Math.abs(pct('EMPTY-ENHANCER'))<threshold,
  'installing an enhancer is indistinguishable from BASE',`${pct('EMPTY-ENHANCER').toFixed(0)}% < ${threshold.toFixed(1)}%`);
check(Math.abs(pct('BATCHING'))<threshold,
  'batching(), a real enhancer on the same write path, is indistinguishable from BASE',
  `${pct('BATCHING').toFixed(0)}% < ${threshold.toFixed(1)}%`);
check(pct('TX-FULL')>threshold,
  'transactions() is distinguishable, and by far more than the threshold',
  `${pct('TX-FULL').toFixed(0)}% > ${threshold.toFixed(1)}%`);
writeFileSync(resolve(here,'l19-ablation-0b.json'),
  JSON.stringify({probe:'L19-ABLATION-0B',preregistered:{TRIALS,DISCARD,statistic:'median',dispersion:'relative IQR',thresholdRule:'3x worst relIQR'},N,raw,medians:m,dispersion:disp,threshold,checks},null,2)+'\n');
const failed=checks.filter(c=>!c.ok);
console.log(`${checks.length-failed.length}/${checks.length} checks passed`);
process.exit(failed.length?1:0);
