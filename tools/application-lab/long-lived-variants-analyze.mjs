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
  resultsPath = join(input, 'results.json'),
  summaryPath = join(input, 'summary.json');
const schedule = read(schedulePath),
  results = read(resultsPath),
  summary = read(summaryPath);
assert.equal(results.passed, true);
assert.equal(summary.passed, true);
assert.equal(results.scheduleSha256, sha(schedulePath));
assert.equal(summary.resultsSha256, sha(resultsPath));
assert.equal(results.results.length, 40);
assert.equal(schedule.schedule.length, 40);
for (const [p, digest] of Object.entries(schedule.bindings))
  assert.equal(sha(p), digest, `Input: ${p}`);
const children = [];
for (const [index, sample] of schedule.schedule.entries()) {
  const receipt = read(join(input, `invocation-${index}.json`));
  assert.equal(receipt.exit, 0);
  assert.equal(receipt.signal, null);
  assert.equal(sha(receipt.resultPath), receipt.resultSha256);
  assert.equal(sha(receipt.resultPath + '.log'), receipt.logSha256);
  const child = read(receipt.resultPath);
  assert.deepEqual(child, results.results[index]);
  assert.equal(child.passed, true);
  for (const [k, v] of Object.entries(sample)) assert.equal(child[k], v);
  let cumulative = 0;
  for (const stage of child.stages) {
    cumulative += stage.elapsedMs;
    assert.equal(stage.cumulativeMs, cumulative);
  }
  children.push(child);
}
assert.equal(new Set(children.map((c) => c.pid)).size, 40);
const median = (values) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const stats = (values) => ({
  median: median(values),
  min: Math.min(...values),
  max: Math.max(...values),
  values,
});
for (const group of summary.groups) {
  const base = children
    .filter(
      (c) =>
        c.rows === group.rows &&
        c.fields === group.fields &&
        c.variant === 'baseline'
    )
    .sort((a, b) => a.round - b.round);
  const cand = children
    .filter(
      (c) =>
        c.rows === group.rows &&
        c.fields === group.fields &&
        c.variant === 'candidate'
    )
    .sort((a, b) => a.round - b.round);
  assert.equal(base.length, 5);
  assert.equal(cand.length, 5);
  assert.deepEqual(
    base.map((c) => c.round),
    [0, 1, 2, 3, 4]
  );
  assert.deepEqual(
    cand.map((c) => c.round),
    [0, 1, 2, 3, 4]
  );
  for (const name of Object.keys(group.stages)) {
    const a = base.map((c) => c.stages.find((s) => s.name === name).elapsedMs),
      b = cand.map((c) => c.stages.find((s) => s.name === name).elapsedMs);
    assert.deepEqual(group.stages[name], {
      baseline: stats(a),
      candidate: stats(b),
      pairedRatios: stats(b.map((v, i) => v / a[i])),
    });
  }
  for (const name of Object.keys(group.heapBytes))
    assert.deepEqual(group.heapBytes[name], {
      baseline: stats(base.map((c) => c.heapBytes[name])),
      candidate: stats(cand.map((c) => c.heapBytes[name])),
      pairedDelta: stats(
        cand.map((c, i) => c.heapBytes[name] - base[i].heapBytes[name])
      ),
    });
}
writeFileSync(
  output,
  JSON.stringify(
    {
      passed: true,
      childCount: 40,
      verified: [
        'source and artifact bindings',
        'raw child receipts and schedule',
        'distinct processes',
        'every per-child cumulative sum',
        'every summary value and paired ratio',
      ],
      source: {
        schedulePath,
        scheduleSha256: sha(schedulePath),
        resultsPath,
        resultsSha256: sha(resultsPath),
        summaryPath,
        summarySha256: sha(summaryPath),
      },
      command: [process.execPath, ...process.argv.slice(1)],
    },
    null,
    2
  ) + '\n',
  { flag: 'wx' }
);
console.log('Verified40pairedchildrenandallsummaryvalues.');
