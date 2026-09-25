#!/usr/bin/env node
// STRUCTURAL 5/6/7 — the wall every candidate has died on.
//
// Structure is modelled with the SAME primitive, not a side engine that happens
// to make the tests pass. Three semantic fact kinds:
//
//     existence(S)            does this subject exist
//     occupancy(key)          which subject currently holds this business key
//     field(S, name)          a field of a subject lifetime
//
// A rekey is then contributions over OCCUPANCY, leaving the subject untouched.
// Key reuse gives occupancy a DIFFERENT subject. Nothing keys off the business
// key for identity.
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
const checks=[]; const check=(ok,l,d)=>{checks.push({label:l,ok,detail:d});console.log(`${ok?'PASS':'FAIL'}  ${l}${d?`  -- ${d}`:''}`);};

const store=()=>{
  const facts=new Map(); const live=new Set(); const rootOf=new Map(); const turnOpen=new Map(); let seq=0;
  const F=k=>{ if(!facts.has(k)) facts.set(k,{base:undefined,contribs:[]}); return facts.get(k); };
  const dirty=c=>[...c.obligations].some(o=>live.has(o));
  const api={
    openObligation(o,owner){ live.add(o); rootOf.set(o,owner); },
    blocked(c){ return dirty(c) || (c.turn!==null && turnOpen.get(c.turn)===true); },
    contribute(k,v,{owner=null,obligations=[],turn=null}={}){
      const f=F(k); f.contribs.push({v,order:++seq,owner,turn,settled:owner===null,obligations:new Set(obligations)});
      if(turn!==null && !turnOpen.has(turn)) turnOpen.set(turn,true); this.compact(); },
    settle(turn,{rolledBack=false}={}){
      turnOpen.set(turn,false);
      for(const f of facts.values()){
        if(rolledBack) f.contribs=f.contribs.filter(c=>c.turn!==turn);
        else for(const c of f.contribs) if(c.turn===turn) c.settled=true; }
      for(const [o,ow] of [...rootOf]) if(ow===turn){ live.delete(o); rootOf.delete(o); }
      this.compact(); },
    compact(){ for(const f of facts.values()){ let cut=-1;
      for(let i=f.contribs.length-1;i>=0;i--){ const c=f.contribs[i]; if(c.settled&&!api.blocked(c)){cut=i;break;} }
      if(cut>=0){ f.base=f.contribs[cut].v; f.contribs=f.contribs.slice(cut+1); } } },
    visible(k){ const f=F(k); return f.contribs.length?f.contribs[f.contribs.length-1].v:f.base; },
    exposable(k){ const f=F(k);
      for(let i=f.contribs.length-1;i>=0;i--) if(!api.blocked(f.contribs[i])) return f.contribs[i].v;
      return f.base; },
    retained(){ let t=0; for(const f of facts.values()) t+=f.contribs.length; return t; },
  };
  return api;
};
const existence=S=>`existence(${S})`, occupancy=k=>`occupancy(${k})`, field=(S,n)=>`field(${S},${n})`;

