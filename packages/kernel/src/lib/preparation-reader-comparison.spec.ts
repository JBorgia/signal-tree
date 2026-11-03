import { appendFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { entityMap, signalTree, restoration, transactions, undoable } from '../index';
import { getPathNotifier } from './path-notifier';
import { createSignalTreeFactory } from './signal-tree';
import { createReactiveTestRealization, observeReactiveTestValue } from '../reactive-test-realization';
import { createLocationRuntime } from './internals/location-runtime';
import { getEntityLocationBinding } from './internals/entity-projection-seed';
import { getPositionRegistry } from './internals/position-registry';
import { getOwnedPositionIds } from './internals/owned-metadata';
import { openPhysicalRows, physicalRows, taps } from './internals/physical-rows';
import { preparePointRealization, createTreeRealizationAdapter, rememberTreeRealizationDescriptor, type TreeRealizationDescriptor } from './internals/causal-runtime/tree-realization-adapter';
import type { ReversalEffect } from './internals/causal-runtime/causal-types';
import type { AcquiredSubjectHandle } from './physical/structural-store';
import type { ISignalTree } from './types';

type Row = {id:string;n:number;extra?:number};
type PrivateRows = {__acquireEntityHandleForTesting(key:string):AcquiredSubjectHandle;__retireSubjectRetainedValueBackingForTesting(subject:number):void;__inspectSubjectResources(subject:number):{nodeFacadeMaterialized:boolean;fieldFacadesMaterialized:string[]};__prepareOrdinaryRealization(e:readonly ReversalEffect[],after:undefined,physical:readonly ReversalEffect[]):{install():void}};
const priv = (rows:unknown) => rows as PrivateRows;
const capability = (rows:object) => Object.getOwnPropertySymbols(rows).find(s=>s.description==='signaltree.entityPreparationReader');
function read(rows:{byIdOrFail(key:string):unknown},key:string):unknown {
  const symbol=capability(rows);
  expect(symbol).toBeDefined();
  if(symbol) return (Reflect.get(rows,symbol) as (key:string)=>unknown)(key);
  const node=rows.byIdOrFail(key);return typeof node==='function'?node():node;
}
function record(name:string,value:unknown){const sink=process.env['ST_SNAPSHOT_OUTPUT'];if(!sink)return;appendFileSync(sink,JSON.stringify({name,value})+'\n');}
const nativeMake=()=>{const native=createReactiveTestRealization();return createSignalTreeFactory(native,undefined,bound=>createLocationRuntime(bound));};
const handle=(rows:unknown,key:string)=>priv(rows).__acquireEntityHandleForTesting(key);
function adapterFor(rows:object,subject:number,owner:number,tree?:object){
 const descriptors=new Map<number,TreeRealizationDescriptor>();
 rememberTreeRealizationDescriptor({descriptors,path:'rows.a',ownerPath:'rows',positionIds:[owner],subjectIds:[subject],meta:{structuralEffect:{kind:'remove',subject,key:'a',value:{id:'a',n:1}}}});
 return createTreeRealizationAdapter({tree:(tree??{$:{rows}}) as ISignalTree<object>,descriptors});
}
describe('preparation reader frozen comparison',()=>{
 it('native tracked reads follow value/rekey/absence/restoration and key reuse without holding a facade',async()=>{
  const tree=nativeMake()({rows:entityMap<Row,string>()},{enhancers:[restoration()]});const rows=tree.$.rows;
  try{
   rows.addOne({id:'a',n:1});const original=handle(rows,'a');const observed:unknown[]=[];
   const observedRead=observeReactiveTestValue(()=>{try{return read(rows,'a');}catch(e){return (e as Error).message;}},v=>observed.push(v));
   expect(observedRead()).toEqual({id:'a',n:1});rows.updateOne('a',{n:2});expect(observedRead()).toEqual({id:'a',n:2});
   rows.changeId('a','z');expect(observedRead()).toBe('Entity with id a not found');expect(handle(rows,'z').subjectId).toBe(original.subjectId);
   rows.addOne({id:'a',n:9});expect(observedRead()).toEqual({id:'a',n:9});expect(handle(rows,'a').subjectId).not.toBe(original.subjectId);
   getPathNotifier().flushSync();const historyBefore=tree.getRestorationHistory().length;
   undoable(()=>rows.removeOne('a'));getPathNotifier().flushSync();expect(observedRead()).toBe('Entity with id a not found');
   record('native-before-undo',{canUndo:tree.canUndo(),historyBefore,history:tree.getRestorationHistory(),physical:rows.all()});
   expect(tree.canUndo()).toBe(true);expect(tree.getRestorationHistory().length).toBe(historyBefore+1);
   // Root undo returns void; useful disposition is demonstrated by exact restored
   // physical rows, original lifetime, and redo availability before tracking.
   tree.undo();getPathNotifier().flushSync();record('native-restoration-discriminator',{observed:observedRead(),physical:rows.all(),canRedo:tree.canRedo()});
   expect(rows.all()).toEqual([{id:'a',n:2},{id:'a',n:9}]);expect(tree.canRedo()).toBe(true);expect(observedRead()).toEqual({id:'a',n:9});
   record('native-tracking',{observed,original,restored:handle(rows,'a')});
  }finally{tree.destroy();}
 });
 it('lazy collection owner initializes on read before inventory and subsequent public fields share it',()=>{
  const tree=signalTree({rows:entityMap<Row,string>()});const rows=tree.$.rows;const registry=getPositionRegistry(rows)!;const spy=vi.spyOn(registry,'allocate');
  try{
   rows.addOne({id:'a',n:1});spy.mockClear();expect(read(rows,'a')).toEqual({id:'a',n:1});
   const allocated=spy.mock.results.map(r=>r.value);expect(allocated.length).toBe(1);
   const owner=getOwnedPositionIds(rows);expect(owner).toEqual(allocated);
   const row=rows.byIdOrFail('a');expect(getEntityLocationBinding(row.n)?.owner).toBe(owner![0]);row.n(8);expect(row.n()).toBe(8);
   record('lazy-owner',{allocated,owner});
  }finally{spy.mockRestore();tree.destroy();}
 });
 it('physical visibility requires the same registry and tap depth and closes exactly',()=>{
  const make=nativeMake(),tree=make({rows:entityMap<Row,string>(),stamp:0},{enhancers:[restoration()]}),other=make({rows:entityMap<Row,string>()});
  try{
   tree.$.rows.addOne({id:'a',n:1});other.$.rows.addOne({id:'a',n:99});
   (tree.$ as unknown as (v:object)=>void)({stamp:0});(other.$ as unknown as (v:object)=>void)({});
   expect(()=>read(tree.$.rows,'a')).toThrow('Entity with id a not found');openPhysicalRows(getPositionRegistry(tree.$)!);
   try{expect(read(tree.$.rows,'a')).toEqual({id:'a',n:1});expect(()=>read(other.$.rows,'a')).toThrow('Entity with id a not found');taps.depth++;try{expect(()=>read(tree.$.rows,'a')).toThrow('Entity with id a not found');}finally{taps.depth--;}}
   finally{physicalRows.pop();}
   expect(()=>read(tree.$.rows,'a')).toThrow('Entity with id a not found');expect(tree.$.rows.all()).toEqual([]);
  }finally{other.destroy();tree.destroy();}
 });
 it('initial backing absence is refused, while activation reentry follows the acquired lifetime',()=>{
  for(const action of ['rekey','replace','remove'] as const){
   const native=createReactiveTestRealization();let callback:(()=>void)|undefined;
   const make=createSignalTreeFactory(native,undefined,bound=>{const runtime=createLocationRuntime(bound),original=runtime.createCell;return {...runtime,createCell<T>(...args:Parameters<typeof original<T>>){const cell=original(...args);const cb=callback;callback=undefined;cb?.();return cell;}};});
   const tree=make({rows:entityMap<Row,string>()});const rows=tree.$.rows;
   try{rows.addOne({id:'a',n:1});const first=handle(rows,'a');callback=()=>{if(action==='rekey')rows.changeId('a','z');else{rows.removeOne('a');if(action==='replace')rows.addOne({id:'a',n:9});}};
    const value=read(rows,'a');expect(callback).toBeUndefined();expect(value).toEqual(action==='rekey'?{id:'a',n:1}:undefined);
    if(action==='rekey')expect(handle(rows,'z').subjectId).toBe(first.subjectId);
    if(action==='replace'){expect(read(rows,'a')).toEqual({id:'a',n:9});expect(handle(rows,'a').subjectId).not.toBe(first.subjectId);}
    record('activation-'+action,{value,ids:rows.ids()});
   }finally{callback=undefined;tree.destroy();}
  }
  const native=createReactiveTestRealization();let retire:(()=>void)|undefined;
  const make=createSignalTreeFactory(native,undefined,bound=>{const runtime=createLocationRuntime(bound);return {...runtime,createEpoch(){const epoch=runtime.createEpoch!();const cb=retire;retire=undefined;cb?.();return epoch;}};});
  const tree=make({rows:entityMap<Row,string>()},{enhancers:[restoration()]});try{tree.$.rows.addOne({id:'a',n:1});const subject=handle(tree.$.rows,'a').subjectId;retire=()=>{undoable(()=>tree.$.rows.removeOne('a'));priv(tree.$.rows).__retireSubjectRetainedValueBackingForTesting(subject);};expect(()=>read(tree.$.rows,'a')).toThrow('Entity with id a not found');expect(retire).toBeUndefined();}finally{retire=undefined;tree.destroy();}
 });
 it('genuinely capability-absent collection double retains receiver and live-value non-enumeration',()=>{
  let calls=0,gets=0;const value={id:'a',get n(){gets++;return 1;}};
  const rows={byIdOrFail(this:unknown,key:string){expect(this).toBe(rows);expect(key).toBe('a');calls++;return value;},changeId(){return undefined;},removeOne(){return undefined;},__findKeyBySubjectId(){return 'a';}};
  expect(capability(rows)).toBeUndefined();const adapter=adapterFor(rows,11,7);
  expect(adapter.validateEffects([{owner:7,subjectId:11,structural:'remove',before:'a',after:undefined}])).toBeUndefined();expect(calls).toBeGreaterThan(0);expect(gets).toBe(0);
  record('absent-fallback',{calls,gets});
 });
 it('present capability errors propagate and undefined is not fallback',()=>{
  const tree=signalTree({rows:entityMap<Row,string>()});try{
   const symbol=capability(tree.$.rows);expect(symbol).toBeDefined();const sentinel=Error('reader sentinel');let reads=0,fallbacks=0;
   const rows={byIdOrFail(){fallbacks++;return {id:'a',n:1};},changeId(){return undefined;},removeOne(){return undefined;},__findKeyBySubjectId(){return 'a';},[symbol!]:()=>{reads++;throw sentinel;}};
   const effects:ReversalEffect[]=[{owner:7,subjectId:11,structural:'remove',before:'a',after:undefined}];const adapter=adapterFor(rows,11,7);
   expect(()=>adapter.validateEffects(effects)).toThrow(sentinel);expect(reads).toBe(1);expect(fallbacks).toBe(0);
   Reflect.set(rows,symbol!,()=>{reads++;return undefined;});expect(adapter.validateEffects(effects)).toBeUndefined();expect(reads).toBe(2);expect(fallbacks).toBe(0);
  }finally{tree.destroy();}
 });
 it('P actual payload clone reentry refuses without partial installation and a fresh plan recovers',()=>{
  for(const throwing of [false,true]){
   const tree=signalTree({x:0,rows:entityMap<Row,string>()},{enhancers:[transactions()]});const rows=tree.$.rows;
   try{
    rows.addOne({id:'a',n:1,extra:2});const subject=handle(rows,'a').subjectId,owner=getOwnedPositionIds(rows)![0];const value=rows.all()[0];const sentinel=Error('P clone sentinel');let entered=false;const stacks:string[]=[];
    Object.defineProperty(value,'extra',{enumerable:true,configurable:true,get(){stacks.push(new Error().stack??'');if(!entered){entered=true;tree.$.x(7);}if(throwing)throw sentinel;return 2;}});
    const effects:Parameters<typeof preparePointRealization>[1]=[{owner,subjectId:subject,subjectFieldSegments:['n'],before:1,after:0}];
    expect(()=>preparePointRealization(tree,effects)).toThrow(throwing?sentinel:'Stale scalar preparation');expect(entered).toBe(true);expect(stacks.some(s=>s.includes('deepClone')&&s.includes('preparePointRealization'))).toBe(true);expect(rows.all()[0].n).toBe(1);expect(tree.$.x()).toBe(7);expect(rows.ids()).toEqual(['a']);
    Object.defineProperty(value,'extra',{value:2,enumerable:true,configurable:true,writable:true});const plan=preparePointRealization(tree,effects);expect(plan).toBeDefined();plan!.install();plan!.publish();expect(rows.all()[0].n).toBe(0);rows.byIdOrFail('a').n(8);expect(rows.all()[0].n).toBe(8);record('P-clone-'+throwing,{stacks,final:rows.all()});
   }finally{tree.destroy();}
  }
 });
 it('removal retains prepared payload preference over the uncloned live reference',()=>{
  const tree=signalTree({rows:entityMap<Row,string>()},{enhancers:[transactions()]});const rows=tree.$.rows;
  try{
   rows.setAll([{id:'a',n:1},{id:'b',n:2}]);const subject=handle(rows,'a').subjectId,owner=getOwnedPositionIds(rows)![0],live=rows.all()[0];
   expect(read(rows,'a')).toBe(live);
   const remove:ReversalEffect={owner,subjectId:subject,structural:'remove',before:'a',after:undefined,structuralContext:{kind:'remove',subject,key:'a',value:live}};
   priv(rows).__prepareOrdinaryRealization([remove],undefined,[]).install();
   const add:ReversalEffect={owner,subjectId:subject,structural:'add',before:undefined,after:'a',structuralContext:{kind:'add',subject,key:'a',value:{id:'a',n:1}}};
   const adapter=adapterFor(rows,subject,owner,tree),lowered=adapter.prepareOrdinaryEffects!([add]);expect(lowered[0].structural).toBe('rekey');
   const effects=[lowered[0],remove];const sentinel=Error('prepared payload observation stop');let captured:unknown;
   const port=rows as unknown as {__planPreparedRekey(from:string,to:string,subject:number,value:unknown):never};
   const spy=vi.spyOn(port,'__planPreparedRekey').mockImplementation((_from,_to,_subject,value)=>{captured=value;throw sentinel;});
   try{expect(()=>adapter.applyAtomically(effects)).toThrow(sentinel);expect(captured).toEqual(live);expect(captured).not.toBe(live);expect(rows.ids()).toEqual(['a','b']);record('removal-prepared-reference',{sameLive:captured===live,captured});}finally{spy.mockRestore();}
  }finally{tree.destroy();}
 });
 it('R placement clone callback failure leaves physical rows intact and fresh admission recovers',()=>{
  for(const throwing of [false,true]){
   const tree=signalTree({x:0,rows:entityMap<Row,string>()},{enhancers:[transactions()]});const rows=tree.$.rows;
   try{
    rows.setAll([{id:'a',n:1,extra:2},{id:'b',n:2}]);const subject=handle(rows,'a').subjectId,owner=getOwnedPositionIds(rows)![0],value=rows.all()[0];
    const remove:ReversalEffect={owner,subjectId:subject,structural:'remove',before:'a',after:undefined,structuralContext:{kind:'remove',subject,key:'a',value:{id:'a',n:1,extra:2}}};priv(rows).__prepareOrdinaryRealization([remove],undefined,[]).install();
    const add:ReversalEffect={owner,subjectId:subject,structural:'add',before:undefined,after:'z',structuralContext:{kind:'add',subject,key:'z',value:{id:'a',n:1,extra:2}}};
    const adapter=adapterFor(rows,subject,owner,tree);const effects=adapter.prepareOrdinaryEffects!([add]);expect(effects[0].structural).toBe('rekey');
    let entered=false;const stacks:string[]=[];const sentinel=Error('R clone sentinel');Object.defineProperty(value,'extra',{enumerable:true,configurable:true,get(){stacks.push(new Error().stack??'');if(!entered){entered=true;tree.$.x(7);}if(throwing)throw sentinel;return 2;}});
    // deepClone catches structuredClone getter errors and preserves accessors in its manual fallback. Admission, not validate's first return, refuses the nested committed write.
    expect(adapter.validateEffects(effects)).toBeUndefined();expect(adapter.validateEffects(effects)).toEqual({kind:'structural-drift'});expect(()=>adapter.applyAtomically(effects)).toThrow();
    expect(entered).toBe(true);expect(stacks.some(s=>s.includes('deepClone')&&s.includes('updatePreparedRealizationContext'))).toBe(true);expect(rows.ids()).toEqual(['a','b']);expect(rows.all()[0].n).toBe(1);expect(tree.$.x()).toBe(7);
    Object.defineProperty(value,'extra',{value:2,enumerable:true,configurable:true,writable:true});const fresh=adapter.prepareOrdinaryEffects!([add]);expect(adapter.validateEffects(fresh)).toBeUndefined();adapter.applyAtomically(fresh);expect(rows.ids()).toEqual(['b','z']);expect(handle(rows,'z').subjectId).toBe(subject);rows.byIdOrFail('z').n(8);expect(rows.all()[1].n).toBe(8);record('R-clone-'+throwing,{stacks,final:rows.all()});
   }finally{tree.destroy();}
  }
 });
});
