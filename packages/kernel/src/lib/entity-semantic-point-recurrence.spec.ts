import { describe, expect, it } from 'vitest';
import { signalTree, entityMap, transactions, restoration } from '../index';
import { withWriteContext } from './write-context';
const tick=async()=>{for(let i=0;i<100;i++)await Promise.resolve();};
describe('S3 preserves untouched ordinary truth across partial realization',()=>{
 for(const mixed of [false,true])it(`ordinary sibling baseline survives rollback (scalar=${mixed})`,async()=>{
  const tree=signalTree({x:0,rows:entityMap<{id:string;n:number;m:number},string>({selectId:r=>r.id})},{enhancers:[transactions(),restoration()]});
  try{
   const rows=tree.$.rows;rows.addOne({id:'a',n:7,m:0});await tick();
   withWriteContext({participation:'inspection'},()=>rows.updateOne('a',{n:99}));await tick();
   const p=tree.transact(()=>{if(mixed)tree.$.x(1);rows.updateOne('a',{m:4});});p.rollback();
   expect(tree.$.x()).toBe(0);expect(rows.byIdOrFail('a')()).toEqual({id:'a',n:99,m:0});
   const q=tree.transact(()=>rows.updateOne('a',{n:99}));
   const captured=q.inspect().changes.some(change=>change.path.endsWith('.n'));q.rollback();
   expect({captured,final:rows.byIdOrFail('a')()}).toEqual({captured:true,final:{id:'a',n:7,m:0}});
  }finally{tree.destroy();}
 });
});
