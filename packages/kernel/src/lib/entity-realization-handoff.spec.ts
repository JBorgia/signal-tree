import { describe, expect, it } from 'vitest';
import {signalTree, entityMap, transactions} from '../index';
import {withWriteContext} from './write-context';
import {preparePointRealization} from './internals/causal-runtime/tree-realization-adapter';
import {getOwnedPositionIds,getOwnedSubjectIds} from './internals/owned-mutation';
import type {ReversalEffect} from './internals/causal-runtime/causal-types';
const tick=async()=>{for(let i=0;i<100;i++)await Promise.resolve();};
async function fixture(){
 const tree=signalTree({x:0,rows:entityMap<{id:string;n:number;m:number},string>({selectId:r=>r.id})},{enhancers:[transactions()]});
 const rows=tree.$.rows;rows.addOne({id:'a',n:7,m:0});await tick();
 withWriteContext({participation:'inspection'},()=>rows.updateOne('a',{n:99}));await tick();
 const p=tree.transact(()=>{tree.$.x(1);rows.updateOne('a',{m:4});});
 const owner=getOwnedPositionIds(rows)![0];const subjectId=getOwnedSubjectIds(rows.byIdOrFail('a').m)![0];
 return {tree,rows,p,owner,subjectId};
}
describe('ordered realization handoff faults and reentry',()=>{
 it('throwing after-value getter installs nothing and leaves useful settlement',async()=>{
  const {tree,rows,p,owner,subjectId}=await fixture();const error=new Error('controlled prepare fault');let caught:unknown;
  try{
   const effects:ReversalEffect[]=[{owner,subjectId,subjectFieldSegments:['m'],before:4,get after(){throw error;}}];
   try{preparePointRealization(tree,effects);}catch(e){caught=e;}
   expect(caught).toBe(error);expect(tree.$.x()).toBe(1);expect(rows.byIdOrFail('a')()).toEqual({id:'a',n:99,m:4});
   expect(()=>p.inspect()).not.toThrow();p.rollback();
   const q=tree.transact(()=>rows.updateOne('a',{n:99}));expect(q.inspect().changes.length).toBeGreaterThan(0);q.rollback();
   expect(rows.byIdOrFail('a')()).toEqual({id:'a',n:7,m:0});
  }finally{tree.destroy();}
 });
 it('reentrant after-value preparation preserves newer writes and untouched ordinary baseline',async()=>{
  const {tree,rows,p,owner,subjectId}=await fixture();let entered=false;
  try{
   const effects:ReversalEffect[]=[{owner,subjectId,subjectFieldSegments:['m'],before:4,get after(){if(!entered){entered=true;tree.$.x(9);}return 0;}}];
   expect(()=>preparePointRealization(tree,effects)).toThrow();expect(entered).toBe(true);
   expect(tree.$.x()).toBe(9);expect(rows.byIdOrFail('a')()).toEqual({id:'a',n:99,m:4});
   expect(()=>p.inspect()).not.toThrow();
   const q=tree.transact(()=>rows.updateOne('a',{n:99}));expect(q.inspect().changes.length).toBeGreaterThan(0);q.rollback();
   expect(rows.byIdOrFail('a').n()).toBe(7);expect(tree.$.x()).toBe(9);p.confirm();
  }finally{tree.destroy();}
 });
 it('successful partial realization leaves unrelated ordinary adoption available',async()=>{
  const {tree,rows,p,owner,subjectId}=await fixture();
  try{
   const plan=preparePointRealization(tree,[{owner,subjectId,subjectFieldSegments:['m'],before:4,after:0}]);
   expect(plan).toBeDefined();plan!.install();plan!.publish();
   expect(rows.byIdOrFail('a')()).toEqual({id:'a',n:99,m:0});p.confirm();
   const q=tree.transact(()=>rows.updateOne('a',{n:99}));expect(q.inspect().changes.length).toBeGreaterThan(0);q.rollback();
   expect(rows.byIdOrFail('a')()).toEqual({id:'a',n:7,m:0});
  }finally{tree.destroy();}
 });
 it('preserves ordered whole-field-whole edits and caller-owned input',async()=>{
  const {tree,rows,p,owner,subjectId}=await fixture();
  try{
   p.confirm();
   const replacement={id:'a',n:20,m:0};
   const effects:ReversalEffect[]=[
    {owner,subjectId,subjectFieldSegments:[],before:rows.byIdOrFail('a')(),after:replacement},
    {owner,subjectId,subjectFieldSegments:['m'],before:0,after:4},
    {owner,subjectId,subjectFieldSegments:[],before:{id:'a',n:20,m:4},after:replacement},
   ];
   const plan=preparePointRealization(tree,effects);
   expect(replacement).toEqual({id:'a',n:20,m:0});
   expect(plan).toBeDefined();plan!.install();plan!.publish();
   expect(rows.byIdOrFail('a')()).toEqual({id:'a',n:20,m:0});
   expect(replacement).toEqual({id:'a',n:20,m:0});
  }finally{tree.destroy();}
 });

 it('evaluates a realization value once for physical and ordinary preparation',async()=>{
  const {tree,rows,p,owner,subjectId}=await fixture();let reads=0;
  try{
   p.confirm();
   const plan=preparePointRealization(tree,[{owner,subjectId,subjectFieldSegments:['n'],before:99,get after(){return ++reads===1?8:9;}}]);
   expect(reads).toBe(1);expect(plan).toBeDefined();plan!.install();plan!.publish();
   expect(rows.byIdOrFail('a').n()).toBe(8);
   const q=tree.transact(()=>rows.updateOne('a',{n:10}));q.rollback();
   expect(rows.byIdOrFail('a').n()).toBe(8);
  }finally{tree.destroy();}
 });

});
