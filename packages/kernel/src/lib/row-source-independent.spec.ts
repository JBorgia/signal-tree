import { expect, it } from 'vitest';
import { entityMap, link, signalTree, transactions } from '../index';
import { captureNativeOccurrence } from './internals/native-occurrence';

const drain = async () => { for (let i=0;i<120;i++) await Promise.resolve(); };
type Row = { id:string; n:number; sibling:number; '':number };
const setup = async () => {
 const tree=signalTree({rows:entityMap<Row,string>()},{enhancers:[transactions()]});
 tree.$.rows.setAll([{id:'a',n:1,sibling:2,'':3},{id:'b',n:10,sibling:20,'':30}]);
 await drain();return tree;
};
const complete = async (...connections:{settled():Promise<void>}[]) => {
 const done=connections.map(()=>false);
 const waits=connections.map((c,i)=>c.settled().then(()=>{done[i]=true;}));
 await drain();expect(done).toEqual(connections.map(()=>true));await Promise.all(waits);
};

it('row plus selected and empty-key fields distinguish sibling and independent row writes',async()=>{
 const tree=await setup(),rows=tree.$.rows,row=rows.byIdOrFail('a');
 const rs:unknown[]=[],ns:unknown[]=[],es:unknown[]=[];
 const r=link(row,{set:v=>{rs.push(v);}}),n=link(row.n,{set:v=>{ns.push(v);}}),e=link(row[''],{set:v=>{es.push(v);}});
 try {
  rows.updateOne('b',{n:100,sibling:200,'':300});await drain();await complete(r,n,e);
  expect(rs).toEqual([]);expect(ns).toEqual([]);expect(es).toEqual([]);
  row.sibling(4);await drain();await complete(r,n,e);
  expect(rs).toEqual([{id:'a',n:1,sibling:4,'':3}]);expect(ns).toEqual([]);expect(es).toEqual([]);
  row.n(5);await drain();await complete(r,n,e);
  expect(rs.at(-1)).toEqual({id:'a',n:5,sibling:4,'':3});expect(rs).toHaveLength(2);expect(ns).toEqual([5]);expect(es).toEqual([]);
  row[''](6);await drain();await complete(r,n,e);
  expect(rs.at(-1)).toEqual({id:'a',n:5,sibling:4,'':6});expect(rs).toHaveLength(3);expect(ns).toEqual([5]);expect(es).toEqual([6]);
 }finally{r.dispose();n.dispose();e.dispose();tree.destroy();}
});

for(const outcome of ['confirm','rollback'] as const)
it(`row and field hold pending then ${outcome}, later ordinary publication remains useful`,async()=>{
 const tree=await setup(),row=tree.$.rows.byIdOrFail('a');const rs:unknown[]=[],ns:unknown[]=[];
 const r=link(row,{set:v=>{rs.push(v);}}),n=link(row.n,{set:v=>{ns.push(v);}});
 try {
  const pending=tree.transact(()=>row.n(7));await drain();
  expect(row.n()).toBe(7);expect(rs).toEqual([]);expect(ns).toEqual([]);
  pending[outcome]();await drain();await complete(r,n);
  if(outcome==='confirm'){expect(rs).toEqual([{id:'a',n:7,sibling:2,'':3}]);expect(ns).toEqual([7]);}
  else {expect(row.n()).toBe(1);expect(rs).not.toContainEqual({id:'a',n:7,sibling:2,'':3});expect(ns).not.toContain(7);}
  rs.length=0;ns.length=0;row.n(8);await drain();await complete(r,n);
  expect(rs).toEqual([{id:'a',n:8,sibling:2,'':3}]);expect(ns).toEqual([8]);
 }finally{r.dispose();n.dispose();tree.destroy();}
});

it('row and field retain original subject across rekey, remove, same-key recreation',async()=>{
 const tree=await setup(),rows=tree.$.rows,row=rows.byIdOrFail('a');const rs:unknown[]=[],ns:unknown[]=[];
 const r=link(row,{set:v=>{rs.push(v);}}),n=link(row.n,{set:v=>{ns.push(v);}});
 try {
  rows.changeId('a','new');row.n(5);await drain();await complete(r,n);
  expect(rows.byIdOrFail('new')).toBe(row);expect(row.id()).toBe('a');expect(rs.at(-1)).toEqual({id:'a',n:5,sibling:2,'':3});expect(ns).toEqual([5]);
  rows.removeOne('new');await drain();await complete(r,n);expect(rs.at(-1)).toBeUndefined();expect(ns).toEqual([5,undefined]);
  const prior=rs.slice();rows.addOne({id:'new',n:90,sibling:20,'':30});rows.updateOne('new',{n:99});await drain();await complete(r,n);
  expect(row()).toBeUndefined();expect(rows.byIdOrFail('new')).not.toBe(row);expect(rs).toEqual(prior);expect(ns).toEqual([5,undefined]);expect(rows.byIdOrFail('new').n()).toBe(99);
 }finally{r.dispose();n.dispose();tree.destroy();}
});

it('dispose row and field before queued completion suppresses endpoint and releases settled wait',async()=>{
 const tree=await setup(),row=tree.$.rows.byIdOrFail('a');const rs:unknown[]=[],ns:unknown[]=[];
 const r=link(row,{set:v=>{rs.push(v);}}),n=link(row.n,{set:v=>{ns.push(v);}});
 try {
  row.n(7);const rw=r.settled(),nw=n.settled();r.dispose();n.dispose();
  await complete(r,n);await Promise.all([rw,nw]);await drain();
  expect(row.n()).toBe(7);expect(rs).toEqual([]);expect(ns).toEqual([]);
 }finally{r.dispose();n.dispose();tree.destroy();}
});

it('unbound callable cannot acquire source occurrence or construct a Link',()=>{
 let value=1;const unbound=(next?:number)=>{if(next!==undefined)value=next;return value;};
 const sent:unknown[]=[];
 expect(()=>captureNativeOccurrence(unbound)).toThrow(/no verified root\/address/);
 expect(()=>link(unbound,{set:v=>{sent.push(v);}})).toThrow(/owned SignalTree location/);
 expect(value).toBe(1);expect(sent).toEqual([]);
});
