import {appendFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {link,signalTree,transactions,type PublicationReceipt} from '../index';
import {__historyRoots,__historySnapshot} from './experimental-publication/private';
import {__historyOperations,__c26NormalizationState,nativeProof} from './experimental-publication/lifecycle';
const drain=async()=>{for(let i=0;i<120;i++)await Promise.resolve();};
for(const terminal of ['confirm','dispose-pending'] as const)it(`repeated no-write retains only original selected operation, then ${terminal}`,async()=>{
 const t=signalTree({pair:{x:0,y:0},q:0},{enhancers:[transactions()]});const sent:unknown[]=[];const c=link(t.$.pair,{set:v=>{sent.push(v);}});const receipts:PublicationReceipt[]=[];
 try{
  const p=t.transact(()=>t.$.pair.x(7)),a=t.transact(()=>t.$.q(1));
  const earlier=c.declare({kind:'dependent',owners:[p,a]},()=>t.$(v=>({...v,pair:{...v.pair}})));a.confirm();await drain();
  const saved=t.$.pair(),savedViews=__historySnapshot(saved)!,issued=savedViews.map(v=>v.requirement);
  const original=__historyOperations().find(op=>__historyRoots(t.$.pair.x).bindings.some(b=>b.current===op.revision))!;expect(original).toBeDefined();
  const dependencies=[...original.dependencies],originalProof=original.proof,originalNative=original.native;
  const cells=(values:Iterable<{owner:number;id:number;outcome:string}>)=>[...values].map(v=>({owner:v.owner,id:v.id,outcome:v.outcome}));
  const sample=(n:number,phase:string)=>{
   const roots=__historyRoots(t.$.pair.x),source=roots.endpoint!.requirement,ops=__historyOperations();
   const cached=__historySnapshot(t.$.pair())??[];
   const row={terminal,n,phase,source:{owners:cells(nativeProof(source).owners),components:source.components?.length??0,getter:!!Object.getOwnPropertyDescriptor(source,'proof')?.get,normalization:__c26NormalizationState(source)},recipients:roots.bindings.map(b=>({owners:cells(b.index.proof().owners),pending:b.pending.size,maskedUnits:[...b.pending].filter(u=>u.relevance?.size).length})),selectedOperations:ops.map(op=>({isOriginal:op===original,dependencies:cells(op.dependencies),hasInvocation:!!op.invocation,mask:op.relevance?.size??0,frames:op.frames.size})),cachedOwners:cells(new Set(cached.flatMap(v=>nativeProof(v.requirement).owners))),issuedOwners:cells(new Set(issued.flatMap(r=>nativeProof(r).owners))),originalDependencyRegistrations:dependencies.map(cell=>({owner:cell.owner,id:cell.id,stillRegistered:cell.dependents.has(original)})),oldReceipt:earlier.read(),freshReceipts:receipts.map(r=>r.read()),sent};
   const output=process.env['ST_NO_WRITE_ROOTS_OUTPUT'];if(!output)throw Error('Missing no-write root output');appendFileSync(output,JSON.stringify(row)+'\n');
  };
  let settled=false;const waiting=c.settled().then(()=>{settled=true;});const before=p.inspect();sample(0,'historical');
  for(let n=1;n<=4;n++){
   const q=t.transact(()=>t.$.q(n+1));q.confirm();await drain();let calls=0;
   const receipt=c.declare({kind:'dependent',owners:[p,q]},()=>t.$(v=>{calls++;expect(v.q).toBe(n+1);return {...v,pair:{...v.pair}};}));receipts.push(receipt);await drain();
   expect(calls).toBe(1);expect(receipt.read()).toEqual({state:'no-write'});expect(earlier.read().state).not.toBe('superseded');expect(settled).toBe(false);expect(sent).toEqual([]);expect(p.inspect()).toEqual(before);
   const roots=__historyRoots(t.$.pair.x),ops=__historyOperations();expect(ops).toEqual([original]);expect(roots.bindings[0].current).toBe(original.revision);
   expect([...original.dependencies]).toEqual(dependencies);expect(original.proof).toBe(originalProof);expect(original.native).toBe(originalNative);expect(original.invocation).toBeUndefined();expect(original.relevance).toBeUndefined();
   expect(roots.bindings.every(b=>b.pending.size===0)).toBe(true);expect(nativeProof(roots.endpoint!.requirement).owners).toHaveLength(1);
   expect(__historySnapshot(saved)).toBe(savedViews);expect(savedViews.map(v=>v.requirement)).toEqual(issued);
   if(n===1||n===2||n===4)sample(n,'no-write-closed');
  }
  if(terminal==='confirm'){
   p.confirm();await drain();await waiting;expect(settled).toBe(true);expect(sent).toEqual([{x:7,y:0}]);expect(earlier.read()).toEqual({state:'started',basis:'surviving'});sample(4,'confirmed');
  }else{
   c.dispose();await drain();await waiting;expect(settled).toBe(true);expect(sent).toEqual([]);expect(earlier.read()).toEqual({state:'disposed'});sample(4,'disposed-pending');p.confirm();await drain();expect(sent).toEqual([]);
  }
  c.dispose();await drain();expect(__historyOperations()).toEqual([]);expect(__historyRoots(t.$.pair.x).bindings).toEqual([]);for(const cell of dependencies)expect(cell.dependents.has(original)).toBe(false);
  for(const receipt of receipts)expect(receipt.read()).toEqual({state:'no-write'});sample(4,'disposed');const beforeSend=[...sent];t.$.pair.x(99);await drain();expect(sent).toEqual(beforeSend);
 }finally{c.dispose();t.destroy();}
});
