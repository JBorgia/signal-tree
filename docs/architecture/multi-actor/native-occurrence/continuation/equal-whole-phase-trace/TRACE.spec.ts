import {writeFileSync} from 'node:fs';
import {it,afterAll} from 'vitest';
import {entityMap,signalTree,link,transactions} from '../index';
import {getPathNotifier} from './path-notifier';
type Declared=ReturnType<typeof link>&{declare(d:{kind:'independent'},work:()=>void):unknown};
const results:unknown[]=[];const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<100;i++)await Promise.resolve();};
afterAll(()=>writeFileSync(process.env.TMPDIR+'/getter-stacks.json',JSON.stringify(results,null,2)));
for(const route of ['setAll','replaceOne','row'] as const)for(const mode of ['stable','throw7','reenter2'] as const)
it(`trace ${route} ${mode}`,async()=>{
 const t=signalTree({rows:entityMap<{id:string;x:number},string>(),inner:0},{enhancers:[transactions()]});const rows=t.$.rows;rows.addOne({id:'a',x:7});await flush();const row=rows.byIdOrFail('a');const sent:unknown[]=[];const c=link(rows,{set:v=>{sent.push(v);}}) as Declared;const off=row.x.subscribe(()=>{});let phase='prepare',caught:unknown;const reads:{ordinal:number;phase:string;stack:string}[]=[];const sentinel=Error('seventh read');const supplied={id:'a',get x(){const ordinal=reads.length+1;reads.push({ordinal,phase,stack:new Error('getter').stack??''});if(mode==='throw7'&&ordinal===7)throw sentinel;if(mode==='reenter2'&&ordinal===2)t.$.inner(9);return 7;}};
 try{try{c.declare({kind:'independent'},()=>{if(route==='setAll')rows.setAll([supplied]);else if(route==='replaceOne')rows.replaceOne('a',supplied);else row(supplied);});}catch(e){caught=e;}phase='flush';await flush();results.push({route,mode,reads,caught:caught instanceof Error?caught.message:String(caught),firstIdentity:caught===sentinel,inner:t.$.inner(),sends:sent.length});}
 finally{off();c.dispose();t.destroy();}
});
