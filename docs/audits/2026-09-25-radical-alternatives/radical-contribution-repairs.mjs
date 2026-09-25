#!/usr/bin/env node
// RADICAL-CONTRIBUTION-1 and -2: do the obvious repairs preserve the simplicity
// that made contribution-store attractive, or converge back toward Candidate C?
//
//   RC-1  can compaction preserve rollback/authority WITHOUT retaining hidden
//         history?
//   RC-2  can causal-turn grouping preserve independent fact progress WITHOUT
//         making every turn an indivisible snapshot?
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const checks=[]; const check=(ok,l,d)=>{checks.push({label:l,ok,detail:d});console.log(`${ok?'PASS':'FAIL'}  ${l}${d?`  -- ${d}`:''}`);};

const store = () => {
  const facts=new Map(); const live=new Set(); let seq=0;
  const F=k=>{ if(!facts.has(k)) facts.set(k,{base:0,contribs:[]}); return facts.get(k); };
  const dirty=c=>[...c.obligations].some(o=>live.has(o));
  const api={
    open:o=>live.add(o),
    resolve(o){ live.delete(o); this.compact(); },
    contribute(k,value,{owner=null,obligations=[],turn=null}={}){
      const f=F(k); f.contribs.push({value,order:++seq,owner,turn,settled:owner===null,obligations:new Set(obligations)});
      this.compact(); return seq; },
    confirm(owner){ for(const f of facts.values()) for(const c of f.contribs) if(c.owner===owner) c.settled=true; this.compact(); },
    rollback(owner){ for(const f of facts.values()) f.contribs=f.contribs.filter(c=>c.owner!==owner); this.compact(); },
    /**
     * RC-1 COMPACTION. Everything at or below the HIGHEST settled clean
     * contribution is superseded for this fact -- including an unresolved
     * contribution buried beneath it, whose rollback here is already a no-op.
     * Obligation LIVENESS is tracked separately and is NOT ended by compaction,
     * because other facts may have inherited it.
     */
    compact(){ for(const f of facts.values()){
        let cut=-1;
        // COUPLING RULE, forced by RC-2: a contribution may not be compacted
        // while its causal turn still has a dirty sibling, or compaction erases
        // the turn membership grouping depends on.
        for(let i=f.contribs.length-1;i>=0;i--){ const c=f.contribs[i];
          if(c.settled && !dirty(c) && (c.turn===null || this.turnClean(c.turn))){ cut=i; break; } }
        if(cut>=0){ f.base=f.contribs[cut].value; f.contribs=f.contribs.slice(cut+1); } } },
    visible(k){ const f=F(k); return f.contribs.length?f.contribs[f.contribs.length-1].value:f.base; },
    exposable(k){ const f=F(k);
      for(let i=f.contribs.length-1;i>=0;i--) if(!dirty(f.contribs[i])) return f.contribs[i].value;
      return f.base; },
    /** RC-2: a turn is exposable only if EVERY fact it wrote is clean. */
    turnClean(turn){ for(const f of facts.values()) for(const c of f.contribs)
        if(c.turn===turn && dirty(c)) return false; return true; },
    exposableGrouped(k){ const f=F(k);
      for(let i=f.contribs.length-1;i>=0;i--){ const c=f.contribs[i];
        if(!dirty(c) && (c.turn===null || this.turnClean(c.turn))) return c.value; }
      return f.base; },
    depth(k){ return F(k).contribs.length; },
    liveObligations(){ return live.size; },
  };
  return api;
};

// ---- RC-1: compaction under long-pending churn -----------------------------
{
  const s=store(); s.open('O1');
  s.contribute('x',1,{owner:'P1',obligations:['O1']});
  for(let i=2;i<=100001;i++) s.contribute('x',i);
  check(s.depth('x')===0 && s.visible('x')===100001,
    'RC-1 compaction bounds depth under 100k writes behind an unresolved contribution',
    `depth=${s.depth('x')} visible=${s.visible('x')}`);
  check(s.liveObligations()===1,
    'RC-1 the OBLIGATION stays live even though its contribution was compacted away',
    `liveObligations=${s.liveObligations()}`);
  // Rolling back the compacted-away contribution must be a safe no-op.
  const before=s.visible('x'); s.rollback('P1');
  check(s.visible('x')===before,
    'RC-1 rollback of a superseded compacted contribution is a NO-OP, not a restore',
    `before=${before} after=${s.visible('x')}`);
}
// RC-1 negative control: compaction must NOT discard a contribution that is
// still the visible truth.
{
  const s=store(); s.open('O1');
  s.contribute('x',5);                                     // settled clean base
  s.contribute('x',9,{owner:'P1',obligations:['O1']});      // unresolved ON TOP
  check(s.depth('x')===1 && s.visible('x')===9 && s.exposable('x')===5,
    'RC-1 an unresolved contribution ON TOP is retained, not compacted away',
    `depth=${s.depth('x')} visible=${s.visible('x')} exposable=${s.exposable('x')}`);
  s.rollback('P1');
  check(s.visible('x')===5,'RC-1 rolling it back reverts to the compacted base',`visible=${s.visible('x')}`);
}

// ---- RC-2: causal-turn grouping --------------------------------------------
{
  const s=store(); s.open('OT');
  s.contribute('x',10,{owner:'T1',turn:'T1',obligations:['OT']});
  s.contribute('y',20,{owner:'T1',turn:'T1'});               // same turn, clean
  s.confirm('T1');
  check(s.exposableGrouped('y')===0 && s.exposableGrouped('x')===0,
    'RC-2 grouping prevents exposing HALF a causal turn',
    `x=${s.exposableGrouped('x')} y=${s.exposableGrouped('y')}`);
  // Independent progress across a DIFFERENT turn must survive grouping.
  s.contribute('z',7,{owner:'T2',turn:'T2'}); s.confirm('T2');
  check(s.exposableGrouped('z')===7,
    'RC-2 a DIFFERENT turn still progresses -- grouping is not a global snapshot',
    `z=${s.exposableGrouped('z')}`);
  s.resolve('OT');
  check(s.exposableGrouped('x')===10 && s.exposableGrouped('y')===20,
    'RC-2 resolving the obligation exposes the WHOLE turn at once',
    `x=${s.exposableGrouped('x')} y=${s.exposableGrouped('y')}`);
}
// RC-2 cost control: an ordinary write outside any turn must not be grouped.
{
  const s=store(); s.open('O1');
  s.contribute('a',1,{owner:'P1',turn:'P1',obligations:['O1']});
  s.contribute('b',2);                                       // plain write, turn=null
  check(s.exposableGrouped('b')===2,
    'RC-2 an ordinary write outside a turn is unaffected by grouping',
    `b=${s.exposableGrouped('b')}`);
}

writeFileSync(resolve(here,'radical-contribution-repairs.json'),JSON.stringify({probe:'CONTRIBUTION-REPAIRS',checks},null,2)+'\n');
const failed=checks.filter(c=>!c.ok);
console.log(`\n${checks.length-failed.length}/${checks.length} checks passed`);
process.exit(failed.length?1:0);
