import {it,expect} from 'vitest';
import {signalTree,entityMap,transactions} from '../index';
import {installProductionSubstrateStatsForTesting,clearProductionSubstrateStatsForTesting,resetProductionSubstrateStatsForTesting} from './internals/production-substrate-stats';
it.each([16,1024])('one-field capture and rejection do not enumerate %i untouched members',async(size)=>{
 const tree=signalTree({rows:entityMap<{id:string;n:number},string>()},{enhancers:[transactions()]});
 try{
  tree.$.rows.setAll(Array.from({length:size},(_,i)=>({id:String(i),n:0})));
  for(let i=0;i<80;i++)await Promise.resolve();
  const row=tree.$.rows.byIdOrFail('0');const stats=installProductionSubstrateStatsForTesting();
  const p=tree.transact(()=>row.n(1));
  expect(stats.structuralActiveKeyEntriesVisited).toBe(0);
  resetProductionSubstrateStatsForTesting(stats);p.rollback();
  expect(row.n()).toBe(0);expect(stats.structuralActiveKeyEntriesVisited).toBe(0);
 }finally{clearProductionSubstrateStatsForTesting();tree.destroy();}
});
