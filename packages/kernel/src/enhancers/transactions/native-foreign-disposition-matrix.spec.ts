import {describe,it,expect} from 'vitest';
import {signalTree,entityMap,transactions} from '../../index';
import {withWriteContext} from '../../lib/write-context';
const tick=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
const foreign=(f:()=>void)=>withWriteContext({intent:'system',participation:'realized'},f);
const make=()=>signalTree({rows:entityMap<{id:string;n:number},string>(),x:0},{enhancers:[transactions()]});
describe('foreign structural disposition across captured segments',()=>{
 it('preserves a foreign rekey and retains confirmation after atomic refusal',async()=>{
  const t=make();try{const r=t.$.rows;r.addOne({id:'a',n:7});await tick();const a=r.byIdOrFail('a');
   const p=t.transact(()=>{t.$.x(1);a.n(8);foreign(()=>r.changeId('a','c'));a.n(99);});
   expect(()=>p.rollback()).toThrow();expect(r.ids()).toEqual(['c']);expect(a.n()).toBe(99);expect(t.$.x()).toBe(1);
   expect(()=>p.inspect()).not.toThrow();p.confirm();expect(a.n()).toBe(99);
  }finally{t.destroy();}
 });
 it('preserves foreign lifetime removal while rejecting its own fresh same-key replacement',async()=>{
  const t=make();try{const r=t.$.rows;r.addOne({id:'a',n:7});await tick();const old=r.byIdOrFail('a');let fresh:ReturnType<typeof r.byIdOrFail>|undefined;
   const p=t.transact(()=>{t.$.x(1);r.changeId('a','b');foreign(()=>r.removeOne('b'));r.addOne({id:'b',n:99});fresh=r.byIdOrFail('b');});
   p.rollback();expect(r.ids()).toEqual([]);expect(old()).toBeUndefined();expect(fresh!()).toBeUndefined();expect(t.$.x()).toBe(0);
  }finally{t.destroy();}
 });
 it('retains foreign replacement on refusal and restores original lifetime after conflict removal',async()=>{
  const t=make();try{const r=t.$.rows;r.addOne({id:'a',n:7});await tick();const old=r.byIdOrFail('a');
   const p=t.transact(()=>{t.$.x(1);r.removeOne('a');foreign(()=>r.addOne({id:'a',n:99}));});const fresh=r.byIdOrFail('a');
   expect(()=>p.rollback()).toThrow();expect(r.byIdOrFail('a')).toBe(fresh);expect(fresh.n()).toBe(99);expect(t.$.x()).toBe(1);expect(()=>p.inspect()).not.toThrow();
   foreign(()=>r.removeOne('a'));await tick();p.rollback();expect(r.byIdOrFail('a')).toBe(old);expect(old.n()).toBe(7);expect(fresh()).toBeUndefined();expect(t.$.x()).toBe(0);
  }finally{t.destroy();}
 });
});
