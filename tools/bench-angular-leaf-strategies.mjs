#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Worker } from 'node:worker_threads';

const argument = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
};

const sourceArgument = (name) => {
  const value = argument(name, '');
  if (!value || value.startsWith('--') || !/\bsha256:[a-f\d]{64}\b/.test(value)) {
    throw new Error(`Provide ${name} with a full SHA-256 digest`);
  }
  return value;
};

const positiveInteger = (name, fallback) => {
  const value = Number(argument(name, fallback));
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
};

const positiveEvenInteger = (name, fallback) => {
  const value = positiveInteger(name, fallback);
  if (value % 2 !== 0) throw new Error(`${name} must be even`);
  return value;
};

const validModes = new Set([
  'historical-native',
  'production-native',
  'current-location',
  'native-projection',
  'effect-wrapper',
  'native-bridge',
]);
const mode = (name, fallback) => {
  const value = argument(name, fallback);
  if (!validModes.has(value)) throw new Error(`${name} has an unknown mode`);
  return value;
};

const arms = {
  a: {
    label: argument('--a-label', 'historical native Angular leaf'),
    consumerRoot: argument('--a-root', ''),
    mode: mode('--a-mode', 'historical-native'),
    source: sourceArgument('--a-source'),
  },
  b: {
    label: argument('--b-label', 'current Angular location'),
    consumerRoot: argument('--b-root', ''),
    mode: mode('--b-mode', 'current-location'),
    source: sourceArgument('--b-source'),
  },
};
if (!arms.a.consumerRoot || !arms.b.consumerRoot) {
  throw new Error('Provide --a-root and --b-root consumer directories');
}

const config = {
  samples: positiveEvenInteger('--samples', 30),
  warmups: positiveInteger('--warmups', 5),
  trials: positiveInteger('--trials', 5),
  readIterations: positiveInteger('--read-iterations', 1_000_000),
  writeIterations: positiveInteger('--write-iterations', 100_000),
  fanoutIterations: positiveInteger('--fanout-iterations', 2_000),
  fanout: positiveInteger('--fanout', 100),
  forceGc: process.argv.includes('--force-gc'),
};
if (config.forceGc && typeof global.gc !== 'function') {
  throw new Error('--force-gc requires node --expose-gc');
}

const requestedOperations = new Set(
  argument('--only', '')
    .split(',')
    .filter(Boolean)
);
const operations = [
  { id: 'scalar-read', iterations: config.readIterations },
  { id: 'scalar-replace', iterations: config.writeIterations },
  { id: 'scalar-derive', iterations: config.writeIterations },
  { id: 'angular-fanout', key: 'angular-fanout-1', iterations: config.fanoutIterations, fanout: 1 },
  { id: 'angular-fanout', key: 'angular-fanout-10', iterations: config.fanoutIterations, fanout: 10 },
  { id: 'angular-fanout', key: 'angular-fanout-100', iterations: config.fanoutIterations, fanout: 100 },
  { id: 'angular-chain', key: 'angular-chain-10', iterations: config.fanoutIterations, fanout: 10 },
  { id: 'angular-diamond', key: 'angular-diamond', iterations: config.fanoutIterations },
  { id: 'construction', iterations: 500, leafCount: 10 },
  { id: 'construction', iterations: 100, leafCount: 100 },
  { id: 'construction', iterations: 10, leafCount: 1_000 },
].map((operation) => ({
  ...operation,
  key: operation.key ?? (operation.leafCount
    ? `construction-${operation.leafCount}`
    : operation.id),
})).filter(
  (operation) => requestedOperations.size === 0 || requestedOperations.has(operation.key)
);
if (operations.length === 0) throw new Error('--only matched no operations');

const spawn = (arm) =>
  new Worker(new URL('./bench-angular-leaf-strategies-worker.mjs', import.meta.url), {
    workerData: {
      consumerRoot: resolve(arm.consumerRoot),
      label: arm.label,
      mode: arm.mode,
    },
  });

const ask = (worker, message) =>
  new Promise((resolveResult, reject) => {
    const onMessage = (result) => {
      worker.off('error', onError);
      if (result.ok) resolveResult(result);
      else reject(new Error(result.error));
    };
    const onError = (error) => {
      worker.off('message', onMessage);
      reject(error);
    };
    worker.once('message', onMessage);
    worker.once('error', onError);
    worker.postMessage(message);
  });

const median = (values) => {
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? (ordered[middle - 1] + ordered[middle]) / 2
    : ordered[middle];
};
const quantile = (values, probability) => {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * probability))];
};
const round = (value) => Number(value.toFixed(3));

const samples = Object.fromEntries(
  operations.map((operation) => [
    operation.key,
    { a: [], b: [], pairedDeltaPct: [], workerAssignment: [] },
  ])
);
let sink = 0;

