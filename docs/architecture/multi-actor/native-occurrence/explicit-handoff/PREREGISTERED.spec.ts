import {expect,it} from 'vitest';
import {batching,entityMap,signalTree,transactions} from '../index';
import {getEntityPublicationBinding} from './internals/entity-publication';
import {interceptLocationWrites} from './internals/location-runtime';
import {getPathNotifier} from './path-notifier';
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<120;i++)await Promise.resolve();};
for(const coalesced of [false,true])it(`registered projection interceptor preserves particular inverse continuation (coalesce=${coalesced})`,async()=>{
 const tree=signalTree({rows:entityMap<{id:string;x:number},string>()},{enhancers:[transactions(),batching()]});const rows=tree.$.rows;
 rows.addOne({id:'a',x:0});await flush();const leaf=rows.byIdOrFail('a').x;
 const binding=getEntityPublicationBinding(leaf)!;const baseline=binding.source.evidence()!.field(binding.subject!,'x','ordinary');
 const q=tree.transact(()=>rows.updateOne('a',{x:7}));await flush();let entered=0,nested:object|undefined;
 const off=interceptLocationWrites(leaf,(operation,proceed)=>{if(entered++===0){expect(operation.intent).toBe('replace');rows.updateOne('a',{x:99});nested=binding.source.evidence()!.field(binding.subject!,'x','ordinary');}proceed();});
 try{if(coalesced)tree.coalesce(()=>q.rollback());else q.rollback();await flush();expect(entered).toBe(1);expect(nested).not.toBe(baseline);expect(leaf()).toBe(0);expect(binding.source.evidence()!.field(binding.subject!,'x','ordinary')).toBe(baseline);}
 finally{off();tree.destroy();}
});
