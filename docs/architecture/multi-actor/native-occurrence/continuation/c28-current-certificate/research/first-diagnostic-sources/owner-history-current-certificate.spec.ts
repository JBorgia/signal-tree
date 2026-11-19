import {appendFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {link,signalTree,transactions,type PendingTransaction} from '../index';
import {__historyRoots,__historyFactRoot} from './experimental-publication/private';
import {__historyWeakRoots,__historyOperations,nativeProof,type NativeRequirement,diagnostics} from './experimental-publication/lifecycle';
type C=ReturnType<typeof link>&{declare(input:{kind:'dependent';owners:readonly PendingTransaction[]},work:()=>unknown):unknown};
const drain=async()=>{for(let i=0;i<120;i++)await Promise.resolve();};
function graph(roots:unknown[]){
 const seen=new Set<object>(),requirements=new Set<object>();let components=0;const ownerCells=new Set<object>();
 const visit=(value:unknown)=>{if(!value||(typeof value!=='object'&&typeof value!=='function')||seen.has(value))return;seen.add(value);if(Object.hasOwn(value,'outcome')&&Object.hasOwn(value,'dependents'))ownerCells.add(value);
  if(value instanceof Map){for(const [k,v]of value){visit(k);visit(v);}return;}
  if(value instanceof Set){for(const v of value)visit(v);return;}
  if(Object.hasOwn(value,'known')&&Object.hasOwn(value,'inputs')&&Object.hasOwn(value,'frames')){requirements.add(value);components+=(value as NativeRequirement).components?.length??0;}
  for(const k of Reflect.ownKeys(value)){if(typeof value==='function'&&['caller','callee','arguments','prototype','length','name'].includes(String(k)))continue;const d=Object.getOwnPropertyDescriptor(value,k);if(d&&'value'in d)visit(d.value);}
  visit(__historyFactRoot(value));for(const v of __historyWeakRoots(value))visit(v);
 };roots.forEach(visit);return {objects:seen.size,requirements:requirements.size,components,ownerCells:ownerCells.size};
}
for(const terminal of ['confirm','rollback'] as const)it(`distinct actual inputs confirmed while p remains pending, then ${terminal}`,async()=>{
 const t=signalTree({pair:{x:0,y:0},q:0},{enhancers:[transactions()]});const sent:{x:number;y:number}[]=[];
 const c=link(t.$.pair,{set:v=>{sent.push({...v});}}) as C;let off=()=>{};
 try{
  const p=t.transact(()=>t.$.pair.x(7));await drain();expect(sent).toEqual([]);const pBefore=p.inspect();let calls=0,notices=0;off=t.$.pair.x.subscribe(()=>notices++);
  let settled=false;const wait=c.settled().then(()=>{settled=true;});await drain();expect(settled).toBe(false);
  const sample=(n:number,phase='closed')=>{
   const roots=__historyRoots(t.$.pair.x),req=roots.endpoint!.requirement as NativeRequirement,proof=nativeProof(req);
   const roles=Object.fromEntries((['owners','destination','input','validation','possible'] as const).map(role=>[role,(proof[role]??[]).map(c=>({owner:c.owner,id:c.id,outcome:c.outcome}))]));
   const operations=__historyOperations();
   const selected=operations.filter(op=>roots.bindings.some(binding=>binding.current===op.revision));
   const describe=(cells:Iterable<{owner:number;id:number;outcome:string}>)=>[...cells].map(cell=>({owner:cell.owner,id:cell.id,outcome:cell.outcome}));
   const accounting={currentContributions:roots.bindings.map(binding=>Object.fromEntries((['owners','destination','input','validation','possible'] as const).map(role=>[role,describe(binding.index.proof()[role]??[])]))),selectedOperations:selected.map(op=>({dependencies:describe(op.dependencies),proof:op.proof&&Object.fromEntries((['owners','destination','input','validation','possible'] as const).map(role=>[role,describe(op.proof?.[role]??[])])),nativeOwners:op.native?describe(nativeProof(op.native).owners):[],relevanceSize:op.relevance?.size??0})),allOperationRoots:graph(operations)};
   const out=process.env['ST_HISTORY_OUTPUT'];if(!out)throw Error('Missing diagnostic output');
   appendFileSync(out,JSON.stringify({terminal,n,phase,roles,flags:{unknown:proof.unknown,invalid:proof.invalid,terminalRejectedRoles:proof.terminalRejectedRoles??0,historicalWindow:proof.historicalWindow??false},source:{components:req.components?.length??0,getter:!!Object.getOwnPropertyDescriptor(req,'proof')?.get},roots:graph([roots,...operations]),accounting,registryDiagnosticOnly:diagnostics()})+'\n');
   if(phase==='closed'){expect(req.components).toBeUndefined();expect(Object.getOwnPropertyDescriptor(req,'proof')?.get).toBeUndefined();expect(proof.owners.some(c=>c.outcome==='pending')).toBe(true);}
  };
  sample(0);
  for(let n=1;n<=4;n++){
   const qi=t.transact(()=>t.$.q(n));await drain();expect(t.$.q()).toBe(n);
   c.declare({kind:'dependent',owners:[p,qi]},()=>t.$(input=>{calls++;expect(input.q).toBe(n);return {...input,pair:{x:input.q===n?input.pair.x:-1,y:input.pair.y}};}));
   await drain();expect(sent).toEqual([]);expect(settled).toBe(false);expect(p.inspect()).toEqual(pBefore);
   // Capture each qi while it is still pending; then confirm before next qi exists.
   sample(n,'input-pending');qi.confirm();await drain();
   expect(t.$()).toEqual({pair:{x:7,y:0},q:n});expect(p.inspect()).toEqual(pBefore);expect(sent).toEqual([]);expect(settled).toBe(false);
   if(n===1||n===2||n===4)sample(n);
  }
  expect(calls).toBe(4);expect(notices).toBe(0);
  p[terminal]();await drain();const x=terminal==='confirm'?7:0;
  expect(t.$()).toEqual({pair:{x,y:0},q:4});expect(sent).toEqual([{x,y:0}]);expect(settled).toBe(true);await wait;sample(4,'p-terminal');
  await drain();expect(sent).toEqual([{x,y:0}]);c.dispose();t.$.pair.x(99);await drain();expect(sent).toEqual([{x,y:0}]);
 }finally{off();c.dispose();t.destroy();}
});