// ---- ROW 5: pending-created subject, and a dependent reading its field.
{
  const s=store(); s.openObligation('O1','P1');
  s.contribute(existence('S1'),true,{owner:'P1',turn:'P1',obligations:['O1']});
  s.contribute(occupancy('A'),'S1',{owner:'P1',turn:'P1',obligations:['O1']});
  s.contribute(field('S1','score'),1,{owner:'P1',turn:'P1',obligations:['O1']});
  check(s.visible(existence('S1'))===true && s.exposable(existence('S1'))===undefined,
    'ROW5 a pending-created subject is VISIBLE but not exposable',
    `visible=${s.visible(existence('S1'))} exposable=${s.exposable(existence('S1'))}`);
  // P2 reads S1.score and derives elsewhere -> inherits O1.
  s.contribute('derived',101,{owner:'P2',turn:'P2',obligations:['O1']});
  s.settle('P2');
  check(s.exposable('derived')===undefined,
    'ROW5 a dependent deriving from the pending subject is withheld even after IT settles',
    `exposable=${s.exposable('derived')}`);
  s.settle('P1');
  check(s.exposable(existence('S1'))===true && s.exposable('derived')===101,
    'ROW5 settling the creator exposes both the subject and its dependent',
    `existence=${s.exposable(existence('S1'))} derived=${s.exposable('derived')}`);
  // Rolling back instead must remove the subject entirely.
  const r=store(); r.openObligation('O2','Q1');
  r.contribute(existence('S9'),true,{owner:'Q1',turn:'Q1',obligations:['O2']});
  r.settle('Q1',{rolledBack:true});
  check(r.visible(existence('S9'))===undefined,
    'ROW5 rolling back the creator removes the subject -- no compensation needed',
    `visible=${r.visible(existence('S9'))}`);
}
// ---- ROW 6: rekey moves OCCUPANCY, not the subject.
{
  const s=store();
  s.contribute(existence('S1'),true);
  s.contribute(occupancy('A'),'S1');
  s.contribute(field('S1','score'),5);
  s.contribute(occupancy('A'),undefined);          // A -> empty
  s.contribute(occupancy('B'),'S1');               // B -> S1
  check(s.visible(occupancy('A'))===undefined && s.visible(occupancy('B'))==='S1',
    'ROW6 rekey A->B moves occupancy only',
    `A=${s.visible(occupancy('A'))} B=${s.visible(occupancy('B'))}`);
  check(s.visible(existence('S1'))===true && s.visible(field('S1','score'))===5,
    'ROW6 the SUBJECT and its fields are untouched by the rekey -- no repair step',
    `existence=${s.visible(existence('S1'))} score=${s.visible(field('S1','score'))}`);
  check(s.retained()===0,'ROW6 and the rekey leaves no retained contributions',`retained=${s.retained()}`);
}
// ---- ROW 7: key reuse gives occupancy a DIFFERENT subject.
{
  const s=store(); s.openObligation('O1','P1');
  s.contribute(existence('S1'),true);
  s.contribute(occupancy('A'),'S1');
  s.contribute(field('S1','score'),5,{owner:'P1',turn:'P1',obligations:['O1']});  // pending on the OLD subject
  s.contribute(existence('S1'),false);             // old subject removed
  s.contribute(occupancy('A'),undefined);
  s.contribute(existence('S2'),true);              // fresh subject
  s.contribute(occupancy('A'),'S2');               // reusing key A
  s.contribute(field('S2','score'),99);
  check(s.visible(occupancy('A'))==='S2' && s.visible(field('S2','score'))===99,
    'ROW7 the reused key now holds a DIFFERENT subject',
    `occupancy(A)=${s.visible(occupancy('A'))} S2.score=${s.visible(field('S2','score'))}`);
  check(s.exposable(field('S2','score'))===99,
    'ROW7 the fresh subject does NOT inherit the old subject pending obligation',
    `exposable(S2.score)=${s.exposable(field('S2','score'))}`);
  check(s.exposable(field('S1','score'))===undefined,
    'ROW7 the OLD lifetime field stays blocked by its own obligation',
    `exposable(S1.score)=${s.exposable(field('S1','score'))}`);
  s.settle('P1',{rolledBack:true});
  check(s.visible(occupancy('A'))==='S2',
    'ROW7 rolling back the old pending work does not disturb the fresh occupant',
    `occupancy(A)=${s.visible(occupancy('A'))}`);
}
writeFileSync(resolve(here,'structural-567.json'),JSON.stringify({probe:'STRUCTURAL-567',checks},null,2)+'\n');
const failed=checks.filter(c=>!c.ok);
console.log(`\n${checks.length-failed.length}/${checks.length} checks passed`);
process.exit(failed.length?1:0);
