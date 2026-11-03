import {expect,it} from 'vitest';
import {signalTree,transactions} from '../index';
// Only this fixture's explicitly installed shape is asserted; arbitrary Record access stays unknown.
function assertInstalledRow(value:unknown):asserts value is {n:{():number;(value:number):void}} {
 if(typeof value!=='function'||!('n' in value)||typeof value.n!=='function')throw Error('Expected installed row scalar');
}
for(const dynamic of [false,true])it(`new ordinary member remains transaction-writable: dynamic=${dynamic}`,()=>{
 const t=signalTree({rows:(dynamic?{}:{b:{n:2}}) as Record<string,{n:number}>},{enhancers:[transactions()]});
 try{
  if(dynamic)t.$.rows({b:{n:2}});
  const row=t.$.rows.b;
  if(!row)throw Error('missing installed row');assertInstalledRow(row);
  const p=t.transact(()=>row.n(3));
  expect(t.$.rows()).toEqual({b:{n:3}});expect(p.inspect().changes.length).toBeGreaterThan(0);
  p.rollback();expect(t.$.rows()).toEqual({b:{n:2}});expect(t.$.rows.b).toBe(row);
 }finally{t.destroy();}
});
