import { describe, expect, it } from 'vitest';
import { entityMap, signalTree, transactions } from '../../index';
import { hydrateMarkerNode } from '../../lib/internals/materialize-markers';
import { selectNativeOwnershipTransactions } from '../../lib/internals/native-ownership-public-selection';
import { getNativeOwnershipPublicExperiment } from './native-ownership-public-experiment';
const make=()=>signalTree({marker:0,rows:entityMap<{id:string;n:number},string>()},{enhancers:[selectNativeOwnershipTransactions(transactions())]});
describe('B existing collection hydration (not dynamic collection acquisition)',()=>{
 it('preserves newer hydrated truth after rejecting a pending field contribution',()=>{
  const tree=make();try{
   expect(getNativeOwnershipPublicExperiment(tree)?.authority).toBe('native-pending');
   tree.$.rows.addOne({id:'A',n:1});const pending=tree.transact(()=>tree.$.rows.updateOne('A',{n:2}));
   expect(hydrateMarkerNode(tree.$.rows,{all:[{id:'A',n:3}]},'restore')).toBe(true);
   pending.rollback();expect(tree.$.rows.byIdOrFail('A')().n).toBe(3);
   expect(getNativeOwnershipPublicExperiment(tree)?.stats()).toEqual({pending:0,ledgers:0});
  }finally{tree.destroy();}
 });
 it('keeps failed settlement retryable after ordinary hydration',()=>{
  const tree=make();try{
   tree.$.rows.addOne({id:'A',n:1});const pending=tree.transact(()=>tree.$.rows.updateOne('A',{n:2}));
   expect(hydrateMarkerNode(tree.$.rows,{all:[{id:'A',n:3}]},'restore')).toBe(true);
   getNativeOwnershipPublicExperiment(tree)!.failPreparation(new Error('retry'));
   expect(()=>pending.rollback()).toThrow();expect(tree.$.rows.byIdOrFail('A')().n).toBe(3);
   expect(getNativeOwnershipPublicExperiment(tree)?.stats().pending).toBe(1);
   pending.rollback();expect(tree.$.rows.byIdOrFail('A')().n).toBe(3);
  }finally{tree.destroy();}
 });
 it('preserves hydration authored by settlement delivery and cleans up on destruction',()=>{
  const tree=make();let off=()=>{ /* No listener before installation. */ };try{
   const pending=tree.transact(()=>tree.$.rows.addOne({id:'A',n:1}));
   off=tree.$.rows.tap({onRemove:()=>{expect(hydrateMarkerNode(tree.$.rows,{all:[{id:'B',n:7}]},'restore')).toBe(true);}});
   pending.rollback();expect(tree.$.rows.ids()).toEqual(['B']);expect(tree.$.rows.byIdOrFail('B')().n).toBe(7);
   const later=tree.transact(()=>tree.$.rows.updateOne('B',{n:8}));later.rollback();expect(tree.$.rows.byIdOrFail('B')().n).toBe(7);
   tree.transact(()=>tree.$.rows.updateOne('B',{n:9}));tree.destroy();
   expect(getNativeOwnershipPublicExperiment(tree)?.stats()).toEqual({pending:0,ledgers:0});
  }finally{off();tree.destroy();}
 });
});
