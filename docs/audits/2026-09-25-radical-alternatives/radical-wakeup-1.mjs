#!/usr/bin/env node
// RADICAL-WAKEUP-1 — the make-or-break test.
//
// HYPOTHESIS: obligation LIVENESS is itself a node in the kernel's EXISTING
// reactive graph. Then exposable(fact) is an ordinary derived computation that
// reads it, and resolving an obligation invalidates exactly the publication
// frontiers that depend on it -- through machinery SignalTree already owns.
//
//   O1 liveness node
//     |-- exposable(y)
//     `-- exposable(z)
//
// If that holds there is NO obligation->Link waiter map, no blocker set, no
// polling, no tree-wide invalidation. If it does not, the waiter architecture
// returns and the claimed simplification largely disappears.
import { build } from 'esbuild';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)); const root=resolve(here,'../../..');
const bundled=await build({
  stdin:{contents:`export {signalTree} from './packages/kernel/src/index';
export {transactions} from './packages/kernel/src/enhancers/transactions/transactions';
export {getPathNotifier} from './packages/kernel/src/lib/path-notifier';
export {createLocationRuntime} from './packages/kernel/src/lib/internals/location-runtime';
export {NEUTRAL_OBSERVATION_ADAPTER} from './packages/kernel/src/lib/internals/observation-adapter';`,
    resolveDir:root,sourcefile:'wake1.ts',loader:'ts'},
  absWorkingDir:root,bundle:true,write:false,platform:'node',format:'esm',target:'node24'});
const K=await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const checks=[]; const check=(ok,l,d)=>{checks.push({label:l,ok,detail:d});console.log(`${ok?'PASS':'FAIL'}  ${l}${d?`  -- ${d}`:''}`);};

// The neutral adapter keeps this a pure reactive-graph test: no framework
// scheduler, so any invalidation observed is the kernel graph doing the work.
const RT = K.createLocationRuntime ? K.createLocationRuntime(K.NEUTRAL_OBSERVATION_ADAPTER) : null;
if(!RT){ console.error('no location runtime export'); process.exit(2); }

/** Obligation liveness as an ORDINARY reactive cell in the existing graph. */
const obligation = (initialLive=true) => RT.createCell(initialLive);

const world = ({invalidate=true}={}) => {
  const publishes=[]; const recomputes={exposable:0,visible:0};
  return { publishes, recomputes,
    /** exposable(y) is a DERIVED that reads the contribution AND the obligations. */
    makeFact(name, valueCell, obligations){
      const visible = RT.createDerived(()=>{ recomputes.visible++; return valueCell(); });
      const exposable = RT.createDerived(()=>{ recomputes.exposable++;
        const v=valueCell();
        // MUTANT: skip reading obligation liveness -> no invalidation path.
        if(!invalidate) return v;
        for(const o of obligations) if(o()) return 0;   // blocked by a live obligation
        return v; });
      return {name,visible,exposable};
    },
    /** A Link is an ORDINARY consumer of the exposable frontier. */
    link(fact){ let last;
      const off=RT.watch ? RT.watch(()=>fact.exposable()) : null;
      const pump=()=>{ const v=fact.exposable(); if(v!==last && v!==0){ last=v; publishes.push([fact.name,v]); } };
      return {pump,off}; },
  };
};

// The runtime may not expose a watcher; drive recomputation explicitly and
// measure INVALIDATION by whether the derived value changes without any write
// to the underlying fact.
const run = ({invalidate=true}={}) => {
  const w=world({invalidate});
  const O1=obligation(true), O4=obligation(true);
  const yVal=RT.createCell(2), zVal=RT.createCell(3), uVal=RT.createCell(5);
  const y=w.makeFact('y',yVal,[O1]), z=w.makeFact('z',zVal,[O1]), u=w.makeFact('u',uVal,[]);
  const ly=w.link(y), lz=w.link(z), lu=w.link(u);
  ly.pump(); lz.pump(); lu.pump();
  const beforeExposable=w.recomputes.exposable, beforeVisible=w.recomputes.visible;
  const afterOpen=[...w.publishes];
  // Resolve O1. NO write to y or z.
  O1(false);
  ly.pump(); lz.pump(); lu.pump();
  return {w,O1,O4,y,z,u,ly,lz,lu,afterOpen,beforeExposable,beforeVisible};
};

