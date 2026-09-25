#!/usr/bin/env node
// L19-V15-REPRODUCTION — does the dormant penalty exist on RELEASED v15.3.0?
//
// The v15 patch decision was recorded as conditional on this. Everything
// measured so far was the workspace tree, which is 16.0.0-dev.
//
// Kernel sources are loaded from the v15.3.0 TAG via `git show`, so this
// measures released code rather than the working tree. Only this experiment's
// entry comes from disk.
//
// Preregistered, matching l19-ablation-0b: 15 trials, discard the first 3
// unconditionally, median, relative IQR, plus PAIRED per-trial differences
// since the arms alternate within each trial.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
const here=dirname(fileURLToPath(import.meta.url)); const root=resolve(here,'../../..');
const out=mkdtempSync(resolve(tmpdir(),'st-v15-'));
const TAG='v15.3.0';

const bundled=await build({
  stdin:{contents:`export {signalTree} from './packages/kernel/src/index';
export {transactions} from './packages/kernel/src/enhancers/transactions/transactions';`,
    resolveDir:root,sourcefile:'v15.ts',loader:'ts'},
  absWorkingDir:root,bundle:true,write:false,platform:'node',format:'esm',target:'node24',
  plugins:[{name:'from-tag',setup(b){
    b.onLoad({filter:/\/packages\/kernel\/src\/.*\.ts$/},({path})=>({
      contents: execFileSync('git',['show',`${TAG}:${relative(root,path)}`],
        {cwd:root,encoding:'utf8',maxBuffer:16*1024*1024}),
      loader:'ts', resolveDir: dirname(path) })); }}],
});
const p=resolve(out,'v15.mjs'); writeFileSync(p,bundled.outputFiles[0].text);
const K=await import(p);
const rev=execFileSync('git',['rev-parse',TAG],{cwd:root,encoding:'utf8'}).trim();

const N=200000, TRIALS=15, DISCARD=3;
const ARMS={
  BASE:   ()=>K.signalTree({a:0,b:0,c:0}),
  DORMANT:()=>K.signalTree({a:0,b:0,c:0},{enhancers:[K.transactions()]}),
};
const names=Object.keys(ARMS);
const timeWrites=t=>{const t0=process.hrtime.bigint();for(let i=0;i<N;i++)t.$.a(i);
  return Number(process.hrtime.bigint()-t0)/1e6;};
for(let w=0;w<3;w++) for(const n of names){const t=ARMS[n]();for(let i=0;i<20000;i++)t.$.a(i);t.destroy();}
const raw=Object.fromEntries(names.map(n=>[n,[]]));
for(let i=0;i<TRIALS;i++){
  const order=i%2===0?names:[...names].reverse();
  for(const n of order){const t=ARMS[n]();raw[n].push(timeWrites(t));t.destroy();}
}
const q=(a,f)=>{const s=[...a].sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.floor(s.length*f))];};
const median=a=>q(a,0.5); const relIQR=a=>(q(a,0.75)-q(a,0.25))/median(a)*100;
const kept=Object.fromEntries(names.map(n=>[n,raw[n].slice(DISCARD)]));
const m=Object.fromEntries(names.map(n=>[n,median(kept[n])]));
const pairs=kept.DORMANT.map((d,i)=>d-kept.BASE[i]);
const sortedPairs=[...pairs].sort((x,y)=>x-y);
const slower=pairs.filter(x=>x>0).length;
console.log(`released ${TAG} (${rev.slice(0,12)})\n`);
console.log(`${'arm'.padEnd(10)}${'median'.padStart(9)}${'relIQR'.padStart(9)}`);
for(const n of names) console.log(`${n.padEnd(10)}${m[n].toFixed(1).padStart(7)}ms${(relIQR(kept[n]).toFixed(1)+'%').padStart(9)}`);
const delta=(m.DORMANT-m.BASE)/m.BASE*100;
console.log(`\ndelta ${delta>=0?'+':''}${delta.toFixed(0)}%`);
console.log(`paired: median ${sortedPairs[Math.floor(sortedPairs.length/2)].toFixed(1)}ms  range [${sortedPairs[0].toFixed(1)}, ${sortedPairs[sortedPairs.length-1].toFixed(1)}]  dormant slower in ${slower}/${pairs.length} trials`);
const checks=[]; const check=(ok,l,d)=>{checks.push({label:l,ok,detail:d});console.log(`${ok?'PASS':'FAIL'}  ${l}${d?`  -- ${d}`:''}`);};
console.log();
check(slower===pairs.length && sortedPairs[0]>0,
  `REPRODUCED on released ${TAG}: dormant is slower in every paired trial`,
  `slower in ${slower}/${pairs.length}, worst-case paired delta ${sortedPairs[0].toFixed(1)}ms`);
writeFileSync(resolve(here,'l19-v15-reproduction.json'),
  JSON.stringify({probe:'L19-V15-REPRODUCTION',tag:TAG,rev,N,TRIALS,DISCARD,medians:m,delta,pairs,raw,checks},null,2)+'\n');
process.exit(checks.some(c=>!c.ok)?1:0);
