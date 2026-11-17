#!/usr/bin/env node
// Synthetic admission falsifiers, never runtime/performance evidence.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { admitChild, admitResults } from './ledger-admission.mjs';
import { expectedFaults, freshOutside, phaseNames, schedule, sha, write } from './ledger-common.mjs';
const out=freshOutside(process.argv[2],[import.meta.dirname]);
const packetPath=join(out,'packet.json'), runner=join(out,'synthetic-runner.txt');
write(runner,{synthetic:true});
const packet={kind:'v15-ledger-screen-packet-v1',node:{version:'synthetic',path:'/synthetic/node',sha256:'0'.repeat(64)},runner,bindings:{[runner]:sha(runner)},bundles:{baseline:{sha256:'1'.repeat(64)},L2:{sha256:'2'.repeat(64)}}};
write(packetPath,packet);
const sequence=(start,n)=>Array.from({length:n},(_,i)=>start+i), keep=(xs,h)=>h>0?xs.slice(-h):[];
function payload(sample,pid) {
 const {P,H,E,N}=sample.profile,ordinary=sequence(P+1,N), expected=expectedFaults[sample.fault];
 const result={sample,pid,node:packet.node,packetPath,packetSha256:sha(packetPath),bundleSha256:packet.bundles[sample.arm].sha256,runnerSha256:sha(runner),passed:!expected};
 if(expected)return {...result,error:expected};
 if(sample.kind==='overlap-control')return {...result,oracles:{overlapRefused:true,rollbackValues:[2,1,0],pending:0}};
 const oracle=(xs,n)=>({ids:xs,effects:xs.reduce((n,id)=>n+(id<=P?1:E),0),digest:'3'.repeat(64),retention:{truncated:xs.length<n,...(xs.length?{firstAvailableTurnId:xs[0]}:{})}});
 const boundaries=[...new Set([1,N,...(H>=1?[Math.trunc(H),Math.trunc(H)+1]:[])])].filter(n=>n<=N).sort((a,b)=>a-b);
 result.oracles={initial:oracle([],0),windows:boundaries.map(step=>({step,...oracle(P?sequence(P+1,step):keep(sequence(P+1,step),H),step)})),held:oracle(P?ordinary:keep(ordinary,H),N),settled:oracle(keep(sample.settlement==='confirm'?sequence(1,P+N):ordinary,H),N),nextId:P+N+1};
 const stage={elapsedNs:1000,cpuMicroseconds:{user:1,system:0},cpuMs:0.001};
 result.stages={};result.operationSamples=[];
 if(sample.kind==='cpu') {result.stages=Object.fromEntries(phaseNames.map(n=>[n,structuredClone(stage)]));result.operationSamples=Array.from({length:N},()=>structuredClone(stage));result.stages.ordinaryFlushes={elapsedNs:N*1000,cpuMicroseconds:{user:N,system:0},cpuMs:N/1000};}
 return result;
}
const outcomes=[];
function negative(name,fn,pattern) {let failure;try{fn();}catch(e){failure=e;}assert.ok(failure,`Control failed to reject: ${name}`);if(pattern)assert.match(String(failure),pattern);outcomes.push({name,passed:true,rejected:String(failure)});}
const cpu=schedule('cpu').find(s=>s.profile.id==='history-256'&&s.arm==='baseline'), valid=payload(cpu,100);
admitChild(valid,cpu,packetPath,packet,true);outcomes.push({name:'positive-complete-cpu',passed:true});
for(const [name,edit,pattern] of [
 ['missing-phase',x=>delete x.stages.factory,undefined],
 ['missing-interval',x=>x.operationSamples.pop(),undefined],
 ['falsey-cleanup',x=>x.cleanupError='',/Cleanup failure/],
 ['bad-horizon',x=>x.oracles.windows[2].ids.shift(),/Exact ledger IDs/],
 ['wrong-next-id',x=>x.oracles.nextId++,undefined],
 ['wrong-truncation',x=>x.oracles.held.retention.truncated=false,undefined],
]){const x=structuredClone(valid);edit(x);negative(name,()=>admitChild(x,cpu,packetPath,packet,true),pattern);}
function fixture(name,mutate=()=>{}) {
 const dir=join(out,name);mkdirSync(dir);const planPath=join(dir,'plan.json');
 const plan={kind:'v15-ledger-screen-plan-v1',packetPath,packetSha256:sha(packetPath),bindings:{[packetPath]:sha(packetPath),...packet.bindings},node:packet.node,schedule:schedule('controls'),cohort:'controls'};
 const results=[];
 for(const sample of plan.schedule){const resultPath=join(dir,`child-${sample.index}.json`),logPath=resultPath+'.log',child=payload(sample,sample.index+1000),fault=expectedFaults[sample.fault];write(resultPath,child);write(logPath,{synthetic:true});results.push({sample,command:[packet.node.path,runner,'child',packetPath,resultPath,JSON.stringify(sample)],exitCode:fault?1:0,signal:null,resultPath,resultSha256:sha(resultPath),logPath,logSha256:sha(logPath),...(fault?{expectedFault:fault}:{}),passed:true});}
 const result={passed:true,planPath,planSha256:'pending',bindings:plan.bindings,results};mutate(plan,result);write(planPath,plan);result.planSha256=sha(planPath);
 for(const item of results)write(join(dir,`invocation-${String(item.sample.index).padStart(3,'0')}.json`),item);
 const path=join(dir,'results.json');write(path,result);return path;
}
admitResults(fixture('positive-cohort'));outcomes.push({name:'positive-complete-control-cohort',passed:true});
for(const [name,edit,pattern] of [
 ['joint-binding-omission',(p,r)=>{delete p.bindings[runner];r.bindings=p.bindings;},/Mandatory complete packet bindings/],
 ['wrong-command',(p,r)=>r.results[0].command[1]='/different/runner',/Exact command/],
 ['falsey-admission',(p,r)=>r.results[0].admissionError='',/Unexpected admissionError/],
 ['missing-child',(p,r)=>r.results.pop(),undefined],
])negative(name,()=>admitResults(fixture(name,edit)),pattern);
write(join(out,'receipt.json'),{passed:true,kind:'synthetic-admission-only',source:import.meta.filename,sourceSha256:sha(import.meta.filename),outcomes});
console.log(JSON.stringify({passed:true,out,count:outcomes.length}));
