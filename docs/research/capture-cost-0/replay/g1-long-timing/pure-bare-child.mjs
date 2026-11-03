globalThis.ngDevMode=false;
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {loadavg} from 'node:os';
import {quiesce} from './heap-quiescence.mjs';
const [arm,task,nText='32',leavesText='128']=process.argv.slice(2);
const dir=process.env.ST_COST_ARTIFACT_DIR;if(!dir)throw new Error('Explicit artifact directory required');
const {signalTree}=await import(dir+'/index.js');
const N=Number(nText),leaves=Number(leavesText);
const result={arm,task,N,leaves,variant:'pure-bare',artifactDir:dir,ngDevMode:globalThis.ngDevMode,node:process.version,nodeEnv:process.env.NODE_ENV,pid:process.pid,started:new Date().toISOString(),environment:{loadavg:loadavg()},measurements:[]};
function fixture(){return signalTree({fields:Object.fromEntries(Array.from({length:leaves},(_,i)=>['f'+i,0]))});}
if(task==='timing'){
 const t=fixture();try{const step=i=>{t.$.fields.f0(i);assert.equal(t.$.fields.f0(),i);};const iterations=200000,warmup=20000;for(let i=1;i<=warmup;i++)step(i);const cpu=process.cpuUsage(),start=performance.now();for(let i=warmup+1;i<=warmup+iterations;i++)step(i);const elapsedMs=performance.now()-start;result.measurements.push({kind:'pure-bare-scalar',iterations,warmup,elapsedMs,nsPerCheckedIteration:elapsedMs*1e6/iterations,cpuMicros:process.cpuUsage(cpu),logicalWritesPerIteration:1,scope:'checked scalar write and read/assertion; fixture excluded'});}finally{t.destroy();}
}else{
 const before=await quiesce({label:'before'});let held=[],weak=[];
 function populate(){const trees=[],refs=[];for(let i=0;i<N;i++){const t=fixture();assert.equal(t.$.fields.f0(),0);assert.equal(t.$.fields['f'+(leaves-1)](),0);trees.push(t);refs.push(new WeakRef(t));}return{trees,refs};}
 ({trees:held,refs:weak}=populate());globalThis.costHeld=held;
 const live=await quiesce({label:'live'});result.memory={before,live,liveDeltaBytes:live.heapUsed-before.heapUsed,metric:'quiesced whole-process heapUsed delta, not dominator retained size'};
 result.memory.settled=await quiesce({label:'settled-live'});result.memory.settledDeltaBytes=result.memory.settled.heapUsed-before.heapUsed;
 function destroy(){for(const t of held)t.destroy();}destroy();held=[];globalThis.costHeld=undefined;
 result.memory.destroyed=await quiesce({label:'destroyed'});result.memory.destroyedDeltaBytes=result.memory.destroyed.heapUsed-before.heapUsed;result.memory.weakTargets=weak.length;result.memory.weakAlive=weak.filter(r=>r.deref()!==undefined).length;
}
result.ended=new Date().toISOString();result.environment.endLoadavg=loadavg();console.log(JSON.stringify(result));
