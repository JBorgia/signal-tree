import {writeFileSync} from 'node:fs';
import {it,afterAll} from 'vitest';
import {entityMap,signalTree,link,transactions} from '../index';
import {getEntityPublicationBinding} from './internals/entity-publication';
import * as life from './experimental-publication/lifecycle';
import {getPathNotifier} from './path-notifier';
type Declared=ReturnType<typeof link>&{declare(d:{kind:'independent'},work:()=>void):unknown};
const results:unknown[]=[];const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<100;i++)await Promise.resolve();};
afterAll(()=>writeFileSync(process.env.TMPDIR+'/getter-chronology.json',JSON.stringify(results,null,2)));
for(const route of ['setAll','replaceOne','row'] as const)for(const pending of [false,true])it(`chronology ${route} pending=${pending}`,async()=>{
 const t=signalTree({rows:entityMap<{id:string;x:number},string>()},{enhancers:[transactions()]}),foreign=signalTree({z:0},{enhancers:[transactions()]});const rows=t.$.rows;rows.addOne({id:'a',x:7});await flush();const row=rows.byIdOrFail('a'),binding=getEntityPublicationBinding(row)!;const req=()=>binding.source.evidence()!.field(binding.subject!,'x','ordinary') as life.NativeRequirement;const before=req();const events:unknown[]=[];let calls=0,phase='before-call';
 const record=(event:string,extra:object={})=>{const current=req(),proof=life.nativeProof(current);events.push({event,phase,calls,endpointSame:current===before,ready:life.nativeRequirementReady(current),invalid:proof.invalid,unknown:proof.unknown,possible:proof.possible?.map(o=>o.outcome)??[],...extra});};
 const sent:unknown[]=[];const c=link(rows,{set:v=>{sent.push(v);record('endpoint-call',{value:v});}}) as Declared;const off=row.x.subscribe(()=>{});const q=pending?foreign.transact(()=>foreign.$.z(7)):undefined;const sentinel=Error('seventh read');const supplied={id:'a',get x(){calls++;record('getter',{stack:new Error().stack});if(calls===7){record('getter-throws');throw sentinel;}return 7;}};
 try{record('before-declare');phase='inside-declare';try{c.declare({kind:'independent'},()=>{record('before-writer');if(route==='setAll')rows.setAll([supplied]);else if(route==='replaceOne')rows.replaceOne('a',supplied);else row(supplied);record('writer-returned');});record('declare-returned');}catch(e){record('caught',{sentinel:e===sentinel,message:e instanceof Error?e.message:String(e)});}phase='before-flush';record('before-flush');phase='flush';await flush();record('after-flush',{sends:sent.length});if(q){phase='confirm';q.confirm();await flush();record('after-confirm',{sends:sent.length});}results.push({route,pending,events});}
 finally{off();c.dispose();t.destroy();foreign.destroy();}
});
