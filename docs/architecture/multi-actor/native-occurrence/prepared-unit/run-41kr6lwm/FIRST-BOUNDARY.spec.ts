import {it,expect} from 'vitest';
import {writeFileSync} from 'node:fs';
import {entityMap,signalTree,transactions} from '../index';
import {getPathNotifier} from './path-notifier';
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<120;i++)await Promise.resolve();};
it('selected field plus surviving-row order restores the complete transaction',async()=>{
 const t=signalTree({rows:entityMap<{id:string;x:number},string>()},{enhancers:[transactions()]});
 const rows=t.$.rows;rows.setAll([{id:'a',x:0},{id:'b',x:0}]);await flush();
 const q=t.transact(()=>{rows.updateOne('a',{x:7});rows.setAll([{id:'b',x:0},{id:'a',x:7}]);});await flush();
 try{
  const pending=rows.all();let error:unknown;try{q.rollback();}catch(e){error=e;}await flush();const after=rows.all();
  let confirmError:unknown;try{q.confirm();}catch(e){confirmError=e;}
  writeFileSync(process.env['ST_PREPARED_REVIEW_OUTPUT']+'/field-order.json',JSON.stringify({pending,after,error:String(error),confirmError:String(confirmError)},null,2));
  expect(pending).toEqual([{id:'b',x:0},{id:'a',x:7}]);expect(error).toBeUndefined();expect(after).toEqual([{id:'a',x:0},{id:'b',x:0}]);
 }finally{t.destroy();}
});
