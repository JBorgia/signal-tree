import {expect,it} from 'vitest';
import {writeFileSync} from 'node:fs';
import {entityMap,signalTree,transactions} from '../index';
const flush=async()=>{for(let i=0;i<120;i++)await Promise.resolve();};
for(const followup of ['retry','confirm'] as const)it(`public onUpdate refuses x inverse after y; ${followup}`,async()=>{
 const t=signalTree({rows:entityMap<{id:string;x:number;y:number},string>()},{enhancers:[transactions()]});const rows=t.$.rows;
 rows.addOne({id:'a',x:0,y:0});await flush();
 const q=t.transact(()=>{rows.updateOne('a',{x:7});rows.updateOne('a',{y:11});});await flush();
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
  const result={followup,before,calls,afterFailure,afterFollowup,firstError:describe(firstError),followupError:describe(followupError)};
  const directory=process.env['ST_PUBLIC_DIAGNOSTIC_OUTPUT'];if(!directory)throw new Error('unique evidence output directory required');
  writeFileSync(`${directory}/${followup}.json`,JSON.stringify(result,null,2));
  expect(firstError).toBeDefined();expect(calls.some(c=>c.changes.y===0)).toBe(true);expect(calls.some(c=>c.changes.x===0)).toBe(true);
  // Existing atomic-refusal safety: refusing a required inverse cannot leave a partial selected write.
  expect(afterFailure.value).toEqual({x:7,y:11});
 }finally{off();t.destroy();}
});
