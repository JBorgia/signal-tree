import {expect,it} from 'vitest';
import {entityMap,signalTree} from '../index';
import {getEntityPublicationBinding,type EntityPublicationPacket} from './internals/entity-publication';

it('frame producers retain whole, partial and derived scope independently of equal value diffs',()=>{
 const tree=signalTree({rows:entityMap<{id:string;x:number;y:number},string>()});
 const rows=tree.$.rows;rows.addOne({id:'a',x:7,y:0});
 const packets:EntityPublicationPacket[]=[];
 const off=getEntityPublicationBinding(rows)!.source.subscribe({prepare(packet){packets.push(packet);return undefined;},complete(){/* This fixture records preparation only. */}});
 const scope=()=>packets.at(-1)?.steps?.find(step=>step.authoredFootprint)?.authoredFootprint;
 try{
  rows.setAll([{id:'a',x:7,y:0}]);expect(scope()).toEqual({kind:'whole'});
  expect(packets.at(-1)?.ordinary[0]?.fields).toEqual(['id','x','y']); // Whole offers still pass through native endpoint selection.
  expect(packets.at(-1)?.physical[0]?.fields).toEqual([]); // Equal offers are not physical value changes.
  rows.replaceOne('a',{id:'a',x:7,y:0});expect(scope()).toEqual({kind:'whole'});
  rows.updateMany(['a'],{x:7});expect(scope()).toEqual({kind:'fields',fields:['x']});
  rows.upsertMany([{id:'a',x:7,y:0}]);expect(scope()?.kind).toBe('fields');
  rows.byIdOrFail('a')(value=>({...value,x:8}));expect(scope()).toEqual({kind:'derive'});
  rows.updateOne('a',{x:8});expect(scope()).toEqual({kind:'fields',fields:['x']});
 }finally{off();tree.destroy();}
});
