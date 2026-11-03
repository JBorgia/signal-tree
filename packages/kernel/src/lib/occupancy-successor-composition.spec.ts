import {describe,expect,it} from 'vitest';
import {signalTree,entityMap,transactions} from '../index';
import {withWriteContext} from './write-context';
const tick=async()=>{for(let i=0;i<80;i++)await Promise.resolve();};
const make=()=>signalTree({rows:entityMap<{id:string;n:number},string>()},{enhancers:[transactions()]});
const inspection=(work:()=>void)=>withWriteContext({participation:'inspection'},work);
describe('occupancy successor composition contracts',()=>{
 it('rejects nested transact before its callback while outer writes remain usable',async()=>{
  const t=make(),r=t.$.rows;try{
   r.setAll([{id:'a',n:7},{id:'b',n:8}]);await tick();const old=r.byIdOrFail('a');let nestedRan=false;
   const outer=t.transact(()=>{
    r.changeId('a','c');
    expect(()=>t.transact(()=>{nestedRan=true;old.n(99);})).toThrow('Nested transaction is not supported');
    old.n(9);r.changeId('c','a');
   });
   expect(nestedRan).toBe(false);expect(old.n()).toBe(9);expect(()=>outer.inspect()).not.toThrow();
   outer.rollback();expect(old.n()).toBe(7);expect(r.byIdOrFail('a')).toBe(old);
   expect(r.ids()).toEqual(['a','b']);expect(()=>outer.rollback()).not.toThrow();
  }finally{t.destroy();}
 });
 it('preserves the admitted same-lifetime displacement and rebind sequence',async()=>{
  const t=make(),r=t.$.rows;try{
   r.setAll([{id:'a',n:7},{id:'b',n:8}]);await tick();const a=r.byIdOrFail('a'),b=r.byIdOrFail('b');
   inspection(()=>r.changeId('a','c'));
   const p=t.transact(()=>{r.changeId('b','a');r.changeId('c','d');});
   expect(r.byIdOrFail('d')).toBe(a);expect(r.byIdOrFail('a')).toBe(b);
   expect(()=>p.inspect()).not.toThrow();p.rollback();expect(r.ids()).toEqual(['a','b']);
   expect(r.byIdOrFail('a')).toBe(a);expect(r.byIdOrFail('b')).toBe(b);
   const q=t.transact(()=>a.n(11));q.rollback();expect(a.n()).toBe(7);
  }finally{t.destroy();}
 });
 it('keeps distinct lifetimes distinct through repeated business-key reuse',async()=>{
  const t=make(),r=t.$.rows;try{
   r.addOne({id:'a',n:7});await tick();const old=r.byIdOrFail('a');let middle:typeof old|undefined;
   const p=t.transact(()=>{r.removeOne('a');r.addOne({id:'a',n:8});middle=r.byIdOrFail('a');r.removeOne('a');r.addOne({id:'a',n:9});});
   const fresh=r.byIdOrFail('a');expect(fresh).not.toBe(old);expect(fresh).not.toBe(middle);
   p.rollback();expect(r.byIdOrFail('a')).toBe(old);expect(old.n()).toBe(7);
   expect(middle!()).toBeUndefined();expect(fresh()).toBeUndefined();
  }finally{t.destroy();}
 });
 it('retains an explicitly authored field across ordinary displacement and rebind',async()=>{
  const t=make(),r=t.$.rows;try{
   r.setAll([{id:'a',n:7},{id:'b',n:8}]);await tick();const a=r.byIdOrFail('a'),b=r.byIdOrFail('b');
   inspection(()=>r.changeId('a','c'));
   const p=t.transact(()=>{r.changeId('b','a');a.n(99);r.changeId('c','d');});
   expect(a.n()).toBe(99);expect(()=>p.inspect()).not.toThrow();p.rollback();
   expect(r.byIdOrFail('a')).toBe(a);expect(r.byIdOrFail('b')).toBe(b);expect(a.n()).toBe(7);
   const q=t.transact(()=>a.n(12));q.rollback();expect(a.n()).toBe(7);
  }finally{t.destroy();}
 });

});
