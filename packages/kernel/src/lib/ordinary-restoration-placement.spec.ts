import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { EntityPlacementStage } from './physical/entity-placement-stage';
import { resolveOrdinaryRestorationPlacement, type OrdinaryRestorationPlacement } from './physical/ordinary-restoration-placement';
import { createEntityEgressProjection } from './internals/entity-egress-projection';
import { entityMap, signalTree, transactions } from '../index';
import { getEntityPublicationBinding } from './internals/entity-publication';
import type { ReversalEffect } from './internals/causal-runtime/causal-types';

function stage(ids: number[]) {
  const base = new Map(ids.map((id, i) => [id, { present: true as const, key: id, beforeSubject: ids[i-1], afterSubject: ids[i+1] }]));
  return new EntityPlacementStage<number>(id => base.get(id) ?? { present: false }, ids[0], ids.at(-1));
}
function resolve(initial: number[], requests: OrdinaryRestorationPlacement[]) {
  const placement = stage(initial);
  for (const value of requests) placement.insert(value.subject, value.subject, value.beforeSubject, value.afterSubject);
  const final = resolveOrdinaryRestorationPlacement(placement, new Map(requests.map(value => [value.subject, value])));
  return { placement, final };
}
function assertLinks(p: EntityPlacementStage<number>, ids: number[]) {
  expect(p.snapshot()).toEqual(ids);expect(p.head).toBe(ids[0]);expect(p.tail).toBe(ids.at(-1));
  ids.forEach((id,i)=>expect(p.read(id)).toEqual({present:true,key:id,beforeSubject:ids[i-1],afterSubject:ids[i+1]}));
}
describe('final ordinary placement', () => {
  for (const reverse of [false,true]) it(`resolves restored successor with surviving C reverse=${reverse}`,()=>{
    const requests=[{subject:1,afterSubject:2},{subject:2,beforeSubject:1,afterSubject:3}];
    const {placement}=resolve([3],reverse?requests.reverse():requests);assertLinks(placement,[1,2,3]);
  });
  it('prefers successor over nonadjacent predecessor',()=>{
    const {placement}=resolve([3,4,5],[{subject:1,beforeSubject:5,afterSubject:4}]);assertLinks(placement,[3,1,4,5]);
  });
  it('uses predecessor when successor is finally absent',()=>{
    const {placement}=resolve([3,4],[{subject:1,beforeSubject:3,afterSubject:99}]);assertLinks(placement,[3,1,4]);
  });
  it('appends when both anchors are absent and keeps disconnected stable fallback',()=>{
    const {placement}=resolve([3],[{subject:1,beforeSubject:91,afterSubject:92},{subject:2}]);assertLinks(placement,[3,1,2]);
  });
  it('resolves a cycle without a surviving anchor using existing stable fallback',()=>{
    const {placement}=resolve([],[{subject:1,beforeSubject:2,afterSubject:2},{subject:2,beforeSubject:1,afterSubject:1}]);
    assertLinks(placement,[2,1]);
  });
  it('does not restore finally absent episode or use same-key replacement as anchor',()=>{
    const p=stage([3,4]);p.remove(4);p.insert(8,4);
    const final=resolveOrdinaryRestorationPlacement(p,new Map([[1,{subject:1,afterSubject:4}]]));
    expect(final).toEqual([]);expect(p.snapshot()).toEqual([3,8]);
    p.insert(1,1,undefined,4);resolveOrdinaryRestorationPlacement(p,new Map([[1,{subject:1,afterSubject:4}]]));
    expect(p.snapshot()).toEqual([3,8,1]);
  });
  it('matches egress final placement without changing membership or values',()=>{
    const {placement,final}=resolve([3],[{subject:1,afterSubject:2},{subject:2,beforeSubject:1,afterSubject:3}]);
    const rows=[{subjectId:2,key:2,row:{id:2,n:20}},{subjectId:3,key:3,row:{id:3,n:30}},{subjectId:1,key:1,row:{id:1,n:10}}];
    const projection=createEntityEgressProjection(rows);projection.relocate(final);
    expect(projection.value()).toEqual(placement.snapshot().map(id=>rows.find(row=>row.subjectId===id)!.row));
    projection.relocate([{subject:99,afterSubject:1}]);expect(projection.value()).toHaveLength(3);
  });
  it('explicit order remains last and retains invalid-domain refusal',()=>{
    const {placement}=resolve([3,4],[{subject:1,afterSubject:2},{subject:2,afterSubject:3}]);
    placement.orderDomain([2,1]);expect(placement.snapshot()).toEqual([2,1,3,4]);
    expect(()=>placement.orderDomain([1,1])).toThrow('repeats');expect(()=>placement.orderDomain([9])).toThrow('absent');
  });
  it('only visits affected placement state, independent of collection size',()=>{
    const counts:number[]=[];
    for(const n of [32,1024]) {
      const p=stage(Array.from({length:n},(_,i)=>i+3));let reads=0;const read=p.read.bind(p);p.read=id=>{reads++;return read(id);};
      p.insert(1,1,undefined,2);p.insert(2,2,1,3);reads=0;
      resolveOrdinaryRestorationPlacement(p,new Map([[1,{subject:1,afterSubject:2}],[2,{subject:2,beforeSubject:1,afterSubject:3}]]));
      counts.push(reads);expect(p.read(1)).toMatchObject({afterSubject:2});
    }
    expect(counts[0]).toBe(counts[1]);expect(counts[0]).toBeGreaterThan(0);
    if(process.env['ST_PREPARED_REVIEW_OUTPUT']) writeFileSync(join(process.env['ST_PREPARED_REVIEW_OUTPUT'],'placement-work.json'),JSON.stringify({sizes:[32,1024],stageReads:counts})+'\n');
  });
});

