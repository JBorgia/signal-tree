#!/usr/bin/env node
/**
 * Compare the pre-callable scalar location API with the current callable API.
 *
 * Each production artifact runs in an isolated persistent worker. Samples are
 * paired, call order alternates, operation order rotates, and artifact-to-worker
 * assignment is mirrored across the sample set to cancel worker-slot bias.
 * Every measured fixture is destroyed after its postcondition is checked.
 *
 *   pnpm nx build kernel
 *   node tools/bench-callable-locations.mjs \
 *     --a /tmp/signaltree-callable-baseline/kernel/dist/index.js \
 *     --b dist/packages/kernel/dist/index.js
 *
 * Use identical paths and syntax values for an A/A protocol-noise control.
 */
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
  if (value % 2 !== 0) {
    throw new Error(`${name} must be even for mirrored worker assignment`);
  }
  return value;
};

const syntax = (name, fallback) => {
  const value = argument(name, fallback);
  if (value !== 'methods' && value !== 'callable') {
    throw new Error(`${name} must be methods or callable`);
  }
  return value;
};

const aInputPath = argument('--a', '');
const bInputPath = argument('--b', 'dist/packages/kernel/dist/index.js');
if (!aInputPath) {
  throw new Error('Provide the pre-change artifact with --a <dist/index.js>');
}

const config = {
  samples: positiveEvenInteger('--samples', 30),
  warmups: positiveInteger('--warmups', 5),
  trialsPerArm: positiveInteger('--trials', 5),
  readIterations: positiveInteger('--read-iterations', 1_000_000),
  writeIterations: positiveInteger('--write-iterations', 100_000),
  constructionIterations: positiveInteger('--construction-iterations', 500),
  forceGcBeforeConstruction: process.argv.includes('--force-gc'),
  mirroredWorkerAssignment: true,
};
if (config.forceGcBeforeConstruction && typeof global.gc !== 'function') {
  throw new Error('--force-gc requires node --expose-gc');
}

const arms = {
  a: {
    label: argument('--a-label', 'pre-callable methods'),
    path: aInputPath,
    source: sourceArgument('--a-source'),
    syntax: syntax('--a-syntax', 'methods'),
  },
  b: {
    label: argument('--b-label', 'callable locations'),
    path: bInputPath,
    source: sourceArgument('--b-source'),
    syntax: syntax('--b-syntax', 'callable'),
  },
};

const spawn = (arm) =>
  new Worker(new URL('./bench-callable-locations-worker.mjs', import.meta.url), {
    workerData: {
      artifactPath: resolve(arm.path),
      label: arm.label,
      syntax: arm.syntax,
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
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
};

const quantile = (values, probability) => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * probability))];
};

const summarize = (values) => {
  const center = median(values);
  return {
    medianNsPerOperation: center,
    madNsPerOperation: median(
      values.map((value) => Math.abs(value - center))
    ),
    p10NsPerOperation: quantile(values, 0.1),
    p90NsPerOperation: quantile(values, 0.9),
  };
};

let sink = 0;

const operations = [
  { id: 'scalar-read', iterations: config.readIterations },
  { id: 'scalar-replace', iterations: config.writeIterations },
  { id: 'scalar-derive', iterations: config.writeIterations },
  { id: 'tree-construction', iterations: config.constructionIterations },
];

const runOperation = async (worker, operation) => {
  const result = await ask(worker, {
    operation: operation.id,
    iterations: operation.iterations,
    trials: config.trialsPerArm,
    forceGcBeforeConstruction: config.forceGcBeforeConstruction,
  });
  sink += result.sink;
  return result.value;
};

const workerSets = {
  forward: {
    slots: { first: spawn(arms.a), second: spawn(arms.b) },
    assignment: 'A:first,B:second',
  },
  reverse: {
    slots: { first: spawn(arms.b), second: spawn(arms.a) },
    assignment: 'A:second,B:first',
  },
};
workerSets.forward.logical = {
  a: workerSets.forward.slots.first,
  b: workerSets.forward.slots.second,
};
workerSets.reverse.logical = {
  a: workerSets.reverse.slots.second,
  b: workerSets.reverse.slots.first,
};

const samples = Object.fromEntries(
  operations.map((operation) => [
    operation.id,
    { a: [], b: [], pairedDeltaPct: [], workerAssignment: [] },
  ])
);

