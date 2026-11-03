import {expect,it} from 'vitest';
import {leaf,link,signalTree,transactions} from '../index';
const drain=async()=>{for(let i=0;i<120;i++)await Promise.resolve();};
// recursive is internal runtime grammar, NOT supported public typed input.
const routes=['callable','recursive','report'] as const;
type Route=typeof routes[number];
const catchError=(work:()=>void)=>{try{work();}catch(error){return error;}return undefined;};
for(const route of routes)it(`fresh current pending input: ${route==='recursive'?'internal-runtime recursive':route}`,async()=>{
 const source=signalTree({pair:{x:7}}),foreign=signalTree({q:0},{enhancers:[transactions()]}),target=signalTree({y:0});
 const sent:number[]=[];const c=link(target.$.y,{set:v=>{sent.push(v);}});
 try{
  const saved=source.$();const q=foreign.transact(()=>foreign.$.q(7));const before=q.inspect();
  foreign.updateAndReport(v=>{source.$.pair.x(v.q);return {};});await drain();let calls=0;
  const consume=(v:{x:number})=>{calls++;expect(v).toEqual({x:7});target.$.y(v.x);};
  const error=catchError(()=>c.declare({kind:'independent'},()=>{
   if(route==='callable')source.$.pair(v=>{consume(v);return v;});
   else if(route==='recursive'){
    // @ts-expect-error TS2322: nested updater is internal runtime grammar, not public Partial<T>.
    source.updateAndReport({pair:(v:{x:number})=>{consume(v);return v;}});
   }
   else source.updateAndReport(v=>{consume(v.pair);return {};});
  }));await drain();
  expect.soft(calls).toBe(1);expect.soft(error).toMatchObject({code:'SIGNALTREE_PUBLICATION_DECLARATION_INVALID',stage:'after-callback',reason:'contradiction'});
  expect.soft(sent).toEqual([]);expect(q.inspect()).toEqual(before);expect(saved).toEqual({pair:{x:7}});
  q.confirm();await drain();await c.settled();await drain();expect(sent).toEqual([7]);c.dispose();target.$.y(9);await drain();expect(sent).toEqual([7]);
 }finally{c.dispose();source.destroy();foreign.destroy();target.destroy();}
});
for(const route of routes)for(const claim of ['r','s','both'] as const)it(`opaque payload and current location: ${route==='recursive'?'internal-runtime recursive':route}/${claim}`,async()=>{
 const source=signalTree({pair:{x:0}},{enhancers:[transactions()]});
 const r=source.transact(()=>source.$.pair.x(7));const saved=source.$.pair();
 const holder=signalTree({pair:{input:leaf({x:0})}},{enhancers:[transactions()]});
 const s=holder.transact(()=>holder.$.pair.input(saved));const rBefore=r.inspect(),sBefore=s.inspect();
 const target=signalTree({y:0});const sent:number[]=[];const c=link(target.$.y,{set:v=>{sent.push(v);}});
 try{
  const cached=holder.$.pair();expect(cached.input).toBe(saved);let calls=0;
  const consume=(v:{input:{x:number}})=>{calls++;expect(v.input).toBe(saved);target.$.y(v.input.x);};
  const error=catchError(()=>c.declare({kind:'dependent',owners:claim==='r'?[r]:claim==='s'?[s]:[r,s]},()=>{
   if(route==='callable')holder.$.pair(v=>{consume(v);return v;});
   else if(route==='recursive'){
    // @ts-expect-error TS2322: nested updater is internal runtime grammar, not public Partial<T>.
    holder.updateAndReport({pair:(v:{input:{x:number}})=>{consume(v);return v;}});
   }
   else holder.updateAndReport(v=>{consume(v.pair);return {};});
  }));await drain();expect(calls).toBe(1);expect(holder.$.pair.input()).toBe(saved);expect(r.inspect()).toEqual(rBefore);expect(s.inspect()).toEqual(sBefore);
  if(claim==='both')expect.soft(error).toBeUndefined();else expect.soft(error).toMatchObject({code:'SIGNALTREE_PUBLICATION_DECLARATION_INVALID',stage:'after-callback',reason:'contradiction'});
  expect.soft(sent).toEqual([]);r.confirm();await drain();expect.soft(sent).toEqual([]);s.confirm();await drain();await c.settled();await drain();expect(sent).toEqual([7]);
  c.dispose();target.$.y(9);await drain();expect(sent).toEqual([7]);
 }finally{c.dispose();source.destroy();holder.destroy();target.destroy();}
});
