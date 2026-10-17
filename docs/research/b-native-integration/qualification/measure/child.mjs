import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import {loadavg,cpus} from 'node:os';
const [repo,arm,scenario,countArg='400',sizeArg='32']=process.argv.slice(2);
const count=Number(countArg),size=Number(sizeArg);
globalThis.ngDevMode=false;
const api=await import(pathToFileURL(`${repo}/dist/packages/kernel/dist/index.js`));
const {signalTree,transactions,entityMap,SignalTreeRollbackError}=api;
const isB=arm==='B';
const install=isB?(await import(pathToFileURL(`${repo}/dist/packages/kernel/dist/enhancers/transactions/native-ownership-public-experiment.js`))).installNativeOwnershipPublicExperiment:undefined;
const peek=(await import(pathToFileURL(`${repo}/dist/packages/kernel/dist/enhancers/transactions/transactions.js`))).peekInternalTransactionRuntime;
function make(populate=true){const t=signalTree({x:0,rows:entityMap()},{enhancers:[isB?Object.assign(tree=>install(tree),transactions()):transactions()]});if(isB){assert.equal(typeof install,'function');assert.equal(peek(t),undefined);}else assert.ok(peek(t));if(populate)t.$.rows.addMany(Array.from({length:size},(_,id)=>({id,n:0})));return t;}
const drain=async()=>{await new Promise(r=>setTimeout(r,0));await new Promise(r=>setImmediate(r));};
const gc=async()=>{for(let i=0;i<3;i++){await drain();globalThis.gc?.();}};
function pending(t){return t.__transactions.getPendingTurnCount();}
let tree;let current=0;
function cycle(i){
 if(scenario==='construct'){const t=make();assert.equal(t.$.rows.count(),size);t.destroy();return;}
 const t=tree;
 if(scenario==='ordinary-scalar'){t.$.x(i);assert.equal(t.$.x(),i);return;}
 if(scenario==='ordinary-entity'){t.$.rows.updateOne(0,{n:i});assert.equal(t.$.rows.byIdOrFail(0)().n,i);return;}
 if(scenario==='churn'){t.$.rows.addOne({id:'temporary',n:i});const held=t.$.rows.byIdOrFail('temporary');assert.equal(held().n,i);t.$.rows.removeOne('temporary');assert.equal(held(),undefined);return;}
 if(scenario==='refusal-recovery'){
  t.$.rows.addOne({id:'temporary',n:1});const original=t.$.rows.byIdOrFail('temporary');
  const p=t.transact(()=>t.$.rows.removeOne('temporary'));
  t.$.rows.addOne({id:'temporary',n:2});const replacement=t.$.rows.byIdOrFail('temporary');
  assert.throws(()=>p.rollback(),SignalTreeRollbackError);assert.equal(pending(t),1);
  assert.equal(replacement().n,2);assert.equal(original(),undefined);assert.ok(p.inspect().changes.length);
  p.confirm();p.confirm();assert.equal(pending(t),0);assert.equal(replacement().n,2);t.$.rows.removeOne('temporary');return;
 }
 if(scenario==='overlap'){
  const a=t.transact(()=>t.$.x(1)),b=t.transact(()=>t.$.x(2));assert.equal(t.$.x(),2);
  a.rollback();assert.equal(t.$.x(),2);b.rollback();assert.equal(t.$.x(),0);assert.equal(pending(t),0);return;
 }
 const before=current; const p=t.transact(()=>{t.$.x(i);t.$.rows.updateOne(0,{n:i});});
 assert.equal(t.$.x(),i);assert.equal(t.$.rows.byIdOrFail(0)().n,i);assert.equal(pending(t),1);
 assert.equal(p.inspect().changes.length,2);
 const method=scenario==='confirm'?'confirm':'rollback';p[method]();current=method==='confirm'?i:before;
 assert.equal(t.$.x(),current);assert.equal(t.$.rows.byIdOrFail(0)().n,current);assert.equal(pending(t),0);p[method]();
}
const warmup=Math.min(100,Math.max(5,Math.floor(count/10)));
const env={node:process.version,arch:process.arch,cpus:cpus().length,loadStart:loadavg(),exposeGc:typeof globalThis.gc==='function'};
if(scenario==='retention'){
 await gc();const before=process.memoryUsage().heapUsed;tree=make();const held=[];
 for(let i=0;i<count;i++){const p=tree.transact(()=>tree.$.rows.addOne({id:'temporary',n:i}));held.push(tree.$.rows.byIdOrFail('temporary'));p.rollback();}
 await gc();assert.equal(pending(tree),0);assert.equal(tree.$.rows.count(),size);assert.ok(held.every(x=>x()===undefined));
 const retired=tree.$.rows.__listSubjectReclamationCandidates?.();const live=process.memoryUsage().heapUsed;
 tree.destroy();tree=undefined;held.length=0;await gc();console.log(JSON.stringify({arm,scenario,count,size,before,postDrainLive:live,postDrainDelta:live-before,afterDestroy:process.memoryUsage().heapUsed,retiredCandidates:retired?.length,env,metric:'whole-process heapUsed after three capture-drain/explicit-GC turns; not dominator retained size'}));
}else{
 tree=scenario==='construct'?undefined:make();
 try{for(let i=1;i<=warmup;i++)cycle(i);await gc();const heapBefore=process.memoryUsage().heapUsed;const cpu=process.cpuUsage();const start=performance.now();for(let i=warmup+1;i<=warmup+count;i++)cycle(i);const wallMs=performance.now()-start;const used=process.cpuUsage(cpu);await drain();const drainedWallMs=performance.now()-start;const drainedCpu=process.cpuUsage(cpu);await gc();const postDrain=process.memoryUsage().heapUsed;console.log(JSON.stringify({arm,scenario,count,size,warmup,wallMs,cpuUs:used.user+used.system,drainedWallMs,drainedCpuUs:drainedCpu.user+drainedCpu.system,heapBefore,postDrain,heapDelta:postDrain-heapBefore,env,loadEnd:loadavg(),scope:'cpuUs/wallMs: checked synchronous operations; drainedCpuUs/drainedWallMs additionally include one final capture/maintenance drain; setup and forced GC excluded'}));}finally{tree?.destroy();await drain();}
}