const runRound = async (workerSet, round, record) => {
  const offset = round % operations.length;
  const orderedOperations = [
    ...operations.slice(offset),
    ...operations.slice(0, offset),
  ];

  for (let operationIndex = 0; operationIndex < orderedOperations.length; operationIndex++) {
    const operation = orderedOperations[operationIndex];
    const canonicalOperationIndex = operations.indexOf(operation);
    const aFirst = (round + canonicalOperationIndex) % 2 === 0;
    const first = aFirst ? workerSet.logical.a : workerSet.logical.b;
    const second = aFirst ? workerSet.logical.b : workerSet.logical.a;
    const firstValue = await runOperation(first, operation);
    const secondValue = await runOperation(second, operation);
    const aValue = aFirst ? firstValue : secondValue;
    const bValue = aFirst ? secondValue : firstValue;

    if (record) {
      const result = samples[operation.id];
      result.a.push(aValue);
      result.b.push(bValue);
      result.pairedDeltaPct.push(((bValue - aValue) / aValue) * 100);
      result.workerAssignment.push(workerSet.assignment);
    }
  }
};

for (let warmup = 0; warmup < config.warmups; warmup++) {
  const order =
    warmup % 2 === 0
      ? [workerSets.forward, workerSets.reverse]
      : [workerSets.reverse, workerSets.forward];
  for (const workerSet of order) await runRound(workerSet, warmup, false);
}

for (let sample = 0; sample < config.samples; sample++) {
  const workerSet =
    sample % 2 === 0 ? workerSets.forward : workerSets.reverse;
  await runRound(workerSet, sample, true);
}

await Promise.all(
  Object.values(workerSets).flatMap((workerSet) => [
    workerSet.slots.first.terminate(),
    workerSet.slots.second.terminate(),
  ])
);

const round = (value) => Number(value.toFixed(3));
const results = operations.map((operation) => {
  const operationSamples = samples[operation.id];
  const aSummary = summarize(operationSamples.a);
  const bSummary = summarize(operationSamples.b);
  return {
    operation: operation.id,
    iterationsPerSample: operation.iterations,
    a: Object.fromEntries(
      Object.entries(aSummary).map(([key, value]) => [key, round(value)])
    ),
    b: Object.fromEntries(
      Object.entries(bSummary).map(([key, value]) => [key, round(value)])
    ),
    bOverARatio: round(
      bSummary.medianNsPerOperation / aSummary.medianNsPerOperation
    ),
    pairedDeltaPct: {
      median: round(median(operationSamples.pairedDeltaPct)),
      p10: round(quantile(operationSamples.pairedDeltaPct, 0.1)),
      p90: round(quantile(operationSamples.pairedDeltaPct, 0.9)),
    },
    samples: {
      aNsPerOperation: operationSamples.a.map(round),
      bNsPerOperation: operationSamples.b.map(round),
      pairedDeltaPct: operationSamples.pairedDeltaPct.map(round),
      workerAssignment: operationSamples.workerAssignment,
    },
  };
});

const output = {
  schemaVersion: 1,
  method: 'mirrored-workers-paired-alternating-v4',
  runtime: {
    node: process.version,
    platform: process.platform,
    architecture: process.arch,
  },
  config,
  arms: {
    a: arms.a,
    b: arms.b,
  },
  results,
  sink,
};

const outputPath = argument('--output');
if (outputPath) {
  writeFileSync(resolve(outputPath), `${JSON.stringify(output, null, 2)}\n`);
}

const typescriptOutputPath = argument('--typescript-output');
if (typescriptOutputPath) {
  const exportName = argument(
    '--export-name',
    'CALLABLE_LOCATION_BENCHMARK'
  );
  if (!/^[A-Z][A-Z0-9_]*$/.test(exportName)) {
    throw new Error('--export-name must be an uppercase TypeScript identifier');
  }
  writeFileSync(
    resolve(typescriptOutputPath),
    `// Generated by tools/bench-callable-locations.mjs. Do not edit.\n` +
      `export const ${exportName} = ${JSON.stringify(output, null, 2)} as const;\n`
  );
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(output, null, 2));
} else {
  console.log(
    `${output.method}; ${config.samples} paired samples after ${config.warmups} warmups`
  );
  console.log(`A: ${arms.a.label} (${arms.a.syntax})`);
  console.log(`B: ${arms.b.label} (${arms.b.syntax})\n`);
  console.log(
    `${'operation'.padEnd(20)}${'A ns/op'.padStart(14)}${'B ns/op'.padStart(14)}${'B/A'.padStart(10)}${'paired delta'.padStart(16)}`
  );
  for (const result of results) {
    console.log(
      `${result.operation.padEnd(20)}` +
        `${result.a.medianNsPerOperation.toFixed(2).padStart(14)}` +
        `${result.b.medianNsPerOperation.toFixed(2).padStart(14)}` +
        `${result.bOverARatio.toFixed(3).padStart(10)}` +
        `${`${result.pairedDeltaPct.median.toFixed(2)}%`.padStart(16)}`
    );
  }
}
