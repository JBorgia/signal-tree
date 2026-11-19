import {expect,it} from 'vitest';
import {appendFileSync} from 'node:fs';
import '../index';
import {EntityPublicationSource,type EntityPublicationEdit} from './internals/entity-publication';
for(const frozen of [false,true])it(`shared structural alias remains mutable with frozen shell=${frozen}`,()=>{
 const source=new EntityPublicationSource();const payload={x:7};const structural={kind:'add' as const,subject:1,value:payload};const fields=['x'];
 const raw:EntityPublicationEdit={subject:1,before:undefined,after:payload,fields,structural};const edit=frozen?Object.freeze(raw):raw;
 const retainedHistoryFact={structuralRecord:structural};
 try{source.prepare({owner:1,id:{},meta:undefined,ordinary:[edit],physical:[edit]});appendFileSync('/private/tmp/st-packet-r1-cost-feasibility/ownership.jsonl',JSON.stringify({frozen,editSameStructural:edit.structural===structural,sharedFrozen:Object.isFrozen(retainedHistoryFact.structuralRecord),fieldsFrozen:Object.isFrozen(fields),payloadFrozen:Object.isFrozen(payload)})+'\n');expect(Object.isFrozen(payload)).toBe(false);expect(Object.isFrozen(retainedHistoryFact.structuralRecord)).toBe(false);expect(Object.isFrozen(fields)).toBe(false);}finally{source.dispose();}
});
