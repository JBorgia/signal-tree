import {writeFileSync} from 'node:fs';
import {expect,it,afterAll} from 'vitest';
import {entityMap,signalTree,link,transactions} from '../index';
import {getEntityPublicationBinding} from './internals/entity-publication';
import {getPathNotifier} from './path-notifier';
type Declared=ReturnType<typeof link>&{declare(d:{kind:'independent'},work:()=>void):unknown};
const results:unknown[]=[];const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<100;i++)await Promise.resolve();};
afterAll(()=>writeFileSync(process.env.TMPDIR+'/whole-late-getter.json',JSON.stringify(results,null,2)));
// Exact C16 characterization reaches six reads in all three routes. The seventh
// read is a new callback execution, not permission to change error behavior.
for(const route of ['setAll','replaceOne','row'] as const)
it(`whole ${route} does not newly reach a seventh-read exception`,async()=>{
 const t=signalTree({rows:entityMap<{id:string;x:number},string>()},{enhancers:[transactions()]});const rows=t.$.rows;rows.addOne({id:'a',x:7});await flush();const row=rows.byIdOrFail('a'),binding=getEntityPublicationBinding(row)!;const before=binding.source.evidence()!.field(binding.subject!,'x','ordinary');const sent:unknown[]=[];const c=link(rows,{set:v=>{sent.push(v);}}) as Declared;let calls=0,thrown:unknown;const sentinel=Error('new seventh getter read');const supplied={id:'a',get x(){if(++calls===7)throw sentinel;return 7;}};
 try{try{c.declare({kind:'independent'},()=>{if(route==='setAll')rows.setAll([supplied]);else if(route==='replaceOne')rows.replaceOne('a',supplied);else row(supplied);});}catch(e){thrown=e;}await flush();results.push({route,calls,thrown:thrown instanceof Error?thrown.message:String(thrown),sentinel:thrown===sentinel,endpointSame:binding.source.evidence()!.field(binding.subject!,'x','ordinary')===before,sent:JSON.parse(JSON.stringify(sent))});expect(thrown).toBeUndefined();expect(calls).toBe(6);
 }finally{c.dispose();t.destroy();}
});
