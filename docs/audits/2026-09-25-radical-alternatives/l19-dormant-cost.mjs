#!/usr/bin/env node
// L19-DORMANT-COST — does transactions() cost anything when INSTALLED BUT UNUSED?
//
// This measures the CURRENT kernel, not a proposed design. If the enhancer is
// already free when dormant, L19 is a constraint the kernel can keep. If it is
// not, L19 is already violated today.
//
// METHODOLOGY. An earlier benchmark in this investigation showed ~16% run-to-run
// variance on identical work, so single timings here would be worthless. Trials
// ALTERNATE between arms to cancel drift, each arm gets its own fresh tree, and
// the MEDIAN of many trials is reported with the spread. Only effects larger
// than the observed noise floor are claimed.
import { build } from 'esbuild';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
const here=dirname(fileURLToPath(import.meta.url)); const root=resolve(here,'../../..');
const bundled=await build({
  stdin:{contents:`export {signalTree} from './packages/kernel/src/index';
export {transactions} from './packages/kernel/src/enhancers/transactions/transactions';
export {getPathNotifier} from './packages/kernel/src/lib/path-notifier';`,
    resolveDir:root,sourcefile:'l19.ts',loader:'ts'},
  absWorkingDir:root,bundle:true,write:false,platform:'node',format:'esm',target:'node24'});
const bundlePath=resolve(tmpdir(),'st-l19-bundle.mjs');
writeFileSync(bundlePath,bundled.outputFiles[0].text);
const K=await import(bundlePath);

const N=200000, TRIALS=11;
const make=(withEnhancer)=> withEnhancer
  ? K.signalTree({a:0,b:0,c:0},{enhancers:[K.transactions()]})
  : K.signalTree({a:0,b:0,c:0});

const timeWrites=(tree)=>{
  const t0=process.hrtime.bigint();
  for(let i=0;i<N;i++) tree.$.a(i);
  return Number(process.hrtime.bigint()-t0)/1e6;   // ms
};
// Warm both shapes so JIT state is shared, not attributed to whichever ran first.
for(let w=0;w<3;w++){ for(const e of [false,true]){ const t=make(e); for(let i=0;i<20000;i++) t.$.a(i); t.destroy(); } }

const base=[], dormant=[];
for(let i=0;i<TRIALS;i++){
  // Alternate order each trial so systematic drift cancels.
  const order = i%2===0 ? [false,true] : [true,false];
  for(const withEnhancer of order){
    const tree=make(withEnhancer);
    const ms=timeWrites(tree);
    (withEnhancer?dormant:base).push(ms);
    tree.destroy();
  }
}
const median=a=>{const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)];};
const spread=a=>{const s=[...a].sort((x,y)=>x-y);return (s[s.length-1]-s[0])/median(a)*100;};
const mBase=median(base), mDorm=median(dormant);
const delta=(mDorm-mBase)/mBase*100;
const noise=Math.max(spread(base),spread(dormant));

// Allocation check: heap growth across a dormant run, after settling.
const heapRun=(withEnhancer)=>{
  const tree=make(withEnhancer);
  for(let i=0;i<20000;i++) tree.$.a(i);
  globalThis.gc?.();
  const before=process.memoryUsage().heapUsed;
  for(let i=0;i<N;i++) tree.$.a(i);
  globalThis.gc?.();
  const after=process.memoryUsage().heapUsed;
  tree.destroy();
  return (after-before)/N;   // bytes retained per write
};
const bytesBase=heapRun(false), bytesDorm=heapRun(true);

const checks=[]; const check=(ok,l,d)=>{checks.push({label:l,ok,detail:d});console.log(`${ok?'PASS':'FAIL'}  ${l}${d?`  -- ${d}`:''}`);};
console.log(`base    median ${mBase.toFixed(1)}ms  spread ${spread(base).toFixed(1)}%`);
console.log(`dormant median ${mDorm.toFixed(1)}ms  spread ${spread(dormant).toFixed(1)}%`);
console.log(`delta   ${delta>=0?'+':''}${delta.toFixed(1)}%   noise floor ${noise.toFixed(1)}%`);
console.log(`retained bytes/write  base ${bytesBase.toFixed(2)}  dormant ${bytesDorm.toFixed(2)}\n`);

check(Math.abs(delta)<=noise,
  'L19 TIME installing transactions() with nothing transactional is within the noise floor',
  `delta ${delta.toFixed(1)}% vs noise ${noise.toFixed(1)}%`);
check(bytesDorm<8,
  'L19 ALLOCATION a dormant enhancer retains no meaningful per-write state',
  `${bytesDorm.toFixed(2)} bytes/write retained (base ${bytesBase.toFixed(2)})`);

writeFileSync(resolve(here,'l19-dormant-cost.json'),
  JSON.stringify({probe:'L19-DORMANT-COST',N,TRIALS,mBase,mDorm,delta,noise,bytesBase,bytesDorm,base,dormant,checks},null,2)+'\n');
const failed=checks.filter(c=>!c.ok);
console.log(`${checks.length-failed.length}/${checks.length} checks passed`);
process.exit(failed.length?1:0);
