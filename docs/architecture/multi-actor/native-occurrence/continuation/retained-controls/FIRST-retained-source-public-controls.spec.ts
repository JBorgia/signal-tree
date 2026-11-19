import {expect,it} from 'vitest';
import {entityMap,signalTree,transactions} from '../index';

type Row={id:string;n:number;tag:string};
type State={visible:number;box?:{s:number;rows?:ReturnType<typeof entityMap<Row,string>>}};
const flush=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
const make=()=>signalTree({visible:1,box:{s:2,rows:entityMap<Row,string>()}} as State,{enhancers:[transactions()]});
type Tree=ReturnType<typeof make>;
type Rows=NonNullable<NonNullable<Tree['$']['box']>['rows']>;
type Shape='ancestor'|'collection';
const hide=(tree:Tree,shape:Shape)=>tree.transact(()=>{
 if(shape==='ancestor')tree.$({visible:1});
 else tree.$.box!({s:2});
});
function absent(tree:Tree,rows:Rows,shape:Shape){
 expect(rows.all()).toEqual([]);expect(rows.ids()).toEqual([]);expect(rows.count()).toBe(0);
 expect(rows.byId('a')).toBeUndefined();expect(rows.has('a')()).toBe(false);
 expect(tree.$()).toEqual(shape==='ancestor'?{visible:1}:{visible:1,box:{s:2}});
}

for(const shape of ['ancestor','collection'] as const)
it(`retained-source: reversing ${shape} omission reveals compensated rows and untouched siblings`,async()=>{
 const tree=make();const rows=tree.$.box!.rows!;
 try{
  rows.setAll([{id:'a',n:0,tag:'A'},{id:'b',n:3,tag:'B'}]);await flush();
  const a=rows.byIdOrFail('a'),b=rows.byIdOrFail('b');
  const pending=tree.transact(()=>rows.updateOne('a',{n:7}));await flush();
  expect(a.n()).toBe(7);const omission=hide(tree,shape);await flush();
  absent(tree,rows,shape);expect(a()).toBeUndefined();expect(b()).toBeUndefined();
  // This is deliberately NOT a supplied-value/addOne reveal, which replaces hidden contents.
  pending.rollback();await flush();
  absent(tree,rows,shape);expect(a()).toBeUndefined();expect(a.n()).toBeUndefined();
  omission.rollback();await flush();
  expect(rows.byIdOrFail('a')).toBe(a);expect(rows.byIdOrFail('b')).toBe(b);
  expect(rows.all()).toEqual([{id:'a',n:0,tag:'A'},{id:'b',n:3,tag:'B'}]);
  expect(tree.$()).toEqual({visible:1,box:{s:2,rows:{all:[{id:'a',n:0,tag:'A'},{id:'b',n:3,tag:'B'}]}}});
 }finally{tree.destroy();}
});

it('retained-source: hidden two-row refusal preserves both rows, then retry compensates before reveal',async()=>{
 const tree=make();const rows=tree.$.box!.rows!;let off=()=>{};
 try{
  rows.setAll([{id:'a',n:0,tag:'A'},{id:'b',n:3,tag:'B'}]);await flush();
  const pending=tree.transact(()=>{rows.updateOne('a',{n:7});rows.updateOne('b',{n:9});});await flush();
  const omission=hide(tree,'ancestor');await flush();const visited:string[]=[];
  // Callback only records/blocks. Assertions execute after rollback returns to this test.
  off=rows.intercept({onUpdate(id,_changes,context){visited.push(id);if(visited.length===2)context.block('retained-source second inverse refused');}});
  let failure:unknown;try{pending.rollback();}catch(error){failure=error;}
  expect(failure).toMatchObject({code:'SIGNALTREE_ROLLBACK_FAILED',cause:{kind:'effect-validation-failed'}});
  expect(visited).toHaveLength(2);expect(new Set(visited)).toEqual(new Set(['a','b']));
  absent(tree,rows,'ancestor');off();
  omission.rollback();await flush();
  expect(rows.all()).toEqual([{id:'a',n:7,tag:'A'},{id:'b',n:9,tag:'B'}]);
  const secondOmission=hide(tree,'collection');await flush();absent(tree,rows,'collection');
  pending.rollback();await flush();absent(tree,rows,'collection');
  secondOmission.rollback();await flush();
  expect(rows.all()).toEqual([{id:'a',n:0,tag:'A'},{id:'b',n:3,tag:'B'}]);
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
  const omission=hide(tree,shape);await flush();absent(tree,rows,shape);
  // The invariant here is exact lifetime isolation, not a new conflict/settlement policy.
  let refused=false,failure:unknown;try{pending.rollback();}catch(error){refused=true;failure=error;}
  if(refused)expect(failure).toMatchObject({code:'SIGNALTREE_ROLLBACK_FAILED',cause:{kind:'effect-validation-failed'}});
  absent(tree,rows,shape);expect(old()).toBeUndefined();expect(fresh()).toBeUndefined();
  omission.rollback();await flush();
  expect(rows.byIdOrFail('a')).toBe(fresh);expect(old()).toBeUndefined();
  expect(rows.all()).toEqual([{id:'a',n:99,tag:'new'}]);
  if(refused)pending.confirm();
 }finally{tree.destroy();}
});

it('retained-source: destroyed hidden owner refuses its saved handles without touching another same-key tree',async()=>{
 const tree=make(),other=make();const rows=tree.$.box!.rows!,otherRows=other.$.box!.rows!;
 try{
  rows.addOne({id:'a',n:0,tag:'owned'});otherRows.addOne({id:'a',n:99,tag:'other'});await flush();
  const otherRow=otherRows.byIdOrFail('a');const pending=tree.transact(()=>rows.updateOne('a',{n:7}));await flush();
  const omission=hide(tree,'ancestor');await flush();absent(tree,rows,'ancestor');tree.destroy();
  expect(()=>pending.rollback()).toThrow();expect(()=>pending.confirm()).toThrow();expect(()=>omission.rollback()).toThrow();
  expect(otherRows.byIdOrFail('a')).toBe(otherRow);expect(otherRows.all()).toEqual([{id:'a',n:99,tag:'other'}]);
 }finally{tree.destroy();other.destroy();}
});
