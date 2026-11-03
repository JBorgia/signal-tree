import {describe,it,expect} from 'vitest';
import {signalTree,entityMap,transactions} from '../index';
import {withWriteContext} from './write-context';
type Row={id:string;n:number};
const tick=async()=>{for(let i=0;i<100;i++)await Promise.resolve();};
const ins=(fn:()=>void)=>withWriteContext({participation:'inspection'},fn);
const setup=()=>signalTree({x:0,rows:entityMap<Row,string>({selectId:r=>r.id})},{enhancers:[transactions()]});
describe('slice2 structural inverse completeness',()=>{
 it('same-key target restores all authored facts and retains unrelated inspected divergence',async()=>{
  const t=setup(),r=t.$.rows;try{
   r.setAll([{id:'a',n:1},{id:'d',n:7},{id:'c',n:0}]);await tick();const old=r.byIdOrFail('a');
   ins(()=>{r.removeOne('a');r.updateOne('c',{n:99});});
   const p=t.transact(()=>{t.$.x(1);r.addOne({id:'a',n:2});r.updateOne('d',{n:9});});const fresh=r.byIdOrFail('a');
   p.rollback();expect(t.$.x()).toBe(0);expect(r.byIdOrFail('a')).toBe(old);expect(fresh()).toBeUndefined();
   expect(r.ids()).toEqual(['a','d','c']);expect(r.byIdOrFail('d').n()).toBe(7);expect(r.byIdOrFail('c').n()).toBe(99);
   const q=t.transact(()=>r.updateOne('c',{n:99}));expect(q.inspect().changes.some(c=>c.path.endsWith('.n'))).toBe(true);q.rollback();expect(r.byIdOrFail('c').n()).toBe(0);
  }finally{t.destroy();}
 });
 for(const mode of ['adopt','remove'] as const)it(`${mode} inspection-created lifetime leaves later structural rollback usable`,async()=>{
  const t=setup(),r=t.$.rows;try{
   r.addOne({id:'a',n:1});await tick();ins(()=>r.addOne({id:'b',n:2}));const b=r.byIdOrFail('b');
   const p=t.transact(()=>{if(mode==='adopt')b.n(3);else r.removeOne('b');});p.rollback();
   expect(r.ids()).toEqual(['a']);expect(b()).toBeUndefined();expect(()=>p.rollback()).not.toThrow();
   const q=t.transact(()=>r.prependOne({id:'c',n:4}));const c=r.byIdOrFail('c');expect(r.ids()).toEqual(['c','a']);
   q.rollback();expect(r.ids()).toEqual(['a']);expect(c()).toBeUndefined();expect(()=>q.rollback()).not.toThrow();
  }finally{t.destroy();}
 });
});
