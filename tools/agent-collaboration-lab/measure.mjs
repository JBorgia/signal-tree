#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { contextProbe, pressureStage, pressureSettle, interleavedProbe } from './browser-metrics.mjs';
import { resolveHistoricalInputs } from './historical-inputs.mjs';

const [mode, packetArg, outArg, controlsArg, calibrationArg] = process.argv.slice(2);
assert(['calibrate', 'compare', 'controls'].includes(mode) && packetArg && outArg);
const packet = resolve(packetArg), out = resolve(outArg), runner = fileURLToPath(import.meta.url);
assert(!existsSync(out), 'Preserve previous attempts');
mkdirSync(out, { recursive: true });
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const save = (name, value) => writeFileSync(join(out, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const planPath = join(packet, 'plan.json'), buildPath = join(packet, 'dispatch-build.json');
const conformancePath = join(packet, 'dispatch-conformance/results.json');
const plan = read(planPath), built = read(buildPath), conformance = read(conformancePath);
assert.equal(built.planSha256, sha(planPath));
assert.equal(conformance.planSha256, sha(planPath));
assert.equal(conformance.buildSha256, sha(buildPath));
assert(conformance.results.length > 0 && conformance.results.every(result => result.passed));
const arms = ['native', 'ngrx', 'v15', 'v16', 'tanstack', 'tanstack-variant'];
const dispatchFaults = ['drop-write', 'stale-preview', 'premature-publication', 'clobber-other-field', 'blanket-block', 'stale-editor', 'drop-reentry', 'skip-destroy', 'false-rejection', 'stale-success'];
const checker = resolve(dirname(runner), '../application-lab/dispatch-check.mjs');
assert.deepEqual([...plan.arms].sort(), [...arms].sort());
assert.deepEqual(Object.keys(built.arms).sort(), [...arms].sort());
assert.equal(conformance.runnerSha256, sha(checker));
assert.deepEqual(Object.keys(conformance.controls).sort(), [...dispatchFaults].sort());
assert.equal(conformance.results.length, arms.length * (dispatchFaults.length + 1));
let bindings = { ...plan.inputs, [planPath]: sha(planPath), [buildPath]: sha(buildPath), [conformancePath]: sha(conformancePath) };
const requiredLive = new Set([planPath, buildPath, conformancePath]);
bindings[checker] = sha(checker); requiredLive.add(checker);
for (const path of [runner, join(dirname(runner), 'browser-metrics.mjs'), join(dirname(runner), 'metrics-protocol.md'), join(dirname(runner), 'historical-inputs.mjs')]) { bindings[path] = sha(path); requiredLive.add(path); }
for (const arm of arms) {
  assert(built.arms[arm]);
  assert.equal(conformance.results.filter(result => result.arm === arm).length, Object.keys(conformance.controls).length + 1);
  assert.deepEqual(conformance.results.filter(result => result.arm === arm).map(result => result.fault ?? 'baseline').sort(), ['baseline', ...dispatchFaults].sort());
  Object.assign(bindings, built.arms[arm].dependencies, built.arms[arm].served);
  for (const path of [...Object.keys(built.arms[arm].dependencies), ...Object.keys(built.arms[arm].served)]) requiredLive.add(path);
}
const historicalConfigPath = process.env.ST_HISTORICAL_INPUTS_CONFIG ? resolve(process.env.ST_HISTORICAL_INPUTS_CONFIG) : undefined;
const historical = resolveHistoricalInputs(bindings, requiredLive, historicalConfigPath ? read(historicalConfigPath) : undefined);
bindings = historical.bindings;
if (historicalConfigPath) bindings[historicalConfigPath] = sha(historicalConfigPath);
const verify = () => { for (const [path, expected] of Object.entries(bindings)) assert.equal(sha(path), expected, `Input drift ${path}`); };
const sourceIdentity = { planSha256: sha(planPath), buildSha256: sha(buildPath), runnerSha256: sha(runner), browserMetricsSha256: sha(join(dirname(runner), 'browser-metrics.mjs')), protocolSha256: sha(join(dirname(runner), 'metrics-protocol.md')), inputResolverSha256: sha(join(dirname(runner), 'historical-inputs.mjs')), historicalConfigSha256: historicalConfigPath ? sha(historicalConfigPath) : null };
const faults = ['context-truncated', 'context-corrupt', 'drop-write', 'drop-pending-record', 'stale-optimistic', 'premature-dismissal', 'dismissal-loses-projection', 'duplicate-effect', 'busy-main-thread'];
if (mode === 'compare') {
  assert(controlsArg && calibrationArg, 'Comparison requires fresh metric controls and calibration results');
  for (const [pathArg, expectedMode, expectedCount] of [[controlsArg, 'controls', faults.length], [calibrationArg, 'calibrate', arms.length * 2]]) {
    const path = resolve(pathArg), result = read(path);
    assert.equal(result.mode, expectedMode); assert.equal(result.passed, true);
    assert.equal(result.completed, expectedCount); assert.equal(result.planned, expectedCount);
    assert.deepEqual(result.sourceIdentity, sourceIdentity);
    const admitted = [];
    for (const child of result.children) {
      const childPath = join(dirname(path), child.path); assert.equal(sha(childPath), child.sha256);
      const value = read(childPath); assert.equal(value.passed, true); admitted.push(value);
      if (expectedMode === 'controls') assert.equal(value.expectedControlObserved, true);
      bindings[childPath] = child.sha256;
    }
    if (expectedMode === 'controls') assert.deepEqual(admitted.map(child => child.fault).sort(), [...faults].sort());
    else assert.deepEqual(admitted.map(child => `${child.arm}:${child.kind}:${child.rows}`).sort(), arms.flatMap(arm => [`${arm}:timing:1000`, `${arm}:memory:1000`]).sort());
    bindings[path] = sha(path);
  }
}
verify();
const { chromium } = createRequire(join(plan.toolchainDirectory, 'package.json'))('playwright');
const schedule = [];
if (mode === 'controls') {
  for (const fault of faults) schedule.push({ arm: 'native', rows: 1000, round: 0, kind: 'control', fault });
} else for (const rows of mode === 'calibrate' ? [1000] : [1000, 10000]) {
  for (let round = 0; round < (mode === 'calibrate' ? 1 : 5); round++) {
    for (const arm of arms.map((_, i) => arms[(i + round) % arms.length])) for (const kind of ['timing', 'memory']) schedule.push({ arm, rows, round, kind });
    if (mode === 'compare' && round < 2) for (const member of [0, 1]) for (const kind of ['timing', 'memory']) schedule.push({ arm: 'v15', rows, round, kind, aa: true, member });
  }
}
save('schedule.json', { mode, createdUTC: new Date().toISOString(), bindings, historicalVersions: historical.versions, schedule, node: process.version, host: { platform: process.platform, arch: process.arch, cpu: os.cpus()[0]?.model } });
let directory;
const server = createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const path = resolve(directory, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!path.startsWith(directory + sep)) { res.writeHead(403).end(); return; }
  try { res.setHeader('Content-Type', path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : 'text/html'); res.end(readFileSync(path)); }
  catch { res.writeHead(404).end(); }
});
await new Promise((yes, no) => { server.once('error', no); server.listen(0, '127.0.0.1', yes); });
const url = `http://127.0.0.1:${server.address().port}`;
const results = [];
const contextIdentities = new Map();
const knownControlOracles = { 'context-truncated': 'context-content-oracle', 'context-corrupt': 'context-content-oracle', 'drop-write': 'pending-cardinality-oracle', 'drop-pending-record': 'pending-cardinality-oracle', 'stale-optimistic': 'optimistic-value-oracle', 'premature-dismissal': 'unresolved-dismissal-oracle', 'dismissal-loses-projection': 'unresolved-projection-oracle', 'duplicate-effect': 'effect-cardinality-oracle' };
async function child(sample, index) {
  const result = { ...sample, index, passed: false, stage: 'launch', errors: [], heap: [], hostStart: { load: os.loadavg(), freeBytes: os.freemem() } };
  let browser;
  try {
    directory = join(packet, sample.arm, 'dist/dispatch/browser');
    browser = await chromium.launch({ headless: true });
    result.browser = browser.version();
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on('pageerror', error => result.errors.push(String(error)));
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');
    const navigation = async () => {
      await page.goto(`${url}/?rows=${sample.rows}${sample.fault === 'drop-write' ? '&fault=drop-write' : ''}`);
      await page.waitForFunction(() => window.lab?.ready, undefined, { timeout: 30000 });
    };
    const heap = async name => {
      for (let i = 0; i < 3; i++) { await cdp.send('HeapProfiler.collectGarbage'); await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0))); }
      result.heap.push({ name, ...(await cdp.send('Runtime.getHeapUsage')) });
    };
    if (sample.kind === 'memory') await heap('blank');
    result.stage = 'navigation';
    await navigation();
    result.startup = await page.evaluate(() => ({ ...window.lab.timings }));
    if (sample.kind === 'memory') await heap('populated');
    result.stage = 'context';
    result.context = await page.evaluate(contextProbe, { rows: sample.rows, repetitions: sample.kind === 'memory' ? 0 : 20, fault: sample.fault });
    for (const value of Object.values(result.context)) {
      value.sha256 = createHash('sha256').update(value.json).digest('hex');
      value.canonicalSha256 = createHash('sha256').update(value.canonicalJson).digest('hex');
      const rows = JSON.parse(value.json);
      assert.equal(rows.length, value.rows);
      assert(rows.every((row, i) => row.id === `J-${i}`));
      const key = value.rows, identity = { canonicalSha256: value.canonicalSha256, bytes: value.bytes };
      if (contextIdentities.has(key)) assert.deepEqual(identity, contextIdentities.get(key), 'Cross-arm context content/size differs');
      else contextIdentities.set(key, identity);
      delete value.json; delete value.canonicalJson;
    }
    if (sample.kind === 'memory') await heap('after-contexts-dropped');
    result.pressure = [];
    for (const count of sample.kind === 'control' ? [8] : [8, 32, 128]) {
      result.stage = `pending-${count}`;
      await navigation();
      if (sample.kind === 'memory') await heap(`populated-${count}`);
      const prefix = `pressure-${count}`;
      const staged = await page.evaluate(pressureStage, { count, prefix, fault: sample.fault });
      if (sample.kind === 'memory') await heap(`pending-${count}`);
      result.stage = `settled-${count}`;
      const settled = await page.evaluate(pressureSettle, { count, prefix, before: staged.before, fault: sample.fault });
      result.pressure.push({ staged, settled });
      if (sample.kind === 'memory') await heap(`settled-${count}`);
    }
    if (sample.kind !== 'memory') {
      result.stage = 'interleaved';
      await navigation();
      const before = await cdp.send('Performance.getMetrics');
      result.interleaved = await page.evaluate(interleavedProbe, { fault: sample.fault });
      const after = await cdp.send('Performance.getMetrics');
      result.browserDurationSeconds = Object.fromEntries(['TaskDuration', 'ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration'].map(name => [name, after.metrics.find(m => m.name === name).value - before.metrics.find(m => m.name === name).value]));
      assert.equal(result.interleaved.checkedCommands, 180);
      assert.equal(result.interleaved.visibility, 'visible');
      if (sample.fault === 'busy-main-thread') {
        const maximum = Math.max(...result.interleaved.frameGapsMs, ...result.interleaved.user.map(value => value.enqueueToHandlerMs));
        assert(maximum >= 60, 'busy-thread telemetry control did not observe the injected80ms work');
        result.expectedControlObserved = true;
      }
    }
    result.stage = 'destroy';
    await page.evaluate(() => window.lab.destroy());
    if (sample.kind === 'memory') await heap('destroyed');
    assert.deepEqual(result.errors, []);
    assert(!knownControlOracles[sample.fault], 'Expected planted defect was not rejected');
    result.passed = true;
  } catch (error) {
    result.failure = String(error.stack ?? error);
    const expected = knownControlOracles[sample.fault];
    if (expected && result.failure.includes(expected)) { result.expectedControlObserved = true; result.passed = true; }
  } finally { if (browser) await browser.close(); }
  save(`child-${index}.json`, result);
  return result;
}
try {
  for (let index = 0; index < schedule.length; index++) {
    const result = await child(schedule[index], index); results.push(result);
    console.log(JSON.stringify({ index, ...schedule[index], passed: result.passed, stage: result.stage }));
    if (!result.passed) break; // Preserve first failure; do not run a partial cohort as a success.
  }
  verify();
  save('results.json', { mode, sourceIdentity, planned: schedule.length, completed: results.length, passed: results.length === schedule.length && results.every(result => result.passed), children: results.map(result => ({ index: result.index, path: `child-${result.index}.json`, sha256: sha(join(out, `child-${result.index}.json`)), passed: result.passed })) });
  if (results.length !== schedule.length || results.some(result => !result.passed)) process.exitCode = 1;
} finally { await new Promise(resolve => server.close(resolve)); }
