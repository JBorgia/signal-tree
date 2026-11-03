import {expect,it} from 'vitest';
import { writeDiagnostic } from '../../test/optional-diagnostic';
import {entityMap,signalTree,transactions} from '../index';
const flush=async()=>{for(let i=0;i<120;i++)await Promise.resolve();};
for(const order of ['xy','yx'] as const)for(const followup of ['retry','confirm'] as const)it(`public onUpdate refuses x inverse after y; ${followup}, writes=${order}`,async()=>{
 const t=signalTree({rows:entityMap<{id:string;x:number;y:number},string>()},{enhancers:[transactions()]});const rows=t.$.rows;
 rows.addOne({id:'a',x:0,y:0});await flush();
 const q=t.transact(()=>{if(order==='xy'){rows.updateOne('a',{x:7});rows.updateOne('a',{y:11});}else{rows.updateOne('a',{y:11});rows.updateOne('a',{x:7});}});await flush();
 const value=()=>({x:rows.byIdOrFail('a').x(),y:rows.byIdOrFail('a').y()});
 const inspection=()=>JSON.stringify(q.inspect());const before={value:value(),inspection:inspection()};
 const calls:Array<{changes:Partial<{id:string;x:number;y:number}>;value:{x:number;y:number}}>=[];
 const off=rows.intercept({onUpdate(_id,changes,ctx){calls.push({changes:{...changes},value:value()});if(Object.prototype.hasOwnProperty.call(changes,'x')&&changes.x===0)ctx.block('public x inverse refused');}});
 let firstError:unknown,followupError:unknown;
 try{
  try{q.rollback();}catch(e){firstError=e;}
  const afterFailure={value:value(),inspection:inspection()};off();
  try{if(followup==='retry')q.rollback();else q.confirm();}catch(e){followupError=e;}
  const afterFollowup={value:value(),inspection:inspection()};
  const describe=(e:unknown)=>e instanceof Error?{name:e.name,message:e.message}:String(e);
  const result={order,followup,before,calls,afterFailure,afterFollowup,firstError:describe(firstError),followupError:describe(followupError)};
  const directory=process.env['ST_PUBLIC_DIAGNOSTIC_OUTPUT'];
  writeDiagnostic(directory ? `${directory}/${order}-${followup}.json` : undefined,JSON.stringify(result,null,2));
  expect(firstError).toBeDefined();expect(calls.some(c=>c.changes.x===0)).toBe(true);
  // Existing atomic-refusal safety: refusing a required inverse cannot leave a partial selected write.
  expect(afterFailure.value).toEqual({x:7,y:11});
  expect(followupError).toBeUndefined();
  expect(afterFollowup.value).toEqual(followup==='retry'?{x:0,y:0}:{x:7,y:11});
  expect(afterFailure.inspection).toBe(before.inspection);
  expect(afterFollowup.inspection).toBe(before.inspection);
 }finally{off();t.destroy();}
});
