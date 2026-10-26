import {describe,it,expect} from 'vitest';
import {signalTree,entityMap,transactions} from '../index';
import {withWriteContext} from './write-context';
type Row={id:string;n:number};
const setup=()=>signalTree({x:0,rows:entityMap<Row,string>({selectId:r=>r.id})},{enhancers:[transactions()]});
const tick=async()=>{for(let i=0;i<100;i++)await Promise.resolve();};
describe('slice2 interceptor preparation faults and reentry',()=>{
 for(const route of ['upsert','setAll'] as const)it(`${route}: failed mixed preparation admits no outer membership or adoption`,async()=>{
  const t=setup(),r=t.$.rows;const error=new Error('prepare');r.intercept({onAdd:row=>{if(row.id==='b')throw error;}});try{
   r.addOne({id:'a',n:7});await tick();withWriteContext({participation:'inspection'},()=>r.updateOne('a',{n:99}));
   expect(()=>t.transact(()=>{t.$.x(1);const values=[{id:'a',n:99},{id:'b',n:8}];if(route==='upsert')r.upsertMany(values);else r.setAll(values);})).toThrow(error);
   expect(t.$.x()).toBe(0);expect(r.ids()).toEqual(['a']);expect(r.byIdOrFail('a').n()).toBe(99);
   const p=t.transact(()=>r.updateOne('a',{n:99}));expect(p.inspect().changes.length).toBeGreaterThan(0);p.rollback();expect(r.byIdOrFail('a').n()).toBe(7);
  }finally{t.destroy();}
 });
 it('preparation reentry survives a thrown outer structural attempt',async()=>{
  const t=setup(),r=t.$.rows;const error=new Error('after reentry');try{
   r.addOne({id:'a',n:7});await tick();let entered=false;r.intercept({onAdd:row=>{if(row.id==='b'){entered=true;r.updateOne('a',{n:123});throw error;}}});
   expect(()=>r.setAll([{id:'a',n:9},{id:'b',n:8}])).toThrow(error);
   expect(entered).toBe(true);expect(r.ids()).toEqual(['a']);expect(r.byIdOrFail('a').n()).toBe(123);
   const p=t.transact(()=>r.updateOne('a',{n:124}));p.rollback();expect(r.byIdOrFail('a').n()).toBe(123);
  }finally{t.destroy();}
 });
 it('occupied rekey destination preserves identities and usable transaction rollback',async()=>{
  const t=setup(),r=t.$.rows;try{
   r.setAll([{id:'a',n:7},{id:'b',n:8}]);await tick();const a=r.byIdOrFail('a'),b=r.byIdOrFail('b');
   const p=t.transact(()=>r.updateOne('a',{n:9}));expect(()=>r.changeId('a','b')).toThrow();
   expect(r.ids()).toEqual(['a','b']);expect(r.byIdOrFail('a')).toBe(a);expect(r.byIdOrFail('b')).toBe(b);expect(a.n()).toBe(9);expect(()=>p.inspect()).not.toThrow();
   p.rollback();expect(a.n()).toBe(7);expect(b.n()).toBe(8);
  }finally{t.destroy();}
 });
});
