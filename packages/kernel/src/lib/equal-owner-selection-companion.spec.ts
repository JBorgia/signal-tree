import {expect,it} from 'vitest';
import {link,signalTree,transactions} from '../index';
// Private prototype cast: this is not a shipping type assertion.
type Declared=ReturnType<typeof link>&{declare(input:{kind:'independent'},work:()=>unknown):unknown};
const drain=async()=>{for(let n=0;n<120;n++)await Promise.resolve();};
it('pins current p and z-only q before and after newer net-zero settlement',async()=>{
 const t=signalTree({pair:{x:0,y:0},z:0},{enhancers:[transactions()]});const sent:unknown[]=[];
 const c=link(t.$.pair,{set:v=>{sent.push(v);}}) as Declared;
 try{
  const p=t.transact(()=>t.$.pair.x(7));const q=t.transact(()=>{t.$.z(1);t.$.pair.x(9);t.$.pair.x(7);});
  const current=[{path:'pair.x',address:['pair','x'],status:'current'}];
  expect(p.inspect().changes).toEqual(current);
  expect(q.inspect().changes).toEqual([{path:'z',address:['z'],status:'current'}]);
  await drain();expect(sent).toEqual([]);q.confirm();await drain();
  expect(p.inspect().changes).toEqual(current);expect(q.inspect().changes.map(change=>change.path)).toEqual(['z']);expect(sent).toEqual([]);
  c.declare({kind:'independent'},()=>t.$.pair.x(7));await drain();expect(sent).toEqual([]);
  p.rollback();await drain();expect(t.$()).toEqual({pair:{x:0,y:0},z:1});expect(sent).toEqual([{x:0,y:0}]);await c.settled();
 }finally{c.dispose();t.destroy();}
});
