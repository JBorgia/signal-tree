import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
const [buildArg, checksArg, measuresArg, outArg] = process.argv.slice(2);
assert(
  buildArg && checksArg && measuresArg && outArg,
  'summarize.mjs BUILD CHECKS MEASUREMENTS EXISTING_OUTPUT'
);
const hash = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex');
const build = JSON.parse(readFileSync(buildArg)),
  checks = JSON.parse(readFileSync(checksArg));
const measurements = JSON.parse(readFileSync(measuresArg));
assert(build.complete && checks.passed && measurements.passed);
for (const run of [checks, measurements])
  assert.equal(run.bindings[resolve(buildArg)], hash(buildArg));
assert.equal(checks.results.length, 5);
assert.equal(measurements.results.length, 68);
function distribution(values) {
  assert(values.length && values.every(Number.isFinite));
  const sorted = [...values].sort((a, b) => a - b),
    n = sorted.length;
  return {
    median:
      n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2,
    min: sorted[0],
    max: sorted.at(-1),
    samples: values,
  };
}
const average = (values) => values.reduce((a, b) => a + b, 0) / values.length;
const summary = [];
for (const size of [1000, 10000])
  for (const arm of Object.keys(build.arms)) {
    const cpu = measurements.results.filter(
      (r) => r.arm === arm && r.size === size && r.kind === 'cpu' && !r.control
    );
    const heap = measurements.results.filter(
      (r) => r.arm === arm && r.size === size && r.kind === 'heap' && !r.control
    );
    assert.equal(cpu.length, 3);
    assert.equal(heap.length, 3);
    for (const row of cpu) {
      assert(row.checked);
      assert.equal(row.sparse.length, 100);
      assert.equal(row.bulk.length, 10);
      assert.equal(row.driver.length, 10);
      assert.equal(row.lifecycle.length, 50);
    }
    assert(heap.every((row) => row.retainedEditors === 0));
    summary.push({
      arm,
      size,
      cpu: Object.fromEntries([
        ...['constructionMs', 'readyMs', 'destroyMs'].map((key) => [
          key,
          distribution(cpu.map((row) => row[key])),
        ]),
        ...['sparse', 'bulk', 'driver', 'lifecycle'].map((key) => [
          key + 'MeanMs',
          distribution(cpu.map((row) => average(row[key]))),
        ]),
        ['firstEditorMs', distribution(cpu.map((row) => row.lifecycle[0]))],
      ]),
      heap: Object.fromEntries(
        ['populated', 'pending', 'closed', 'destroyed'].map((key) => [
          key + 'DeltaBytes',
          distribution(heap.map((row) => row[key] - row.baseline)),
        ])
      ),
      thirtyEditorDeltaBytes: distribution(
        heap.map((row) => row.pending - row.populated)
      ),
    });
  }
const evidence = {
  schema: 'signaltree.adoption-workflow.v1',
  command: process.argv.slice(0, 2),
  manifests: {
    build: hash(buildArg),
    checks: hash(checksArg),
    measurements: hash(measuresArg),
  },
  node: build.node,
  angular: build.angular,
  typescript: build.typescript,
  browser: measurements.browser,
  artifacts: Object.fromEntries(
    Object.entries(build.arms).map(([name, arm]) => [
      name,
      {
        bytes: arm.bytes,
        gzip: arm.gzip,
        emitted: arm.emitted,
        packageLockSha256: arm.packageLockSha256,
        sources: Object.fromEntries(
          Object.entries(arm.installed).map(([name, pkg]) => [name, pkg.source])
        ),
      },
    ])
  ),
  sourceSnapshot: build.source,
  host: measurements.host,
  summaries: summary,
  raw: measurements.results,
  checks: checks.results.map(({ arm, checks, controls }) => ({
    arm,
    checks,
    controls,
  })),
  limits: measurements.limits,
};
writeFileSync(
  join(resolve(outArg), 'RESULTS.json'),
  JSON.stringify(evidence, null, 2) + '\n',
  { flag: 'wx' }
);
console.log(
  JSON.stringify({ summaries: summary, artifacts: evidence.artifacts }, null, 2)
);
