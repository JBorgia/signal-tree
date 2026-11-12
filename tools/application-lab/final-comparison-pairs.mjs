#!/usr/bin/env node
// Additional exact-profile/round pairs; never substitutes for full browser analysis.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const[mode,packetArg,cohortArg,outArg,fullAnalysisArg]=process.argv.slice(2);assert(['ordinary','inventory','dispatch'].includes(mode)&&packetArg&&cohortArg&&outArg);
const packet=resolve(packetArg),cohort=resolve(cohortArg),out=resolve(outArg),self=fileURLToPath(import.meta.url);
const read=p=>JSON.parse(readFileSync(p,'utf8')),sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');assert(!existsSync(out));
const planPath=join(packet,'plan.json'),plan=read(planPath),schedulePath=join(cohort,'schedule.json'),schedule=read(schedulePath),resultPath=join(cohort,'results.json'),aggregate=read(resultPath);
const packetBinding=mode==='ordinary'?schedule.bindings:aggregate.bindings;assert.equal(packetBinding?.[planPath],sha(planPath),'Cohort does not bind supplied packet plan');if(mode==='inventory')assert.equal(schedule.packetPlanSha256,sha(planPath));
assert(plan.runtimeRefresh);assert.equal(aggregate.scheduleSha256,sha(schedulePath));assert.equal(schedule.mode,'compare');assert.equal(aggregate.results.length,schedule.schedule.length);if(aggregate.passed!==undefined)assert(aggregate.passed);
const admission={};for(const group of [plan.inputs,schedule.bindings??{},aggregate.bindings??{}])for(const[p,h]of Object.entries(group)){if(admission[p])assert.equal(admission[p],h,`Conflicting bound input ${p}`);admission[p]=h;}
for(const[p,h]of Object.entries(admission))assert.equal(sha(p),h,`Bound input drift ${p}`);
const receipts={[self]:sha(self),[planPath]:sha(planPath),[schedulePath]:sha(schedulePath),[resultPath]:sha(resultPath)};
if(mode!=='ordinary'){
 assert(fullAnalysisArg,'Browser pairs require completed original full analyzer receipt');
 const receiptPath=resolve(fullAnalysisArg),receipt=read(receiptPath),directory=dirname(receiptPath),summaryPath=join(directory,'summary.json'),summary=read(summaryPath),fullAnalyzer=join(dirname(self),'analyze.mjs');
 assert.equal(sha(summaryPath),receipt.summarySha256);assert.equal(sha(join(directory,'summary.md')),receipt.markdownSha256);assert.equal(receipt.analyzerSha256,sha(fullAnalyzer));assert.equal(summary.analyzerSha256,sha(fullAnalyzer));assert.equal(summary.validation.complete,true);assert.equal(summary.packet,packet);assert.deepEqual(summary.arms,plan.arms);assert.deepEqual(summary.command,receipt.command);assert.equal(resolve(receipt.command[1]),fullAnalyzer);
 assert(summary.sourceRuns.some(r=>r.scenario===mode&&r.directory===cohort),'Full analysis covers this exact cohort');
 assert.equal(summary.validation.receipts[planPath],sha(planPath));assert.equal(summary.validation.receipts[resultPath],sha(resultPath));assert.equal(summary.validation.receipts[schedulePath],sha(schedulePath));
 for(const group of [summary.validation.bindings,summary.validation.receipts])for(const[p,h]of Object.entries(group))assert.equal(sha(p),h,`Full analysis binding drift ${p}`);
 receipts[receiptPath]=sha(receiptPath);receipts[summaryPath]=sha(summaryPath);receipts[fullAnalyzer]=sha(fullAnalyzer);
}

