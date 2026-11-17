#!/usr/bin/env node
// Validate the adopted keyed context strategy before timing any application.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contextStrategyCheck, contextCheckNames } from './context-probe.mjs';
import { verifyExecution } from '../context-strategy-execution.mjs';

const [packetArg, outArg] = process.argv.slice(2); assert(packetArg && outArg);
const packet = resolve(packetArg), out = resolve(outArg), runner = fileURLToPath(import.meta.url);
assert(!existsSync(out)); mkdirSync(out, { recursive: true });
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const save = (name, value) => writeFileSync(join(out, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const planPath = join(packet, 'plan.json'), buildPath = join(packet, 'dispatch-build.json'), conformancePath = join(packet, 'dispatch-conformance/results.json');
const plan = read(planPath), build = read(buildPath), conformance = read(conformancePath);
assert.equal(build.planSha256, sha(planPath)); assert.equal(conformance.planSha256, sha(planPath)); assert.equal(conformance.buildSha256, sha(buildPath));
assert.equal(conformance.results.length, 88); assert(conformance.results.every(result => result.passed));
assert.equal(plan.optimizationComparison.schema, 1); const execution = plan.optimizationComparison.execution;
verifyExecution(execution);
const faults = { 'context-truncated': 'context-content-oracle', 'context-corrupt': 'context-content-oracle', 'context-stale-cache': 'context-pending-oracle', 'context-bypass-projection': 'context-pending-oracle', 'context-stale-instance': 'context-instance-oracle' };
// The conformance probe exercises stale cache/projection/instance directly;
// truncation/corruption are separately proved by the common metric controls.
const arms = ['native', 'ngrx', 'v15-before', 'v15', 'v16-before', 'v16', 'tanstack', 'tanstack-variant'];
assert.deepEqual([...plan.arms].sort(), [...arms].sort());
assert.deepEqual(Object.keys(plan.optimizationComparison.contextStrategies).sort(), [...arms].sort());
assert.equal(plan.optimizationComparison.peerBulkContext.receiptSha256, 'fdb12664e01e4a2cc604cfaae96a664d0eff0ba5e488faa0550c69558fb94e39');
const schedule = arms.flatMap(arm => [null, 'context-stale-cache', 'context-bypass-projection', 'context-stale-instance'].map(fault => ({ arm, fault })));
const bindings = { ...plan.inputs, [planPath]: sha(planPath), [buildPath]: sha(buildPath), [conformancePath]: sha(conformancePath), [runner]: sha(runner) };
for (const path of [join(dirname(runner), 'context-probe.mjs'), resolve(dirname(runner), '../context-strategy-execution.mjs')]) bindings[path] = sha(path);
for (const arm of Object.values(build.arms)) Object.assign(bindings, arm.dependencies, arm.served);
const verify = () => { for (const [path, expected] of Object.entries(bindings)) assert.equal(sha(path), expected, `Input drift: ${path}`); };
verify(); save('schedule.json', { schedule, bindings });
const { chromium } = createRequire(join(plan.toolchainDirectory, 'package.json'))('playwright');
let directory;
const server = createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname, path = resolve(directory, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!path.startsWith(directory + sep)) { res.writeHead(403).end(); return; }
  try { res.setHeader('Content-Type', path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : 'text/html'); res.end(readFileSync(path)); } catch { res.writeHead(404).end(); }
});
const results = [];
try {
  await new Promise((yes, no) => { server.once('error', no); server.listen(0, '127.0.0.1', yes); });
  for (const [index, sample] of schedule.entries()) {
    let browser; const result = { sample, passed: false, errors: [] };
    try {
      directory = join(packet, sample.arm, 'dist/dispatch/browser'); browser = await chromium.launch({ headless: true, executablePath: execution.browser.executable });
      assert.equal(browser.version(), execution.browser.version);
      const page = await browser.newPage(); page.on('pageerror', error => result.errors.push(String(error)));
      await page.goto(`http://127.0.0.1:${server.address().port}/?rows=1000`); await page.waitForFunction(() => window.lab?.ready);
      try { result.conformance = await page.evaluate(contextStrategyCheck, { strategy: 'bulk', fault: sample.fault }); }
      catch (error) { if (!sample.fault || !String(error).includes(faults[sample.fault])) throw error; result.detectedOracle = faults[sample.fault]; }
      if (sample.fault) assert.equal(result.detectedOracle, faults[sample.fault]);
      else { assert.equal(result.conformance?.destroyed, true); assert.deepEqual(result.conformance.checks, contextCheckNames); }
      assert.deepEqual(result.errors, []); result.passed = true;
    } catch (error) { result.error = String(error?.stack ?? error); }
    finally { try { await browser?.close(); } catch (error) { result.cleanupError = String(error); result.passed = false; } }
    save(`child-${index}.json`, result); results.push({ index, sample, path: `child-${index}.json`, sha256: sha(join(out, `child-${index}.json`)), passed: result.passed });
    if (!result.passed) break;
  }
} finally { if (server.listening) await new Promise(resolve => server.close(resolve)); }
verify(); verifyExecution(execution);
const passed = results.length === schedule.length && results.every(result => result.passed);
save('results.json', { passed, planSha256: sha(planPath), buildSha256: sha(buildPath), scheduleSha256: sha(join(out, 'schedule.json')), results });
assert(passed, 'Context controls failed; preserve first failure');
