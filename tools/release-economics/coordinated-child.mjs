import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {performance} from 'node:perf_hooks';
import {quiesce} from '../lib/heap-quiescence.mjs';
import * as c from './coordinated.mjs';

const [,packet,arm,mode]=process.argv.slice(2);
const policy=JSON.parse(readFileSync(new URL('./policy.json',import.meta.url)));
const factory=await c.loadArm(arm,resolve(packet,'packed-kernel'));
const input=c.makeRows(policy.coordination.rows);
const turn=()=>new Promise(resolve=>setTimeout(resolve,0));
const cpuMs=start=>{const cpu=process.cpuUsage(start);return(cpu.user+cpu.system)/1000;};
const p95=xs=>[...xs].sort((a,b)=>a-b)[Math.ceil(xs.length*.95)-1];
async function timed(work) {
  const cpu=process.cpuUsage(),start=performance.now();
  const value=work();const syncWallMs=performance.now()-start,syncCpuMs=cpuMs(cpu);
  await c.flush();
  return {value,wallMs:performance.now()-start,syncWallMs,syncCpuMs,totalCpuMs:cpuMs(cpu)};
}
async function route() {
  const measured=await timed(()=>{const session=factory.create(input);return{session,rows:session.rows()};});
  assert.deepEqual(measured.value.rows,input);
  measured.value.session.destroy();delete measured.value;
  await turn();return measured;
}
async function workflow(session,cycle) {
  const context=c.prepareWorkflow(session,{cycle,localOutcomes:cycle%2?{a:'rollback',b:'confirm'}:{a:'confirm',b:'rollback'}});
  const stages={};
  try {
    const pending=await timed(()=>c.startPending(context));c.captureOwnership(context);
    const publication=await timed(()=>c.startPublication(context));
    stages.start=Object.fromEntries(['wallMs','syncWallMs','syncCpuMs','totalCpuMs'].map(k=>[k,pending[k]+publication[k]]));
    c.checkPending(context);
    const order=cycle%2?['b','a']:['a','b'];
    for(const name of order){stages[`settle-${name}`]=await timed(()=>c.settleOne(context,name));c.checkLocalSettlement(context,name);}
    stages.foreign=await timed(()=>c.settleForeign(context,cycle%2?'confirm':'rollback'));await c.checkSettled(context);
    stages.retire=await timed(()=>c.retireWorkflow(context));c.checkRetired(context);
    stages.replacement=await timed(()=>c.publishReplacement(context));await c.checkReplacement(context);
    const total=Object.fromEntries(['wallMs','syncWallMs','syncCpuMs','totalCpuMs'].map(k=>[k,Object.values(stages).reduce((sum,s)=>sum+s[k],0)]));
    return{stages,total,checkpoints:context.checkpoints.length};
  }finally{c.disposeWorkflow(context);}
}

if(mode==='cpu') {
  const cold=await route();
  for(let i=0;i<policy.ordinaryCpu.warmupRoutes;i++)await route();
  const routes=[];for(let i=0;i<policy.ordinaryCpu.measuredRoutes;i++)routes.push(await route());
  const session=factory.create(input);await c.flush();const workflows=[];
  try{
    for(let i=0;i<policy.coordination.warmupWorkflows+policy.coordination.measuredWorkflows;i++){
      const result=await workflow(session,i);
      if(i>=policy.coordination.warmupWorkflows)workflows.push(result);
    }
  }finally{session.destroy();await turn();}
  const stageP95=Object.fromEntries(Object.keys(workflows[0].stages).map(name=>[name,p95(workflows.map(w=>w.stages[name].wallMs))]));
  console.log(JSON.stringify({arm,mode,cold,routes,workflows,stageP95,endpoints:{
    coldInitWallMs:cold.wallMs,initP95WallMs:p95(routes.map(x=>x.wallMs)),
    stageP95WallMs:Math.max(...Object.values(stageP95)),workflowP95WallMs:p95(workflows.map(x=>x.total.wallMs)),
    initP95SyncCpuMs:p95(routes.map(x=>x.syncCpuMs)),workflowP95SyncCpuMs:p95(workflows.map(x=>x.total.syncCpuMs)),
    workflowP95TotalCpuMs:p95(workflows.map(x=>x.total.totalCpuMs))}}));
}else if(mode==='heap'){
  // Warm code with a tiny session. The input payload is already resident at idle.
  let warm=factory.create(c.makeRows(4));await c.exercise(warm);warm.destroy();warm=null;await turn();
  const idle=await quiesce({label:`${arm} coordinated idle`});
  async function createAndAge(){
    const sessions=Array.from({length:policy.coordination.heapSessions},()=>factory.create(input));
    for(const session of sessions)for(let i=0;i<policy.coordination.heapCycles;i++)await c.exercise(session,{cycle:i});
    return sessions;
  }
  let sessions=await createAndAge();
  const populated=await quiesce({label:`${arm} coordinated populated`});
  function startAll(){
    return sessions.map((session,i)=>{
      const ctx=c.prepareWorkflow(session,{cycle:100+i});c.startPending(ctx);c.captureOwnership(ctx);c.startPublication(ctx);return ctx;
    });
  }
  let contexts=startAll();await c.flush();
  contexts.forEach(ctx=>{c.checkPending(ctx);c.releaseOracle(ctx);});
  const pending=await quiesce({label:`${arm} coordinated pending`});
  async function settleAll(){
    for(const ctx of contexts){c.settleOne(ctx,'a');c.settleOne(ctx,'b');await c.flush();c.checkLocalSettlement(ctx,'both');}
    for(let i=contexts.length-1;i>=0;i--){
      c.settleForeign(contexts[i],'rollback');await c.flush();
      if(i>0)contexts.forEach(ctx=>assert.equal(ctx.sent.length,0));
    }
    for(const ctx of contexts){await c.checkSettled(ctx);c.disposeWorkflow(ctx);}
  }
  await settleAll();
  contexts=null;
  const settled=await quiesce({label:`${arm} coordinated settled`});
  const refs=sessions.flatMap(session=>session.sentinels().map(value=>new WeakRef(value)));
  sessions.forEach(session=>session.destroy());sessions=null;
  const released=await quiesce({label:`${arm} coordinated released`});
  const collected=refs.map(ref=>ref.deref()===undefined);
  console.log(JSON.stringify({arm,mode,idle,populated,pending,settled,released,collected,endpoints:{
    populatedBytes:populated.heapUsed-idle.heapUsed,pendingBytes:pending.heapUsed-idle.heapUsed,settledBytes:settled.heapUsed-idle.heapUsed},
    checks:{actualResourcesCollected:collected.every(Boolean)}}));
  assert.ok(collected.every(Boolean),`Actual coordinated resources retained: ${JSON.stringify(collected)}`);
}else throw new Error(`Unknown mode ${mode}`);
