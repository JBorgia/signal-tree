#!/usr/bin/env node
// RADICAL-CONTRIBUTION-COMPOSITION-1
//
// COMPACTION-1 and COHERENCE-1 each passed ALONE. This collides them, plus the
// obligation lifecycle that COMPACTION-1 assumed away by resolving O1 from
// outside with no root relation.
//
// PREREGISTERED SEMANTIC ANSWER, derived before running, so turnClean() does
// not get to decide it by accident:
//
//   Q: if an unresolved contribution belonging to an atomic causal turn is
//      SUPERSEDED, does its unresolved responsibility still gate the surviving
//      members of that turn?
//
//   A: it depends on WHICH kind of unresolvedness, and the model currently
//      conflates them:
//
//      (1) THE TURN'S OWN DISPOSITION is unresolved (not yet settled).
//          Its members gate each other REGARDLESS of supersession, because a
//          rollback would still retract the surviving members. Exposing a
//          sibling would export retractable truth.
//
//      (2) The turn is SETTLED, but a member carries a live DEPENDENCY
//          obligation. Once that member is superseded by later clean truth, it
//          no longer gates its siblings -- because {supersedingX, y} is a state
//          that GENUINELY EXISTED, whereas {preTurnX, y} never did. Tearing was
//          only ever about exposing a state that never existed.
//
// So supersession legitimately releases (2) and must NOT release (1).
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
const checks=[]; const check=(ok,l,d)=>{checks.push({label:l,ok,detail:d});console.log(`${ok?'PASS':'FAIL'}  ${l}${d?`  -- ${d}`:''}`);};

const store=({forgetRoot=false,forgetCompactedMember=false}={})=>{
  const facts=new Map(); const live=new Set(); const rootOf=new Map(); const turnSettled=new Map(); let seq=0;
  const F=k=>{ if(!facts.has(k)) facts.set(k,{base:0,contribs:[]}); return facts.get(k); };
  const dirty=c=>[...c.obligations].some(o=>live.has(o));
  const api={
    /** An obligation is OWNED by the contribution/authority that can resolve it. */
    openObligation(o,owner){ live.add(o); if(!forgetRoot) rootOf.set(o,owner); },
    settleOwner(owner,{rolledBack=false}={}){
      turnSettled.set(owner,true);
      for(const f of facts.values()){
        if(rolledBack) f.contribs=f.contribs.filter(c=>c.owner!==owner);
        else for(const c of f.contribs) if(c.owner===owner) c.settled=true; }
      // ROOT LIFECYCLE: settling the owner terminates the obligations it roots,
      // with no external naming of O1.
      for(const [o,ow] of [...rootOf]) if(ow===owner){ live.delete(o); rootOf.delete(o); }
      this.compact();
    },
    contribute(k,v,{owner=null,obligations=[],turn=null}={}){
      const f=F(k); f.contribs.push({v,order:++seq,owner,turn,settled:owner===null,obligations:new Set(obligations)});
      if(turn!==null && !turnSettled.has(owner)) turnSettled.set(owner,false);
      this.compact(); return seq; },
    /** (1) the turn's own disposition, independent of any member's obligations. */
    turnDispositionOpen(t){ return t!==null && turnSettled.get(t)===false; },
    /** (2) dependency dirt among the turn's SURVIVING members. */
    turnMemberDirty(t){ for(const f of facts.values()) for(const c of f.contribs)
        if(c.turn===t && dirty(c)) return true;
      // MUTANT: also consult members already compacted away.
      return forgetCompactedMember ? false : false; },
    blockedBy(c){ return dirty(c) || this.turnDispositionOpen(c.turn) || (c.turn!==null && this.turnMemberDirty(c.turn)); },
    compact(){ for(const f of facts.values()){ let cut=-1;
        for(let i=f.contribs.length-1;i>=0;i--){ const c=f.contribs[i];
          if(c.settled && !api.blockedBy(c)){ cut=i; break; } }
        if(cut>=0){ f.base=f.contribs[cut].v; f.contribs=f.contribs.slice(cut+1); } } },
    visible(k){ const f=F(k); return f.contribs.length?f.contribs[f.contribs.length-1].v:f.base; },
    exposable(k){ const f=F(k);
      for(let i=f.contribs.length-1;i>=0;i--) if(!api.blockedBy(f.contribs[i])) return f.contribs[i].v;
      return f.base; },
    retained(){ let t=0; for(const f of facts.values()) t+=f.contribs.length; return t; },
    liveObligations(){ return live.size; },
  };
  return api;
};

