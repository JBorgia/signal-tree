import { expect, it } from 'vitest';
import { entityMap, signalTree, transactions } from '../index';
import { getEntityPublicationBinding } from './internals/entity-publication';
import { entityMembershipReader, type EntityMembershipEvent } from './internals/entity-membership-view';
import { getOwnedPositionIds } from './internals/owned-mutation';
import { preparePointRealization } from './internals/causal-runtime/tree-realization-adapter';

type Row = { id: string; n: number };
it('installed sibling membership survives completion throw and releases once for useful later writes', () => {
  const t = signalTree({left: entityMap<Row,string>(), right: entityMap<Row,string>()}, {enhancers:[transactions()]});
  t.$.left.addOne({id:'a',n:1}); t.$.right.addOne({id:'b',n:2});
  const reader = entityMembershipReader(t)!;
  const events: EntityMembershipEvent[] = [];
  const stop = reader.subscribe(event => events.push(event));
  const sentinel = {tag:'installed-completion'};
  const reads: unknown[] = [];
  let armed = true;
  const off = getEntityPublicationBinding(t.$.left)!.source.subscribe({
    prepare(){ return {record:{writes:[],adds:[]},completion:{}}; },
    complete(){
      reads.push([t.$.left.ids(),t.$.right.ids()]);
      if(armed){armed=false;throw sentinel;}
    },
  });
  try {
    const plan = preparePointRealization(t, [
      {owner:getOwnedPositionIds(t.$.left)![0],subjectId:getEntityPublicationBinding(t.$.left.byIdOrFail('a'))!.subject!,structural:'rekey',before:'a',after:'x'},
      {owner:getOwnedPositionIds(t.$.right)![0],subjectId:getEntityPublicationBinding(t.$.right.byIdOrFail('b'))!.subject!,structural:'rekey',before:'b',after:'y'},
    ])!;
    expect(plan).toBeDefined(); plan.install();
    plan.publish({deferCompletion:true});
    expect(events).toEqual([]);
    let caught:unknown;try{plan.complete();}catch(error){caught=error;}
    expect(caught).toBe(sentinel);
    expect(reads).toEqual([[['x'],['y']]]);
    expect(events.map(e=>[e.collection.path,e.changes.map(c=>c.kind)])).toEqual([['left',['rekey']],['right',['rekey']]]);
    expect(t.$.left.ids()).toEqual(['x']);expect(t.$.right.ids()).toEqual(['y']);
    plan.complete();expect(events).toHaveLength(2);
    t.$.right.addOne({id:'c',n:3});
    expect(events).toHaveLength(3);
    expect(events[2].changes).toEqual([{kind:'add',lifetimeId:2,key:'c',beforeLifetimeId:1}]);
    expect(reader.snapshot().collections.find(c=>c.path==='right')!.members.map(m=>m.key)).toEqual(['y','c']);
  } finally {off();stop();t.destroy();}
});

for (const throws of [false,true]) it(`captures add neighbours before completion reentry throws=${throws}`, () => {
  const t=signalTree({rows:entityMap<Row,string>()});
  const reader=entityMembershipReader(t)!;const events:EntityMembershipEvent[]=[];
  const stop=reader.subscribe(event=>events.push(event));const sentinel={tag:'after-nested-add'};let armed=true;
  const off=getEntityPublicationBinding(t.$.rows)!.source.subscribe({
    prepare(){return {record:{writes:[],adds:[]},completion:{}};},
    complete(){if(!armed)return;armed=false;t.$.rows.addOne({id:'b',n:2});if(throws)throw sentinel;},
  });
  try{
    let caught:unknown;try{t.$.rows.addOne({id:'a',n:1});}catch(error){caught=error;}
    expect(caught).toBe(throws?sentinel:undefined);
    expect(events.map(e=>e.changes)).toEqual([
      [{kind:'add',lifetimeId:1,key:'a'}],
      [{kind:'add',lifetimeId:2,key:'b',beforeLifetimeId:1}],
    ]);
    expect(events.map(e=>e.sequence)).toEqual([1,2]);
    expect(t.$.rows.all()).toEqual([{id:'a',n:1},{id:'b',n:2}]);
    t.$.rows.removeOne('a');expect(events).toHaveLength(3);
    expect(events[2].changes).toEqual([{kind:'remove',lifetimeId:1,key:'a'}]);
    expect(reader.snapshot().collections[0].members.map(m=>m.key)).toEqual(['b']);
  }finally{off();stop();t.destroy();}
});
