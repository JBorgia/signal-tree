import {expect,it} from 'vitest';
import {signalTree,entityMap} from '../index';
import {getEntityPublicationBinding} from '../../../kernel/src/lib/internals/entity-publication';
for(const writer of ['update','replace'] as const)for(const throws of [false,true])it(`direct ${writer} completion coherent; throws=${throws}`,()=>{
 const t=signalTree({rows:entityMap<{id:number;n:number},number>()});
 t.$.rows.addOne({id:1,n:0});const leaf=t.$.rows.byIdOrFail(1).n;
 const read=()=>[leaf.value,t.$.rows.byIdOrFail(1).n.value,t.$.rows.all.value.map(x=>({...x}))];
 expect(read()).toEqual([0,0,[{id:1,n:0}]]);
 const seen:unknown[]=[];const sentinel=new Error('completion sentinel');let caught:unknown;
 const stop=getEntityPublicationBinding(t.$.rows)!.source.subscribe({prepare(){return {record:{writes:[],adds:[]},completion:{}};},complete(){seen.push(read());if(throws)throw sentinel;}});
 try{
  try{if(writer==='update')t.$.rows.updateOne(1,{n:2});else t.$.rows.replaceOne(1,{id:1,n:2});}catch(e){caught=e;}
  console.log(JSON.stringify({writer,throws,seen,after:read(),caught:caught===sentinel}));
  expect(caught).toBe(throws?sentinel:undefined);
  expect(seen.length).toBeGreaterThan(0);
  expect(read()).toEqual([2,2,[{id:1,n:2}]]);
  expect(seen).toEqual([[2,2,[{id:1,n:2}]]]);
 }finally{stop();t.destroy();}
});
it('direct completion nested write remains final truth',()=>{
 const t=signalTree({rows:entityMap<{id:number;n:number},number>()});t.$.rows.addOne({id:1,n:0});
 let nested=false;let calls=0;
 const stop=getEntityPublicationBinding(t.$.rows)!.source.subscribe({prepare(){return {record:{writes:[],adds:[]},completion:{}};},complete(){calls++;if(!nested){nested=true;t.$.rows.updateOne(1,{n:777});}}});
 try{t.$.rows.updateOne(1,{n:2});expect(calls).toBe(2);expect(t.$.rows.byIdOrFail(1).n.value).toBe(777);expect(t.$.rows.all.value).toEqual([{id:1,n:777}]);}finally{stop();t.destroy();}
});
