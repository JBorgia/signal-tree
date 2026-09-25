#!/usr/bin/env node
// L19-ABLATION-2 — does NOTIFICATION EMISSION cause the remaining gap?
//
// The profile only ATTRIBUTED the remainder to notify/coalesce. This removes
// the emission call itself and measures whether the gap collapses. The mutant
// is deliberately semantics-breaking; it exists to answer a cost question, not
// to be a candidate repair.
//
// Reproducible from a clean checkout: builds every bundle it needs, imports
// nothing from a previous run or from /tmp.
//
// Preregistered: 15 trials, discard the first 3 unconditionally, median,
// relative IQR, claim threshold 3x worst relIQR.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
const here=dirname(fileURLToPath(import.meta.url)); const root=resolve(here,'../../..');
const out=mkdtempSync(resolve(tmpdir(),'st-abl2-'));
const TX='packages/kernel/src/enhancers/transactions/transactions.ts';
const OM='packages/kernel/src/lib/internals/owned-mutation.ts';

const noBoth=(s)=>s
  .replace('notifier.observeEnqueue(treeOwnerId,','((_i: never,_c: never)=>(()=>undefined))(treeOwnerId as never,')
  .replace('notifier.subscribe(','((..._a: never[])=>(()=>undefined))(');
const noEmit=(s)=>{
  const a='  pathObservation().notify(';
  if(!s.includes(a)) throw new Error('ANCHOR MISS emission');
  return s.replace(a,'  ((..._a: never[]) => undefined)('); };

const VARIANTS={
  'TX-FULL':        {},
  'NO-BOTH':        {[TX]:noBoth},
  'NO-EMIT':        {[OM]:noEmit},
  'NO-BOTH+NO-EMIT':{[TX]:noBoth,[OM]:noEmit},
};
const mods={};
for(const [name,patches] of Object.entries(VARIANTS)){
  const bundled=await build({
    stdin:{contents:`export {signalTree} from './packages/kernel/src/index';
export {transactions} from './${TX.replace(/\.ts$/,'')}';`,
      resolveDir:root,sourcefile:`abl2-${name}.ts`,loader:'ts'},
    absWorkingDir:root,bundle:true,write:false,platform:'node',format:'esm',target:'node24',
    plugins:[{name:'ablate',setup(b){ b.onLoad({filter:/\.ts$/},({path})=>{
      const rel=relative(root,path); const patch=patches[rel];
      if(!patch) return null;
      return {contents:patch(readFileSync(path,'utf8')),loader:'ts',resolveDir:dirname(path)}; }); }}],
  });
  const p=resolve(out,`${name}.mjs`); writeFileSync(p,bundled.outputFiles[0].text);
  mods[name]=await import(p);
}
const K=mods['TX-FULL'];
const N=200000, TRIALS=15, DISCARD=3;
const ARMS={BASE:()=>K.signalTree({a:0,b:0,c:0})};
for(const [n,m] of Object.entries(mods)) ARMS[n]=()=>m.signalTree({a:0,b:0,c:0},{enhancers:[m.transactions()]});
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
const worst=Math.max(...names.map(n=>relIQR(kept[n])));
console.log(`${'arm'.padEnd(18)}${'median'.padStart(9)}${'relIQR'.padStart(9)}${'vs BASE'.padStart(10)}`);
for(const n of names)
  console.log(`${n.padEnd(18)}${m[n].toFixed(1).padStart(7)}ms${(relIQR(kept[n]).toFixed(1)+'%').padStart(9)}${(((m[n]-m.BASE)/m.BASE*100).toFixed(0)+'%').padStart(10)}`);
console.log(`\nworst relIQR ${worst.toFixed(1)}%  ->  threshold ${(worst*3).toFixed(1)}%`);
writeFileSync(resolve(here,'l19-ablation-2.json'),
  JSON.stringify({probe:'L19-ABLATION-2',N,TRIALS,DISCARD,medians:m,worstRelIQR:worst,raw},null,2)+'\n');
