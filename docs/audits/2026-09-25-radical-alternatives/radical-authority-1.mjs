#!/usr/bin/env node
// RADICAL-CONTRIBUTION-AUTHORITY-1
//
// ACCEPTANCE CRITERION, preregistered:
//   authority may change FRONTIER SELECTION without changing the retention
//   rule -- keep only what can still affect a legal future outcome. If it
//   forces predecessor history, restoration info or an authority journal, kill.
//
// Authority is modelled as a RELATION, not a scalar rank. A number is
// convenient, not semantic, and the constitution says authority order is
// explicit -- not that it is globally total.
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
const checks=[]; const check=(ok,l,d)=>{checks.push({label:l,ok,detail:d});console.log(`${ok?'PASS':'FAIL'}  ${l}${d?`  -- ${d}`:''}`);};

/** Partial order: comparable only within a domain unless policy relates them. */
const dominates=(a,b)=>{
  if(a.domain!==b.domain) return false;          // incomparable across domains
  return a.rank>b.rank;
};
const comparable=(a,b)=>a.domain===b.domain;

const store=({authorityAware=true}={})=>{
  const facts=new Map(); const live=new Set(); const rootOf=new Map(); const settled=new Map(); let seq=0;
  const F=k=>{ if(!facts.has(k)) facts.set(k,{base:0,baseAuthority:{domain:'base',rank:-Infinity},contribs:[]}); return facts.get(k); };
  const dirty=c=>[...c.obligations].some(o=>live.has(o));
  const api={
    openObligation(o,owner){ live.add(o); rootOf.set(o,owner); },
    contribute(k,v,{owner=null,obligations=[],turn=null,authority={domain:'local',rank:0}}={}){
      const f=F(k); f.contribs.push({v,order:++seq,owner,turn,authority,settled:owner===null,obligations:new Set(obligations)});
      if(turn!==null && !settled.has(owner)) settled.set(owner,false);
      this.compact(); return seq; },
    settleOwner(owner,{rolledBack=false,settles=[]}={}){
      settled.set(owner,true);
      for(const f of facts.values()){
        if(rolledBack) f.contribs=f.contribs.filter(c=>c.owner!==owner);
        else for(const c of f.contribs) if(c.owner===owner) c.settled=true; }
      for(const [o,ow] of [...rootOf]) if(ow===owner){ live.delete(o); rootOf.delete(o); }
      // L11: an authoritative write settles a pending contribution ONLY via an
      // explicit settlement relation, never by arriving with higher authority.
      for(const other of settles) this.settleOwner(other);
      this.compact();
    },
    turnOpen(t){ return t!==null && settled.get(t)===false; },
    blocked(c){ return dirty(c) || this.turnOpen(c.turn); },
    /** Frontier = the authority-maximal candidate; ties fall back to order. */
    select(list){
      if(!list.length) return undefined;
      if(!authorityAware) return list[list.length-1];          // MUTANT: append order
      let best=list[0];
      for(const c of list.slice(1)){
        if(dominates(c.authority,best.authority)) best=c;
        else if(!comparable(c.authority,best.authority) && c.order>best.order) best=c;
        else if(comparable(c.authority,best.authority) && !dominates(best.authority,c.authority) && c.order>best.order) best=c;
      }
      return best; },
    conflicted(k){ const f=F(k); const top=[this.baseCandidate(f),...f.contribs.filter(c=>!this.blocked(c))]
        .filter(c=>c.authority.domain!=='base');
      if(top.length<2) return false;
      const a=top[top.length-1], b=top[top.length-2];
      return !comparable(a.authority,b.authority); },
    /** The base participates in selection as a real candidate: it carries the
     *  authority of the contribution that produced it. Without this, folding a
     *  winner into a bare value ERASES its authority and a later lower-authority
     *  write wins. That is one tag on the current base, not retained history. */
    baseCandidate(f){ return {v:f.base,order:-Infinity,owner:null,turn:null,
      authority:f.baseAuthority,settled:true,obligations:new Set()}; },
    visible(k){ const f=F(k); return this.select([this.baseCandidate(f),...f.contribs]).v; },
    exposable(k){ const f=F(k);
      return this.select([this.baseCandidate(f),...f.contribs.filter(c=>!this.blocked(c))]).v; },
    /** Retention: discard anything that can no longer affect a legal frontier. */
    compact(){ for(const f of facts.values()){
        const usable=[api.baseCandidate(f),...f.contribs.filter(c=>c.settled && !api.blocked(c))];
        const win=api.select(usable);
        if(!win || win.order===-Infinity) { f.contribs=f.contribs.filter(c=>!c.settled||api.blocked(c)||
            (!dominates(f.baseAuthority,c.authority))); continue; }
        f.base=win.v; f.baseAuthority=win.authority;
        // keep only candidates that could still WIN later: unsettled/blocked
        // ones, and anything the winner does not already dominate.
        f.contribs=f.contribs.filter(c=>{
          if(!c.settled || api.blocked(c)) return true;
          return c!==win && !dominates(win.authority,c.authority) && c.order>win.order; }); } },
    retained(){ let t=0; for(const f of facts.values()) t+=f.contribs.length; return t; },
    isSettled(o){ return settled.get(o)===true; },
  };
  return api;
};

