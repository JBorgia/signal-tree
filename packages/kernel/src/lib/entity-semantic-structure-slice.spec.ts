import {describe,it,expect} from 'vitest';
import {signalTree,entityMap,transactions,link} from '../index';
import {withWriteContext} from './write-context';
type Row={id:string;n:number;m:number};
const tick=async()=>{for(let i=0;i<100;i++)await Promise.resolve();};
const setup=()=>signalTree({x:0,rows:entityMap<Row,string>({selectId:r=>r.id})},{enhancers:[transactions()]});
const inspect=(fn:()=>void)=>withWriteContext({participation:'inspection'},fn);
describe('slice2 prewritten structural composition',()=>{
 for(const route of ['append','prepend','rekey'] as const)it(`${route}: mixed inverse preserves untouched inspected sibling authority`,async()=>{
  const t=setup(),r=t.$.rows;try{
   r.addOne({id:'a',n:7,m:0});await tick();const a=r.byIdOrFail('a');
   inspect(()=>r.updateOne('a',{n:99}));
   const p=t.transact(()=>{t.$.x(1);r.updateOne('a',{m:4});
    if(route==='append')r.addOne({id:'b',n:8,m:0});
    if(route==='prepend')r.prependOne({id:'b',n:8,m:0});
    if(route==='rekey')r.changeId('a','a2');
   });
   expect(()=>p.inspect()).not.toThrow();p.rollback();
   expect(t.$.x()).toBe(0);expect(r.ids()).toEqual(['a']);expect(r.byIdOrFail('a')).toBe(a);
   expect(a()).toEqual({id:'a',n:99,m:0});
   const q=t.transact(()=>a.n(99));expect(q.inspect().changes.some(c=>c.path.endsWith('.n'))).toBe(true);q.rollback();
   expect(a()).toEqual({id:'a',n:7,m:0});expect(()=>p.rollback()).not.toThrow();
  }finally{t.destroy();}
 });
 for(const route of ['upsert','setAll'] as const)it(`${route}: compound values and membership reject as one ordinary transition`,async()=>{
  const t=setup(),r=t.$.rows;const sent:(readonly Row[])[]=[];const c=link(r,{set:v=>{sent.push(structuredClone(v));}});
  try{
   r.setAll([{id:'a',n:7,m:0},{id:'b',n:8,m:0}]);await tick();const a=r.byIdOrFail('a'),b=r.byIdOrFail('b');
   inspect(()=>r.updateOne('a',{n:99}));
   const p=t.transact(()=>{const values=[{id:'a',n:99,m:4},{id:'c',n:9,m:0}];if(route==='upsert')r.upsertMany(values);else r.setAll(values);});
   const fresh=r.byIdOrFail('c');expect(p.inspect().changes.some(v=>v.path.endsWith('.n'))).toBe(true);
   p.rollback();await tick();await c.settled();
   expect(r.ids()).toEqual(['a','b']);expect(r.byIdOrFail('a')).toBe(a);expect(r.byIdOrFail('b')).toBe(b);expect(fresh()).toBeUndefined();
   expect(r.all()).toEqual([{id:'a',n:7,m:0},{id:'b',n:8,m:0}]);expect(sent.at(-1)).toEqual(r.all());
   expect(sent.some(v=>v.some(row=>row.n===99))).toBe(false);expect(()=>p.rollback()).not.toThrow();
  }finally{c.dispose();t.destroy();}
 });
 it('prepend callbacks observe completed order and preserve nested placement',()=>{
  const t=setup(),r=t.$.rows;try{
   r.setAll([{id:'a',n:7,m:0},{id:'b',n:8,m:0}]);const snapshots:string[][]=[];
   r.tap({onAdd:(_row,id)=>{snapshots.push([...r.ids()]);if(id==='c')r.prependOne({id:'d',n:10,m:0});}});
   r.prependOne({id:'c',n:9,m:0});expect(snapshots).toEqual([['c','a','b'],['d','c','a','b']]);expect(r.ids()).toEqual(['d','c','a','b']);
  }finally{t.destroy();}
 });
 for(const action of ['append','remove','rekey'] as const)it(`completed prepend survives callback ${action}`,()=>{
  const t=setup(),r=t.$.rows;try{
   r.setAll([{id:'a',n:7,m:0},{id:'b',n:8,m:0}]);let seen:readonly string[]=[];
   r.tap({onAdd:(_row,id)=>{if(id!=='c')return;seen=[...r.ids()];
    if(action==='append')r.addOne({id:'d',n:10,m:0});
    if(action==='remove')r.removeOne('a');
    if(action==='rekey')r.changeId('c','d');
   }});
   r.prependOne({id:'c',n:9,m:0});expect(seen).toEqual(['c','a','b']);
   expect(r.ids()).toEqual(action==='append'?['c','a','b','d']:action==='remove'?['c','b']:['d','a','b']);
  }finally{t.destroy();}
 });
 it('callback throw leaves complete membership/order and transaction abort remains useful',()=>{
  const t=setup(),r=t.$.rows;const error=new Error('onAdd');try{
   r.setAll([{id:'a',n:7,m:0},{id:'b',n:8,m:0}]);
   r.tap({onAdd:(_row,id)=>{if(id==='c')throw error;}});
   expect(()=>r.prependOne({id:'c',n:9,m:0})).toThrow(error);
   expect(r.ids()).toEqual(['c','a','b']);r.removeOne('c');
   expect(()=>t.transact(()=>r.prependOne({id:'c',n:9,m:0}))).toThrow(error);
   expect(r.ids()).toEqual(['a','b']);
  }finally{t.destroy();}
 });

});
