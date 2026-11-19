import {expect,it} from 'vitest';
import {entityMap,link,signalTree,transactions} from '../index';
import {getEntityPublicationBinding} from './internals/entity-publication';
import * as life from './experimental-publication/lifecycle';
import {getPathNotifier} from './path-notifier';
type Declared=ReturnType<typeof link>&{declare(d:{kind:'independent'},work:()=>void):unknown};
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<120;i++)await Promise.resolve();};
function evidence(row:object,key:string){const b=getEntityPublicationBinding(row)!;return b.source.evidence()!.field(b.subject!,key,'ordinary') as life.NativeRequirement;}
for(const reauthor of [true,false])it(`mixed rollback preserves support and ${reauthor?'fresh whole progresses':'ordinary fallback delivers'}`,async()=>{
 const t=signalTree({rows:entityMap<{id:string;x:number;y:number},string>()},{enhancers:[transactions()]}),foreign=signalTree({z:0},{enhancers:[transactions()]});const rows=t.$.rows;rows.addOne({id:'a',x:0,y:0});await flush();const row=rows.byIdOrFail('a'),sent:unknown[]=[];const c=link(rows,{set:v=>{sent.push(v);}}) as Declared;const q=t.transact(()=>rows.updateOne('a',{x:7})),r=foreign.transact(()=>foreign.$.z(9));
 let foreignSettled=false;
 try{
  rows.updateOne('a',{y:9});await flush();
  const x=evidence(row,'x'),y=evidence(row,'y'),inspection=q.inspect(),foreignInspection=r.inspect();
  expect(sent).toEqual([]);
  c.declare({kind:'independent'},()=>rows.replaceOne('a',{id:'a',x:7,y:9}));await flush();
  expect(evidence(row,'x')).toBe(x);
  expect(evidence(row,'y')).not.toBe(y);
  expect(life.nativeProof(evidence(row,'y'))).toMatchObject({unknown:false,invalid:false});
  expect(q.inspect()).toEqual(inspection);
  expect(row()).toEqual({id:'a',x:7,y:9});
  expect(sent).toEqual([]);
  q.rollback();await flush();
  const current={id:'a',x:0,y:9};
  expect(row()).toEqual(current);
  expect(foreign.$.z()).toBe(9);
  expect(r.inspect()).toEqual(foreignInspection);
  // Either useful early delivery or conservative hold is permitted; never stale x=7.
  expect(sent.length).toBeLessThanOrEqual(1);
  for(const value of sent)expect(value).toEqual([current]);
  if(reauthor){
   c.declare({kind:'independent'},()=>rows.replaceOne('a',{id:'a',x:0,y:9}));await flush();
   expect(sent).toEqual([[current]]);
   expect(row()).toEqual(current);
   expect(foreign.$.z()).toBe(9);
   expect(r.inspect()).toEqual(foreignInspection);
  }
  r.confirm();foreignSettled=true;await flush();
  expect(sent).toEqual([[current]]);
  expect(row()).toEqual(current);
  expect(foreign.$.z()).toBe(9);
 }finally{if(!foreignSettled)r.rollback();c.dispose();t.destroy();foreign.destroy();}
});
