import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runWorkload } from './workload.mjs';

const [manifestArg, outputArg] = process.argv.slice(2);
const manifestPath = resolve(manifestArg), output = resolve(outputArg);
assert(!existsSync(output));
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
for (const [file, hash] of Object.entries(manifest.files)) assert.equal(sha(resolve(manifest.root, file)), hash);
const api = await import(pathToFileURL(resolve(manifest.root, 'dist/index.js')).href);
const sample = { kind: 'cpu', profile: { id: 'cleanup-control', shape: 'entity', trees: 1, rows: 2, width: 2, enhancer: 'none', link: 'absent', history: 1 } };
const positive = {};
await runWorkload(api, sample, positive);
assert.equal(positive.oracles.destroyed, 1);
const records = [{ name: 'positive', destroyed: positive.oracles.destroyed }];
for (const primaryFailure of [false, true]) {
  const cleanup = new Error('planted-cleanup-failure');
  let calls = 0, thrown;
  const wrapped = { ...api, signalTree(...args) {
    const tree = api.signalTree(...args);
    return Object.create(tree, { destroy: { value() {
      calls++; tree.destroy();
      if (calls >= (primaryFailure ? 1 : 2)) throw cleanup;
    } } });
  } };
  const result = {};
  try { await runWorkload(wrapped, { ...sample, ...(primaryFailure ? { fault: 'drop-population' } : {}) }, result); }
  catch (error) { thrown = error; }
  assert.match(result.cleanupError, /planted-cleanup-failure/);
  if (primaryFailure) {
    assert.notEqual(thrown, cleanup);
    assert.match(thrown.message, /population-count-oracle/);
    assert.equal(calls, 1);
  } else {
    assert.equal(thrown, cleanup);
    assert.equal(calls, 2);
  }
  records.push({ name: primaryFailure ? 'first-failure-preserved' : 'cleanup-failure-rejected', calls, thrown: thrown.message, cleanupError: result.cleanupError });
}
writeFileSync(output, JSON.stringify({ command: process.argv, runnerSha256: sha(new URL(import.meta.url)), workloadSha256: sha(new URL('./workload.mjs', import.meta.url)), manifest: manifestPath, manifestSha256: sha(manifestPath), records, passed: true, limits: 'Behavioral cleanup controls, not performance measurements.' }, null, 2) + '\n');
console.log('Positive work, cleanup failure rejection and first-failure preservation passed.');
