import assert from 'node:assert/strict';
import {Session} from 'node:inspector';
import {writeFileSync} from 'node:fs';
import {quiesce} from '../lib/heap-quiescence.mjs';
import {pendingWorkload} from './pending-workload.mjs';
globalThis.ngDevMode=false;
const [dir,mode,output,badFlag]=process.argv.slice(2);
const session=new Session();session.connect();
const post=(method,params={})=>new Promise((resolve,reject)=>session.post(method,params,(error,value)=>error?reject(error):resolve(value)));
const drain=async()=>{await new Promise(setImmediate);await new Promise(setImmediate);};
const options={samplingInterval:1024,includeObjectsCollectedByMajorGC:badFlag!=='no-collected',includeObjectsCollectedByMinorGC:badFlag!=='no-collected'};
function knownAllocationControl(){const values=[];for(let i=0;i<20000;i++)values.push({i,payload:new Array(32).fill(i)});return values;}
function sampledBytes(node,inside=false){const active=inside||node.callFrame.functionName==='knownAllocationControl';let total=active?node.selfSize:0;for(const child of node.children)total+=sampledBytes(child,active);return total;}
let held,tree,workload,weak;
if(mode.startsWith('control-')){
 await post('HeapProfiler.startSampling',options);
 held=knownAllocationControl();weak=[new WeakRef(held[0]),new WeakRef(held[10000]),new WeakRef(held[19999])];globalThis.__ST_ALLOCATION_CAL__=held;
 if(mode==='control-collected'){held=undefined;globalThis.__ST_ALLOCATION_CAL__=undefined;await quiesce({label:'collected allocation control'});for(const ref of weak)assert.equal(ref.deref(),undefined);}
}else if(mode==='point'){
 const {signalTree,entityMap}=await import(dir+'/index.js');tree=signalTree({fields:Object.fromEntries(Array.from({length:16},(_,i)=>['f'+i,0])),rows:entityMap()});tree.$.rows.setAll(Array.from({length:1000},(_,i)=>({id:String(i),name:'row'+i,value:0})));
 for(let i=1;i<=200;i++){tree.$.rows.updateOne('0',{value:i});assert.equal(tree.$.rows.byIdOrFail('0')().value,i);}await drain();
 await post('HeapProfiler.startSampling',options);
 for(let i=201;i<=2200;i++){tree.$.rows.updateOne('0',{value:i});assert.equal(tree.$.rows.byIdOrFail('0')().value,i);}await drain();
}else{
 assert.ok(['pending-author','pending-settle'].includes(mode));workload=await pendingWorkload(dir,'anchor',10);held=workload.createHeld();await quiesce({label:'primed allocation profile'});
 if(mode==='pending-settle'){workload.author(held);await quiesce({label:'pending allocation profile'});}
 await post('HeapProfiler.startSampling',options);
 if(mode==='pending-author')workload.author(held);else workload.settle(held,'rolled-back');
 await quiesce({label:mode});
}
const {profile}=await post('HeapProfiler.stopSampling');session.disconnect();
let control;
if(mode.startsWith('control-')){const bytes=sampledBytes(profile.head);assert.ok(bytes>=1024*1024,'Known multi-megabyte allocation control must exceed 1 MiB sampled bytes');control={knownFunctionSampledBytes:bytes,held:mode==='control-held',collected:mode==='control-collected',minimumControlSampledBytes:1024*1024,weakAlive:weak.some(ref=>ref.deref()!==undefined)};}
writeFileSync(output,JSON.stringify({node:process.version,pid:process.pid,mode,options,control,profile,limits:'Poisson-sampled JS allocations; not exact total bytes/counts, native backing stores, retained ownership or timing acceptance. Includes profiler/quiescence overhead; source stacks must be separated.'})+'\n');
if(tree)tree.destroy();if(workload){if(mode==='pending-author')workload.settle(held,'rolled-back');workload.destroy(held);}held=undefined;globalThis.__ST_ALLOCATION_CAL__=undefined;
