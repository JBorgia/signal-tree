import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {performance,PerformanceObserver} from 'node:perf_hooks';
import {createHook} from 'node:async_hooks';
import * as probe from './trace-probe.mjs';
import {pendingWorkload} from './pending-workload.mjs';
import {quiesce} from '../lib/heap-quiescence.mjs';
globalThis.ngDevMode=false;
const [dir,mode,output,arm='candidate']=process.argv.slice(2);
const immediate=()=>new Promise(setImmediate);
let active='setup';const phase=name=>{active=name;probe.phase(name);};
if(mode==='control-scheduler'){
 probe.reset();phase('scheduler-control');const order=[];
 const cancelled=probe.schedule('cal.cancel','setTimeout',undefined,setTimeout,()=>order.push('bad'),60000);
 probe.cancel('cal.cancel','clearTimeout',undefined,clearTimeout,cancelled);
 probe.schedule('cal.outer','queueMicrotask',undefined,queueMicrotask,()=>{order.push('outer');probe.schedule('cal.inner','queueMicrotask',undefined,queueMicrotask,()=>order.push('inner'));});
 probe.schedule('cal.immediate','setImmediate',undefined,setImmediate,()=>order.push('immediate'));
 await immediate();await immediate();const report=probe.snapshot();assert.deepEqual(order,['outer','inner','immediate']);assert.deepEqual(report.schedulerTotals,{scheduled:4,executed:3,cancelled:1,failedScheduling:0,current:0,maxQueue:2});
 probe.reset();const receiver={tag:7},handle={id:1};let seen;const returned=probe.schedule('cal.receiver','setTimeout',receiver,function(callback,delay,value){assert.equal(this,receiver);callback.call(receiver,value);return handle;},function(value){seen=[this,value];},0,42);assert.equal(returned,handle);assert.deepEqual(seen,[receiver,42]);
 let caught=false;try{probe.schedule('cal.throw','setImmediate',undefined,callback=>callback(),()=>{throw undefined;});}catch(error){caught=true;assert.equal(error,undefined);}assert.ok(caught);
 writeFileSync(output,JSON.stringify({node:process.version,mode,passed:true,report,receiverArgumentsAndHandle:true,thrownUndefined:true})+'\n');
}else{
 const gc=[];const observer=new PerformanceObserver(list=>{if(mode!=='control-gc-drop')for(const e of list.getEntries())gc.push({startTime:e.startTime,duration:e.duration,kind:e.detail?.kind,flags:e.detail?.flags,deliveryPhase:active});});observer.observe({entryTypes:['gc']});
 if(mode.startsWith('control-gc')){
  phase('gc-control');assert.equal(typeof globalThis.gc,'function');for(let i=0;i<4;i++)globalThis.gc();await immediate();await immediate();for(const e of observer.takeRecords())if(mode!=='control-gc-drop')gc.push({startTime:e.startTime,duration:e.duration,kind:e.detail?.kind});observer.disconnect();assert.ok(gc.length>0,'GC probe must observe known forced GC');assert.ok(gc.every(e=>e.duration>=0));writeFileSync(output,JSON.stringify({node:process.version,mode,gc,passed:true})+'\n');
 }else{
  const resources=new Map(),asyncCounts={};const inc=(stage,type)=>{const key=stage+':'+type;asyncCounts[key]=(asyncCounts[key]??0)+1;};
  const hook=createHook({init(id,type,trigger){assert.ok(resources.size<50000,'async diagnostic cap');resources.set(id,{type,trigger,phase:active});inc('init@'+active,type);},before(id){const r=resources.get(id);if(r)inc('before@'+active,r.type);},after(id){const r=resources.get(id);if(r)inc('after@'+active,r.type);},destroy(id){resources.delete(id);}});hook.enable();
  let tree,held,workload;const timeline=[];probe.reset({maxEvents:256});phase('seed');
  if(mode==='point'||mode==='point-calibration'){
   const {signalTree,entityMap}=await import(dir+'/index.js');tree=signalTree({fields:Object.fromEntries(Array.from({length:16},(_,i)=>['f'+i,0])),rows:entityMap()});tree.$.rows.setAll(Array.from({length:1000},(_,i)=>({id:String(i),name:'row'+i,value:0})));
   if(mode==='point')for(let i=1;i<=200;i++){tree.$.rows.updateOne('0',{value:i});assert.equal(tree.$.rows.byIdOrFail('0')().value,i);}await immediate();await immediate();probe.reset({maxEvents:256});gc.length=0;phase('writes');
   const cpu=process.cpuUsage(),start=performance.now(),writes=mode==='point'?2000:3,offset=mode==='point'?200:0;
   for(let i=1;i<=writes;i++){tree.$.rows.updateOne('0',{value:offset+i});assert.equal(tree.$.rows.byIdOrFail('0')().value,offset+i);}
   timeline.push({phase:'sync',time:performance.now(),elapsedMs:performance.now()-start,cpu:process.cpuUsage(cpu),trace:probe.snapshot()});
   for(let turn=1;turn<=22;turn++){phase('turn-'+turn);await immediate();timeline.push({phase:'turn-'+turn,time:performance.now(),elapsedMs:performance.now()-start,cpu:process.cpuUsage(cpu),trace:probe.snapshot()});}
  }else{
   assert.ok(['pending-author','pending-settle'].includes(mode));workload=await pendingWorkload(dir,'anchor',10);held=workload.createHeld();await quiesce({label:'trace primed'});if(mode==='pending-settle'){workload.author(held);await quiesce({label:'trace pending'});}probe.reset({maxEvents:256});gc.length=0;phase('operation');
   const cpu=process.cpuUsage(),start=performance.now();if(mode==='pending-author')workload.author(held);else workload.settle(held,'rolled-back');timeline.push({phase:'sync',time:performance.now(),elapsedMs:performance.now()-start,cpu:process.cpuUsage(cpu),trace:probe.snapshot()});for(let turn=1;turn<=22;turn++){phase('turn-'+turn);await immediate();timeline.push({phase:'turn-'+turn,time:performance.now(),elapsedMs:performance.now()-start,cpu:process.cpuUsage(cpu),trace:probe.snapshot()});}
  }
  const report=probe.snapshot();let calibration;if(mode==='point-calibration')calibration=probe.assertPointCalibration(report,{candidate:arm==='candidate',writes:3});
  phase('observer-flush');await new Promise(resolve=>setTimeout(resolve,0));for(const e of observer.takeRecords())gc.push({startTime:e.startTime,duration:e.duration,kind:e.detail?.kind,flags:e.detail?.flags,deliveryPhase:active});observer.disconnect();hook.disable();
  writeFileSync(output,JSON.stringify({node:process.version,pid:process.pid,mode,arm,calibration,timeline,trace:report,afterObserverFlush:probe.snapshot(),gc,asyncCounts,remainingAsyncResourceTypes:[...resources.values()].reduce((o,r)=>(o[r.type]=(o[r.type]??0)+1,o),{}),limits:'Instrumented copied artifacts. Observer/wrapper/async-hook overhead confounds timings. Counts cover rewritten direct schedulers; async resources include harness/profiler work. GC duration is event duration, not attribution of historical drain or exact CPU.'})+'\n');
  if(tree)tree.destroy();if(workload){if(mode==='pending-author')workload.settle(held,'rolled-back');workload.destroy(held);}
 }
}
