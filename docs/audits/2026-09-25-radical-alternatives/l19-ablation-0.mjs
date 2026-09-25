#!/usr/bin/env node
// L19-ABLATION-0 — localize the 3.3x dormant penalty before guessing at a fix.
//
// The decisive split first: if an EMPTY enhancer is already slow, this is
// generic enhancer/JIT-shape overhead in the kernel, not transaction-specific
// work, and the successor architecture inherits it regardless.
//
// Same methodology as L19-DORMANT-COST: alternating arm order per trial, all
// shapes pre-warmed together, fresh tree per trial, medians with spread.
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
    resolveDir:root,sourcefile:'abl.ts',loader:'ts'},
  absWorkingDir:root,bundle:true,write:false,platform:'node',format:'esm',target:'node24'});
const p=resolve(tmpdir(),'st-l19-abl.mjs'); writeFileSync(p,bundled.outputFiles[0].text);
const K=await import(p);

/** An enhancer that installs nothing and returns the tree untouched. */
const emptyEnhancer=()=>{ const fn=t=>t;
  const meta={name:'empty',provides:[]};
  fn.metadata=meta; fn[K.ENHANCER_META]=meta; return fn; };

const ARMS={
  BASE:            ()=>K.signalTree({a:0,b:0,c:0}),
  'EMPTY-ENHANCER':()=>K.signalTree({a:0,b:0,c:0},{enhancers:[emptyEnhancer()]}),
  BATCHING:        ()=>K.signalTree({a:0,b:0,c:0},{enhancers:[K.batching()]}),
  'TX-FULL':       ()=>K.signalTree({a:0,b:0,c:0},{enhancers:[K.transactions()]}),
};
const names=Object.keys(ARMS);
const N=200000, TRIALS=9;
const timeWrites=t=>{ const t0=process.hrtime.bigint();
  for(let i=0;i<N;i++) t.$.a(i); return Number(process.hrtime.bigint()-t0)/1e6; };

for(let w=0;w<3;w++) for(const n of names){ const t=ARMS[n](); for(let i=0;i<20000;i++) t.$.a(i); t.destroy(); }

const results=Object.fromEntries(names.map(n=>[n,[]]));
for(let i=0;i<TRIALS;i++){
  const order = i%2===0 ? names : [...names].reverse();
  for(const n of order){ const t=ARMS[n](); results[n].push(timeWrites(t)); t.destroy(); }
}
// Discard the first trial of every arm: despite the shared warm-up it still
// carries first-measurement contamination, and it was the sole cause of a
// 111.8% spread on BASE that polluted the noise floor.
for(const n of names) results[n].shift();
const median=a=>{const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)];};
const spread=a=>{const s=[...a].sort((x,y)=>x-y);return (s[s.length-1]-s[0])/median(a)*100;};
const m=Object.fromEntries(names.map(n=>[n,median(results[n])]));
const baseM=m.BASE;
console.log(`${'arm'.padEnd(16)}${'median'.padStart(9)}${'spread'.padStart(9)}${'vs BASE'.padStart(10)}`);
for(const n of names)
  console.log(`${n.padEnd(16)}${m[n].toFixed(1).padStart(7)}ms${(spread(results[n]).toFixed(1)+'%').padStart(9)}${(((m[n]-baseM)/baseM*100).toFixed(0)+'%').padStart(10)}`);
const noise=Math.max(...names.map(n=>spread(results[n])));
console.log(`\nnoise floor ${noise.toFixed(1)}%\n`);

const checks=[]; const check=(ok,l,d)=>{checks.push({label:l,ok,detail:d});console.log(`${ok?'PASS':'FAIL'}  ${l}${d?`  -- ${d}`:''}`);};
const pct=n=>(m[n]-baseM)/baseM*100;
check(Math.abs(pct('EMPTY-ENHANCER'))<=noise,
  'ABLATION an EMPTY enhancer is free -- the penalty is NOT generic enhancer dispatch or JIT shape',
  `empty ${pct('EMPTY-ENHANCER').toFixed(0)}% vs noise ${noise.toFixed(1)}%`);
check(pct('TX-FULL')>noise*2,
  'ABLATION transactions() specifically carries the dormant penalty',
  `tx ${pct('TX-FULL').toFixed(0)}%`);
console.log(`\nbatching() for comparison: ${pct('BATCHING').toFixed(0)}% -- another real enhancer on the same write path`);

writeFileSync(resolve(here,'l19-ablation-0.json'),JSON.stringify({probe:'L19-ABLATION-0',N,TRIALS,medians:m,noise,results,checks},null,2)+'\n');
const failed=checks.filter(c=>!c.ok);
console.log(`${checks.length-failed.length}/${checks.length} checks passed`);
process.exit(failed.length?1:0);
