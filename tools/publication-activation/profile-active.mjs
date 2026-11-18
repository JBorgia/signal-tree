#!/usr/bin/env node
// Diagnostic sampling of identified artifacts; profiler timings are not an A/B result.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { read, sha, verify, save } from './common.mjs';

const [planArg, outArg] = process.argv.slice(2);
assert(planArg && outArg, 'profile-active PLAN NEW_OUTPUT');
const planPath = resolve(planArg), plan = read(planPath), packet = read(plan.packet);
const out = resolve(outArg);
mkdirSync(out);
verify(packet.bindings);
assert.deepEqual(plan.order, ['baseline', 'candidate', 'candidate', 'baseline']);
assert.equal(plan.samplingIntervalUs, 1000);
const records = [];
let expectedOracles;
for (const [index, arm] of plan.order.entries()) {
  verify(packet.bindings);
  const directory = join(out, String(index)); mkdirSync(directory);
  const resultPath = join(directory, 'result.json'), log = join(directory, 'command.log');
  const sample = { index, arm, kind: 'cpu', profile: plan.profile, round: index };
  const command = [packet.node.path, '--cpu-prof', '--cpu-prof-interval=1000', `--cpu-prof-dir=${directory}`,
    packet.runner, 'child', packet.executionPath, resultPath, JSON.stringify(sample)];
  save(join(directory, 'command.json'), { command, planPath, planSha256: sha(planPath), packetSha256: sha(plan.packet) });
  const child = spawnSync(command[0], command.slice(1), { encoding: 'utf8', timeout: 600000,
    env: { ...process.env, NODE_OPTIONS: '' } });
  writeFileSync(log, (child.stdout ?? '') + (child.stderr ?? ''));
  assert.equal(child.status, 0); assert.equal(child.signal, null); assert.equal(child.error, undefined);
  const result = read(resultPath); assert.equal(result.passed, true); assert.equal(result.cleanupError, undefined);
  const oracles = { ...result.oracles }; delete oracles.release;
  if (expectedOracles) assert.deepEqual(oracles, expectedOracles); else expectedOracles = oracles;
  const names = readdirSync(directory).filter(name => name.endsWith('.cpuprofile')); assert.equal(names.length, 1);
  const profilePath = join(directory, names[0]), profile = read(profilePath);
  const nodes = new Map(profile.nodes.map(node => [node.id, { frame: node.callFrame, selfUs: 0, samples: 0 }]));
  for (const [i, id] of profile.samples.entries()) {
    const node = nodes.get(id); assert(node); node.selfUs += profile.timeDeltas[i]; node.samples++;
  }
  const hotspots = [...nodes.values()].filter(node => node.samples).sort((a, b) => b.selfUs - a.selfUs);
  records.push({ index, arm, command, resultPath, resultSha256: sha(resultPath), log, logSha256: sha(log),
    profilePath, profileSha256: sha(profilePath), episodeCpuMs: result.episode.cpuMs,
    sampledUs: profile.timeDeltas.reduce((a, b) => a + b, 0), hotspots });
  console.log(JSON.stringify({ index, arm, passed: true, profilePath }));
}
verify(packet.bindings);
save(join(out, 'summary.json'), { planPath, planSha256: sha(planPath), packetSha256: sha(plan.packet),
  limits: 'V8 main-thread sampling with profiler overhead. Same workload and checked semantic observations. Hotspots are diagnostic, not allocation counts or unprofiled timing evidence.', records });
