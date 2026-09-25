#!/usr/bin/env node
// RADICAL-CONTRIBUTION-STORE-0
//
// Can ONE live contribution structure produce BOTH correct local visibility and
// correct consequence-safe visibility, deleting compensation AND Link blocker
// machinery?
//
//   fact = base + ordered live contributions
//   each contribution: { value, order, settled, obligations }
//
//   VISIBLE   frontier = highest surviving contribution
//   EXPOSABLE frontier = highest contribution carrying no LIVE obligation
//
// Deliberately a pure model. A radical alternative should be killable before
// anything is wired into a kernel.
//
// RETENTION CONSTRAINT, imposed from the start: only live correctness-relevant
// contributions may remain. A settled, obligation-clean contribution with
// nothing older beneath it folds into base and disappears. Otherwise this
// quietly becomes event sourcing.
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));

const checks=[]; const check=(ok,l,d)=>{checks.push({label:l,ok,detail:d});console.log(`${ok?'PASS':'FAIL'}  ${l}${d?`  -- ${d}`:''}`);};

const store = () => {
  const facts=new Map(); const liveObligations=new Set(); let seq=0;
  const F=k=>{ if(!facts.has(k)) facts.set(k,{base:0,contribs:[]}); return facts.get(k); };
  const dirty=c=>[...c.obligations].some(o=>liveObligations.has(o));
  const api={
    openObligation:o=>liveObligations.add(o),
    resolveObligation(o){ liveObligations.delete(o); this.fold(); },
    contribute(k,value,{owner=null,obligations=[]}={}){
      const f=F(k); f.contribs.push({value,order:++seq,owner,settled:owner===null,obligations:new Set(obligations)});
      // An ordinary settled write with nothing unresolved beneath it must fold
      // immediately, or the store silently becomes a write log.
      this.fold();
      return seq;
    },
    /** Rollback = REMOVE the contribution. No compensation, no baseline. */
    rollback(owner){ for(const f of facts.values()) f.contribs=f.contribs.filter(c=>c.owner!==owner); this.fold(); },
    confirm(owner){ for(const f of facts.values()) for(const c of f.contribs) if(c.owner===owner) c.settled=true; this.fold(); },
    /** Obligations a fact's visible truth currently carries. */
    obligationsOf(k){ const f=F(k); const top=f.contribs[f.contribs.length-1];
      return top?[...top.obligations].filter(o=>liveObligations.has(o)):[]; },
    visible(k){ const f=F(k); return f.contribs.length?f.contribs[f.contribs.length-1].value:f.base; },
    exposable(k){ const f=F(k);
      for(let i=f.contribs.length-1;i>=0;i--) if(!dirty(f.contribs[i])) return f.contribs[i].value;
      return f.base; },
    /** Only live correctness-relevant contributions survive. */
    fold(){ for(const f of facts.values()){
        while(f.contribs.length && f.contribs[0].settled && !dirty(f.contribs[0])){
          f.base=f.contribs.shift().value; } } },
    depth(){ let m=0; for(const f of facts.values()) m=Math.max(m,f.contribs.length); return m; },
    totalContribs(){ let t=0; for(const f of facts.values()) t+=f.contribs.length; return t; },
  };
  return api;
};

// 1 — F1 overlap. Rolling back the OLDER contribution while a NEWER overlapping
// one is open: the incumbent refuses this; a contribution store just removes it.
{
  const s=store();
  s.contribute('x',1,{owner:'P1'}); s.contribute('y',1,{owner:'P1'});
  s.contribute('y',2,{owner:'P2'}); s.contribute('z',2,{owner:'P2'});
  s.rollback('P1');
  check(s.visible('x')===0 && s.visible('y')===2 && s.visible('z')===2,
    '1 F1 overlap: rolling back the older contribution leaves the newer intact, no compensation',
    `x=${s.visible('x')} y=${s.visible('y')} z=${s.visible('z')}`);
}
// 2 — authoritative supersession must survive rollback of earlier authored work.
{
  const s=store();
  s.contribute('x',1,{owner:'P1'});
  s.contribute('x',3);                 // server truth, settled, higher order
  s.rollback('P1');
  check(s.visible('x')===3 && s.exposable('x')===3,
    '2 authoritative supersession survives rollback of the authored contribution',
    `visible=${s.visible('x')} exposable=${s.exposable('x')}`);
}
// 3 — dependency WITHOUT overlap: the case committed-view could not handle.
{
  const s=store(); s.openObligation('O1');
  s.contribute('x',1,{owner:'P1',obligations:['O1']});
  s.contribute('y',2,{owner:'P2',obligations:['O1']}); s.confirm('P2');
  const v=s.visible('y'), e=s.exposable('y');
  s.resolveObligation('O1');
  check(v===2 && e===0,
    '3 dependent y is VISIBLE at 2 but NOT exposable while O1 is unresolved',
    `visible=${v} exposable=${e}`);
  check(s.exposable('y')===2,
    '3b resolving O1 makes the same contribution exposable, with no waiter bookkeeping',
    `exposable=${s.exposable('y')}`);
}
// 4 — independent progress, with no blocker machinery at all.
{
  const s=store(); s.openObligation('O1');
  s.contribute('x',1,{owner:'P1',obligations:['O1']});
  s.contribute('y',7);
  check(s.exposable('x')===0 && s.exposable('y')===7,
    '4 independent y is exposable immediately while speculative x is not',
    `exposable x=${s.exposable('x')} y=${s.exposable('y')}`);
}
// 8 — multiple blockers.
{
  const s=store(); s.openObligation('O1'); s.openObligation('O4');
  s.contribute('y',5,{owner:'P2',obligations:['O1','O4']}); s.confirm('P2');
  const before=s.exposable('y');
  s.resolveObligation('O1'); const mid=s.exposable('y');
  s.resolveObligation('O4'); const after=s.exposable('y');
  check(before===0 && mid===0 && after===5,
    '8 multi-blocker: exposable only after BOTH obligations resolve',
    `before=${before} afterO1=${mid} afterO4=${after}`);
}
// 9 + retention — transitive, and settled clean contributions must not accumulate.
{
  const s=store(); s.openObligation('O1');
  s.contribute('x',1,{owner:'P1',obligations:['O1']});
  s.contribute('y',2,{owner:'P2',obligations:['O1']}); s.confirm('P2');
  s.contribute('z',3,{owner:'P3',obligations:['O1']}); s.confirm('P3');
  check(s.exposable('z')===0,'9 transitive: z is not exposable while the ROOT O1 is unresolved');
  s.confirm('P1'); s.resolveObligation('O1');
  const depthAfter=s.depth(), total=s.totalContribs();
  check(s.exposable('z')===3,'9b resolving the root makes z exposable');
  check(depthAfter===0 && total===0,
    'RETENTION settled obligation-clean contributions FOLD into base and disappear',
    `maxDepth=${depthAfter} totalLiveContribs=${total}`);
}
// 10 — an ordinary write must not create durable per-write structure.
{
  const s=store();
  for(let i=0;i<1000;i++) s.contribute('x',i);
  check(s.totalContribs()===0 && s.visible('x')===999,
    '10 ordinary writes leave NO accumulated contributions (stack stays O(live), not O(writes))',
    `live=${s.totalContribs()} visible=${s.visible('x')}`);
}

writeFileSync(resolve(here,'radical-contribution-store-0.json'),JSON.stringify({probe:'RADICAL-CONTRIBUTION-STORE-0',checks},null,2)+'\n');
const failed=checks.filter(c=>!c.ok);
console.log(`\n${checks.length-failed.length}/${checks.length} checks passed`);
process.exit(failed.length?1:0);
