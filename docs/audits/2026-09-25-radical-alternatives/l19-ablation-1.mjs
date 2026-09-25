#!/usr/bin/env node
// L19-ABLATION-1 — ablate transaction mechanisms ONE AT A TIME.
//
// The profile ATTRIBUTED the dormant cost to PathNotifier.notify. Attribution
// is not causation: each arm below removes ONE mechanism at the source and
// measures whether the +223% actually goes away.
//
// Preregistered, same rules as 0B: 15 trials, discard the first 3
// unconditionally, median, relative IQR, claim threshold 3x worst relIQR.
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
const here=dirname(fileURLToPath(import.meta.url)); const root=resolve(here,'../../..');
const TX='packages/kernel/src/enhancers/transactions/transactions.ts';

const PATCHES={
  'TX-FULL': null,
  // Swap the CALLEE, never the call-site syntax: the arguments and arrow
  // bodies stay exactly as written, so this removes the registration without
  // changing the surrounding code shape.
  'NO-ENQUEUE-OBS': (s)=>{
    const a='notifier.observeEnqueue(treeOwnerId,';
    if(!s.includes(a)) throw new Error('ANCHOR MISS enqueue');
    return s.replace(a,'((_id: never, _cb: never) => (() => undefined))(treeOwnerId as never,'); },
  'NO-SUBSCRIBE': (s)=>{
    const a='notifier.subscribe(';
    if(!s.includes(a)) throw new Error('ANCHOR MISS subscribe');
    return s.replace(a,'((..._a: never[]) => (() => undefined))('); },
};
const bundles={};
for(const [name,patch] of Object.entries(PATCHES)){
  const bundled=await build({
    stdin:{contents:`export {signalTree} from './packages/kernel/src/index';
export {transactions} from './${TX.replace(/\.ts$/,'')}';`,
      resolveDir:root,sourcefile:`abl1-${name}.ts`,loader:'ts'},
    absWorkingDir:root,bundle:true,write:false,platform:'node',format:'esm',target:'node24',
    plugins: patch?[{name:'ablate',setup(b){ b.onLoad({filter:/transactions\.ts$/},({path})=>{
      if(relative(root,path)!==TX) return null;
      return {contents:patch(readFileSync(path,'utf8')),loader:'ts',resolveDir:dirname(path)}; }); }}]:[],
  }).catch(e=>{ console.log(`  [${name}] build failed: ${String(e.message).slice(0,90)}`); return null; });
  if(!bundled) continue;
  const p=resolve(tmpdir(),`st-abl1-${name}.mjs`); writeFileSync(p,bundled.outputFiles[0].text);
  bundles[name]=await import(p);
}
const K=bundles['TX-FULL'];
const N=200000, TRIALS=15, DISCARD=3;
const timeWrites=t=>{const t0=process.hrtime.bigint();for(let i=0;i<N;i++)t.$.a(i);
  return Number(process.hrtime.bigint()-t0)/1e6;};
const ARMS={BASE:()=>K.signalTree({a:0,b:0,c:0})};
for(const [name,mod] of Object.entries(bundles))
  ARMS[name]=()=>mod.signalTree({a:0,b:0,c:0},{enhancers:[mod.transactions()]});
const names=Object.keys(ARMS);
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
console.log(`\n${'arm'.padEnd(20)}${'median'.padStart(9)}${'relIQR'.padStart(9)}${'vs BASE'.padStart(10)}`);
for(const n of names)
  console.log(`${n.padEnd(20)}${m[n].toFixed(1).padStart(7)}ms${(relIQR(kept[n]).toFixed(1)+'%').padStart(9)}${(((m[n]-m.BASE)/m.BASE*100).toFixed(0)+'%').padStart(10)}`);
writeFileSync(resolve(here,'l19-ablation-1.json'),JSON.stringify({probe:'L19-ABLATION-1',N,TRIALS,DISCARD,medians:m,raw},null,2)+'\n');
