import {writeFileSync} from 'node:fs';
import {expect,it,afterAll} from 'vitest';
import {entityMap,signalTree,link,transactions} from '../index';
import {getEntityPublicationBinding} from './internals/entity-publication';
import {getPathNotifier} from './path-notifier';
type Declared=ReturnType<typeof link>&{declare(d:{kind:'independent'},work:()=>void):unknown};
const results:unknown[]=[];
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<100;i++)await Promise.resolve();};
afterAll(()=>{writeFileSync(process.env.TMPDIR+'/whole-getters.json',JSON.stringify(results,null,2));});
for(const route of ['setAll','replaceOne','row'] as const)for(const scenario of ['stable','first-throw','reentry'] as const)
it(`whole getter ${route} ${scenario}`,async()=>{
 const t=signalTree({rows:entityMap<{id:string;x:number},string>(),inner:0},{enhancers:[transactions()]});t.$.rows.addOne({id:'a',x:7});await flush();const rows=t.$.rows,row=rows.byIdOrFail('a');const sent:unknown[]=[];const c=link(rows,{set:v=>{sent.push(v);}}) as Declared;
 const binding=getEntityPublicationBinding(row)!;const req=()=>binding.source.evidence()!.field(binding.subject!,'x','ordinary');const before=req();let calls=0,notices=0;const off=row.x.subscribe(()=>notices++);const sentinel=Error('whole getter sentinel');let thrown:unknown;
 const supplied={id:'a',get x(){calls++;if(scenario==='first-throw')throw sentinel;if(scenario==='reentry'&&calls===2)t.$.inner(9);return 7;}};
 try{try{c.declare({kind:'independent'},()=>{if(route==='setAll')rows.setAll([supplied]);else if(route==='replaceOne')rows.replaceOne('a',supplied);else row(supplied);});}catch(e){thrown=e;}
  // Capture reads made by preparation/delivery before inspecting the resulting row.
  await flush();const operationCalls=calls;
  results.push({route,scenario,calls:operationCalls,thrown:thrown instanceof Error?thrown.message:String(thrown),firstIdentity:thrown===sentinel,endpointSame:req()===before,notices,inner:t.$.inner(),sent:JSON.parse(JSON.stringify(sent))});
  if(scenario==='first-throw'){expect(thrown).toBe(sentinel);expect(req()).toBe(before);expect(sent).toEqual([]);}else if(scenario==='reentry'){expect(t.$.inner()).toBe(9);expect(thrown).toBeDefined();expect(req()).toBe(before);expect(sent).toEqual([]);}else{expect(thrown).toBeUndefined();expect(row.x()).toBe(7);expect(notices).toBe(0);}
 }finally{off();c.dispose();t.destroy();}
});
