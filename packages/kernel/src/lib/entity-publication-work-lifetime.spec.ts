// Prewritten qualification of new private metadata, not a CPU/heap or GC claim.
import {expect,it} from 'vitest';
import {entityMap,link,signalTree,transactions} from '../index';
import {getEntityPublicationBinding} from './internals/entity-publication';
import {getPathNotifier} from './path-notifier';
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<120;i++)await Promise.resolve();};
const counts=(node:object)=>{const binding=getEntityPublicationBinding(node);if(!binding)throw Error('Native publication binding unavailable');return binding.source.inspect();};
const counter=(value:Readonly<Record<string,number>>,key:string)=>{const n=value[key];if(n===undefined)throw Error(`Unmeasured counter ${key}`);return n;};
const retained=['rows','fields','presence','negativePresence','placements','viewRows','viewFields','negativeViewFields','visible','negativeVisible','placementViews','recipients'] as const;
type Receipt={read():Readonly<{state:string;basis?:string}>};
type Experimental=ReturnType<typeof link>&{declare(input:{kind:'independent'},work:()=>unknown):Receipt};

it('fixed field capture and rollback metadata work does not grow with unrelated rows',async()=>{
 const work:unknown[]=[];
 for(const size of [16,128,1024]){
  const tree=signalTree({rows:entityMap<{id:string;n:number},string>()},{enhancers:[transactions()]});
  tree.$.rows.setAll(Array.from({length:size},(_,i)=>({id:String(i),n:0})));await flush();
  const row=tree.$.rows.byIdOrFail('0');const sent:unknown[]=[];
  const c=link(row.n,{set:value=>{sent.push(value);}});
  try{
   const before=counts(tree.$.rows);
   const p=tree.transact(()=>row.n(7));const afterWrite=counts(tree.$.rows);
   await flush();expect(sent).toEqual([]);p.rollback();await flush();
   expect(row.n()).toBe(0);expect(sent).not.toContain(7);await c.settled();
   const after=counts(tree.$.rows);
   const result={
    writeEdits:counter(afterWrite,'preparedFieldEdits')-counter(before,'preparedFieldEdits'),
    writeInputs:counter(afterWrite,'inputFactVisits')-counter(before,'inputFactVisits'),
    totalEdits:counter(after,'preparedFieldEdits')-counter(before,'preparedFieldEdits'),
    totalInputs:counter(after,'inputFactVisits')-counter(before,'inputFactVisits'),
   };
   expect(result.writeEdits).toBeGreaterThan(0);expect(result.totalEdits).toBeGreaterThan(result.writeEdits);
   work.push(result);if(work.length>1)expect(result).toEqual(work[0]);
  }finally{c.dispose();tree.destroy();}
 }
});

it('ordinary churn retires new metadata while retained receipts and old references stay detached',async()=>{
 const tree=signalTree({rows:entityMap<{id:string;n:number},string>()});await flush();
 const held:ReturnType<typeof tree.$.rows.byIdOrFail>[]=[];const receipts:Receipt[]=[];const terminal:unknown[]=[];
 try{
  for(let i=0;i<12;i++){
   tree.$.rows.addOne({id:'a',n:i});await flush();const row=tree.$.rows.byIdOrFail('a');held.push(row);
   const sent:unknown[]=[];const c=link(row.n,{set:value=>{sent.push(value);}}) as Experimental;
   try{
    const receipt=c.declare({kind:'independent'},()=>row.n(i+100));receipts.push(receipt);await flush();
    expect(sent).toEqual([i+100]);expect(receipt.read()).toMatchObject({state:'started',basis:'declared'});terminal.push(receipt.read());
    tree.$.rows.removeOne('a');await flush();expect(row.n()).toBeUndefined();
   }finally{c.dispose();}
   await flush();const state=counts(tree.$.rows);
   for(const key of retained)expect(counter(state,key),`${key} after cycle ${i}`).toBe(0);
   for(const old of held){expect(old()).toBeUndefined();expect(old.n()).toBeUndefined();}
   expect(receipts.map(receipt=>receipt.read())).toEqual(terminal);
  }
 }finally{tree.destroy();}
});

it('recipient disposal cannot retire source facts still needed by a pending structural inverse',async()=>{
 const tree=signalTree({rows:entityMap<{id:string;n:number},string>()},{enhancers:[transactions()]});
 tree.$.rows.addOne({id:'a',n:7});await flush();const held=tree.$.rows.byIdOrFail('a');
 const c=link(held.n,{set:()=>undefined});
 try{
  const p=tree.transact(()=>tree.$.rows.removeOne('a'));const inspection=p.inspect();
  c.dispose();await flush();expect(held()).toBeUndefined();expect(p.inspect()).toEqual(inspection);
  expect(counter(counts(tree.$.rows),'negativePresence')).toBeGreaterThan(0);
  p.rollback();await flush();expect(tree.$.rows.byIdOrFail('a')).toBe(held);expect(held.n()).toBe(7);
 }finally{c.dispose();tree.destroy();}
});
