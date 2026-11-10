import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
globalThis.ngDevMode=false;
const [dir,output,mode='point']=process.argv.slice(2);
const immediate=()=>new Promise(setImmediate);
if(mode.startsWith('control')){
 const cpu=process.cpuUsage(),wall=performance.now();let checksum=0;for(let i=0;i<10000000;i++)checksum=(checksum+i)|0;
 const usage=mode==='control-zero-cpu'?{user:0,system:0}:process.cpuUsage(cpu);
 assert.ok(usage.user+usage.system>0,'CPU probe must observe known synchronous burn');assert.equal(checksum,-2014260032);
 writeFileSync(output,JSON.stringify({node:process.version,pid:process.pid,mode,cpu:usage,wallMs:performance.now()-wall,checksum})+'\n');
}else{
 const {signalTree,entityMap}=await import(dir+'/index.js');
 const tree=signalTree({fields:Object.fromEntries(Array.from({length:16},(_,i)=>['f'+i,0])),rows:entityMap()});
 try{
  tree.$.rows.setAll(Array.from({length:1000},(_,i)=>({id:String(i),name:'row'+i,value:0})));
  for(let i=1;i<=200;i++){tree.$.rows.updateOne('0',{value:i});assert.equal(tree.$.rows.byIdOrFail('0')().value,i);}await immediate();await immediate();
  const cpu=process.cpuUsage(),wall=performance.now();
  let verifiedWrites=0;for(let i=201;i<=2200;i++){verifiedWrites++;tree.$.rows.updateOne('0',{value:i});assert.equal(tree.$.rows.byIdOrFail('0')().value,i);}
  assert.equal(verifiedWrites,2000,'Measured point loop must execute all writes');
  const sync={wallMs:performance.now()-wall,cpu:process.cpuUsage(cpu)};const turns=[];
  for(let turn=1;turn<=22;turn++){await immediate();turns.push({turn,wallMs:performance.now()-wall,cpu:process.cpuUsage(cpu)});}
  writeFileSync(output,JSON.stringify({node:process.version,pid:process.pid,mode,rows:1000,warmup:200,writes:2000,sync,twoImmediateDrain:turns[1],turns,limits:'Fresh uninstrumented diagnostic cohort. Cumulative CPU/wall include harness task turns and JIT/GC;22 turns not proof of complete native quiescence. Does not replace prior cost cohort or confer adoption.'})+'\n');
 }finally{tree.destroy();await immediate();await immediate();}
}
