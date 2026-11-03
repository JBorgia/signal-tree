import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import os from 'node:os';
import {quiesce} from './heap-quiescence.mjs';
globalThis.ngDevMode=false;
const [dir,kind,nText='0']=process.argv.slice(2), n=Number(nText);
const {signalTree,entityMap,transactions}=await import(dir+'/index.js');
const {peekInternalTransactionRuntime}=await import(dir+'/enhancers/transactions/transactions.js');
const pending=t=>peekInternalTransactionRuntime(t).getPendingTurnCount();
const drain=async()=>{await new Promise(setImmediate);await new Promise(setImmediate);};
const env=()=>({load:os.loadavg(),free:os.freemem()});
const out={kind,n,pid:process.pid,node:process.version,cpu:os.cpus()[0].model,started:new Date().toISOString(),environment:env()};
const seed=n=>Array.from({length:n},(_,i)=>({id:String(i),name:'row'+i,value:0}));
function fixture(n,tx=false){const t=signalTree({fields:Object.fromEntries(Array.from({length:16},(_,i)=>['f'+i,0])),rows:entityMap()},tx?{enhancers:[transactions()]}:undefined);if(n)t.$.rows.setAll(seed(n));return t;}
if(kind.startsWith('heap')){
 const count=kind==='heap-empty'?100:10;
 const base=await quiesce();let held=[];
 for(let j=0;j<count;j++){
  const t=kind==='heap-empty'?signalTree({}):fixture(n,kind==='heap-pending');const owners=[];
  if(kind==='heap-pending')for(let k=0;k<10;k++)assert.equal(t.$.rows.byIdOrFail(String(k))().value,0);
  if(kind!=='heap-empty')assert.equal(t.$.rows.count(),n);if(owners.length)assert.equal(pending(t),10);
  held.push({t,owners});
 }
 out.memory={count,baseline:base,enhancedIdlePrimed:kind==='heap-pending'?await quiesce():null};
 if(kind==='heap-pending')for(const h of held){for(let k=0;k<10;k++)h.owners.push(h.t.transact(()=>h.t.$.rows.updateOne(String(k),{value:1})));assert.equal(pending(h.t),10);}
 out.memory.liveBeforeDrain=process.memoryUsage().heapUsed;out.memory.live=await quiesce();
 for(const h of held){for(const p of h.owners)p.rollback();h.owners=[];if(kind==='heap-pending'){assert.equal(pending(h.t),0);for(let k=0;k<10;k++)assert.equal(h.t.$.rows.byIdOrFail(String(k))().value,0);}}
 out.memory.settledBeforeDrain=process.memoryUsage().heapUsed;out.memory.settled=await quiesce();
 for(const h of held)h.t.destroy();held=[];
 out.memory.destroyed=await quiesce();
}else{
 const counts={bare:20000,point:2000,projection:200,churn:500,confirm:200,rollback:200,overlap:200,refusal:100,construction:200,empty:1000};
 const count=counts[kind];assert.ok(count);
 const enhanced=['confirm','rollback','overlap','refusal'].includes(kind);
 let t=['construction','empty'].includes(kind)?null:(kind==='bare'?signalTree({fields:Object.fromEntries(Array.from({length:16},(_,i)=>['f'+i,0]))}):fixture(n,enhanced)), current=0;
 const step=i=>{
  if(kind==='empty'||kind==='construction'){const x=kind==='empty'?signalTree({}):fixture(100);if(kind==='construction')assert.equal(x.$.rows.count(),100);x.destroy();return;}
  const rows=t.$.rows;
  if(kind==='bare'){t.$.fields.f0(i);assert.equal(t.$.fields.f0(),i);}
  else if(kind==='point'||kind==='projection'){rows.updateOne('0',{value:i});assert.equal(rows.byIdOrFail('0')().value,i);if(kind==='projection'){const all=rows.all();assert.equal(all.length,n);assert.equal(all[0].value,i);}}
  else if(kind==='churn'){rows.addOne({id:'temporary',name:'temp',value:i});const old=rows.byIdOrFail('temporary');assert.equal(old().value,i);assert.equal(rows.count(),n+1);rows.removeOne('temporary');assert.equal(rows.byId('temporary'),undefined);rows.addOne({id:'temporary',name:'replacement',value:-i});assert.notEqual(rows.byIdOrFail('temporary'),old);assert.equal(rows.byIdOrFail('temporary')().value,-i);rows.removeOne('temporary');assert.equal(rows.count(),n);}
  else if(kind==='confirm'||kind==='rollback'){const before=current;const p=t.transact(()=>{t.$.fields.f0(i);rows.updateOne('0',{value:i});});assert.equal(t.$.fields.f0(),i);assert.equal(rows.byIdOrFail('0')().value,i);assert.equal(pending(t),1);p[kind]();current=kind==='confirm'?i:before;assert.equal(t.$.fields.f0(),current);assert.equal(rows.byIdOrFail('0')().value,current);assert.equal(pending(t),0);}
  else if(kind==='overlap'){const a=t.transact(()=>t.$.fields.f0(1)),b=t.transact(()=>t.$.fields.f0(2));assert.equal(t.$.fields.f0(),2);assert.equal(pending(t),2);b.rollback();assert.equal(t.$.fields.f0(),1);a.rollback();assert.equal(t.$.fields.f0(),0);assert.equal(pending(t),0);}
  else if(kind==='refusal'){const p=t.transact(()=>{t.$.fields.f0(1);rows.removeOne('0');});rows.addOne({id:'0',name:'replacement',value:2});assert.throws(()=>p.rollback());assert.equal(t.$.fields.f0(),1);assert.equal(rows.byIdOrFail('0')().value,2);assert.equal(pending(t),1);rows.removeOne('0');p.rollback();assert.equal(t.$.fields.f0(),0);assert.equal(rows.byIdOrFail('0')().value,0);assert.equal(pending(t),0);}
 };
 try{
  for(let i=1;i<=count/10;i++)step(i);await drain();
  const cpu=process.cpuUsage(),start=performance.now();
  for(let i=count/10+1;i<=count*1.1;i++)step(i);
  const syncEnd=performance.now(),syncCpu=process.cpuUsage(cpu);await drain();
  out.timing={count,warmup:count/10,syncMs:syncEnd-start,drainMs:performance.now()-syncEnd,syncCpu,totalCpu:process.cpuUsage(cpu)};
 }finally{t?.destroy();await drain();}
}
out.ended=new Date().toISOString();out.endEnvironment=env();console.log(JSON.stringify(out));
