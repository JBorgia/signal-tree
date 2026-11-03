import { expect, it, vi } from 'vitest';
import { entityMap, signalTree, transactions } from '../index';
import { EntityPlacementStage } from './physical/entity-placement-stage';
import { EntityMutationFrame } from './physical/entity-mutation-frame';
import { EntityValueStore } from './physical/entity-value-store';
import { StructuralStore } from './physical/structural-store';

// Preregistered work bound: retain separate P/O endpoints, avoid the repeated
// P-after snapshot and the rewalk of the already-built O permutation.
for (const size of [16, 256, 1024]) {
  it(`existing prepend visits at most four snapshot domains at N=${size}`, () => {
    const tree = signalTree({ rows: entityMap<{id:string;n:number},string>() }, {enhancers:[transactions()]});
    const rows = tree.$.rows;
    rows.setAll(Array.from({length:size},(_,i)=>({id:String(i),n:i})));
    const original = EntityPlacementStage.prototype.snapshot;
    let entries=0;
    const spy = vi.spyOn(EntityPlacementStage.prototype,'snapshot').mockImplementation(function(this:EntityPlacementStage<string>){
      const result=original.call(this);entries+=result.length;return result;
    });
    try {
      rows.prependMany([{id:String(size-1),n:42}],{mode:'overwrite'});
      expect(rows.ids()).toEqual([String(size-1),...Array.from({length:size-1},(_,i)=>String(i))]);
      expect(rows.byIdOrFail(String(size-1)).n()).toBe(42);
      expect(entries).toBeLessThanOrEqual(4*size);
    } finally {spy.mockRestore();tree.destroy();}
  });
}

it('prefix and later full order keep different prepared endpoints',()=>{
  const store=new StructuralStore<string>();
  for (const [i,key] of ['a','b','c'].entries()) store.createSubject(i+1,key);
  const frame=new EntityMutationFrame(new EntityValueStore<{id:string}>(),store);
  frame.stageFinalFront(['c']);
  frame.stageFinalOrder(['b','a','c']);
  const placement=frame.preparePlacement();
  expect(frame.ordinaryOrder).toEqual([3,1,2]);
  expect(frame.orderEndpoints).toEqual({before:[1,2,3],after:[2,1,3]});
  expect(placement.snapshot()).toEqual([2,1,3]);
  expect(store.activeKeysSnapshot()).toEqual(['a','b','c']);
});

it('ordinary domain ordering retains omitted members and validates before change',()=>{
  const store=new StructuralStore<string>();
  for (const [i,key] of ['a','b','c','d'].entries()) store.createSubject(i+1,key);
  const stage=store.preparePlacement();
  stage.orderDomain([4,2]);
  expect(stage.snapshot()).toEqual([1,4,3,2]);
  expect(()=>stage.orderDomain([4,4])).toThrow(/repeats/);
  expect(()=>stage.orderDomain([99])).toThrow(/absent/);
  expect(stage.snapshot()).toEqual([1,4,3,2]);
  expect(store.activeKeysSnapshot()).toEqual(['a','b','c','d']);
});
