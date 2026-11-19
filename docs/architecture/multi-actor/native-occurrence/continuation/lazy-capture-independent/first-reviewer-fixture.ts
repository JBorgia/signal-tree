import {expect,it,vi} from 'vitest';
import {signalTree,entityMap} from '../index';
import {getPositionRegistry} from './internals/position-registry';
import {getOwnedPositionIds} from './internals/owned-metadata';
import {EntityPublicationSource} from './internals/entity-publication';

it('bare structural and point writes retain native publication without allocating collection position',()=>{
 const tree=signalTree({rows:entityMap<{id:number;n:number},number>()});
 const registry=getPositionRegistry(tree.$);if(!registry)throw new Error('registry missing');
 const allocate=vi.spyOn(registry,'allocate');
 const prepare=vi.spyOn(EntityPublicationSource.prototype,'prepare');
 try {
  tree.$.rows.setAll([{id:1,n:1},{id:2,n:2}]);
  const structural=prepare.mock.results.filter(result=>result.type==='return'&&result.value);
  expect(structural.length).toBeGreaterThan(0);
  expect(allocate).not.toHaveBeenCalled();
  prepare.mockClear();
  tree.$.rows.updateOne(1,{n:9});
  expect(tree.$.rows.byIdOrFail(1).n()).toBe(9);
  expect(prepare.mock.calls.length).toBeGreaterThan(0);
  expect(prepare.mock.results.some(result=>result.type==='return'&&result.value?.record.writes.length>0)).toBe(true);
  expect(prepare.mock.calls.every(([packet])=>packet.prepareResponsibility===undefined)).toBe(true);
  expect(allocate).not.toHaveBeenCalled();
  expect(getOwnedPositionIds(tree.$.rows)?.length).toBe(1);
  expect(allocate).toHaveBeenCalledTimes(1);
 }finally{prepare.mockRestore();allocate.mockRestore();tree.destroy();}
});
