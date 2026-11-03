import {getOwnedPositionIds,getOwnedSubjectIds} from './internals/owned-mutation';
import type {ReversalEffect} from './internals/causal-runtime/causal-types';
import {it,expect} from 'vitest';
import {signalTree,entityMap,transactions} from '../index';
import {withWriteContext} from './write-context';
const drain=async()=>{for(let i=0;i<50;i++)await Promise.resolve();};
it('relocates the same lifetime with physical99 ordinary7, then adopts and rejects99',async()=>{
 const tree=signalTree({rows:entityMap<{id:string;n:number},string>()},{enhancers:[transactions()]});
 const rows=tree.$.rows;
 try{
  rows.setAll([{id:'a',n:7}]);await drain();
  const old=rows.byIdOrFail('a');
  withWriteContext({participation:'inspection'},()=>{rows.changeId('a','b'); old.n(99);});
  const p=tree.transact(()=>rows.addOne({id:'a',n:42}));
  const fresh=rows.byIdOrFail('a');
  expect(()=>p.rollback()).not.toThrow();
  expect(rows.ids()).toEqual(['a']);expect(rows.byIdOrFail('a')).toBe(old);
  expect(old.n()).toBe(99);expect(fresh()).toBeUndefined();
  const adopt=tree.transact(()=>old.n(99));
  expect(()=>adopt.inspect()).not.toThrow();expect(()=>adopt.rollback()).not.toThrow();
  expect(old.n()).toBe(7);expect(()=>adopt.rollback()).not.toThrow();
 }finally{tree.destroy();}
});
it('relocation restores placement independently of a physical key transfer',async()=>{
 const tree=signalTree({rows:entityMap<{id:string;n:number},string>()},{enhancers:[transactions()]});
 const rows=tree.$.rows;
 try{
  rows.setAll([{id:'x',n:1},{id:'a',n:7},{id:'z',n:2}]);await drain();
  const old=rows.byIdOrFail('a');
  withWriteContext({participation:'inspection'},()=>{rows.changeId('a','b'); rows.setAll([{id:'b',n:99},{id:'x',n:1},{id:'z',n:2}]);});
  const p=tree.transact(()=>rows.addOne({id:'a',n:42}));
  expect(()=>p.rollback()).not.toThrow();
  expect(rows.ids()).toEqual(['x','a','z']);expect(rows.byIdOrFail('a')).toBe(old);expect(old.n()).toBe(99);
 }finally{tree.destroy();}
});

for(const reenter of [false,true]) it(`relocation preparation ${reenter?'reentry':'failure'} preserves installed state and retry authority`,async()=>{
 const tree=signalTree({q:0,rows:entityMap<{id:string;n:number},string>()},{enhancers:[transactions()]});
 const rows=tree.$.rows;
 try{
  rows.addOne({id:'a',n:7});await drain();const old=rows.byIdOrFail('a');
  withWriteContext({participation:'inspection'},()=>{rows.changeId('a','b');old.n(99);});
  const p=tree.transact(()=>rows.addOne({id:'a',n:42}));const fresh=rows.byIdOrFail('a');
  const binding=(rows as unknown as {__prepareTransitionTarget:import('./internals/causal-runtime/target-transition').CollectionTransitionTargetBinding}).__prepareTransitionTarget;
  const original=binding.prepareTarget;
  const error=new Error('prepared inverse fault');
  binding.prepareTarget=(...args)=>{const plan=original(...args);if(reenter)tree.$.q(5);else throw error;return plan;};
  try{expect(()=>p.rollback()).toThrow();}finally{binding.prepareTarget=original;}
  expect(rows.ids()).toEqual(['b','a']);expect(rows.byIdOrFail('a')).toBe(fresh);expect(old.n()).toBe(99);expect(tree.$.q()).toBe(reenter?5:0);
  expect(()=>p.inspect()).not.toThrow();expect(()=>p.rollback()).not.toThrow();
  expect(rows.ids()).toEqual(['a']);expect(rows.byIdOrFail('a')).toBe(old);expect(old.n()).toBe(99);
 }finally{tree.destroy();}
});

it('sparse revival and active transfer share placement dependencies without synthetic lifecycle',async()=>{
 const tree=signalTree({rows:entityMap<{id:string;n:number},string>()},{enhancers:[transactions()]});const rows=tree.$.rows;
 try{
  rows.setAll([{id:'a',n:7},{id:'b',n:8},{id:'c',n:9}]);await drain();
  const a=rows.byIdOrFail('a'),b=rows.byIdOrFail('b'),c=rows.byIdOrFail('c');
  // Establish an authentic inverse: old a is removed; a fresh b displaces old b
  // in ordinary membership while inspection retains old b physically at bb.
  const replacement=tree.transact(()=>{
   rows.removeOne('a');
   withWriteContext({participation:'inspection'},()=>{rows.changeId('b','bb');rows.setAll([{id:'c',n:9},{id:'bb',n:88}]);});
   rows.addOne({id:'b',n:43});
  });
  const freshB=rows.byIdOrFail('b');expect(freshB).not.toBe(b);
  withWriteContext({participation:'inspection'},()=>rows.removeOne('b'));
  expect(rows.ids()).toEqual(['c','bb']);expect(rows.byIdOrFail('bb')).toBe(b);expect(b.n()).toBe(88);expect(a()).toBeUndefined();
  const owner=getOwnedPositionIds(rows)![0];
  const ordinaryPresent=(subjectId:number,key:string)=>
   (rows as unknown as {__validateOrdinaryStructure(effects:readonly ReversalEffect[]):boolean}).__validateOrdinaryStructure([{owner,subjectId,before:key,after:undefined,structural:'remove'}]);
  const as=getOwnedSubjectIds(a.n)![0],bs=getOwnedSubjectIds(b.n)![0],freshBs=getOwnedSubjectIds(freshB.n)![0];
  expect(ordinaryPresent(as,'a')).toBe(false);expect(ordinaryPresent(bs,'b')).toBe(false);
  expect(ordinaryPresent(freshBs,'b')).toBe(true);
  expect(replacement.inspect().changes.length).toBeGreaterThanOrEqual(2);
  const adds:string[]=[],removes:string[]=[],snapshots:string[][]=[];
  rows.tap({onAdd:(_row,id)=>{adds.push(id);snapshots.push(rows.ids());},onRemove:(id)=>removes.push(id)});
  expect(()=>replacement.rollback()).not.toThrow();
  expect(rows.ids()).toEqual(['a','b','c']);expect(rows.byIdOrFail('a')).toBe(a);expect(rows.byIdOrFail('b')).toBe(b);expect(a.n()).toBe(7);expect(b.n()).toBe(88);
  expect(adds).toEqual(['a']);expect(removes).toEqual([]);expect(snapshots).toEqual([['a','b','c']]);
  expect(ordinaryPresent(as,'a')).toBe(true);expect(ordinaryPresent(bs,'b')).toBe(true);expect(ordinaryPresent(freshBs,'b')).toBe(false);
  const p=tree.transact(()=>b.n(88));p.rollback();expect(b.n()).toBe(8);
 }finally{tree.destroy();}
});
