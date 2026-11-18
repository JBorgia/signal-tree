#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { errorInfo, inventory, read, save, sha, verifySlim } from './common.mjs';

const [packetPath, outputPath, sampleText] = process.argv.slice(2);
const packet = read(packetPath), sample = JSON.parse(sampleText), work = outputPath + '.work';
const result = { pid: process.pid, sample, executionSha256: packet.execution.sha256, passed: false, cleanupErrors: [], limits: 'Functional evidence only; old coordination timers and GC are not comparison metrics.' };
try {
  assert.equal(sha(packet.execution.path), packet.execution.sha256);
  verifySlim(packet.execution.path);
  const source = packet.old[sample.suite];
  assert.equal(sha(source), packet.bindings[source], 'Unchanged reused runner');
  let args;
  if (sample.suite === 'coordination') args = [sample.fault ? 'fault' : 'child', packet.views[sample.arm], work + '.json', JSON.stringify({ rows: sample.rows, episodes: sample.episodes, round: 0 }), packet.allPackages[sample.arm].kernel.root];
  else args = [packet.configs[sample.arm], work, ...(sample.fault ? ['--control=' + sample.fault] : [])];
  process.argv = [process.execPath, source, ...args];
  await import(pathToFileURL(source));
  const code = process.exitCode ?? 0;
  result.originalExitCode = code;
  if (sample.suite === 'coordination') {
    const raw = read(work + '.json'); result.raw = { path: work + '.json', sha256: sha(work + '.json') };
    assert.equal(raw.pid, process.pid);
    if (sample.fault) {
      assert.equal(code, 1); assert.equal(raw.passed, false);
      const sourceText = readFileSync(source, 'utf8');
      const assertionLine = sourceText.slice(0, sourceText.indexOf('assert.deepEqual(sent, []);')).split('\n').length;
      assert(raw.error.includes(`${source}:${assertionLine}:`), 'Fault must reach the existing early-delivery assertion');
      assert.match(raw.error, /\+\s+1001/); result.controlDetected = true;
    } else {
      assert.equal(code, 0); assert.equal(raw.passed, true);
      assert.deepEqual(raw.sample, { rows: 1000, episodes: 20, round: 0 });
      for (const name of ['declared-dependent-and-independent', 'transaction-rejection-and-refusal', 'retirement-and-late-reader', 'pre-enrollment-history', 'automatic-refusal-recovery'])
        assert.equal(raw.phases[name]?.count, 20, `Missing useful episodes: ${name}`);
      for (const name of ['setup', 'pending-open', 'pending-drain']) assert.equal(raw.phases[name]?.count, 1);
      assert(raw.checkpoints.some(item => item.stage === 'settled-128'));
      assert.equal(raw.checkpoints.at(-1).stage, 'destroyed');
    }
  } else {
    assert.equal(code, 0);
    const manifestPath = join(work, 'manifest.json'), manifest = read(manifestPath);
    const browserPath = join(work, 'browser-results.json'), browser = read(browserPath);
    result.raw = { path: manifestPath, sha256: sha(manifestPath), browserPath, browserSha256: sha(browserPath) };
    assert(!Object.hasOwn(manifest, 'error'));
    assert.equal(manifest.chromium, packet.browserExecution.browser.version, 'Actual browser version must match frozen selected browser');
    assert(manifest.commands.length > 0 && manifest.commands.every(item => item.exit === 0));
    for (const name of ['kernel', 'angular']) assert.deepEqual(inventory(join(work, 'consumer/node_modules/@signal-tree', name)), packet.allPackages[sample.arm][name].files, 'Installed payload equality, including the older public runner');
    if (sample.suite === 'http') {
      assert.equal(manifest.complete, true); assert.equal(browser.passed, true);
      assert(browser.results.every(item => item.serverClosed === true));
      if (sample.fault) { assert.equal(browser.results.length, 1); assert.equal(browser.controlDetected, true); }
      else { assert.equal(browser.results.length, 12); assert(browser.results.every(item => item.outcome === 'PASS')); }
    } else {
      assert.equal(browser.results.length, 15); assert(browser.results.every(item => item.outcome === 'PASS'));
      assert.deepEqual(browser.pageErrors, []);
      const log = readFileSync(join(work, 'logs/coordinator-protocol-http.log'), 'utf8');
      assert.match(log, /(?:#|ℹ) tests 62\b/); assert.match(log, /(?:#|ℹ) pass 62\b/); assert.match(log, /(?:#|ℹ) fail 0\b/);
    }
    result.caseCount = browser.results.length;
  }
  verifySlim(packet.execution.path);
  process.exitCode = 0; result.passed = true;
} catch (error) { result.error = errorInfo(error); process.exitCode = 1; }
save(outputPath, result);
