import {it,expect} from 'vitest';
import {signalTree,entityMap,transactions} from '../index';
import {withWriteContext} from './write-context';
it('rejecting rekey restores both ordinary key occupancies and original lifetimes',async()=>{
 const tree=signalTree({rows:entityMap<{id:string;n:number},string>()},{enhancers:[transactions()]});
 const rows=tree.$.rows;
 try{
  rows.setAll([{id:'a',n:7},{id:'b',n:8}]);for(let i=0;i<50;i++)await Promise.resolve();
  const oldA=rows.byIdOrFail('a'),oldB=rows.byIdOrFail('b');
  withWriteContext({participation:'inspection'},()=>rows.removeOne('a'));
  const pending=tree.transact(()=>rows.changeId('b','a'));
  expect(()=>pending.inspect()).not.toThrow();expect(()=>pending.rollback()).not.toThrow();
  expect(rows.ids()).toEqual(['a','b']);
  expect(rows.byIdOrFail('a')).toBe(oldA);expect(rows.byIdOrFail('b')).toBe(oldB);
  expect(oldA()).toEqual({id:'a',n:7});expect(oldB()).toEqual({id:'b',n:8});
 }finally{tree.destroy();}
});