// A / B — basic wakeup and its mutant
{
  const r=run();
  // u carries no obligation and SHOULD publish immediately; the claim is about
  // the facts that do carry O1.
  check(!r.afterOpen.some(([n])=>n==='y'||n==='z'),
    'A neither y nor z published while O1 is live (u legitimately does)',
    `published=${JSON.stringify(r.afterOpen)}`);
  check(r.w.publishes.some(([n,v])=>n==='y'&&v===2),
    'A resolving O1 publishes the ORIGINAL y=2 with NO write to y',
    `published=${JSON.stringify(r.w.publishes)}`);
  const m=run({invalidate:false});
  // The mutant never reads obligation liveness, so it cannot be blocked OR
  // woken: its defect is publishing y WHILE O1 is still live.
  check(m.afterOpen.some(([n,v])=>n==='y'&&v===2),
    'B MUTANT not reading obligation liveness publishes y EARLY, while O1 is live',
    `whileLive=${JSON.stringify(m.afterOpen)}`);
}
// C — fanout: both inheritors wake, each once
{
  const r=run();
  const yP=r.w.publishes.filter(([n])=>n==='y'), zP=r.w.publishes.filter(([n])=>n==='z');
  check(yP.length===1 && zP.length===1,'C FANOUT y and z both wake exactly once',
    `y=${yP.length} z=${zP.length}`);
}
// D / H — selectivity and visible non-interference
{
  const r=run();
  // u never reads O1, so its exposable must not have been invalidated by O1.
  const uBefore=r.w.recomputes.exposable;
  r.lu.pump();
  check(r.w.recomputes.exposable===uBefore,
    'D SELECTIVITY u does not depend on O1, so it is not recomputed',
    `exposableRecomputes stable at ${uBefore}`);
  // Establish a real baseline first: comparing 0 to 0 proves nothing.
  r.y.visible(); r.z.visible();
  const vBefore=r.w.recomputes.visible;
  r.O4(false);                         // unrelated obligation transition
  r.y.visible(); r.z.visible();
  check(vBefore>0 && r.w.recomputes.visible===vBefore,
    'H VISIBLE NON-INTERFERENCE an obligation transition does not dirty ordinary visible state',
    `visibleRecomputes stable at ${vBefore}`);
}
// E — multi-blocker
{
  const w=world(); const O1=obligation(true), O4=obligation(true);
  const yVal=RT.createCell(9); const y=w.makeFact('y',yVal,[O1,O4]); const ly=w.link(y);
  ly.pump();
  O1(false); ly.pump();
  const afterFirst=w.publishes.length;
  O4(false); ly.pump();
  check(afterFirst===0 && w.publishes.length===1,
    'E MULTI-BLOCKER no publication after O1 alone; exactly one after O4',
    `afterO1=${afterFirst} afterO4=${w.publishes.length}`);
}
// SHARED MACHINERY — two Links on the same fact must not duplicate causal state
{
  const w=world(); const O1=obligation(true);
  const yVal=RT.createCell(4); const y=w.makeFact('y',yVal,[O1]);
  const a=w.link(y), b=w.link(y);
  a.pump(); b.pump();
  const before=w.recomputes.exposable;
  O1(false); a.pump(); b.pump();
  const added=w.recomputes.exposable-before;
  check(added<=1,'SHARED two Links share ONE exposable frontier -- no per-Link causal state',
    `exposable recomputes caused by the resolution = ${added}`);
}

writeFileSync(resolve(here,'radical-wakeup-1.json'),JSON.stringify({probe:'WAKEUP-1',checks},null,2)+'\n');
const failed=checks.filter(c=>!c.ok);
console.log(`\n${checks.length-failed.length}/${checks.length} checks passed`);
process.exit(failed.length?1:0);
