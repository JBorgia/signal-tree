#!/usr/bin/env node
// RADICAL-WAKEUP-1P — production push, ZERO pulls.
//
// RULE: after subscription is established, the test performs NO read, pump,
// poll, write, or manual recomputation OF THE AFFECTED FACT after the
// obligation transition. The only action is resolving the obligation.
//
// Uses the REAL path: a real signalTree, a real derived exposable frontier, and
// real link() consequences -- not a purpose-built adapter whose invalidate()
// calls the test callback.
import { build } from 'esbuild';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)); const root=resolve(here,'../../..');
const bundled=await build({
  stdin:{contents:`export {signalTree} from './packages/kernel/src/index';
export {transactions} from './packages/kernel/src/enhancers/transactions/transactions';
export {link} from './packages/kernel/src/lib/link';
export {getPathNotifier} from './packages/kernel/src/lib/path-notifier';
export {computed} from '@angular/core';`,
    resolveDir:root,sourcefile:'wake1p.ts',loader:'ts'},
  absWorkingDir:root,bundle:true,write:false,platform:'node',format:'esm',target:'node24'});
// Written to a file rather than a data URL so stack traces stay readable.
const bundlePath=resolve(tmpdir(),'st-wake1p-bundle.mjs');
writeFileSync(bundlePath,bundled.outputFiles[0].text);
const K=await import(bundlePath);
const checks=[]; const check=(ok,l,d)=>{checks.push({label:l,ok,detail:d});console.log(`${ok?'PASS':'FAIL'}  ${l}${d?`  -- ${d}`:''}`);};
const settle=async n=>{ n.flushSync(); for(let i=0;i<20;i++) await Promise.resolve(); };

const counters={exposableRecomputes:0,visibleRecomputes:0};
const n=K.getPathNotifier();
// o1/o4 are obligation LIVENESS. yVal/zVal/uVal are contribution values.
// The exposable frontier is an ordinary DERIVED that reads both.
const tree=K.signalTree(
  { o1:true, o4:true, yVal:2, zVal:3, uVal:5 },
  { enhancers:[K.transactions()],
    derived: ($) => ({
      yExposable: K.computed(()=>{ counters.exposableRecomputes++; return ($.o1()||$.o4())?0:$.yVal(); }),
      zExposable: K.computed(()=>{ counters.exposableRecomputes++; return $.o1()?0:$.zVal(); }),
      uExposable: K.computed(()=>{ counters.exposableRecomputes++; return $.uVal(); }),
      yVisible:   K.computed(()=>{ counters.visibleRecomputes++;   return $.yVal(); }),
    }) });

const got={y:[],z:[],u:[],yA:[],yB:[]};
const links=[
  K.link(tree.$.zExposable,{set:v=>got.z.push(v)}),
  K.link(tree.$.uExposable,{set:v=>got.u.push(v)}),
  K.link(tree.$.yExposable,{set:v=>got.yA.push(v)}),
  K.link(tree.$.yExposable,{set:v=>got.yB.push(v)}),
  K.link(tree.$.yVisible,{set:()=>{}}),
];
await settle(n);
const beforeVisible=counters.visibleRecomputes;
const whileLive={y:[...got.yA],z:[...got.z],u:[...got.u]};

// ---- resolve O4 only. Nothing else. No reads of y.
tree.$.o4(false);
await settle(n);
const afterO4=[...got.yA];

// ---- resolve O1. Nothing else. NO PULL of y, z or u.
const exposableBefore=counters.exposableRecomputes;
tree.$.o1(false);
await settle(n);
const afterO1={y:[...got.yA],yB:[...got.yB],z:[...got.z],u:[...got.u]};
const exposableDelta=counters.exposableRecomputes-exposableBefore;
const visibleDelta=counters.visibleRecomputes-beforeVisible;

console.log(`while O1 live : y=${JSON.stringify(whileLive.y)} z=${JSON.stringify(whileLive.z)} u=${JSON.stringify(whileLive.u)}`);
console.log(`after O4 only : y=${JSON.stringify(afterO4)}`);
console.log(`after O1      : yA=${JSON.stringify(afterO1.y)} yB=${JSON.stringify(afterO1.yB)} z=${JSON.stringify(afterO1.z)}`);
console.log(`recomputes    : exposable+${exposableDelta} visible+${visibleDelta}\n`);

check(!whileLive.y.includes(2) && !whileLive.z.includes(3),
  'A- nothing speculative published while O1 is live',`y=${JSON.stringify(whileLive.y)}`);
check(whileLive.u.includes(5),'A- an unblocked fact publishes normally',`u=${JSON.stringify(whileLive.u)}`);
check(!afterO4.includes(2),'E MULTI-BLOCKER resolving O4 alone pushes nothing for y',`y=${JSON.stringify(afterO4)}`);
check(afterO1.y.includes(2),
  'A PUSH resolving O1 delivers y=2 with ZERO pulls, reads or writes of y',
  `yA=${JSON.stringify(afterO1.y)}`);
check(afterO1.yB.includes(2),'D SHARED both Links on the same frontier receive it',
  `yB=${JSON.stringify(afterO1.yB)}`);
check(afterO1.z.includes(3),'C SELECTIVITY z, which also depends on O1, is delivered',
  `z=${JSON.stringify(afterO1.z)}`);
check(afterO1.u.length===whileLive.u.length,'C SELECTIVITY u, independent of O1, is NOT re-delivered',
  `u=${JSON.stringify(afterO1.u)}`);
check(visibleDelta===0,'G VISIBLE ISOLATION ordinary visible consumers are not recomputed',
  `visible recomputes after resolution = ${visibleDelta}`);
check(exposableDelta>0 && exposableDelta<=4,
  'TRACE exposable recomputation is bounded, not a tree-wide scan',
  `exposable recomputes = ${exposableDelta}`);
for(const l of links) l.dispose();
tree.destroy();

writeFileSync(resolve(here,'radical-wakeup-1p.json'),JSON.stringify({probe:'WAKEUP-1P',counters,whileLive,afterO4,afterO1,checks},null,2)+'\n');
const failed=checks.filter(c=>!c.ok);
console.log(`${checks.length-failed.length}/${checks.length} checks passed`);
process.exit(failed.length?1:0);
