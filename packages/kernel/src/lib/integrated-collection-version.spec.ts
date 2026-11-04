import { expect, it } from 'vitest';
import { entityMap, signalTree } from '../index';
import { getLocationRuntime } from './internals/location-runtime';
import type { ReadonlyLocation } from './internals/cell-runtime';

type Row = {id:string;v:number};
const make = () => {
  const tree=signalTree({rows:entityMap<Row,string>()});
  tree.$.rows.setAll([{id:'a',v:0}]);
  const runtime=getLocationRuntime(tree.$);
  if(!runtime)throw new Error('Missing tree runtime');
  return {tree,rows:tree.$.rows,runtime};
};

it('realizes a collection query after cold writes and keeps future dependencies live',()=>{
  const {tree,rows,runtime}=make();let stop=()=>{ /* No subscription exists before the first query. */ };
  try{
    rows.updateOne('a',{v:1});rows.updateOne('a',{v:2});
    const query=runtime.createDerived(()=>rows.all().reduce((sum,row)=>sum+row.v,0));
    expect(query()).toBe(2);const cached=rows.all();expect(rows.all()).toBe(cached);
    const seen:number[]=[];stop=query.subscribe(()=>seen.push(query()));
    rows.updateOne('a',{v:3});expect(query()).toBe(3);expect(seen).toEqual([3]);
    expect(rows.all()).not.toBe(cached);expect(rows.ids()).toEqual(['a']);expect(rows.count()).toBe(1);
  }finally{stop();tree.destroy();}
});

it('first read inside an open invalidation group observes that write and later grouped writes',()=>{
  const {tree,rows,runtime}=make();let query:ReadonlyLocation<number>|undefined;let stop=()=>{ /* No subscription exists before the first query. */ };const seen:number[]=[];
  try{
    runtime.runInvalidationGroup(()=>{
      rows.updateOne('a',{v:1});
      query=runtime.createDerived(()=>rows.all()[0].v);expect(query()).toBe(1);
      stop=query.subscribe(()=>seen.push(query?.()??-1));
      rows.updateOne('a',{v:2});
    });
    expect(query?.()).toBe(2);expect(seen).toEqual([2]);
    rows.updateOne('a',{v:3});expect(query?.()).toBe(3);expect(seen).toEqual([2,3]);
  }finally{stop();tree.destroy();}
});

it('a tap can create the first collection computation without losing subsequent invalidation',()=>{
  const {tree,rows,runtime}=make();let query:ReadonlyLocation<number>|undefined;let stop=()=>{ /* No subscription exists before the first query. */ };const seen:number[]=[];
  const untap=rows.tap({onUpdate(){if(!query){query=runtime.createDerived(()=>rows.all()[0].v);expect(query()).toBe(1);stop=query.subscribe(()=>seen.push(query?.()??-1));}}});
  try{
    rows.updateOne('a',{v:1});expect(query?.()).toBe(1);
    rows.updateOne('a',{v:2});expect(query?.()).toBe(2);expect(seen).toEqual([2]);
  }finally{untap();stop();tree.destroy();}
});

it('held row epochs still invalidate without an earlier collection query',()=>{
  const {tree,rows,runtime}=make();let stop=()=>{ /* No subscription exists before the first query. */ };
  try{
    const row=rows.byIdOrFail('a'),query=runtime.createDerived(()=>row()?.v);
    expect(query()).toBe(0);const seen:Array<number|undefined>=[];stop=query.subscribe(()=>seen.push(query()));
    rows.updateOne('a',{v:1});expect(query()).toBe(1);expect(seen).toEqual([1]);
    rows.removeOne('a');expect(row()).toBeUndefined();expect(query()).toBeUndefined();expect(seen).toEqual([1,undefined]);
  }finally{stop();tree.destroy();}
});
