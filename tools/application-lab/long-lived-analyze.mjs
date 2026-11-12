#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
const [inputArg, outArg] = process.argv.slice(2);
assert.ok(inputArg && outArg);
const input = resolve(inputArg),
  output = resolve(outArg);
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const schedulePath = join(input, 'schedule.json'),
  aggregatePath = join(input, 'results.json');
const schedule = read(schedulePath),
  aggregate = read(aggregatePath);
assert.equal(
  schedule.mode,
  'compare',
  'Do not pool pilots/controls into comparisons'
);
assert.equal(aggregate.passed, true);
assert.equal(aggregate.scheduleSha256, sha(schedulePath));
assert.equal(aggregate.results.length, schedule.schedule.length);
for (const [p, digest] of Object.entries(schedule.bindings))
  assert.equal(sha(p), digest, `Input binding: ${p}`);
const samples = [];
for (const [index, expected] of schedule.schedule.entries()) {
  const receipt = read(join(input, `invocation-${index}.json`));
  assert.equal(receipt.exit, 0);
  assert.equal(receipt.signal, null);
  assert.equal(receipt.resultSha256, sha(receipt.resultPath));
  assert.equal(receipt.logSha256, sha(receipt.resultPath + '.log'));
  const child = read(receipt.resultPath);
  for (const [k, v] of Object.entries(expected))
    assert.equal(child[k], v, `${index}/${k}`);
  assert.deepEqual(child, aggregate.results[index]);
  assert.equal(child.passed, true);
  let sum = 0;
  for (const stage of child.stages) {
    assert.ok(Number.isFinite(stage.elapsedMs) && stage.elapsedMs >= 0);
    sum += stage.elapsedMs;
    assert.equal(stage.cumulativeMs, sum);
  }
  samples.push(child);
}
assert.equal(
  new Set(samples.map((s) => s.pid)).size,
  samples.length,
  'Distinct child processes required'
);
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length % 2
    ? sorted[Math.floor(sorted.length / 2)]
    : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
};
const distribution = (values) => ({
  count: values.length,
  median: median(values),
  min: Math.min(...values),
  max: Math.max(...values),
  values,
});
const groups = [];
for (const rows of [1000, 10000])
  for (const fields of [8, 32])
    for (const arm of ['native', 'ngrx', 'v15', 'v16']) {
      const children = samples.filter(
        (s) =>
          s.rows === rows &&
          s.fields === fields &&
          s.arm === arm &&
          s.repeat === 0
      );
      assert.equal(children.length, 5);
      assert.equal(new Set(children.map((s) => s.round)).size, 5);
      const stages = {};
      for (const stage of children[0].stages)
        stages[stage.name] = {
          elapsedMs: distribution(
            children.map(
              (c) => c.stages.find((s) => s.name === stage.name).elapsedMs
            )
          ),
          cumulativeMs: distribution(
            children.map(
              (c) => c.stages.find((s) => s.name === stage.name).cumulativeMs
            )
          ),
          operations: stage.operations,
        };
      const heapBytes = {};
      for (const name of Object.keys(children[0].heapBytes))
        heapBytes[name] = distribution(children.map((c) => c.heapBytes[name]));
      const heapDeltas = {};
      for (const [name, after, before] of [
        ['populationPlusFirstRead', 'populated', 'fixtureBeforeStore'],
        ['sparseReaderDemand', 'sparseReaders', 'populated'],
        ['fiveThousandSparseEdits', 'sparse5000', 'sparseReaders'],
        ['wideReaderDemand', 'wideReaders', 'afterRetirement'],
        ['afterDestroyMinusFixture', 'afterDestroy', 'fixtureBeforeStore'],
      ])
        heapDeltas[name] = distribution(
          children.map((c) => c.heapBytes[after] - c.heapBytes[before])
        );
      groups.push({ rows, fields, arm, stages, heapBytes, heapDeltas });
    }
const aa = [];
for (const rows of [1000, 10000])
  for (const fields of [8, 32]) {
    const pairs = [];
    for (let round = 0; round < 5; round++) {
      const a = samples.find(
        (s) =>
          s.arm === 'v15' &&
          s.rows === rows &&
          s.fields === fields &&
          s.round === round &&
          s.repeat === 0
      );
      const b = samples.find(
        (s) =>
          s.arm === 'v15' &&
          s.rows === rows &&
          s.fields === fields &&
          s.round === round &&
          s.repeat === 1
      );
      assert.ok(a && b);
      const ratios = {};
      for (const stage of a.stages)
        ratios[stage.name] =
          stage.elapsedMs === 0
            ? null
            : b.stages.find((s) => s.name === stage.name).elapsedMs /
              stage.elapsedMs;
      pairs.push({ round, ratios });
    }
    aa.push({ rows, fields, pairs });
  }
writeFileSync(
  output,
  JSON.stringify(
    {
      passed: true,
      command: [process.execPath, ...process.argv.slice(1)],
      source: {
        schedulePath,
        scheduleSha256: sha(schedulePath),
        aggregatePath,
        aggregateSha256: sha(aggregatePath),
      },
      limits: aggregate.limits,
      childCount: samples.length,
      groups,
      aa,
    },
    null,
    2
  ) + '\n',
  { flag: 'wx' }
);
console.log(
  `${samples.length} children verified; ${groups.length} profile/arm groups; A/A pairs kept separate.`
);
