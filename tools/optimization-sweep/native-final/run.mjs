#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { admitPacket, fresh, loadRun, read, save, schedule, sha, validateChild, verify } from './common.mjs';

const runner = fileURLToPath(import.meta.url), here = dirname(runner);
const [mode, ...args] = process.argv.slice(2);
if (mode === 'plan') {
  const [packetArg, kind, outArg, controlsArg] = args; assert(packetArg && kind && outArg);
  const packetPath = resolve(packetArg), packet = admitPacket(packetPath);
  assert.equal(runner, packet.runner, 'Use frozen runner');
  const out = fresh(outArg, [dirname(packetPath), ...packet.protected, ...Object.keys(packet.bindings)]);
  let controls;
  if (['cpu', 'heap'].includes(kind)) {
    assert(controlsArg, 'Exact-packet controls must pass first');
    const path = resolve(controlsArg), admitted = loadRun(path);
    assert.equal(admitted.plan.kind, 'controls'); assert.equal(admitted.plan.packetPath, packetPath);
    controls = { path, sha256: sha(path) };
  }
  const plan = { schema: 1, kind, packetPath, packetSha256: sha(packetPath), executionSha256: packet.execution.sha256,
    output: join(out, 'execution'), schedule: schedule(kind), controls, command: process.argv, createdUTC: new Date().toISOString() };
  save(join(out, 'plan.json'), plan); console.log(JSON.stringify({ plan: join(out, 'plan.json'), children: plan.schedule.length }));
} else if (mode === 'run') {
  const [planArg] = args; assert(planArg);
  const planPath = resolve(planArg), plan = read(planPath), packet = admitPacket(plan.packetPath);
  assert.equal(sha(plan.packetPath), plan.packetSha256); assert.equal(packet.execution.sha256, plan.executionSha256);
  assert.equal(runner, packet.runner); assert.deepEqual(plan.schedule, schedule(plan.kind));
  if (['cpu', 'heap'].includes(plan.kind)) {
    assert.equal(sha(plan.controls.path), plan.controls.sha256);
    const controls = loadRun(plan.controls.path); assert.equal(controls.plan.kind, 'controls'); assert.equal(controls.plan.packetPath, plan.packetPath);
  }
  if (plan.kind === 'functional') {
    const { verifyExecution } = await import(pathToFileURL(packet.executionHelper)); verifyExecution(packet.browserExecution);
  }
  const out = fresh(plan.output, [planPath, dirname(plan.packetPath), ...packet.protected, ...Object.keys(packet.bindings)]);
  const children = [], pids = new Set();
  for (const sample of plan.schedule) {
    verify(packet.bindings);
    const path = join(out, `child-${String(sample.index).padStart(3, '0')}.json`);
    const script = join(here, plan.kind === 'functional' ? 'functional-child.mjs' : 'child.mjs');
    const command = [
      ...(sample.mode === 'heap' || sample.suite === 'coordination' ? ['--expose-gc'] : []), script,
      plan.kind === 'functional' ? plan.packetPath : packet.execution.path, path, JSON.stringify(sample),
    ];
    const child = spawnSync(process.execPath, command, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: plan.kind === 'functional' ? 600000 : 240000, env: { ...process.env, NODE_ENV: 'production' } });
    const log = path + '.log'; writeFileSync(log, (child.stdout ?? '') + (child.stderr ?? ''), { flag: 'wx' });
    const value = existsSync(path) ? read(path) : undefined, invocation = path + '.invocation.json';
    save(invocation, { command: [process.execPath, ...command], status: child.status, signal: child.signal, error: child.error ? String(child.error) : null,
      pid: child.pid, log, logSha256: sha(log), resultSha256: value ? sha(path) : null });
    let error;
    try {
      assert.equal(child.status, 0); assert.equal(child.signal, null); assert(!child.error); assert(value);
      assert.equal(value.pid, child.pid); assert(!pids.has(child.pid)); pids.add(child.pid);
      if (plan.kind === 'functional') { assert.equal(value.passed, true); assert.deepEqual(value.sample, sample); assert.equal(value.executionSha256, packet.execution.sha256); }
      else validateChild(value, sample, packet.execution.sha256);
    } catch (caught) { error = String(caught); }
    children.push({ index: sample.index, path, sha256: value ? sha(path) : null, invocation, invocationSha256: sha(invocation), passed: error === undefined, ...(error ? { error } : {}) });
    save(join(out, `progress-${sample.index}.json`), { planned: plan.schedule.length, children });
    console.log(JSON.stringify({ index: sample.index, sample, passed: error === undefined }));
    if (error !== undefined) break;
  }
  verify(packet.bindings);
  if (plan.kind === 'functional') {
    const { verifyExecution } = await import(pathToFileURL(packet.executionHelper)); verifyExecution(packet.browserExecution);
  }
  const passed = children.length === plan.schedule.length && children.every(child => child.passed);
  save(join(out, 'results.json'), { kind: plan.kind, passed, planSha256: sha(planPath), packetSha256: plan.packetSha256, children });
  if (!passed) process.exitCode = 1;
} else throw Error('run.mjs plan PACKET controls|functional|cpu|heap NEW_PLAN [CONTROL_RESULTS] | run PLAN');
