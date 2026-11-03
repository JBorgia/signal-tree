import { describe, expect, it } from 'vitest';
import { signalTree, entityMap, transactions, link } from '../index';
import { withWriteContext } from './write-context';
const tick = async () => {for(let i=0;i<100;i++) await Promise.resolve();};
const inspect = (work:()=>void) => withWriteContext({participation:'inspection'},work);
type Row={id:string;name:string};
const make=()=>signalTree({rows:entityMap<Row,string>({selectId:r=>r.id})},{enhancers:[transactions()]});
// Owner decision Oct20: rejection restores ordinary topology within the authored
// footprint; unrelated inspection remains. These are new approved assertions,
// not reinterpretations of the preserved original egress tests.
describe('ordinary topology rejection after inspected membership divergence',()=>{
 it('C1 rejects necessary existence adopted by a field write',async()=>{
  const tree=make();const rows=tree.$.rows;rows.addOne({id:'a',name:'A'});await tick();
  const sent:(readonly Row[])[]=[];const c=link(rows,{set:value=>{sent.push(structuredClone(value));}});
  try{
   inspect(()=>{rows.addOne({id:'b',name:'inspection-B'});rows.addOne({id:'c',name:'unrelated-inspection'});});
   const b=rows.byIdOrFail('b');const p=tree.transact(()=>b.name('authored-B'));
   expect(()=>p.inspect()).not.toThrow();p.rollback();await tick();
   expect(rows.ids()).toEqual(['a','c']);expect(b()).toBeUndefined();
   await c.settled();expect(sent.at(-1)).toEqual([{id:'a',name:'A'}]);
   expect(()=>p.rollback()).not.toThrow();
  }finally{c.dispose();tree.destroy();}
 });
 it('C2 restores the prior ordinary lifetime after rejecting a new row in an inspected vacancy',async()=>{
  const tree=make();const rows=tree.$.rows;rows.addOne({id:'a',name:'old-A'});await tick();
  const old=rows.byIdOrFail('a');const sent:(readonly Row[])[]=[];const c=link(rows,{set:value=>{sent.push(structuredClone(value));}});
  try{
   inspect(()=>rows.removeOne('a'));
   const p=tree.transact(()=>rows.addOne({id:'a',name:'new-A'}));const fresh=rows.byIdOrFail('a');
   expect(fresh).not.toBe(old);p.rollback();await tick();
   expect(rows.ids()).toEqual(['a']);expect(rows.byIdOrFail('a')).toBe(old);
   expect(old()).toEqual({id:'a',name:'old-A'});expect(fresh()).toBeUndefined();
   await c.settled();expect(sent.at(-1)).toEqual([{id:'a',name:'old-A'}]);
   expect(()=>p.rollback()).not.toThrow();
  }finally{c.dispose();tree.destroy();}
 });
 it('C3 rejecting ordinary-neutral removal does not restore inspection-created existence',async()=>{
  const tree=make();const rows=tree.$.rows;rows.addOne({id:'a',name:'A'});await tick();
  try{
   inspect(()=>rows.addOne({id:'b',name:'inspection-B'}));const b=rows.byIdOrFail('b');
   const p=tree.transact(()=>rows.removeOne('b'));p.rollback();
   expect(rows.ids()).toEqual(['a']);expect(b()).toBeUndefined();
   expect(()=>p.rollback()).not.toThrow();
  }finally{tree.destroy();}
 });
});