const runOperation = async (worker, operation) => {
  const result = await ask(worker, {
    operation: operation.id,
    iterations: operation.iterations,
    trials: config.trials,
    fanout: operation.fanout ?? 0,
    leafCount: operation.leafCount ?? 0,
    forceGc: config.forceGc && operation.id === 'construction',
  });
  sink += result.sink;
  return result.value;
};

const createWorkerSets = () => {
  const forward = {
    slots: { first: spawn(arms.a), second: spawn(arms.b) },
    assignment: 'A:first,B:second',
  };
  const reverse = {
    slots: { first: spawn(arms.b), second: spawn(arms.a) },
    assignment: 'A:second,B:first',
  };
  forward.logical = { a: forward.slots.first, b: forward.slots.second };
  reverse.logical = { a: reverse.slots.second, b: reverse.slots.first };
  return { forward, reverse };
};

const runPair = async (workerSet, operation, roundIndex, record) => {
  const aFirst = roundIndex % 2 === 0;
  const first = aFirst ? workerSet.logical.a : workerSet.logical.b;
  const second = aFirst ? workerSet.logical.b : workerSet.logical.a;
  const firstValue = await runOperation(first, operation);
  const secondValue = await runOperation(second, operation);
  if (!record) return;
  const aValue = aFirst ? firstValue : secondValue;
  const bValue = aFirst ? secondValue : firstValue;
  const result = samples[operation.key];
  result.a.push(aValue);
  result.b.push(bValue);
  result.pairedDeltaPct.push(((bValue - aValue) / aValue) * 100);
  result.workerAssignment.push(workerSet.assignment);
};

for (const operation of operations) {
  const workerSets = createWorkerSets();
  for (let warmup = 0; warmup < config.warmups; warmup++) {
    for (const workerSet of warmup % 2 === 0
      ? [workerSets.forward, workerSets.reverse]
      : [workerSets.reverse, workerSets.forward]) {
      await runPair(workerSet, operation, warmup, false);
    }
  }
  for (let sample = 0; sample < config.samples; sample++) {
    await runPair(
      sample % 2 === 0 ? workerSets.forward : workerSets.reverse,
      operation,
      sample,
      true
    );
  }
  await Promise.all(
    Object.values(workerSets).flatMap((set) => [
      set.slots.first.terminate(),
      set.slots.second.terminate(),
    ])
  );
}

const results = operations.map((operation) => {
  const values = samples[operation.key];
  const aMedian = median(values.a);
  const bMedian = median(values.b);
  return {
    operation: operation.key,
    aNs: round(aMedian),
    bNs: round(bMedian),
    ratio: round(bMedian / aMedian),
    pairedDeltaPct: {
      median: round(median(values.pairedDeltaPct)),
      p10: round(quantile(values.pairedDeltaPct, 0.1)),
      p90: round(quantile(values.pairedDeltaPct, 0.9)),
    },
    samples: {
      aNs: values.a.map(round),
      bNs: values.b.map(round),
      pairedDeltaPct: values.pairedDeltaPct.map(round),
      workerAssignment: values.workerAssignment,
    },
  };
});

const output = {
  schemaVersion: 1,
  method: 'operation-isolated-mirrored-workers-angular-v2',
  runtime: { node: process.version, platform: process.platform, architecture: process.arch },
  config,
  arms,
  results,
  sink,
};

const outputPath = argument('--output');
if (outputPath) writeFileSync(resolve(outputPath), `${JSON.stringify(output, null, 2)}\n`);

const typescriptOutputPath = argument('--typescript-output');
if (typescriptOutputPath) {
  const exportName = argument('--export-name', 'ANGULAR_LEAF_BENCHMARK');
  if (!/^[A-Z][A-Z0-9_]*$/.test(exportName)) {
    throw new Error('--export-name must be an uppercase TypeScript identifier');
  }
  writeFileSync(
    resolve(typescriptOutputPath),
    `// Generated by tools/bench-angular-leaf-strategies.mjs. Do not edit.\n` +
      `export const ${exportName} = ${JSON.stringify(output, null, 2)} as const;\n`
  );
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(output, null, 2));
} else {
  console.log(`${output.method}; ${config.samples} paired samples after ${config.warmups} warmups`);
  console.log(`A: ${arms.a.label} (${arms.a.mode})`);
  console.log(`B: ${arms.b.label} (${arms.b.mode})\n`);
  console.log(
    `${'operation'.padEnd(24)}${'A ns'.padStart(14)}${'B ns'.padStart(14)}` +
      `${'B/A'.padStart(10)}${'paired delta'.padStart(16)}`
  );
  for (const result of results) {
    console.log(
      `${result.operation.padEnd(24)}` +
        `${result.aNs.toFixed(2).padStart(14)}` +
        `${result.bNs.toFixed(2).padStart(14)}` +
        `${result.ratio.toFixed(3).padStart(10)}` +
        `${`${result.pairedDeltaPct.median.toFixed(2)}%`.padStart(16)}`
    );
  }
}
