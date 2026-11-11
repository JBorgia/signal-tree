#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const input = resolve(process.argv[2]),
  path = join(input, 'results.json');
const raw = JSON.parse(readFileSync(path, 'utf8'));
assert.equal(raw.passed, true);
const sha = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex');
const distribution = (values) => {
  const sorted = [...values].sort((a, b) => a - b),
    middle = sorted.length >> 1;
  return {
    median:
      sorted.length % 2
        ? sorted[middle]
        : (sorted[middle - 1] + sorted[middle]) / 2,
    min: sorted[0],
    max: sorted.at(-1),
    all: values,
  };
};
const groups = [];
for (const rows of [1000, 10000])
  for (const activation of new Set(raw.results.map(value => value.activation))) {
    const arms = {},
      records = {};
    for (const arm of ['baseline', 'indexed']) {
      const values = (records[arm] = raw.results.filter(
        (value) =>
          value.rows === rows &&
          value.activation === activation &&
          value.arm === arm
      ));
      assert.ok(values.length);
      arms[arm] = {
        populationMs: distribution(
          values.map(
            (value) =>
              value.stages.populationIncludingInputCopies.elapsedNanoseconds /
              1e6
          )
        ),
        populationCpuMs: distribution(
          values.map(
            (value) =>
              (value.stages.populationIncludingInputCopies.cpuMicroseconds
                .user +
                value.stages.populationIncludingInputCopies.cpuMicroseconds
                  .system) /
              1000
          )
        ),
        point200Ms: distribution(
          values.map(
            (value) =>
              value.stages.pointEdits200Distinct.elapsedNanoseconds / 1e6
          )
        ),
        ...Object.fromEntries(
          ['populated', 'edited', 'destroyed'].map((stage) => [
            stage + 'MiB',
            distribution(
              values.map(
                (value) =>
                  (value.heapBytes[stage] - value.heapBytes.before) /
                  1024 /
                  1024
              )
            ),
          ])
        ),
      };
    }
    assert.equal(records.baseline.length, records.indexed.length);
    const pairs = records.baseline.map((baseline) => {
      const indexed = records.indexed.find(
        (value) => value.round === baseline.round
      );
      assert.ok(indexed);
      return {
        round: baseline.round,
        populationRatio:
          indexed.stages.populationIncludingInputCopies.elapsedNanoseconds /
          baseline.stages.populationIncludingInputCopies.elapsedNanoseconds,
        pointRatio:
          indexed.stages.pointEdits200Distinct.elapsedNanoseconds /
          baseline.stages.pointEdits200Distinct.elapsedNanoseconds,
        heapMiBDifference:
          (indexed.heapBytes.populated -
            indexed.heapBytes.before -
            (baseline.heapBytes.populated - baseline.heapBytes.before)) /
          1024 /
          1024,
      };
    });
    groups.push({ rows, activation, arms, pairs });
  }
const summary = {
  passed: raw.passed,
  source: path,
  sourceSha256: sha(path),
  command: [process.execPath, ...process.argv.slice(1)],
  generatorSha256: sha(process.argv[1]),
  groups,
};
writeFileSync(
  join(input, 'summary.json'),
  JSON.stringify(summary, null, 2) + '\n',
  { flag: 'wx' }
);
console.log(
  JSON.stringify(
    groups.map((group) => ({
      rows: group.rows,
      activation: group.activation,
      baseline: Object.fromEntries(
        Object.entries(group.arms.baseline).map(([key, value]) => [
          key,
          value.median,
        ])
      ),
      indexed: Object.fromEntries(
        Object.entries(group.arms.indexed).map(([key, value]) => [
          key,
          value.median,
        ])
      ),
      pairs: group.pairs,
    })),
    null,
    2
  )
);
