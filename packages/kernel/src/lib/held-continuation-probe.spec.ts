import {it,expect} from 'vitest';
import {writeFileSync} from 'node:fs';
import {entityMap,signalTree,transactions} from '../index';
import {getEntityPublicationBinding} from './internals/entity-publication';
import {interceptLocationWrites} from './internals/location-runtime';
import {getPathNotifier} from './path-notifier';
// Same collector used by repository retention tooling; this is not a byte measurement.
// eslint-disable-next-line @nx/enforce-module-boundaries -- White-box regression exercises private kernel/realization coordination.
import {collect} from '../../../../tools/lib/heap-quiescence.mjs';
type Holder={proceed?:(()=>void);receiver?:object;positive?:object};
const capture=(box:Holder)=>(_operation:unknown,proceed:()=>void)=>{box.proceed=proceed;proceed();};
const turn=()=>new Promise<void>(resolve=>setTimeout(resolve,0));
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<120;i++)await Promise.resolve();};
async function setup(mode:string){
 const box:Holder={positive:{positive:true}};
 const tree=signalTree({rows:entityMap<{id:string;x:number},string>()},{enhancers:[transactions()]});const rows=tree.$.rows;rows.addOne({id:'a',x:0});await flush();
 const row=rows.byIdOrFail('a'),leaf=row.x,binding=getEntityPublicationBinding(leaf)!;const baseline=binding.source.evidence()!.field(binding.subject!,'x','ordinary');
 const q=tree.transact(()=>rows.updateOne('a',{x:7}));await flush();
 const off=interceptLocationWrites(leaf,capture(box));q.rollback();if(leaf()!==0)throw new Error('rollback incomplete');if(!box.proceed)throw new Error('selected proceed not captured');
 off();tree.destroy();await flush();
 const refs={tree:new WeakRef(tree),row:new WeakRef(row),leaf:new WeakRef(leaf),publicationBinding:new WeakRef(binding),nativePublicationSource:new WeakRef(binding.source),transaction:new WeakRef(q),baselineRequirement:new WeakRef(baseline),negative:new WeakRef({negative:true}),positive:new WeakRef(box.positive!)};
 if(mode!=='hold-proceed')box.proceed=undefined;if(mode==='hold-row')box.receiver=row;
 return {box,refs};
}
function snapshot(refs:Record<string,WeakRef<object>>){return Object.fromEntries(Object.entries(refs).map(([k,r])=>[k,r.deref()!==undefined]));}
async function sample(refs:Record<string,WeakRef<object>>){const rounds:Record<string,boolean>[]=[];for(let n=0;n<12;n++){await turn();collect();rounds.push(snapshot(refs));}return rounds;}
it('sample held selected continuation after completed rollback and destroy',async()=>{
 expect(typeof globalThis.gc).toBe('function');const mode=process.env['ST_GC_ARM']!;if(!['hold-proceed','drop-proceed','hold-row'].includes(mode))throw new Error('invalid arm');
 const {box,refs}=await setup(mode);
 const held=await sample(refs);let staleError:string|undefined;
 if(box.proceed){try{box.proceed();}catch(e){staleError=String(e);}}
 box.proceed=undefined;box.receiver=undefined;box.positive=undefined;
 const released=await sample(refs);
 const result={mode,node:process.version,execArgv:process.execArgv,nodeOptions:process.env['NODE_OPTIONS'],held,released,staleError};writeFileSync(process.env['ST_GC_OUTPUT']!,JSON.stringify(result,null,2));
 expect(held.at(-1)?.negative).toBe(false);expect(held.every(r=>r.positive)).toBe(true);expect(released.at(-1)?.positive).toBe(false);
 if(mode==='hold-proceed')expect(staleError).toMatch(/cannot replay|closed|consumed/);
 if(mode==='hold-row')expect(held.every(r=>r.row)).toBe(true);
});
