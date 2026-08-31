#!/usr/bin/env node
/**
 * ROOT-READ-COST-0: isolate the cost of the public root-read spelling.
 *
 * Compares equivalent cached reads from the current build and the last
 * pre-retirement checkpoint. The historical artifact is supplied explicitly so
 * this tool never mistakes the current build for its own control.
 *
 *   pnpm nx build kernel
 *   node tools/bench-root-read-cost.mjs --historical /path/to/e243a569/index.js
 */
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

import { signalTree } from '../dist/packages/kernel/dist/index.js';
import { readCanonicalSnapshotInternal } from '../dist/packages/kernel/dist/lib/internals/canonical-snapshot.js';

const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};

const historicalPath = argument('--historical');
if (!historicalPath) {
  console.error('ROOT-READ-COST-0 requires --historical <e243a569 index.js>.');
  process.exit(1);
}

const historicalModule = await import(pathToFileURL(resolve(historicalPath)).href);
const historicalSignalTree = historicalModule.signalTree;
if (typeof historicalSignalTree !== 'function') {
  throw new Error('Historical artifact does not export signalTree().');
}

const ITERATIONS = Number(argument('--iterations') ?? 1_000_000);
const SAMPLES = Number(argument('--samples') ?? 15);
const WARMUP_SAMPLES = 3;

const grid = (rows = 60, columns = 60) => {
  const state = {};
  for (let row = 0; row < rows; row++) {
    const branch = {};
    for (let column = 0; column < columns; column++) {
      branch[`c${column}`] = row * columns + column;
    }
    state[`r${row}`] = branch;
  }
  return state;
};

const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
};

const mad = (values) => {
  const center = median(values);
  return median(values.map((value) => Math.abs(value - center)));
};

const currentTree = signalTree(grid());
const historicalTree = historicalSignalTree(grid());
currentTree.$();
historicalTree();

let sink = 0;
const arms = [
  {
    id: 'A',
    label: 'canonical cached materialization',
    read: () => readCanonicalSnapshotInternal(currentTree),
  },
  {
    id: 'B',
    label: 'current tree.$() cached read',
    read: () => currentTree.$(),
  },
  {
    id: 'C',
    label: 'e243a569 tree() cached read',
    read: () => historicalTree(),
  },
];

const measurements = new Map(arms.map((arm) => [arm.id, []]));
const run = (arm) => {
  const started = process.hrtime.bigint();
  for (let iteration = 0; iteration < ITERATIONS; iteration++) {
    sink += arm.read().r0.c0;
  }
  return Number(process.hrtime.bigint() - started) / ITERATIONS;
};

for (let sample = -WARMUP_SAMPLES; sample < SAMPLES; sample++) {
  const offset = ((sample % arms.length) + arms.length) % arms.length;
  const ordered = [...arms.slice(offset), ...arms.slice(0, offset)];
  for (const arm of ordered) {
    const nsPerCall = run(arm);
    if (sample >= 0) measurements.get(arm.id).push(nsPerCall);
  }
}

const result = Object.fromEntries(
  arms.map((arm) => {
    const values = measurements.get(arm.id);
    return [arm.id, {
      label: arm.label,
      medianNsPerCall: median(values),
      madNsPerCall: mad(values),
    }];
  })
);

result.currentAccessorOverCanonicalNs =
  result.B.medianNsPerCall - result.A.medianNsPerCall;
result.currentAccessorOverHistoricalNs =
  result.B.medianNsPerCall - result.C.medianNsPerCall;
result.currentAccessorVsHistoricalRatio =
  result.B.medianNsPerCall / result.C.medianNsPerCall;

console.log(JSON.stringify({
  checkpoint: 'e243a569',
  iterations: ITERATIONS,
  samples: SAMPLES,
  result,
  sink,
}, null, 2));

currentTree.destroy();
historicalTree.destroy();
