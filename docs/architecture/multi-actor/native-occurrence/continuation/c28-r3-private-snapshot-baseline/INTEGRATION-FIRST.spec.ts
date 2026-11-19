import {appendFileSync} from 'node:fs';
import {describe,it,expect,vi} from 'vitest';
import {signalTree,entityMap,transactions} from '../index';
import {getOwnedPositionIds,getOwnedSubjectIds} from './internals/owned-mutation';
import {preparePointRealization,createTreeRealizationAdapter,rememberTreeRealizationDescriptor,type TreeRealizationDescriptor} from './internals/causal-runtime/tree-realization-adapter';
import type {ReversalEffect} from './internals/causal-runtime/causal-types';
import {realizationPlacement} from './internals/causal-runtime/ordinary-realization';
import type {ISignalTree} from './types';
const record=(name:string,value:unknown)=>{const p=process.env['ST_SNAPSHOT_OUTPUT'];if(!p)throw Error('Missing diagnostic output');appendFileSync(p,JSON.stringify({name,value})+'\n');};
describe('private snapshot adapter integration only',()=>{
 it('P direct point snapshot reentry refuses before installation and a fresh plan remains useful',()=>{
  const tree=signalTree({x:0,rows:entityMap<{id:string;value:number}>()},{enhancers:[transactions()]});
  tree.$.rows.addOne({id:'a.b',value:0});const pending=tree.transact(()=>{tree.$.x(1);tree.$.rows.byIdOrFail('a.b').value(1);});
  const rows=tree.$.rows,held=rows.byIdOrFail('a.b'),owner=getOwnedPositionIds(rows)![0],subjectId=getOwnedSubjectIds(held.value)![0];
  const effects:Parameters<typeof preparePointRealization>[1]=[{owner,subjectId,subjectFieldSegments:['value'],before:1,after:0}];
  const original=rows.byIdOrFail;let entered=false;const stacks:string[]=[];
  const spy=vi.spyOn(rows,'byIdOrFail').mockImplementation(function(key){const value=original.call(rows,key);const stack=new Error().stack??'';stacks.push(stack);if(!entered&&stack.includes('snapshotCollectionEntityValue')){entered=true;tree.$.x(7);}return value;});
  try{
   expect(()=>preparePointRealization(tree,effects)).toThrow('preparation reentered installation');expect(entered).toBe(true);expect(tree.$.x()).toBe(7);expect(held.value()).toBe(1);expect(rows.ids()).toEqual(['a.b']);
   expect(stacks.some(s=>s.includes('snapshotCollectionEntityValue')&&s.includes('preparePointRealization'))).toBe(true);
   spy.mockRestore();const plan=preparePointRealization(tree,effects);expect(plan).toBeDefined();plan!.install();plan!.publish();expect(held.value()).toBe(0);expect(tree.$.x()).toBe(7);held.value(8);expect(held()).toEqual({id:'a.b',value:8});record('P-direct-point',{entered,stacks,finalX:tree.$.x(),finalRow:held()});
  }finally{spy.mockRestore();pending.confirm();tree.destroy();}
 });
 it('R lowered structural add reaches placement-rekey snapshot and preserves physical payload and lifetime',()=>{
  type Row={id:string;n:number};const tree=signalTree({rows:entityMap<Row,string>()},{enhancers:[transactions()]});const rows=tree.$.rows;
  try{
   rows.setAll([{id:'a',n:1},{id:'b',n:2}]);const held=rows.byIdOrFail('a'),subject=getOwnedSubjectIds(held.n)![0],owner=getOwnedPositionIds(rows)![0];
   // Existing source ordinary-plan ingress: ordinary row absent, physical lifetime still active.
   const remove:ReversalEffect={owner,subjectId:subject,structural:'remove',before:'a',after:undefined,structuralContext:{kind:'remove',subject,key:'a',value:{id:'a',n:1}}};
   const internal=rows as unknown as {__prepareOrdinaryRealization(e:readonly ReversalEffect[],after:undefined,physical:readonly ReversalEffect[]):{install():void}};
   internal.__prepareOrdinaryRealization([remove],undefined,[]).install();expect(held()).toEqual({id:'a',n:1});
   const descriptors=new Map<number,TreeRealizationDescriptor>();const add:ReversalEffect={owner,subjectId:subject,structural:'add',before:undefined,after:'z',structuralContext:{kind:'add',subject,key:'z',value:{id:'a',n:1}}};
   rememberTreeRealizationDescriptor({descriptors,path:'rows.z',ownerPath:'rows',positionIds:[owner],subjectIds:[subject],meta:{structuralEffect:{kind:'add',subject,key:'z',value:{id:'a',n:1}}}});
   const adapter=createTreeRealizationAdapter({tree:tree as unknown as ISignalTree<object>,descriptors});const effects=adapter.prepareOrdinaryEffects!([add]);expect(effects[0].structural).toBe('rekey');expect(realizationPlacement(effects[0])).toBeDefined();
   const original=rows.byIdOrFail;const stacks:string[]=[];const spy=vi.spyOn(rows,'byIdOrFail').mockImplementation(function(key){stacks.push(new Error().stack??'');return original.call(rows,key);});
   try{expect(adapter.validateEffects(effects)).toBeUndefined();expect(stacks.some(s=>s.includes('snapshotCollectionEntityValue')&&s.includes('updatePreparedRealizationContext'))).toBe(true);expect(rows.ids()).toEqual(['a','b']);adapter.applyAtomically(effects);}
   finally{spy.mockRestore();}
   expect(rows.ids()).toEqual(['b','z']);expect(rows.byId('a')).toBeUndefined();expect(rows.byIdOrFail('z')).toBe(held);expect(held()).toEqual({id:'a',n:1});held.n(8);expect(rows.byIdOrFail('z').n()).toBe(8);record('R-placement',{stacks,finalRows:rows.all()});
  }finally{tree.destroy();}
 });
});
