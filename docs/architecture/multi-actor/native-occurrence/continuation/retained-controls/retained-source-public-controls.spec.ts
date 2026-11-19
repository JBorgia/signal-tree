import {expect,it} from 'vitest';
import {entityMap,signalTree,transactions} from '../index';

type Row={id:string;n:number;tag:string};
const flush=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
const make=()=>signalTree({visible:1,box:{s:2,rows:entityMap<Row,string>()}},{enhancers:[transactions()]});
type Tree=ReturnType<typeof make>;
type Rows=Tree['$']['box']['rows'];
type Shape='ancestor'|'collection';
// Mutations use public whole-value writers; casts permit deliberate omission only.
const hide=(tree:Tree,shape:Shape)=>{
 if(shape==='ancestor')(tree.$ as unknown as (value:unknown)=>void)({visible:1});
 else (tree.$.box as unknown as (value:unknown)=>void)({s:2});
};
// INTERNAL DIAGNOSTIC ONLY: same physical-storage read as absent-collection.spec.ts.
const stored=(rows:Rows)=>(rows as unknown as {
 __prepareTransitionTarget:{readSource():{subjects:readonly {value:unknown}[]}}
}).__prepareTransitionTarget.readSource().subjects.map(({value})=>value);
function absent(tree:Tree,rows:Rows,shape:Shape){
 expect(rows.all()).toEqual([]);expect(rows.ids()).toEqual([]);expect(rows.count()).toBe(0);
 expect(rows.byId('a')).toBeUndefined();expect(rows.has('a')()).toBe(false);
 expect(tree.$()).toEqual(shape==='ancestor'?{visible:1}:{visible:1,box:{s:2}});
}

for(const shape of ['ancestor','collection'] as const)
it(`retained-source: hidden ${shape} replay respects dependency boundary and retained rows`,async()=>{
 const tree=make();const rows=tree.$.box!.rows!;
 try{
  rows.setAll([{id:'a',n:0,tag:'A'},{id:'b',n:3,tag:'B'}]);await flush();
  const a=rows.byIdOrFail('a'),b=rows.byIdOrFail('b');
  const pending=tree.transact(()=>rows.updateOne('a',{n:7}));await flush();
  expect(a.n()).toBe(7);hide(tree,shape);await flush();
  absent(tree,rows,shape);expect(a()).toBeUndefined();expect(b()).toBeUndefined();
  expect(stored(rows)).toEqual([{id:'a',n:7,tag:'A'},{id:'b',n:3,tag:'B'}]);
  if(shape==='collection'){
   // Both exact sources refuse this later dependent omission. Do not invent ordering.
   let failure:unknown;try{pending.rollback();}catch(error){failure=error;}
   expect(failure).toMatchObject({code:'SIGNALTREE_ROLLBACK_FAILED',cause:{kind:'later-confirmed-dependency'}});
   absent(tree,rows,shape);
   expect(stored(rows)).toEqual([{id:'a',n:7,tag:'A'},{id:'b',n:3,tag:'B'}]);
   pending.confirm();return;
  }
  pending.rollback();await flush();
  absent(tree,rows,shape);expect(a()).toBeUndefined();expect(a.n()).toBeUndefined();
  expect(stored(rows)).toEqual([{id:'a',n:0,tag:'A'},{id:'b',n:3,tag:'B'}]);
  // Public reveal replaces hidden contents; this checks non-resurrection, not compensation.
  rows.addOne({id:'c',n:11,tag:'reveal'});await flush();
  expect(rows.all()).toEqual([{id:'c',n:11,tag:'reveal'}]);
  expect(rows.byId('a')).toBeUndefined();expect(rows.byId('b')).toBeUndefined();
 }finally{tree.destroy();}
});

it('retained-source: hidden two-row refusal preserves both rows, then retry compensates while still absent',async()=>{
 const tree=make();const rows=tree.$.box!.rows!;let off=()=>{};
 try{
  rows.setAll([{id:'a',n:0,tag:'A'},{id:'b',n:3,tag:'B'}]);await flush();
  const pending=tree.transact(()=>{rows.updateOne('a',{n:7});rows.updateOne('b',{n:9});});await flush();
  hide(tree,'ancestor');await flush();const visited:string[]=[];
  // Callback only records/blocks. Assertions execute after rollback returns to this test.
  off=rows.intercept({onUpdate(id,_changes,context){visited.push(id);if(visited.length===2)context.block('retained-source second inverse refused');}});
  let failure:unknown;try{pending.rollback();}catch(error){failure=error;}
  expect(failure).toMatchObject({code:'SIGNALTREE_ROLLBACK_FAILED',cause:{kind:'effect-validation-failed'}});
  expect(visited).toHaveLength(2);expect(new Set(visited)).toEqual(new Set(['a','b']));
  absent(tree,rows,'ancestor');off();
  expect(stored(rows)).toEqual([{id:'a',n:7,tag:'A'},{id:'b',n:9,tag:'B'}]);
  pending.rollback();await flush();absent(tree,rows,'ancestor');
  expect(stored(rows)).toEqual([{id:'a',n:0,tag:'A'},{id:'b',n:3,tag:'B'}]);
 }finally{off();tree.destroy();}
});

for(const shape of ['ancestor','collection'] as const)
it(`retained-source: hidden ${shape} lookup cannot retarget a removed lifetime at its reused key`,async()=>{
 const tree=make();const rows=tree.$.box!.rows!;
 try{
  rows.addOne({id:'a',n:0,tag:'old'});await flush();const old=rows.byIdOrFail('a');
  const pending=tree.transact(()=>rows.updateOne('a',{n:7}));await flush();
  rows.removeOne('a');rows.addOne({id:'a',n:99,tag:'new'});await flush();
  const fresh=rows.byIdOrFail('a');expect(fresh).not.toBe(old);expect(old()).toBeUndefined();
  hide(tree,shape);await flush();absent(tree,rows,shape);
  // The invariant here is exact lifetime isolation, not a new conflict/settlement policy.
  let refused=false;try{pending.rollback();}catch{refused=true;}
  absent(tree,rows,shape);expect(old()).toBeUndefined();expect(fresh()).toBeUndefined();
  expect(stored(rows)).toEqual([{id:'a',n:99,tag:'new'}]);
  if(refused)pending.confirm();
 }finally{tree.destroy();}
});

it('retained-source: destroyed hidden owner refuses its saved handles without touching another same-key tree',async()=>{
 const tree=make(),other=make();const rows=tree.$.box!.rows!,otherRows=other.$.box!.rows!;
 try{
  rows.addOne({id:'a',n:0,tag:'owned'});otherRows.addOne({id:'a',n:99,tag:'other'});await flush();
  const otherRow=otherRows.byIdOrFail('a');const pending=tree.transact(()=>rows.updateOne('a',{n:7}));await flush();
  hide(tree,'ancestor');await flush();absent(tree,rows,'ancestor');tree.destroy();
  expect(()=>pending.rollback()).toThrow();expect(()=>pending.confirm()).toThrow();
  expect(otherRows.byIdOrFail('a')).toBe(otherRow);expect(otherRows.all()).toEqual([{id:'a',n:99,tag:'other'}]);
 }finally{tree.destroy();other.destroy();}
});