// A — ROOT LIFECYCLE: O1 terminates from P1 settling, never named externally.
{
  const s=store();
  s.openObligation('O1','P1');
  s.contribute('x',1,{owner:'P1',turn:'P1',obligations:['O1']});
  for(let i=2;i<=5000;i++) s.contribute('x',i);          // supersede + compact P1 away
  s.contribute('d',42,{owner:'PD',turn:'PD',obligations:['O1']}); s.settleOwner('PD');
  check(s.exposable('d')===0,'A dependent stays blocked after the ROOT contribution was compacted away',
    `exposable(d)=${s.exposable('d')}`);
  s.settleOwner('P1');                                   // no external resolveObligation call
  check(s.liveObligations()===0 && s.exposable('d')===42,
    'A settling the ROOT OWNER terminates its obligation without naming it externally',
    `live=${s.liveObligations()} exposable(d)=${s.exposable('d')}`);
}
// B — COMPACTION x TURN COHERENCE, the predicted collision.
{
  // B1: turn SETTLED, dirty member superseded -> sibling MAY expose (case 2).
  const s=store(); s.openObligation('OT','PX');
  s.contribute('x',10,{owner:'T1',turn:'T1',obligations:['OT']});
  s.contribute('y',20,{owner:'T1',turn:'T1'});
  s.settleOwner('T1');
  check(s.exposable('y')===0,'B1 before supersession the turn is atomic: y withheld',`y=${s.exposable('y')}`);
  s.contribute('x',99);                                  // later clean authoritative truth
  check(s.exposable('x')===99 && s.exposable('y')===20,
    'B1 once the dirty member is SUPERSEDED, {x:99,y:20} is a state that existed -- expose it',
    `x=${s.exposable('x')} y=${s.exposable('y')}`);
  // B2: turn NOT settled -> supersession must NOT release the sibling (case 1).
  const t=store(); t.openObligation('OU','PY');
  t.contribute('p',10,{owner:'T9',turn:'T9',obligations:['OU']});
  t.contribute('q',20,{owner:'T9',turn:'T9'});
  t.contribute('p',99);                                  // supersede while T9 still open
  check(t.exposable('q')===0,
    'B2 while the TURN ITSELF is unresolved, supersession does NOT release the sibling',
    `q=${t.exposable('q')} (rollback of T9 would still retract it)`);
}
// C — SHARED ROOT: two inheritors released exactly once; an unrelated obligation survives.
{
  const s=store(); s.openObligation('O1','P1'); s.openObligation('O2','P2');
  s.contribute('y',5,{owner:'A1',turn:'A1',obligations:['O1']}); s.settleOwner('A1');
  s.contribute('z',6,{owner:'A2',turn:'A2',obligations:['O1']}); s.settleOwner('A2');
  s.contribute('w',7,{owner:'A3',turn:'A3',obligations:['O2']}); s.settleOwner('A3');
  s.settleOwner('P1');
  check(s.exposable('y')===5 && s.exposable('z')===6,'C resolving the shared root releases BOTH inheritors',
    `y=${s.exposable('y')} z=${s.exposable('z')}`);
  check(s.exposable('w')===0 && s.liveObligations()===1,'C ...and the unrelated obligation stays live',
    `w=${s.exposable('w')} live=${s.liveObligations()}`);
}
// D — ORPHAN CONTROL + MUTANT.
{
  const s=store();
  s.openObligation('O1','P1');
  s.contribute('x',1,{owner:'P1',turn:'P1',obligations:['O1']});
  for(let i=2;i<=100;i++) s.contribute('x',i);           // every carrier compacted away
  check(s.liveObligations()===1 && s.retained()===0,
    'D the obligation stays addressable though nothing it affects remains',
    `live=${s.liveObligations()} retained=${s.retained()}`);
  const m=store({forgetRoot:true});
  m.openObligation('O1','P1');
  m.contribute('x',1,{owner:'P1',turn:'P1',obligations:['O1']});
  m.contribute('d',9,{owner:'PD',turn:'PD',obligations:['O1']}); m.settleOwner('PD');
  m.settleOwner('P1');
  check(m.exposable('d')===0,
    'D MUTANT forgetting the root->obligation relation ORPHANS the obligation: d never releases',
    `exposable(d)=${m.exposable('d')} live=${m.liveObligations()}`);
}

writeFileSync(resolve(here,'radical-composition-1.json'),JSON.stringify({probe:'COMPOSITION-1',checks},null,2)+'\n');
const failed=checks.filter(c=>!c.ok);
console.log(`\n${checks.length-failed.length}/${checks.length} checks passed`);
process.exit(failed.length?1:0);
