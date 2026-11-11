#!/usr/bin/env node
// Paired private-prototype diagnostic. Never changes an existing packet.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { buildIntegrity } from '../../scripts/publish-artifact-integrity.mjs';

const [baselineInput, prototypeInput, runnerInput, outputInput, roundsInput, measurementBaselineInput, activationsInput] =
  process.argv.slice(2);
assert.ok(
  baselineInput && prototypeInput && runnerInput && outputInput,
  'Pass BASELINE_BUNDLES PROTOTYPE_ROOT OPTIONAL_SEAM_RUNNER NEW_OUTPUT [ROUNDS] [MEASUREMENT_BASELINE_BUNDLES] [ACTIVATIONS]'
);
const baseline = resolve(baselineInput),
  prototype = resolve(prototypeInput),
  runner = resolve(runnerInput),
  output = resolve(outputInput);
const rounds = roundsInput === undefined ? 5 : Number(roundsInput);
assert.ok(Number.isInteger(rounds) && rounds > 0 && rounds <= 20);
assert.ok(!existsSync(output), 'Preserve previous attempts');
mkdirSync(output, { recursive: true });
const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const sha = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex');
const write = (path, value) =>
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const baselineReportPath = join(baseline, 'bundles.json'),
  baselineReport = read(baselineReportPath);
assert.equal(sha(runner), baselineReport.runnerSha256);
const originalPlan = read(baselineReport.planPath);
assert.equal(sha(baselineReport.planPath), baselineReport.planSha256);
const packet = join(output, 'prototype-packet');
mkdirSync(join(packet, 'archives'), { recursive: true });
const inputs = {
  ...originalPlan.inputs,
  [baselineReport.planPath]: baselineReport.planSha256,
};
function bindFiles(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) bindFiles(path);
    else if (entry.isFile()) inputs[path] = sha(path);
    else throw new Error('Unexpected artifact entry ' + path);
  }
}
const sourceDiff = execFileSync(
  'git',
  ['diff', 'HEAD', '--', 'packages/kernel/src'],
  { cwd: prototype, encoding: 'utf8' }
);
const patchPath = join(packet, 'tracked-source.patch');
writeFileSync(patchPath, sourceDiff, { flag: 'wx' });
inputs[patchPath] = sha(patchPath);
bindFiles(join(prototype, 'packages/kernel/src'));
bindFiles(join(prototype, 'dist/packages/kernel'));
const packed = JSON.parse(
  execFileSync(
    'npm',
    [
      'pack',
      '--json',
      '--ignore-scripts',
      '--cache',
      join(output, 'npm-cache'),
      '--pack-destination',
      join(packet, 'archives'),
    ],
    { cwd: join(prototype, 'dist/packages/kernel'), encoding: 'utf8' }
  )
)[0];
const variantArchive = join(packet, 'archives', packed.filename);
const oldArchive = originalPlan.artifacts['v15-kernel'].archive;
const copiedOldArchive = join(packet, 'archives', 'v15-kernel.tgz');
cpSync(oldArchive, copiedOldArchive);
const sourceSeal = buildIntegrity(prototype, ['kernel']);
const artifacts = {
  'v15-kernel': {
    ...originalPlan.artifacts['v15-kernel'],
    archive: copiedOldArchive,
  },
  'v16-kernel': {
    archive: variantArchive,
    integrity: packed.integrity,
    sourceSeal,
  },
};
for (const line of ['v15', 'v16']) {
  const directory = join(packet, line, 'node_modules/@signal-tree/kernel');
  mkdirSync(directory, { recursive: true });
  execFileSync('tar', [
    '-xzf',
    artifacts[line + '-kernel'].archive,
    '--strip-components=1',
    '-C',
    directory,
  ]);
  bindFiles(directory);
  inputs[artifacts[line + '-kernel'].archive] = sha(
    artifacts[line + '-kernel'].archive
  );
}
write(join(packet, 'plan.json'), {
  kind: 'private-egress-support-prototype',
  prototype,
  sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: prototype,
    encoding: 'utf8',
  }).trim(),
  sourceTrackedDiff: patchPath,
  sourceSealScope: ['kernel'],
  baselinePlanSha256: baselineReport.planSha256,
  artifacts,
  inputs,
  toolchainDirectory: originalPlan.toolchainDirectory,
});
const candidate = join(output, 'candidate-bundles');
const buildCommand = [runner, 'build', packet, candidate];
const build = spawnSync(process.execPath, buildCommand, { encoding: 'utf8' });
writeFileSync(
  join(output, 'bundle-build.log'),
  (build.stdout ?? '') + (build.stderr ?? ''),
  { flag: 'wx' }
);
write(join(output, 'bundle-build-receipt.json'), {
  command: [process.execPath, ...buildCommand],
  exit: build.status,
  signal: build.signal,
});
assert.equal(build.status, 0);
const reports = { baseline: measurementBaselineInput ? resolve(measurementBaselineInput) : baseline, indexed: candidate };
assert.equal(read(join(reports.baseline, "bundles.json")).runnerSha256, sha(runner));
const bindings = Object.fromEntries(
  Object.entries(reports).map(([arm, path]) => [
    arm,
    { path, sha256: sha(join(path, 'bundles.json')) },
  ])
);
const selectedActivations = activationsInput ? activationsInput.split(",") : ["no-link", "module-only", "active-link"];
assert.ok(selectedActivations.length && selectedActivations.every(value => ["no-link", "module-only", "active-link"].includes(value)));
const schedule = [];
for (const rows of [1000, 10000])
  for (let round = 0; round < rounds; round++) {
    const activations = round % 2 ? [...selectedActivations].reverse() : selectedActivations;
    for (const activation of activations)
      for (const arm of round % 2
        ? ['indexed', 'baseline']
        : ['baseline', 'indexed'])
        schedule.push({ arm, line: 'v16', rows, activation, round });
  }
