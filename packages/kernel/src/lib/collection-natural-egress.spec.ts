import {expect,it} from 'vitest';
import {entityMap,link,signalTree,transactions} from '../index';
import {onTreeError} from './internals/error-reporter';
type Row={id:string;n:number};
type Receipt={read():Readonly<{state:string;reason?:string;basis?:string}>};
type Experimental=ReturnType<typeof link>&{declare(input:{kind:'independent'}|{kind:'dependent';owners:readonly object[]},work:()=>unknown):Receipt};
const flush=async()=>{for(let i=0;i<120;i++)await Promise.resolve();};
const setup=async()=>{const t=signalTree({count:1,box:{keep:2,rows:entityMap<Row,string>()}});t.$.box.rows.addOne({id:'r',n:1});await flush();return t;};
type Tree=Awaited<ReturnType<typeof setup>>;
const omit=(t:Tree,kind:'ancestor'|'collection')=>{if(kind==='ancestor')(t.$ as unknown as (v:unknown)=>void)({count:1});else(t.$.box as unknown as(v:unknown)=>void)({keep:2});};
for(const kind of ['ancestor','collection'] as const)
it(`direct collection same-turn ${kind} omit/readd keeps natural rows`,async()=>{
 const t=await setup(),rows=t.$.box.rows;const sent:unknown[]=[];const c=link(rows,{set:v=>{sent.push(v);}});
 try{omit(t,kind);rows.addOne({id:'s',n:2});await flush();await c.settled();expect(rows.all()).toEqual([{id:'s',n:2}]);expect(sent.at(-1)).toEqual([{id:'s',n:2}]);expect(sent.every(Array.isArray)).toBe(true);}
 finally{c.dispose();t.destroy();}
});
for(const kind of ['ancestor','collection'] as const)
it(`root and branch snapshots compose nested ${kind} collection while direct Link keeps array`,async()=>{
 const t=await setup(),rows=t.$.box.rows;const roots:unknown[]=[],branches:unknown[]=[],direct:unknown[]=[];
 // Runtime representation control only: marker-bearing aggregate sources remain
 // deliberately rejected by TruthfulLinkSource; these are not public typing claims.
 // @ts-expect-error construction contains EntityMap marker
 const a=link(t.$,{set:(v:unknown)=>{roots.push(v);}});
 // @ts-expect-error construction contains EntityMap marker
 const b=link(t.$.box,{set:(v:unknown)=>{branches.push(v);}});
 const c=link(rows,{set:v=>{direct.push(v);}});
 try{omit(t,kind);await flush();rows.addOne({id:'s',n:2});await flush();await Promise.all([a.settled(),b.settled(),c.settled()]);const all=[{id:'s',n:2}];const box=kind==='ancestor'?{rows:{all}}:{keep:2,rows:{all}};expect(roots.at(-1)).toEqual({count:1,box});expect(branches.at(-1)).toEqual(box);expect(direct.at(-1)).toEqual(all);}
 finally{a.dispose();b.dispose();c.dispose();t.destroy();}
});
for(const kind of ['ancestor','collection'] as const)
for(const claim of ['independent','dependent'] as const)
it(`collection ${kind}/${claim} membership selection preserves receipt and pending-owner boundary`,async()=>{
 const t=await setup(),rows=t.$.box.rows,owner=signalTree({x:0},{enhancers:[transactions()]});const p=owner.transact(()=>owner.$.x(7));const sent:unknown[]=[],atSend:unknown[]=[];let receipt:Receipt|undefined;
 const c=link(rows,{set:v=>{sent.push(v);atSend.push(receipt?.read());}}) as Experimental;
 try{receipt=c.declare(claim==='independent'?{kind:claim}:{kind:claim,owners:[p]},()=>{omit(t,kind);rows.addOne({id:'s',n:2});});await flush();expect(rows.all()).toEqual([{id:'s',n:2}]);
  if(claim==='dependent'){expect(sent).toEqual([]);expect(receipt.read()).toMatchObject({state:'held'});p.confirm();await flush();}else{expect(sent).toEqual([[{id:'s',n:2}]]);p.confirm();await flush();}
  await c.settled();expect(sent).toEqual([[{id:'s',n:2}]]);expect(receipt.read()).toMatchObject({state:'started',basis:'declared'});expect(atSend).toHaveLength(1);expect(atSend[0]).toMatchObject({state:'started'});
 }finally{c.dispose();owner.destroy();t.destroy();}
});
for(const kind of ['ancestor','collection'] as const)
for(const throws of [false,true])
it(`${kind} readd callback newer write survives completion, throws=${throws}`,async()=>{
 const t=await setup(),rows=t.$.box.rows;const sent:unknown[]=[],errors:unknown[]=[];const failure=new Error('collection endpoint failure');const off=onTreeError(e=>{errors.push(e.error);});let edited=false;
 const c=link(rows,{set:v=>{sent.push(v);if(Array.isArray(v)&&v[0]?.id==='s'&&!edited){edited=true;rows.updateOne('s',{n:3});if(throws)throw failure;}}});
 try{omit(t,kind);await flush();await c.settled();sent.length=0;rows.addOne({id:'s',n:2});await flush();await c.settled();expect(edited).toBe(true);expect(rows.all()).toEqual([{id:'s',n:3}]);expect(sent).toEqual([[{id:'s',n:2}],[{id:'s',n:3}]]);expect(errors).toEqual(throws?[failure]:[]);}
 finally{c.dispose();off();t.destroy();}
});
