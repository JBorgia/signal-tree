import {appendFileSync} from 'node:fs';
import {expect,it,vi} from 'vitest';
import {link,signalTree,transactions} from '../index';
import * as life from './experimental-publication/lifecycle';
import {RecipientOccurrences} from './experimental-publication/recipient-occurrence';
import {getPathNotifier} from './path-notifier';
type C=ReturnType<typeof link>&{declare(input:unknown,work:()=>unknown):unknown};
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<120;i++)await Promise.resolve();};
it('trace actual scalar enrollment across failed parent validation',async()=>{
 const events:unknown[]=[];const ids=new Map<object,number>();const id=(o:object)=>{if(!ids.has(o))ids.set(o,ids.size+1);return ids.get(o);};
 const sum=(r:life.NativeRequirement)=>{const p=life.nativeProof(r);return {id:id(r),ready:life.nativeRequirementReady(r),invalid:p.invalid,unknown:p.unknown,possible:p.possible?.map(c=>c.outcome),owners:p.owners.map(c=>c.outcome),frames:r.frames.length};};
 const native=vi.spyOn(life,'prepareNativeRequirement');
 const origReplace=RecipientOccurrences.prototype.replace;
 const replace=vi.spyOn(RecipientOccurrences.prototype,'replace').mockImplementation(function(...args){events.push({event:'replace',index:id(this),key:args[1],req:args[2]&&sum(args[2])});return origReplace.apply(this,args);});
 const origProof=RecipientOccurrences.prototype.proof;
 const proof=vi.spyOn(RecipientOccurrences.prototype,'proof').mockImplementation(function(...args){const p=origProof.apply(this,args);events.push({event:'proof',index:id(this),invalid:p.invalid,unknown:p.unknown,possible:p.possible?.map(c=>c.outcome)});return p;});
 const tree=signalTree({pair:{x:0,y:0}},{enhancers:[transactions()]});const foreign=signalTree({z:0},{enhancers:[transactions()]});const parent=link(tree.$.pair,{set:()=>{}}) as C;const sent:unknown[]=[];let child:C|undefined;const q=foreign.transact(()=>foreign.$.z(7));
 const snap=(stage:string)=>events.push({stage,requirements:native.mock.results.filter(r=>r.type==='return').map(r=>sum(r.value.requirement)),sent:[...sent]});
 try{expect(()=>parent.declare({kind:'independent'},()=>{tree.$.pair.x(7);snap('x installed');child=link(tree.$.pair,{set:v=>{sent.push(v);}}) as C;snap('child enrolled');throw Error('parent invalid');})).toThrow('parent invalid');snap('parent failed');child!.declare({kind:'independent'},()=>tree.$.pair.y(8));snap('child authored y');await flush();snap('pending flush');expect(sent).toEqual([{x:7,y:8}]);q.confirm();await flush();snap('confirmed');
 }finally{appendFileSync(process.env['ST_PACKET_PAIR_OUTPUT']!,JSON.stringify(events)+'\n');child?.dispose();parent.dispose();tree.destroy();foreign.destroy();native.mockRestore();replace.mockRestore();proof.mockRestore();}
});
