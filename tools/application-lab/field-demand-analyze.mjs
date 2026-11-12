#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
const [inputArg, outputArg] = process.argv.slice(2);
assert.ok(inputArg && outputArg);
const input = resolve(inputArg),
  output = resolve(outputArg);
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const schedulePath = join(input, 'schedule.json'),
  resultsPath = join(input, 'results.json');
const schedule = read(schedulePath),
  aggregate = read(resultsPath);
assert.equal(schedule.mode, 'compare');
assert.equal(aggregate.passed, true);
assert.equal(aggregate.scheduleSha256, sha(schedulePath));
assert.equal(schedule.schedule.length, 80);
assert.equal(aggregate.results.length, 80);
for (const [p, digest] of Object.entries(schedule.bindings))
  assert.equal(sha(p), digest, `Input ${p}`);
const children = [];
for (const [index, sample] of schedule.schedule.entries()) {
  const receipt = read(join(input, `invocation-${index}.json`));
  assert.equal(receipt.exit, 0);
  assert.equal(receipt.signal, null);
  assert.equal(sha(receipt.resultPath), receipt.resultSha256);
  assert.equal(sha(receipt.resultPath + '.log'), receipt.logSha256);
  const child = read(receipt.resultPath);
  assert.deepEqual(child, aggregate.results[index]);
  assert.equal(child.passed, true);
  for (const [k, v] of Object.entries(sample)) assert.equal(child[k], v);
  if (sample.arm.startsWith('v'))
    assert.equal(
      child.counts.enumerableFieldGetters,
      200 * (sample.fields + 1)
    );
  assert.equal(child.counts.firstAcquiredFields, 200);
  assert.equal(child.counts.allAcquiredFields, 200 * sample.fields);
  assert.equal(child.counts.uniqueAcquiredFields, 200 * sample.fields);
  children.push(child);
}
assert.equal(new Set(children.map((c) => c.pid)).size, 80);
const stats = (values) => ({
  median: [...values].sort((a, b) => a - b)[2],
  min: Math.min(...values),
  max: Math.max(...values),
  values,
});
const groups = [];
for (const rows of [1000, 10000])
  for (const fields of [8, 32])
    for (const arm of ['native', 'ngrx', 'v15', 'v16']) {
      const samples = children.filter(
        (c) => c.rows === rows && c.fields === fields && c.arm === arm
      );
      assert.equal(samples.length, 5);
      assert.deepEqual(samples.map((c) => c.round).sort(), [0, 1, 2, 3, 4]);
      const stages = Object.keys(samples[0].heapBytes),
        heapBytes = {},
        transitions = {};
      for (const [nameIndex, name] of stages.entries()) {
        heapBytes[name] = stats(samples.map((s) => s.heapBytes[name]));
        if (nameIndex > 0) {
          const before = stages[nameIndex - 1];
          transitions[`${before}->${name}`] = stats(
            samples.map((s) => s.heapBytes[name] - s.heapBytes[before])
          );
        }
      }
      groups.push({
        rows,
        fields,
        arm,
        counts: samples[0].counts,
        heapBytes,
        transitions,
      });
    }
writeFileSync(
  output,
  JSON.stringify(
    {
      passed: true,
      childCount: 80,
      limits: aggregate.limits,
      source: {
        schedulePath,
        scheduleSha256: sha(schedulePath),
        resultsPath,
        resultsSha256: sha(resultsPath),
      },
      command: [process.execPath, ...process.argv.slice(1)],
      groups,
    },
    null,
    2
  ) + '\n',
  { flag: 'wx' }
);
console.log(
  'Verified 80 field-demand children, source bindings, counts and checkpoint transitions.'
);
