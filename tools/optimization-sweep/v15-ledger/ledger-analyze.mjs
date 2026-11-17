#!/usr/bin/env node
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { arms, phaseNames, sha, write } from './ledger-common.mjs';
import { admitResults } from './ledger-admission.mjs';
const [inputArg, outputArg] = process.argv.slice(2);
assert.ok(inputArg && outputArg, 'RESULTS_JSON OUTPUT_JSON');
const input = resolve(inputArg), output = resolve(outputArg);
assert.ok(!existsSync(output), 'Preserve prior analysis');
const { results, plan, packet, rows, children } = admitResults(input);
assert.equal(sha(fileURLToPath(import.meta.url)), packet.bindings[fileURLToPath(import.meta.url)], 'Use frozen packet analyzer');
const median = xs => { const sorted=xs.slice().sort((a,b)=>a-b), m=Math.floor(sorted.length/2); return sorted.length%2 ? sorted[m] : (sorted[m-1]+sorted[m])/2; };
const distribution = xs => ({ values: xs, min: Math.min(...xs), median: median(xs), max: Math.max(...xs) });
const summary = { cohort: plan.cohort, admitted: rows.length, profiles: {}, sameArm: [] };
if (plan.cohort === 'cpu') {
  for (const row of rows) if (row.sample.profile.id === 'history-256') {
    for (const [name, samples] of [['fillFirst256',row.operationSamples.slice(0,256)],['trimNext256',row.operationSamples.slice(256)]]) {
      assert.equal(samples.length,256);
      row.stages[name] = { elapsedMs: samples.reduce((n,s)=>n+s.elapsedNs,0)/1e6, cpuMs:samples.reduce((n,s)=>n+s.cpuMicroseconds.user+s.cpuMicroseconds.system,0)/1000 };
    }
  }
  for (const profile of [...new Set(rows.map(row=>row.sample.profile.id))]) {
    const primary=rows.filter(row=>row.sample.profile.id===profile&&!row.sample.control);
    const phases=[...phaseNames,'measuredPhaseSum',...(profile==='history-256'?['fillFirst256','trimNext256']:[])];
    const byArm={};
    for (const arm of arms) {
      const samples=primary.filter(row=>row.sample.arm===arm).sort((a,b)=>a.sample.round-b.sample.round);
      assert.deepEqual(samples.map(row=>row.sample.round),[0,1,2]);
      byArm[arm]=Object.fromEntries(phases.map(phase=>[phase,Object.fromEntries(['elapsedMs','cpuMs'].map(metric=>[metric,distribution(samples.map(row=>row.stages[phase][metric]))]))]));
    }
    const pairedCandidateMinusBaseline=Object.fromEntries(phases.map(phase=>[phase,Object.fromEntries(['elapsedMs','cpuMs'].map(metric=>[metric,distribution([0,1,2].map(round=>primary.find(row=>row.sample.arm==='L2'&&row.sample.round===round).stages[phase][metric]-primary.find(row=>row.sample.arm==='baseline'&&row.sample.round===round).stages[phase][metric]))]))]));
    summary.profiles[profile]={byArm,pairedCandidateMinusBaseline};
    const aa=rows.filter(row=>row.sample.control==='AA'&&row.sample.profile.id===profile).sort((a,b)=>a.sample.repeat-b.sample.repeat);
    assert.deepEqual(aa.map(row=>row.sample.repeat),[0,1]);
    summary.sameArm.push({profile,differenceSecondMinusFirst:Object.fromEntries(phases.map(phase=>[phase,{
      elapsedMs:aa[1].stages[phase].elapsedMs-aa[0].stages[phase].elapsedMs,
      cpuMs:aa[1].stages[phase].cpuMs-aa[0].stages[phase].cpuMs,
    }]))});
  }
}
write(output,{passed:true,input,inputSha256:sha(input),analyzer:fileURLToPath(import.meta.url),analyzerSha256:sha(fileURLToPath(import.meta.url)),
  planPath:results.planPath,planSha256:results.planSha256,summary,rows,children,
  limits:'CPU-only v15 mechanism screen. All first intervals retained. Three paired rounds and one same-arm pair/profile are descriptive; no confidence interval. No heap, application, native publication or final qualification claim.'});
console.log(JSON.stringify({passed:true,output,count:rows.length}));