write(join(output, 'schedule.json'), {
  createdUTC: new Date().toISOString(),
  command: [process.execPath, ...process.argv.slice(1)],
  runnerSha256: sha(runner),
  comparisonRunnerSha256: sha(process.argv[1]),
  bindings,
  schedule,
  limits:
    'Private kernel-only prototype, identical frozen optional-seam child and production bundler. No Angular or rendering; shared host, externally scheduled serial slot. Five fresh processes per cell, no discarded warm-up. Heap deltas after three job-separated GCs include runtime/JIT residual; no leak-free claim.',
});
const results = [];
for (let index = 0; index < schedule.length; index++) {
  const sample = schedule[index],
    resultPath = join(output, `${String(index).padStart(3, '0')}.json`);
  const command = [
    '--expose-gc',
    runner,
    'child',
    reports[sample.arm],
    resultPath,
    JSON.stringify(sample),
  ];
  const child = spawnSync(process.execPath, command, {
    encoding: 'utf8',
    timeout: 120000,
    env: { ...process.env, NODE_ENV: 'production' },
  });
  writeFileSync(
    resultPath + '.log',
    (child.stdout ?? '') + (child.stderr ?? ''),
    { flag: 'wx' }
  );
  const result = existsSync(resultPath) ? read(resultPath) : undefined;
  write(resultPath + '.receipt.json', {
    command: [process.execPath, ...command],
    exit: child.status,
    signal: child.signal,
    error: child.error ? String(child.error) : undefined,
    resultSha256: result ? sha(resultPath) : undefined,
  });
  if (result) results.push(result);
  console.log(
    index,
    sample.arm,
    sample.activation,
    sample.rows,
    result?.passed ? 'passed' : 'FAILED'
  );
  if (child.status !== 0 || !result?.passed) break;
}
const passed =
  results.length === schedule.length &&
  results.every((result) => result.passed);
write(join(output, 'results.json'), {
  passed,
  scheduleSha256: sha(join(output, 'schedule.json')),
  bindings,
  results,
});
if (!passed) process.exitCode = 1;
