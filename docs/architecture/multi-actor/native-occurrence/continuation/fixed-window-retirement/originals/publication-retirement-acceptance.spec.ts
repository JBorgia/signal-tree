import {expect,it} from 'vitest';
import {entityMap,link,signalTree,transactions} from '../index';
import {getEntityPublicationBinding} from './internals/entity-publication';
import {getPathNotifier} from './path-notifier';
import * as lifecycle from './experimental-publication/lifecycle';

const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<120;i++)await Promise.resolve();};
type Row={id:string;n:number};
type Receipt={read():Readonly<{state:string;basis?:string;reason?:string}>};
type Declared=ReturnType<typeof link>&{declare(input:{kind:'independent'},work:()=>unknown):Receipt};
const make=()=>signalTree({rows:entityMap<Row,string>()});
const binding=(node:object)=>{const b=getEntityPublicationBinding(node);if(!b)throw Error('Missing publication binding');return b;};
const measured=(counts:Readonly<Record<string,number>>,key:string)=>{if(!Object.prototype.hasOwnProperty.call(counts,key))throw Error(`Required retention counter absent: ${key}`);return counts[key];};
const existing=['rows','fields','presence','negativePresence','placements','viewRows','viewFields','negativeViewFields','visible','negativeVisible','placementViews'] as const;
const empty=(source:ReturnType<typeof binding>['source'])=>{for(const key of existing)expect(measured(source.inspect(),key),`${key} must retire`).toBe(0);};

it('acceptance: ordinary churn releases metadata, keeping old handles and receipts detached',async()=>{
 const tree=make(),rows=tree.$.rows;const source=binding(rows).source;
 const held:ReturnType<typeof rows.byIdOrFail>[]=[];const receipts:Receipt[]=[];const terminal:ReturnType<Receipt['read']>[]=[];
 try{for(let i=0;i<12;i++){
  rows.addOne({id:'a',n:i});await flush();const row=rows.byIdOrFail('a');held.push(row);const sent:unknown[]=[];
  const c=link(row.n,{set:value=>{sent.push(value);}}) as Declared;
  try{const receipt=c.declare({kind:'independent'},()=>row.n(i+100));receipts.push(receipt);await flush();expect(sent).toEqual([i+100]);expect(receipt.read()).toMatchObject({state:'started',basis:'declared'});terminal.push({...receipt.read()});rows.removeOne('a');await flush();}finally{c.dispose();}
  await flush();for(const old of held){expect(old()).toBeUndefined();expect(old.n()).toBeUndefined();}expect(receipts.map(r=>r.read())).toEqual(terminal);empty(source);
  for(const key of ['mappings','mappingViews','recipients'])expect(measured(source.inspect(),key),key).toBe(0);
 }}finally{tree.destroy();}
});

it.each(['mappings','mappingViews'])('acceptance: %s counter reports allocation then retirement',async(key)=>{
 const tree=make(),rows=tree.$.rows;rows.addOne({id:'a',n:1});await flush();const source=binding(rows).source;
 try{expect(measured(source.inspect(),key),key).toBeGreaterThan(0);rows.removeOne('a');await flush();expect(measured(source.inspect(),key),key).toBe(0);}finally{tree.destroy();}
});

it('acceptance: terminal receipt resists caller mutation, disposal and same-key re-add',async()=>{
 const tree=make(),rows=tree.$.rows;rows.addOne({id:'a',n:1});await flush();const old=rows.byIdOrFail('a');const sent:unknown[]=[];const c=link(old.n,{set:v=>{sent.push(v);}}) as Declared;
 try{const r=c.declare({kind:'independent'},()=>old.n(2));await flush();expect(sent).toEqual([2]);const saved={...r.read()};expect(saved).toMatchObject({state:'started',basis:'declared'});
  const exposed=r.read();expect(Reflect.set(exposed,'state','forged')).toBe(false);expect(Reflect.deleteProperty(exposed,'basis')).toBe(false);expect(r.read()).toEqual(saved);
  rows.removeOne('a');c.dispose();rows.addOne({id:'a',n:99});await flush();expect(rows.byIdOrFail('a')).not.toBe(old);expect(old()).toBeUndefined();expect(old.n()).toBeUndefined();expect(r.read()).toEqual(saved);expect(sent).toEqual([2]);
 }finally{c.dispose();tree.destroy();}
});

