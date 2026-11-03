import {describe,expect,it} from 'vitest';
import {signalTree,entityMap,transactions,link} from '../index';
import {withWriteContext} from './write-context';
const tick=async()=>{for(let i=0;i<100;i++)await Promise.resolve();};
type Row={id:string;n:number;m?:number};
describe('slice1 existing-lifetime writer composition',()=>{
 for(const writer of ['updateMany','updateWhere','upsertMany'] as const)it(`${writer} adopted values retain chronology through mixed rollback`,async()=>{
  const tree=signalTree({x:0,rows:entityMap<Row,string>({selectId:r=>r.id})},{enhancers:[transactions()]});const rows=tree.$.rows;
  const sent: (readonly Row[])[]=[]; const connection=link(rows,{set:value=>{sent.push(structuredClone(value));}});
  try{
   rows.setAll([{id:'a',n:7},{id:'b',n:8}]);await tick();
   withWriteContext({participation:'inspection'},()=>{rows.updateOne('a',{n:99});rows.updateOne('b',{n:99});});
   const p=tree.transact(()=>{
    tree.$.x(1);
    if(writer==='updateMany')rows.updateMany(['a','b'],{n:99});
    if(writer==='updateWhere')rows.updateWhere(()=>true,{n:99});
    if(writer==='upsertMany')rows.upsertMany([{id:'a',n:99},{id:'b',n:99}]);
   });
   expect(p.inspect().changes.filter(change=>change.path.endsWith('.n'))).toHaveLength(2);
   p.rollback();expect(tree.$.x()).toBe(0);expect(rows.all()).toEqual([{id:'a',n:7},{id:'b',n:8}]);
   await tick();await connection.settled();
   expect(sent.at(-1)).toEqual([{id:'a',n:7},{id:'b',n:8}]);
   expect(sent.some(value=>value.some(row=>row.n===99))).toBe(false);
   withWriteContext({participation:'inspection'},()=>{rows.updateOne('a',{n:99});rows.updateOne('b',{n:99});});
   const q=tree.transact(()=>{
    if(writer==='updateMany')rows.updateMany(['a','b'],{n:99});
    if(writer==='updateWhere')rows.updateWhere(()=>true,{n:99});
    if(writer==='upsertMany')rows.upsertMany([{id:'a',n:99},{id:'b',n:99}]);
   });q.confirm();await tick();await connection.settled();
   expect(sent.at(-1)).toEqual([{id:'a',n:99},{id:'b',n:99}]);

  }finally{connection.dispose();tree.destroy();}
 });
 for(const present of [false,true])it(`partial realization preserves field presence (ordinary present=${present})`,async()=>{
  const tree=signalTree({x:0,rows:entityMap<Row,string>({selectId:r=>r.id})},{enhancers:[transactions()]});const rows=tree.$.rows;
  try{
   rows.addOne(present?{id:'a',n:7,m:undefined}:{id:'a',n:7});await tick();
   withWriteContext({participation:'inspection'},()=>rows.updateOne('a',{n:99}));
   const p=tree.transact(()=>{tree.$.x(1);rows.updateOne('a',{m:4});});p.rollback();
   expect(Object.prototype.hasOwnProperty.call(rows.byIdOrFail('a')(),'m')).toBe(present);
   const q=tree.transact(()=>rows.updateOne('a',{n:99}));expect(q.inspect().changes.length).toBeGreaterThan(0);q.rollback();
   expect(rows.byIdOrFail('a').n()).toBe(7);expect(Object.prototype.hasOwnProperty.call(rows.byIdOrFail('a')(),'m')).toBe(present);
  }finally{tree.destroy();}
 });
});