// A — append order actively wrong
{
  const s=store();
  s.contribute('x',10,{authority:{domain:'srv',rank:1}});
  s.contribute('x',20,{authority:{domain:'srv',rank:3}});
  s.contribute('x',30,{authority:{domain:'srv',rank:2}});
  check(s.visible('x')===20,'A frontier follows AUTHORITY, not append order (C2/20, not C3/30)',
    `visible=${s.visible('x')}`);
  const m=store({authorityAware:false});
  m.contribute('x',10,{authority:{domain:'srv',rank:1}});
  m.contribute('x',20,{authority:{domain:'srv',rank:3}});
  m.contribute('x',30,{authority:{domain:'srv',rank:2}});
  check(m.visible('x')===30,'A MUTANT append-order selection picks 30 — the row is not vacuous',
    `mutant visible=${m.visible('x')}`);
}
// B — authority x compaction
{
  const s=store();
  s.contribute('x',10,{authority:{domain:'srv',rank:3}});
  s.contribute('x',20,{authority:{domain:'srv',rank:1}});
  check(s.visible('x')===10 && s.exposable('x')===10,
    'B a later LOWER-authority settled write does not replace higher-authority truth',
    `visible=${s.visible('x')} exposable=${s.exposable('x')}`);
  check(s.retained()===0,'B ...and compaction keeps nothing that can no longer win',`retained=${s.retained()}`);
}
// C — pending high authority over a settled fallback
{
  const s=store(); s.openObligation('OC','P2');
  s.contribute('x',10,{authority:{domain:'srv',rank:1}});
  s.contribute('x',20,{owner:'P2',turn:'P2',authority:{domain:'srv',rank:5},obligations:['OC']});
  check(s.exposable('x')===10,'C exposable falls back to the settled lower-authority truth',`exposable=${s.exposable('x')}`);
  check(s.retained()===1,'C exactly ONE live candidate retained, not a history of contenders',
    `retained=${s.retained()}`);
  s.settleOwner('P2',{rolledBack:true});
  check(s.exposable('x')===10 && s.retained()===0,'C rolling back the pending candidate leaves 10 and retains nothing',
    `exposable=${s.exposable('x')} retained=${s.retained()}`);
}
// D1 / D2 — L11
{
  const a=store(); a.openObligation('O1','P1');
  a.contribute('x',1,{owner:'P1',turn:'P1',authority:{domain:'local',rank:0},obligations:['O1']});
  a.contribute('x',3,{authority:{domain:'srv',rank:1}});
  check(a.exposable('x')===3 && !a.isSettled('P1'),
    'D1 authoritative truth advances the frontier WITHOUT settling the pending contribution',
    `exposable=${a.exposable('x')} P1settled=${a.isSettled('P1')}`);
  const b=store(); b.openObligation('O1','P1');
  b.contribute('x',1,{owner:'P1',turn:'P1',authority:{domain:'local',rank:0},obligations:['O1']});
  b.contribute('x',3,{owner:'SRV',turn:'SRV',authority:{domain:'srv',rank:1}});
  b.settleOwner('SRV',{settles:['P1']});
  check(b.exposable('x')===3 && b.isSettled('P1'),
    'D2 the SAME advance settles P1 only via an explicit settlement relation',
    `exposable=${b.exposable('x')} P1settled=${b.isSettled('P1')}`);
}
// E — incomparable authority must not be silently ranked
{
  const s=store();
  s.contribute('x',10,{authority:{domain:'A',rank:9}});
  s.contribute('x',20,{authority:{domain:'B',rank:1}});
  check(s.conflicted('x'),'E two incomparable authority domains are reported as CONFLICTED, not silently ranked',
    `conflicted=${s.conflicted('x')} visible=${s.visible('x')}`);
}
// F — higher authority is not a shortcut for dependency cleanup
{
  const s=store(); s.openObligation('O1','P1');
  s.contribute('x',1,{owner:'P1',turn:'P1',obligations:['O1']});
  s.contribute('y',2,{owner:'P2',turn:'P2',obligations:['O1']}); s.settleOwner('P2');
  s.contribute('x',9,{authority:{domain:'srv',rank:5}});
  check(s.exposable('x')===9 && s.exposable('y')===0,
    'F authoritative supersession of x does NOT release y, which still depends on O1',
    `x=${s.exposable('x')} y=${s.exposable('y')}`);
  s.settleOwner('P1');
  check(s.exposable('y')===2,'F ...only resolving the root obligation releases y',`y=${s.exposable('y')}`);
}

writeFileSync(resolve(here,'radical-authority-1.json'),JSON.stringify({probe:'AUTHORITY-1',checks},null,2)+'\n');
const failed=checks.filter(c=>!c.ok);
console.log(`\n${checks.length-failed.length}/${checks.length} checks passed`);
process.exit(failed.length?1:0);
