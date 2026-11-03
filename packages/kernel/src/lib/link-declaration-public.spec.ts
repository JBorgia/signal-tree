import { expect, it } from 'vitest';
import { entityMap, leaf, link, signalTree, transactions, SignalTreePublicationError, type Link, type PublicationReceipt } from '../index';
const flush = async () => { for (let i=0;i<120;i++) await Promise.resolve(); };
type Case = { destroy():void; connect(set:(v:unknown)=>void):Link; write():void; expected:unknown };
const cases:readonly (readonly [string,()=>Case])[] = [
 ['leaf',()=>{const t=signalTree({x:0});return {destroy:()=>t.destroy(),connect:set=>link(t.$.x,{set}),write:()=>{t.$.x(1);},expected:1};}],
 ['atomic object leaf',()=>{const t=signalTree({x:leaf({n:0})});return {destroy:()=>t.destroy(),connect:set=>link(t.$.x,{set}),write:()=>{t.$.x({n:1});},expected:{n:1}};}],
 ['branch',()=>{const t=signalTree({box:{x:0}});return {destroy:()=>t.destroy(),connect:set=>link(t.$.box,{set}),write:()=>{t.$.box.x(1);},expected:{x:1}};}],
 ['root',()=>{const t=signalTree({x:0});return {destroy:()=>t.destroy(),connect:set=>link(t.$,{set}),write:()=>{t.$.x(1);},expected:{x:1}};}],
 ...(['entity field','direct row','collection'] as const).map(kind=>[kind,()=>{
   const t=signalTree({rows:entityMap<{id:string;n:number},string>()});t.$.rows.addOne({id:'a',n:0});const row=t.$.rows.byIdOrFail('a');
   return {destroy:()=>t.destroy(),connect:(set:(v:unknown)=>void)=>kind==='entity field'?link(row.n,{set}):kind==='direct row'?link(row,{set}):link(t.$.rows,{set}),write:()=>{row.n(1);},expected:kind==='entity field'?1:kind==='direct row'?{id:'a',n:1}:[{id:'a',n:1}]};
 }] as const),
];
it.each(cases)('public declare admits existing %s without changing foreign ownership',async(_name,make)=>{
 const fixture=make(),owner=signalTree({n:0},{enhancers:[transactions()]});await flush();
 const sent:unknown[]=[];const c=fixture.connect(v=>{sent.push(v);});const q=owner.transact(()=>owner.$.n(7));const inspection=q.inspect();
 try{
  const receipt:PublicationReceipt=c.declare({kind:'independent'},fixture.write);await flush();await c.settled();
  expect(sent).toEqual([fixture.expected]);expect(receipt.read()).toEqual({state:'started',basis:'declared'});
  expect(q.inspect()).toEqual(inspection);expect(owner.$.n()).toBe(7);
  expect(Object.isFrozen(receipt)).toBe(true);expect(Object.isFrozen(receipt.read())).toBe(true);
  const empty=c.declare({kind:'independent'},()=>{});expect(empty.read()).toEqual({state:'no-write'});
  q.rollback();await flush();await c.settled();expect(owner.$.n()).toBe(0);expect(sent).toEqual([fixture.expected]);
 }finally{c.dispose();fixture.destroy();owner.destroy();}
});
it('public declaration error is the actual instance; disposed work never runs',()=>{
 const t=signalTree({x:0});const c=link(t.$.x,{set:()=>{}});c.dispose();let calls=0;
 try{let error:unknown;try{c.declare({kind:'independent'},()=>{calls++;t.$.x(1);});}catch(e){error=e;}
 expect(error).toBeInstanceOf(SignalTreePublicationError);expect(error).toMatchObject({code:'SIGNALTREE_PUBLICATION_DECLARATION_INVALID',stage:'before-callback',reason:'disposed'});expect(calls).toBe(0);expect(t.$.x()).toBe(0);
 }finally{t.destroy();}
});
it('public typing does not grant an unowned callable runtime admission',()=>{
 expect(()=>link(()=>1,{set:()=>{}})).toThrow(/owned SignalTree location/);
});