const arms=mode==='ordinary'?['native','ngrx','v15-before','v15','v16-before','v16']:plan.arms;
assert.equal(arms.length,mode==='ordinary'?6:8);
const expectedCount=mode==='ordinary'?140:mode==='inventory'?132:264;assert.equal(aggregate.results.length,expectedCount);
const finite=x=>{assert(Number.isFinite(x));return x;},p95=a=>{assert(a.length);a.forEach(finite);return [...a].sort((x,y)=>x-y)[Math.ceil(a.length*.95)-1];};
const metrics=r=>{
 const m={};
 if(mode==='ordinary'){
  assert.equal(r.stages.length,12);for(const s of r.stages){m[`stage.${s.name}.elapsedMs`]=s.elapsedMs;m[`stage.${s.name}.cumulativeMs`]=s.cumulativeMs;m[`stage.${s.name}.cpuMs`]=(s.cpuMicroseconds.user+s.cpuMicroseconds.system)/1000;}
  for(const[k,v]of Object.entries(r.heapBytes)){m[`heap.${k}.bytes`]=v;m[`heap.${k}.deltaFromFixtureBytes`]=v-r.heapBytes.fixtureBeforeStore;}
 }else{
  for(const[k,v]of Object.entries(r.startup??{}))m[`startup.${k}.ms`]=v;
  if(mode==='inventory'){
   for(const key of ['filter','toggle']){assert.equal(r.milliseconds[key].length,30);const value=p95(r.milliseconds[key]);assert.equal(value,r.milliseconds[key+'P95']);m[`interaction.${key}.p95ms`]=value;}
   for(const[k,v]of Object.entries(r.heapBytes))if(Array.isArray(v))v.forEach((value,index)=>{m[`heap.${k}.${index}.bytes`]=value;});else m[`heap.${k}.bytes`]=v;
   m['heap.populated.deltaFromBlankBytes']=r.heapBytes.populated-r.heapBytes.baseline;
  }else if(r.kind==='timing'){
   assert.equal(r.workflow.length,20);for(const[k,v]of Object.entries(r.milliseconds)){if(v.values){assert.equal(v.values.length,20);const value=p95(v.values);assert.equal(value,v.withinChildP95);m[`interaction.${k}.p95ms`]=value;}else{assert.equal(v.observations,1);m[`interaction.${k}.ms`]=v.value;}}
  }else{
   assert.equal(r.kind,'memory');assert.equal(r.memory.length,10);for(const h of r.memory){m[`heap.${h.name}.bytes`]=h.postGCBytes;m[`heap.${h.name}.deltaFromBlankBytes`]=h.deltaFromBlankBytes;assert.equal(h.postGCBytes-r.memory[0].postGCBytes,h.deltaFromBlankBytes);}
  }
 }
 Object.values(m).forEach(finite);return m;
};
const rows=[],pids=new Set();
for(const[index,sample]of schedule.schedule.entries()){
 const r=aggregate.results[index];assert(r.passed);for(const[k,v]of Object.entries(sample))assert.deepEqual(r[k],v,`Sample identity mismatch ${index}/${k}`);
 const path=mode==='ordinary'?join(cohort,`child-${String(index).padStart(3,'0')}.json`):join(cohort,`${String(index).padStart(3,'0')}-${sample.arm}${mode==='dispatch'?'-'+sample.kind:''}.json`);
 assert.deepEqual(read(path),r);receipts[path]=sha(path);
 if(mode==='ordinary'){
  const ip=join(cohort,`invocation-${index}.json`),inv=read(ip);assert.equal(inv.exit,0);assert.equal(inv.resultSha256,sha(path));assert.equal(inv.logSha256,sha(path+'.log'));assert.equal(inv.resultPath,path);assert(inv.command.includes(sample.implementationReceipt));receipts[ip]=sha(ip);receipts[path+'.log']=sha(path+'.log');
  const b=read(sample.implementationReceipt);assert.equal(b.implementation,sample.implementation);assert.equal(b.logicalArm,sample.arm);for(const[p,h]of Object.entries(b.bindings))assert.equal(sha(p),h);receipts[sample.implementationReceipt]=sha(sample.implementationReceipt);
 }
 const pid=mode==='ordinary'?r.pid:r.process.browserPid;assert(Number.isInteger(pid)&&pid>0);assert(!pids.has(pid),'Every sample must have a distinct fresh process');pids.add(pid);
 if(mode==='dispatch'){assert.equal(r.process.identity,sample.processIdentity);assert.equal(r.failures.length,0);assert(r.stages.every(x=>x.passed));}
 const arm=mode==='ordinary'?r.implementation:r.arm;assert(arms.includes(arm));
 const profile=mode==='ordinary'?`${r.rows}rows/${r.fields}fields`:`${r.rows}rows/${r.throttle}x/${r.kind??'inventory'}`;
 rows.push({arm,profile,round:r.round,control:mode==='ordinary'?r.repeat===1:r.control,member:r.controlMember??r.repeat??0,raw:path,metrics:metrics(r),work:mode==='ordinary'?r.stages.map(s=>({name:s.name,operations:s.operations})):undefined});
}
const profiles=[...new Set(rows.map(r=>r.profile))].sort();const expectedProfiles=mode==='ordinary'?[1000,10000].flatMap(n=>[8,32].map(f=>`${n}rows/${f}fields`)):[[1000,1],[1000,4],[10000,1]].flatMap(([n,t])=>(mode==='inventory'?['inventory']:['timing','memory']).map(k=>`${n}rows/${t}x/${k}`));assert.deepEqual(profiles,expectedProfiles.sort());
const stats=values=>{assert(values.length);const sorted=values.map(finite).sort((a,b)=>a-b);return{n:values.length,values,min:sorted[0],median:sorted.length%2?sorted[(sorted.length-1)/2]:(sorted[sorted.length/2-1]+sorted[sorted.length/2])/2,max:sorted.at(-1)};};
const distributions=[];
for(const profile of profiles)for(const arm of arms){const found=rows.filter(r=>r.profile===profile&&r.arm===arm&&!r.control).sort((a,b)=>a.round-b.round);assert.deepEqual(found.map(r=>r.round),[0,1,2,3,4]);const keys=Object.keys(found[0].metrics).sort();for(const r of found)assert.deepEqual(Object.keys(r.metrics).sort(),keys);distributions.push({profile,arm,metrics:Object.fromEntries(keys.map(k=>[k,stats(found.map(r=>r.metrics[k]))])),raw:found.map(r=>r.raw)});}
const definitions=[['v15-before','v15'],['v16-before','v16'],...(mode==='ordinary'?[]:[['tanstack','tanstack-variant']])],pairs=[],noise=[];
const pair=(a,b)=>{assert.equal(a.profile,b.profile);assert.equal(a.round,b.round);assert.deepEqual(a.work,b.work);assert.deepEqual(Object.keys(a.metrics).sort(),Object.keys(b.metrics).sort());return{round:a.round,beforeRaw:a.raw,afterRaw:b.raw,metrics:Object.fromEntries(Object.keys(a.metrics).map(k=>{const before=a.metrics[k],after=b.metrics[k];return[k,{before,after,difference:after-before,ratio:before>0&&after>=0?after/before:null,ratioUnavailable:before>0&&after>=0?undefined:'Non-positive before or negative after; signed difference retained'}];}))};};
const summarize=observations=>Object.fromEntries(Object.keys(observations[0].metrics).map(k=>[k,{differences:stats(observations.map(p=>p.metrics[k].difference)),ratios:observations.every(p=>p.metrics[k].ratio!==null)?stats(observations.map(p=>p.metrics[k].ratio)):null}]));
for(const profile of profiles){
 for(const[before,after]of definitions){const observations=[];for(let round=0;round<5;round++){const a=rows.filter(r=>r.profile===profile&&r.arm===before&&r.round===round&&!r.control),b=rows.filter(r=>r.profile===profile&&r.arm===after&&r.round===round&&!r.control);assert.equal(a.length,1);assert.equal(b.length,1);observations.push(pair(a[0],b[0]));}pairs.push({profile,before,after,observations,summary:summarize(observations)});}
 const observations=[];for(let round=0;round<(mode==='ordinary'?5:2);round++){
  const selected=rows.filter(r=>r.profile===profile&&r.arm==='v15'&&r.round===round&&(mode==='ordinary'||r.control));
  const a=selected.filter(r=>mode==='ordinary'?!r.control:r.member===0),b=selected.filter(r=>mode==='ordinary'?r.control:r.member===1);assert.equal(a.length,1);assert.equal(b.length,1);observations.push(pair(a[0],b[0]));
 }noise.push({profile,arm:'v15',observations,summary:summarize(observations),limit:'Observed A/A variation, not a confidence interval or universal noise bound.'});
}
const result={command:[process.execPath,...process.argv.slice(1)],mode,verifiedSamples:rows.length,identities:plan.runtimeRefresh.identities,receipts,distributions,pairs,noise,limits:['Only complete matched profile/round comparisons; no pooled operation tails.','Current standings exclude before arms; update pairs identify exact old/final artifacts.','Whole process/application heap is not per-feature allocation.','Browser output supplements, and does not replace, existing full conformance/workflow analyzer.','No claim of full v16 semantic equivalence for competitor app coordinators.']};writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
