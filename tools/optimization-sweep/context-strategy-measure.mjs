#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { join, resolve, sep } from 'node:path';
import os from 'node:os';
import { admitPacket, admitRun, assertNewOutput, faults, hashText, save, scheduleFor, sha, verify } from './context-strategy-common.mjs';
import { contextStrategyAdvance, contextStrategyCheck, contextStrategyProbe } from './context-strategy-probe.mjs';
import { extractMetrics } from './context-strategy-analyze.mjs';
import { verifyExecution } from './context-strategy-execution.mjs';

const [mode, packetArg, outputArg, controlsArg, calibrationArg] = process.argv.slice(2);
assert(['controls', 'calibrate', 'compare'].includes(mode) && packetArg && outputArg);
const packet = resolve(packetArg), out = resolve(outputArg); assertNewOutput(out);
const admitted = admitPacket(packet), { plan, identity } = admitted;
const bindings = { ...admitted.bindings }, admissions = {};
if (mode !== 'controls') {
  assert(controlsArg, 'Calibration/comparison require exact controls');
  const path = resolve(controlsArg), receipt = admitRun(path, 'controls', identity);
  Object.assign(bindings, receipt.bindings); admissions.controls = path;
}
if (mode === 'compare') {
  assert(calibrationArg, 'Comparison requires exact calibration');
  const path = resolve(calibrationArg), receipt = admitRun(path, 'calibrate', identity, extractMetrics);
  Object.assign(bindings, receipt.bindings); admissions.calibration = path;
}
verify(bindings);
mkdirSync(out, { recursive: true });
const schedule = scheduleFor(mode), schedulePath = join(out, 'schedule.json');
save(schedulePath, { mode, createdUTC: new Date().toISOString(), identity, bindings, admissions, schedule, node: process.version, host: { platform: process.platform, arch: process.arch, cpu: os.cpus()[0]?.model }, limits: 'One fresh browser per child; each post-edit profile starts a new document. Five rotations are partially position-balanced. No browser process CPU claim.' });
const { chromium } = createRequire(join(plan.toolchainDirectory, 'package.json'))('playwright');
let directory;
const server = createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const path = resolve(directory, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!path.startsWith(directory + sep)) { response.writeHead(403).end(); return; }
  try { response.setHeader('Content-Type', path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : 'text/html'); response.end(readFileSync(path)); }
  catch { response.writeHead(404).end(); }
});
await new Promise((yes, no) => { server.once('error', no); server.listen(0, '127.0.0.1', yes); });
const url = `http://127.0.0.1:${server.address().port}`, children = [], contexts = new Map();
function bindContext(value, key, rows) {
  const values = JSON.parse(value.json); assert.equal(values.length, rows); assert.equal(value.rows, rows);
  assert(values.every((row, index) => row.id === `J-${index}`));
  value.sha256 = hashText(value.json); value.canonicalSha256 = hashText(value.canonicalJson);
  const content = { canonicalSha256: value.canonicalSha256, bytes: value.bytes };
  if (contexts.has(key)) assert.deepEqual(content, contexts.get(key), 'Cross-strategy/line context mismatch'); else contexts.set(key, content);
  delete value.json; delete value.canonicalJson;
}
async function child(sample, index) {
  verify(bindings);
  verifyExecution(identity.execution, false);
  const result = { sample, index, passed: false, stage: 'launch', errors: [], heap: [], contexts: {}, telemetry: {}, hostStart: { load: os.loadavg(), freeBytes: os.freemem() } };
  let browser;
  try {
    directory = join(packet, sample.arm, 'dist/dispatch/browser');
    browser = await chromium.launch({ headless: true, executablePath: identity.execution.browser.executable }); result.browser = browser.version();
    assert.equal(result.browser, identity.execution.browser.version, 'Launched browser version drift');
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on('pageerror', error => result.errors.push(String(error)));
    const cdp = await page.context().newCDPSession(page); await cdp.send('Performance.enable');
    const navigate = async () => {
      await page.goto(`${url}/?rows=${sample.rows}`);
      await page.waitForFunction(() => window.lab?.ready, undefined, { timeout: 30000 });
    };
    const heap = async name => {
      for (let cycle = 0; cycle < 3; cycle++) { await cdp.send('HeapProfiler.collectGarbage'); await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0))); }
      result.heap.push({ name, ...(await cdp.send('Runtime.getHeapUsage')) });
    };
    const readPhase = async (phase, repetitions, fault) => {
      const before = await cdp.send('Performance.getMetrics');
      const measured = await page.evaluate(contextStrategyProbe, { rows: sample.rows, strategy: sample.strategy, repetitions, phase, fault });
      const after = await cdp.send('Performance.getMetrics');
      result.telemetry[phase] = Object.fromEntries(['TaskDuration', 'ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration'].map(name => [name, after.metrics.find(metric => metric.name === name).value - before.metrics.find(metric => metric.name === name).value]));
      for (const [name, value] of Object.entries(measured)) bindContext(value, `${sample.rows}:${phase}:${name}`, name === 'selected' ? 50 : sample.rows);
      result.contexts[phase] = measured;
    };
    if (sample.kind === 'memory') await heap('blank');
    result.stage = 'initial'; await navigate();
    result.startup = await page.evaluate(() => ({ ...window.lab.timings }));
    if (sample.kind === 'control') {
      await readPhase('initial', 0, sample.fault);
      result.stage = 'conformance'; result.conformance = await page.evaluate(contextStrategyCheck, { strategy: sample.strategy, fault: sample.fault });
      assert.equal(result.conformance.passed, true); assert.equal(result.conformance.destroyed, true);
      assert.equal(sample.fault, null, 'Planted fault was not detected');
    } else {
      const repetitions = sample.kind === 'timing' ? 20 : 0;
      if (sample.kind === 'memory') await heap('initial.populated');
      await readPhase('initial', repetitions);
      if (sample.kind === 'memory') await heap('initial.afterDropped');
      result.stage = 'post-edit-navigation'; await navigate();
      if (sample.kind === 'memory') await heap('post.populated');
      // Prime only this fresh post-edit document; do not reuse timing results.
      const warm = await page.evaluate(contextStrategyProbe, { rows: sample.rows, strategy: sample.strategy, repetitions: 0 });
      for (const [name, value] of Object.entries(warm)) bindContext(value, `${sample.rows}:initial:${name}`, name === 'selected' ? 50 : sample.rows);
      result.warm = warm;
      if (sample.kind === 'memory') await heap('post.warmed');
      result.mutations = [];
      for (const phase of ['accepted', 'replacement']) {
        result.stage = phase;
        result.mutations.push(await page.evaluate(contextStrategyAdvance, { phase }));
        if (sample.kind === 'memory') await heap(`post.${phase}.beforeRead`);
        await readPhase(phase, repetitions);
        if (sample.kind === 'memory') await heap(`post.${phase}.afterRead`);
      }
      result.stage = 'destroy'; await page.evaluate(() => window.lab.destroy());
      if (sample.kind === 'memory') await heap('destroyed');
    }
    assert.deepEqual(result.errors, []); result.passed = true;
  } catch (error) {
    result.failure = String(error.stack ?? error);
    const expected = sample.kind === 'control' ? faults[sample.fault] : undefined;
    if (expected && result.failure.includes(expected) && result.errors.length === 0) { result.passed = true; result.expectedControlObserved = true; result.detectedOracle = expected; }
  } finally { if (browser) await browser.close(); }
  save(join(out, `child-${index}.json`), result); return result;
}
try {
  for (let index = 0; index < schedule.length; index++) {
    const result = await child(schedule[index], index); children.push(result);
    console.log(JSON.stringify({ index, ...schedule[index], passed: result.passed, stage: result.stage }));
    if (!result.passed) break;
  }
  verify(bindings);
  verifyExecution(identity.execution);
  const passed = children.length === schedule.length && children.every(child => child.passed);
  save(join(out, 'results.json'), { mode, identity, scheduleSha256: sha(schedulePath), planned: schedule.length, completed: children.length, passed, children: children.map(child => ({ index: child.index, path: `child-${child.index}.json`, sha256: sha(join(out, `child-${child.index}.json`)), passed: child.passed })) });
  if (!passed) process.exitCode = 1;
} finally { await new Promise(resolve => server.close(resolve)); }
