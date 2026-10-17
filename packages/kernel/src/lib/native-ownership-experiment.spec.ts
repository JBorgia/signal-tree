import {getPathNotifier} from './path-notifier';
import {materializeMember,ordinaryBranch,registerMarkerProcessor} from './internals/materialize-markers';
import {observeOwnerInvalidation} from '../adapter';
import {describe,it,expect} from 'vitest';
import {signalTree,restoration,undoable} from '../index';
import {nativeOwnershipExperiment} from './internals/native-ownership-driver-experiment';
const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
describe('bounded native ownership B',()=>{
 it('ordinary undo then pending rollback resolves native current truth',async()=>{
  const tree=signalTree({x:0},{enhancers:[restoration()]});const b=nativeOwnershipExperiment(tree.$);
  try{tree.$.x(1);await flush();undoable(()=>tree.$.x(2));await flush();tree.undo();expect(tree.$.x()).toBe(1);const p=b.begin(()=>tree.$.x(3));p.rollback();expect(tree.$.x()).toBe(1);expect(b.stats()).toEqual({pending:0,ledgers:0});}finally{b.destroy();tree.destroy();}
 });
 it('usefully rejects overlapping authors and preserves newer ordinary truth',()=>{
  const tree=signalTree({x:1},{enhancers:[restoration()]});const b=nativeOwnershipExperiment(tree.$);
  try{const a=b.begin(()=>tree.$.x(2)),c=b.begin(()=>tree.$.x(3));a.rollback();expect(tree.$.x()).toBe(3);c.rollback();expect(tree.$.x()).toBe(1);const d=b.begin(()=>tree.$.x(4));tree.$.x(5);d.rollback();expect(tree.$.x()).toBe(5);}finally{b.destroy();tree.destroy();}
 });
 it('restores omitted membership and samevalue reactivation',()=>{
  const tree=signalTree({box:{x:1,y:2}},{enhancers:[restoration()]});const b=nativeOwnershipExperiment(tree.$);
  try{const p=b.begin(()=>tree.$.box({x:1}));expect(tree.$.box()).toEqual({x:1});p.rollback();expect(tree.$.box()).toEqual({x:1,y:2});tree.$.box({x:1});const q=b.begin(()=>tree.$.box({x:1,y:2}));q.rollback();expect(tree.$.box()).toEqual({x:1});}finally{b.destroy();tree.destroy();}
 });
 it('failed preparation leaves scalar unchanged and settlement retry works',()=>{
  const tree=signalTree({x:1},{enhancers:[restoration()]});const b=nativeOwnershipExperiment(tree.$);const error={failure:true};
  try{b.fail(error);expect(()=>tree.$.x(2)).toThrow();expect(tree.$.x()).toBe(1);const p=b.begin(()=>tree.$.x(3));b.fail(error);expect(()=>p.rollback()).toThrow();expect(tree.$.x()).toBe(3);expect(b.stats().pending).toBe(1);p.rollback();p.rollback();expect(tree.$.x()).toBe(1);}finally{b.destroy();tree.destroy();}
 });
 it('callback abort recovers every admitted installation after a later preparation failure',()=>{
  const tree=signalTree({box:{x:1,y:2}},{enhancers:[restoration()]});const b=nativeOwnershipExperiment(tree.$);const error=new Error('second installation fault');
  try{b.fail(error,2);expect(()=>b.begin(()=>tree.$.box({x:3}))).toThrow(error);expect(tree.$.box()).toEqual({x:1,y:2});}finally{b.destroy();tree.destroy();}
 });
 it('new undefined member rollback restores absence',()=>{
  const tree=signalTree({box:{x:1,y:undefined as number|undefined}},{enhancers:[restoration()]});const b=nativeOwnershipExperiment(tree.$);
  try{tree.$.box({x:1});const p=b.begin(()=>tree.$.box({x:1,y:undefined}));expect(Object.keys(tree.$.box())).toContain('y');p.rollback();expect(Object.keys(tree.$.box())).not.toContain('y');}finally{b.destroy();tree.destroy();}
 });
 it('new initial-shape member remains unsupported without manufacturing ownership',()=>{
  const tree=signalTree<{box:{x:number,z?:number}}>({box:{x:1}},{enhancers:[restoration()]});const b=nativeOwnershipExperiment(tree.$);
  try{const p=b.begin(()=>tree.$.box({x:1,z:undefined}));expect(Object.keys(tree.$.box())).not.toContain('z');p.rollback();expect(Object.keys(tree.$.box())).not.toContain('z');}finally{b.destroy();tree.destroy();}
 });
 it('held leaf samevalue reactivation rolls back presence',()=>{
  const tree=signalTree({box:{x:1,y:2}},{enhancers:[restoration()]});const b=nativeOwnershipExperiment(tree.$);const held=tree.$.box.y;
  try{tree.$.box({x:1});const p=b.begin(()=>held(2));expect(tree.$.box()).toEqual({x:1,y:2});p.rollback();expect(tree.$.box()).toEqual({x:1});}finally{b.destroy();tree.destroy();}
 });
 it('rollback publishes coherent state and preserves observer-authored writes',async()=>{
  const tree=signalTree({x:1,y:2},{enhancers:[restoration()]});const b=nativeOwnershipExperiment(tree.$);const seen:number[][]=[];let reenter=false;
  const off=observeOwnerInvalidation(tree,()=>{seen.push([tree.$.x(),tree.$.y()]);if(reenter && tree.$.x()===1){reenter=false;tree.$.x(9);}});
  try{const p=b.begin(()=>{tree.$.x(3);tree.$.y(4);});await flush();seen.length=0;reenter=true;p.rollback();await flush();expect(seen).toContainEqual([1,2]);expect(tree.$.x()).toBe(9);expect(b.stats()).toEqual({pending:0,ledgers:0});}finally{off();b.destroy();tree.destroy();}
 });
 it('failed abort exposes usable recovery without mutating thrown value',()=>{
  const tree=signalTree({x:1},{enhancers:[restoration()]});const b=nativeOwnershipExperiment(tree.$);const original=Object.freeze(new Error('callback'));let caught:unknown;
  try{try{b.begin(()=>{tree.$.x(3);b.fail('abort');throw original;});}catch(e){caught=e;}
   expect(caught).toBeInstanceOf(Error);const recovery=(caught as {recovery:{callbackError:unknown,transaction:{rollback():void}}}).recovery;
   expect(recovery.callbackError).toBe(original);expect(tree.$.x()).toBe(3);recovery.transaction.rollback();recovery.transaction.rollback();expect(tree.$.x()).toBe(1);
  }finally{b.destroy();tree.destroy();}
 });
 it('dynamic materialization creation is removed by rollback',()=>{
  const marker=Symbol('native-ownership-dynamic');
  registerMarkerProcessor((value:unknown):value is {[marker]:true}=>typeof value==='object'&&value!==null&&marker in value,()=>ordinaryBranch({seed:0},{keyedLookup:true}));
  const tree=signalTree({members:{[marker]:true as const}},{enhancers:[restoration()]});
  const members=tree.$.members;void members();const b=nativeOwnershipExperiment(tree.$);
  try{const p=b.begin(()=>materializeMember(members,'created',undefined));expect(Object.keys(members())).toContain('created');p.rollback();expect(Object.keys(members())).not.toContain('created');}finally{b.destroy();tree.destroy();}
 });
 it('settlement delivers the established path observation channel',async()=>{
  const tree=signalTree({x:1},{enhancers:[restoration()]});const b=nativeOwnershipExperiment(tree.$);const seen:unknown[]=[];
  const off=getPathNotifier().subscribe('x',value=>{seen.push(value);});
  try{const p=b.begin(()=>tree.$.x(3));await flush();expect(seen).toEqual([3]);p.rollback();await flush();expect(tree.$.x()).toBe(1);expect(seen).toEqual([3,1]);}finally{off();b.destroy();tree.destroy();}
 });
 it('undo with live pending ownership refuses or reconciles current truth',async()=>{
  const tree=signalTree({x:1},{enhancers:[restoration()]});const b=nativeOwnershipExperiment(tree.$);
  try{undoable(()=>tree.$.x(2));await flush();const p=b.begin(()=>tree.$.x(3));await flush();let refused=false;try{tree.undo();}catch{refused=true;}
  if(refused)expect(tree.$.x()).toBe(3);else expect(tree.$.x()).toBe(1);
  p.rollback();expect(tree.$.x()).toBe(refused?2:1);
  }finally{b.destroy();tree.destroy();}
 });
});