it('acceptance: foreign pending exclusion gates a later useful declared publication',async()=>{
 const owner=signalTree({n:0},{enhancers:[transactions()]});const tree=make(),rows=tree.$.rows;rows.setAll([{id:'a',n:7},{id:'b',n:1}]);await flush();const old=rows.byIdOrFail('a'),b=binding(old);
 const q=owner.transact(()=>rows.removeOne('a'));const fact=b.source.evidence()!.member(b.subject!,'ordinary') as lifecycle.NativeRequirement;
 // Test-only mutation control. Normal acceptance never calls retire directly.
 // This emulates the rejected unconditional cleanup without runtime edits.
 if(process.env['ST_RETIREMENT_FAULT']==='naive-retire')b.source.retire(b.subject!);
 const sent:unknown[]=[];const c=link(rows,{set:v=>{sent.push(v);}}) as Declared;
 try{expect(lifecycle.nativeProof(fact).possible?.some(o=>o.outcome==='pending')).toBe(true);const receipt=c.declare({kind:'independent'},()=>rows.updateOne('b',{n:2}));await flush();expect(rows.byIdOrFail('b').n()).toBe(2);expect(old()).toBeUndefined();expect(sent,'foreign omission must not be published as independent').toEqual([]);expect(receipt.read()).toMatchObject({state:'conservative',reason:'unknown'});expect(b.source.evidence()!.exclusions?.().some(([id])=>id===b.subject)).toBe(true);
 }finally{c.dispose();q.rollback();tree.destroy();owner.destroy();}
});

it('acceptance: public onRemove tap throw leaves committed removal reclaimable',async()=>{
 const tree=make(),rows=tree.$.rows;rows.addOne({id:'a',n:1});await flush();const old=rows.byIdOrFail('a'),source=binding(rows).source;let calls=0;
 const off=rows.tap({onRemove(){calls++;throw Error('controlled-public-tap');}});
 try{expect(()=>rows.removeOne('a')).toThrow('controlled-public-tap');expect(calls).toBe(1);expect(old()).toBeUndefined();await flush();empty(source);}finally{off();tree.destroy();}
});

it('acceptance: exact source completion throw does not strand installed removal metadata',async()=>{
 const tree=make(),rows=tree.$.rows;rows.addOne({id:'a',n:1});await flush();const old=rows.byIdOrFail('a'),source=binding(rows).source;let calls=0;
 // Private participant seam reaches source.complete, earlier than public taps.
 const off=source.subscribe({prepare:packet=>packet.physical.some(e=>e.structural?.kind==='remove')?{record:{writes:[],adds:[]},completion:{}}:undefined,complete(){calls++;throw Error('controlled-source-completion');}});
 try{expect(()=>rows.removeOne('a')).toThrow('controlled-source-completion');expect(calls).toBe(1);expect(old()).toBeUndefined();off();await flush();empty(source);}finally{off();tree.destroy();}
});

it('acceptance: exact completion reentry preserves fresh lifetime and retires only old metadata',async()=>{
 const tree=make(),rows=tree.$.rows;rows.addOne({id:'a',n:1});await flush();const old=rows.byIdOrFail('a'),oldBinding=binding(old),source=oldBinding.source;let calls=0;
 const off=source.subscribe({prepare:packet=>packet.physical.some(e=>e.structural?.kind==='remove')?{record:{writes:[],adds:[]},completion:{}}:undefined,complete(){calls++;rows.addOne({id:'a',n:99});}});
 try{rows.removeOne('a');await flush();expect(calls).toBe(1);const fresh=rows.byIdOrFail('a'),freshBinding=binding(fresh);expect(freshBinding.subject).not.toBe(oldBinding.subject);expect(fresh.n()).toBe(99);expect(old()).toBeUndefined();expect(old.n()).toBeUndefined();expect(source.evidence()!.exclusions?.().some(([id])=>id===oldBinding.subject)).toBe(false);expect(source.inspect().presence).toBe(1);expect(source.inspect().visible).toBe(1);expect(source.inspect().negativePresence).toBe(0);}finally{off();tree.destroy();}
});

it('acceptance: failed preparation cannot reclaim the still-live subject or its evidence',async()=>{
 const tree=make(),rows=tree.$.rows;rows.addOne({id:'a',n:1});await flush();const row=rows.byIdOrFail('a'),b=binding(row),source=b.source,fact=source.evidence()!.member(b.subject!,'ordinary');let calls=0;
 const off=source.subscribe({prepare:packet=>{if(packet.physical.some(e=>e.structural?.kind==='remove')){calls++;throw Error('controlled-prepare');}return undefined;},complete(){throw Error('must-not-complete');}});
 try{expect(()=>rows.removeOne('a')).toThrow('controlled-prepare');expect(calls).toBe(1);expect(rows.byIdOrFail('a')).toBe(row);expect(row.n()).toBe(1);expect(source.evidence()!.member(b.subject!,'ordinary')).toBe(fact);expect(source.inspect().presence).toBe(1);}finally{off();tree.destroy();}
});
