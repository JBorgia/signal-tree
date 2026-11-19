import { expect, it, vi } from 'vitest';
import { signalTree, entityMap, transactions } from '../../index';
import { EntityPlacementStage } from './entity-placement-stage';
import { EntityOrdinaryTopology } from './entity-ordinary-topology';
it('owns immutable present/absent interval rows across later stage episodes', () => {
  const stage = new EntityPlacementStage<string>(() => ({present:false}), undefined, undefined);
  stage.insert(1,'a'); stage.insert(2,'b'); stage.remove(2);
  const captured = stage.capturePatch();
  const topology = new EntityOrdinaryTopology<string>();
  const interval = topology.prepareInterval(stage,captured);
  expect(interval.pairs.map(p=>p.subject)).toEqual([1]);
  expect(interval.pairs[0].after).toBe(captured.find(([id])=>id===1)![1]);
  stage.remove(1); stage.insert(1,'new'); stage.insert(2,'again');
  expect(interval.pairs[0].after).toMatchObject({present:true,key:'a'});
  expect(captured.find(([id])=>id===2)![1]).toEqual({present:false});
  expect(Object.isFrozen(stage.patch.get(1))).toBe(false);
});
it('public final-front/order and rollback do not mutate captured physical stages', () => {
  const original=EntityPlacementStage.prototype.capturePatch;
  let captures=0;
  const spy=vi.spyOn(EntityPlacementStage.prototype,'capturePatch').mockImplementation(function(this:EntityPlacementStage<string|number>) {
    captures++;
    const captured=original.call(this);
    for(const name of ['insert','remove','rekey','order'] as const) {
      this[name]=()=>{throw new Error('physical stage mutated after final capture: '+name);};
    }
    return captured;
  });
  const tree=signalTree({rows:entityMap<{id:number;n:number},number>()},{enhancers:[transactions()]});
  try {
    tree.$.rows.setAll([{id:1,n:1},{id:2,n:2}]);
    tree.$.rows.prependMany([{id:3,n:3},{id:2,n:20}]);
    expect(tree.$.rows.ids()).toEqual([3,2,1]);
    const tx=tree.transact(()=>tree.$.rows.setAll([{id:1,n:10},{id:4,n:4}]));
    expect(tree.$.rows.ids()).toEqual([1,4]);
    tx.rollback();
    expect(tree.$.rows.ids()).toEqual([3,2,1]);
    expect(tree.$.rows.all()).toEqual([{id:3,n:3},{id:2,n:20},{id:1,n:1}]);
    expect(captures).toBeGreaterThanOrEqual(4);
  } finally {tree.destroy();spy.mockRestore();}
});
