import {expect,it} from 'vitest';
import {entityMap,link,signalTree,transactions} from '../index';
type Receipt={read():Readonly<{state:string;reason?:string}>};
type E=ReturnType<typeof link>&{declare(input:{kind:'independent'}|{kind:'dependent';owners:readonly object[]},work:()=>unknown):Receipt};
const flush=async()=>{for(let i=0;i<120;i++)await Promise.resolve();};
for(const kind of ['ancestor','collection'] as const)it(`reexposed ${kind} collection never sends rejected dependency`,async()=>{
 const t=signalTree({count:0,box:{keep:1,rows:entityMap<{id:string;n:number},string>()}});const owner=signalTree({x:0},{enhancers:[transactions()]});t.$.box.rows.addOne({id:'a',n:1});await flush();
 const p=owner.transact(()=>owner.$.x(7));const sent:unknown[]=[];const rows=t.$.box.rows;const c=link(rows,{set:v=>{sent.push(v);}}) as E;
 try{const receipt=c.declare({kind:'dependent',owners:[p]},()=>{if(kind==='ancestor')(t.$ as unknown as(v:unknown)=>void)({count:0});else(t.$.box as unknown as(v:unknown)=>void)({keep:1});rows.addOne({id:'b',n:2});});await flush();expect(rows.all()).toEqual([{id:'b',n:2}]);expect(sent).toEqual([]);expect(receipt.read()).toMatchObject({state:'held'});
 p.rollback();await flush();expect(rows.all()).toEqual([{id:'b',n:2}]);expect(sent).toEqual([]);expect(receipt.read()).toMatchObject({state:'conservative',reason:'rejected-dependency'});
 }finally{c.dispose();owner.destroy();t.destroy();}
});
it('fresh collection recipient retains foreign negative absence through a useful independent edit',async()=>{
 const owner=signalTree({x:0},{enhancers:[transactions()]});const t=signalTree({rows:entityMap<{id:string;n:number},string>()});t.$.rows.setAll([{id:'a',n:1},{id:'b',n:1}]);await flush();const p=owner.transact(()=>t.$.rows.removeOne('a'));
 const sent:unknown[]=[];const c=link(t.$.rows,{set:v=>{sent.push(v);}}) as E;
 try{const receipt=c.declare({kind:'independent'},()=>t.$.rows.updateOne('b',{n:2}));await flush();expect(t.$.rows.all()).toEqual([{id:'b',n:2}]);expect(sent).toEqual([]);expect(receipt.read()).toMatchObject({state:'conservative',reason:'unknown'});p.rollback();await flush();expect(sent).toEqual([]);expect(receipt.read()).toMatchObject({state:'conservative',reason:'unknown'});
 }finally{c.dispose();owner.destroy();t.destroy();}
});
