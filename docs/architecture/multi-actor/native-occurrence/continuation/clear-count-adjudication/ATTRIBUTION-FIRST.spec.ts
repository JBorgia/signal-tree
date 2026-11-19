import {expect,it} from 'vitest';
import {signalTree,entityMap,transactions} from '../index';
it('attributes clear rollback find visits and checks restored order independently',()=>{
 const tree=signalTree({rows:entityMap<{id:number;n:number},number>()},{enhancers:[transactions()]});
 const input=Array.from({length:256},(_,id)=>({id,n:id}));
 const original=Array.prototype.find;const sites=new Map<string,{calls:number;visits:number}>();
 try{
  tree.$.rows.setAll(input);
  const pending=tree.transact(()=>tree.$.rows.setAll([]));
  Array.prototype.find=function<T>(this:T[],predicate:(v:T,i:number,a:T[])=>unknown,thisArg?:unknown):T|undefined{
   const site=new Error().stack?.split('\n')[2]??'unknown';
   let count=sites.get(site);if(!count){count={calls:0,visits:0};sites.set(site,count);}count.calls++;
   return original.call(this,(v:T,i:number,a:T[])=>{count.visits++;return predicate.call(thisArg,v,i,a);});
  } as typeof original;
  try{pending.rollback();}finally{Array.prototype.find=original;}
  console.log('clear-find-attribution',JSON.stringify([...sites]));
  expect(Array.prototype.find).toBe(original);
  expect(tree.$.rows.ids()).toEqual(input.map(x=>x.id));
  expect(tree.$.rows.count()).toBe(256);
  expect(tree.$.rows.byId(0)?.()?.n).toBe(0);
  expect(tree.$.rows.byId(255)?.()?.n).toBe(255);
 }finally{Array.prototype.find=original;tree.destroy();}
});
