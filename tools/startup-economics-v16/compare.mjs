import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';

const [outArg, baselineArg, correctedArg, optimizedArg] = process.argv.slice(2);
const out = resolve(outArg);
mkdirSync(out, { recursive: false });
const packets = { baseline: resolve(baselineArg), corrected: resolve(correctedArg), optimized: resolve(optimizedArg) };
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const save = (name, value) => writeFileSync(join(out, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const samples = [];
for (const carrier of ['kernel', 'angular']) for (let round = 0; round < 5; round++) {
  const arms = ['baseline', 'corrected', 'optimized'];
  const offset = round % arms.length;
  const order = [...arms.slice(offset), ...arms.slice(0, offset)];
  if (round % 2) order.reverse();
  for (const arm of order) {
    if (arm === 'corrected' && round % 2 === 0) samples.push({ carrier, round, arm, control: 'AA' });
    samples.push({ carrier, round, arm });
    if (arm === 'corrected' && round % 2 !== 0) samples.push({ carrier, round, arm, control: 'AA' });
  }
}
save('plan.json', { command: process.argv, runnerSha256: sha(new URL(import.meta.url)), rows: 10000, packets: Object.fromEntries(Object.entries(packets).map(([arm, path]) => [arm, {path, sha256:sha(join(path, 'packet.json'))}])), samples,
  limits: 'Sequential fresh Node children; unminified production-defined artifact bundles and async-separated phases. Five balanced rounds, corrected A/A controls. Not browser application startup, not a confidence interval.' });
const results=[];
for (const [index, sample] of samples.entries()) {
  const packet=packets[sample.arm], resultPath=join(out, `result-${index}.json`);
  const args=[join(packet,'harness/child.mjs'),packet,sample.carrier,'10000',resultPath,'timing'];
  const child=spawnSync(process.execPath,args,{encoding:'utf8',timeout:120000,env:{...process.env,NODE_ENV:'production',NODE_OPTIONS:''}});
  writeFileSync(join(out,`stderr-${index}.log`),child.stderr??'',{flag:'wx'});
  writeFileSync(join(out,`stdout-${index}.log`),child.stdout??'',{flag:'wx'});
  save(`receipt-${index}.json`,{sample,command:[process.execPath,...args],exitCode:child.status,signal:child.signal,error:child.error?.message,resultSha256:child.status===0?sha(resultPath):undefined});
  assert.equal(child.status,0,`Failed child ${index}, preserve first failure`);
  const result=JSON.parse(readFileSync(resultPath,'utf8'));
  assert.equal(result.passed,true);
  results.push({sample,result});
  console.log(`${index+1}/${samples.length} ${sample.carrier}/${sample.arm}${sample.control?'/AA':''}: ${result.stages.find(stage=>stage.name==='populate').wallMs.toFixed(2)}ms populate`);
}
const median=values=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.floor(sorted.length/2)];};
const summaries=[];
for (const carrier of ['kernel','angular']) for (const stage of results[0].result.stages.map(stage=>stage.name)) {
  const get=(arm,round,control)=>results.find(value=>value.sample.carrier===carrier&&value.sample.arm===arm&&value.sample.round===round&&value.sample.control===control).result.stages.find(value=>value.name===stage).wallMs;
  const raw=Object.fromEntries(Object.keys(packets).map(arm=>[arm,Array.from({length:5},(_,round)=>get(arm,round))]));
  const aa=Array.from({length:5},(_,round)=>get('corrected',round,'AA')-get('corrected',round));
  const differences=raw.optimized.map((value,index)=>value-raw.corrected[index]);
  summaries.push({carrier,stage,raw,medians:Object.fromEntries(Object.entries(raw).map(([arm,values])=>[arm,median(values)])),optimizedMinusCorrected:differences,pairedMedianDifference:median(differences),sameArmDifferences:aa,largestAbsoluteSameArmDifference:Math.max(...aa.map(Math.abs))});
}
save('summary.json',{summaries});