it('source retains sequential values and last surviving add episode across repeated lifetime and rekey',()=>{
  const tree=signalTree({rows:entityMap<{id:number;n:number},number>()},{enhancers:[transactions()]});
  try {
    tree.$.rows.setAll([{id:1,n:10},{id:2,n:20},{id:3,n:30}]);
    const rows=tree.$.rows;
    const ids=[1,2,3].map(id=>getEntityPublicationBinding(rows.byIdOrFail(id))!.subject!);
    const [a,b,c]=ids;
    const effects:ReversalEffect[]=[
      {owner:0,subjectId:a,structural:'remove',before:1,after:undefined,structuralContext:{kind:'remove',subject:a,key:1,value:{id:1,n:10}}},
      {owner:0,subjectId:a,structural:'add',before:undefined,after:1,structuralContext:{kind:'add',subject:a,key:1,value:{id:1,n:11},afterSubject:b}},
      {owner:0,subjectId:a,before:11,after:12,subjectFieldSegments:['n']},
      {owner:0,subjectId:a,structural:'remove',before:1,after:undefined,structuralContext:{kind:'remove',subject:a,key:1,value:{id:1,n:12}}},
      {owner:0,subjectId:a,structural:'add',before:undefined,after:1,structuralContext:{kind:'add',subject:a,key:1,value:{id:1,n:13},beforeSubject:c}},
      {owner:0,subjectId:a,before:13,after:14,subjectFieldSegments:['n']},
      {owner:0,subjectId:a,structural:'rekey',before:1,after:4},
    ];
    const source=rows as unknown as {__prepareOrdinaryRealization(e:readonly ReversalEffect[],after:undefined,physical:readonly ReversalEffect[]):{changes:Array<{after:unknown}>;interval:{pairs:Array<{subject:number;after:unknown}>};install():void}};
    const plan=source.__prepareOrdinaryRealization(effects,undefined,[]);
    expect(plan.changes.map(change=>change.after)).toEqual([undefined,{id:1,n:11},{id:1,n:12},undefined,{id:1,n:13},{id:1,n:14},{id:1,n:14}]);
    expect(plan.interval.pairs.find(pair=>pair.subject===a)?.after).toEqual({present:true,key:4,beforeSubject:c,afterSubject:undefined});
    // Planning alone cannot mutate the public physical image.
    expect(rows.ids()).toEqual([1,2,3]);expect(rows.byIdOrFail(1).n()).toBe(10);
    plan.install();
    const next=source.__prepareOrdinaryRealization([{owner:0,subjectId:a,before:14,after:15,subjectFieldSegments:['n']}],undefined,[]);
    expect(next.changes[0].after).toEqual({id:1,n:15});
    expect(rows.ids()).toEqual([1,2,3]);expect(rows.byIdOrFail(1).n()).toBe(10);
  } finally {tree.destroy();}
});

it('final adjacency replay agrees for finite anchor combinations without changing values',()=>{
  let cases=0;
  // Two restores, two surviving rows; include absent anchors and mutual dependency.
  for(const aBefore of [undefined,2,3,4,99]) for(const aAfter of [undefined,2,3,4,99])
    for(const bBefore of [undefined,1,3,4,99]) for(const bAfter of [undefined,1,3,4,99]) {
      const {placement,final}=resolve([3,4],[{subject:1,beforeSubject:aBefore,afterSubject:aAfter},{subject:2,beforeSubject:bBefore,afterSubject:bAfter}]);
      const projection=createEntityEgressProjection([4,2,3,1].map(id=>({subjectId:id,key:id,row:{id}})));
      // Preserve the survivor order; only restored subjects are deliberately displaced.
      projection.reorder([3,4],false,true);
      projection.relocate(final);
      expect(projection.value().map(row=>(row as {id:number}).id)).toEqual(placement.snapshot());
      cases++;
    }
  expect(cases).toBe(625);
});

it('records added recipient placement search work separately from source work',()=>{
  const measurements:unknown[]=[];
  for(const n of [32,1024]) {
    const projection=createEntityEgressProjection(Array.from({length:n},(_,i)=>({subjectId:i+1,key:i+1,row:{id:i+1}})));
    const original=Array.prototype.indexOf;let calls=0,visited=0;
    const spy=vi.spyOn(Array.prototype,'indexOf').mockImplementation(function(this:unknown[],value:unknown,from?:number){
      const result=original.call(this,value,from);calls++;visited+=result<0?this.length:result+1;return result;
    });
    try {projection.relocate([{subject:n-1,afterSubject:1},{subject:n,afterSubject:n-1}]);}
    finally{spy.mockRestore();}
    expect(projection.value().map(row=>(row as {id:number}).id)).toEqual([n,n-1,...Array.from({length:n-2},(_,i)=>i+1)]);
    measurements.push({rows:n,indexOfCalls:calls,denseSearchPositions:visited});
  }
  if(process.env['ST_PREPARED_REVIEW_OUTPUT'])writeFileSync(join(process.env['ST_PREPARED_REVIEW_OUTPUT'],'recipient-placement-work.json'),JSON.stringify(measurements)+'\n');
});
