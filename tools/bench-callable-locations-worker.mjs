#!/usr/bin/env node
import { parentPort, workerData } from 'node:worker_threads';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { artifactPath, label, syntax } = workerData;
const module = await import(pathToFileURL(resolve(artifactPath)).href);
if (typeof module.signalTree !== 'function') {
  throw new Error(`${artifactPath} does not export signalTree()`);
}

const signalTree = module.signalTree;

const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
};

const createScalarHarness = () => {
  const tree = signalTree({ count: 0 });
  const location = tree.$.count;
  if (typeof location !== 'function') {
    tree.destroy();
    throw new Error(`${label} did not create a callable scalar location`);
  }
  if (
    syntax === 'methods' &&
    (typeof location.set !== 'function' || typeof location.update !== 'function')
  ) {
    tree.destroy();
    throw new Error(`${label} does not expose method-shaped writes`);
  }
  if (
    syntax === 'callable' &&
    (typeof location.set === 'function' || typeof location.update === 'function')
  ) {
    tree.destroy();
    throw new Error(`${label} unexpectedly exposes method-shaped writes`);
  }
  return { tree, location };
};

const timeScalar = (operation, iterations) => {
  const { tree, location } = createScalarHarness();
  const replace =
    syntax === 'methods'
      ? (value) => location.set(value)
      : (value) => location(value);
  const derive =
    syntax === 'methods'
      ? (update) => location.update(update)
      : (update) => location(update);
  const toggle = (value) => (value === 0 ? 1 : 0);
  let resultSink = 0;

  const started = process.hrtime.bigint();
  if (operation === 'scalar-read') {
    for (let index = 0; index < iterations; index++) resultSink += location();
  } else if (operation === 'scalar-replace') {
    let next = 1;
    for (let index = 0; index < iterations; index++) {
      replace(next);
      next = toggle(next);
    }
  } else if (operation === 'scalar-derive') {
    for (let index = 0; index < iterations; index++) derive(toggle);
  } else {
    tree.destroy();
    throw new Error(`Unknown scalar operation: ${operation}`);
  }
  const elapsed = process.hrtime.bigint() - started;

  const expected = iterations % 2 === 0 ? 0 : 1;
  if (operation !== 'scalar-read' && location() !== expected) {
    tree.destroy();
    throw new Error(`${label} ${operation} postcondition failed`);
  }
  resultSink += location();
  tree.destroy();
  return { value: Number(elapsed) / iterations, sink: resultSink };
};

const timeConstruction = (iterations, forceGc) => {
  if (forceGc) global.gc();
  const trees = [];
  const started = process.hrtime.bigint();
  for (let index = 0; index < iterations; index++) {
    trees.push(
      signalTree({
        count: index,
        profile: { name: 'Ada', active: true },
        tags: [],
      })
    );
  }
  const elapsed = process.hrtime.bigint() - started;

  const last = trees[iterations - 1];
  if (trees.length !== iterations || last.$.count() !== iterations - 1) {
    for (const tree of trees) tree.destroy();
    throw new Error(`${label} construction postcondition failed`);
  }
  const resultSink = last.$.count();
  for (const tree of trees) tree.destroy();
  return { value: Number(elapsed) / iterations, sink: resultSink };
};

const run = ({ operation, iterations, trials, forceGcBeforeConstruction }) => {
  const values = [];
  let resultSink = 0;
  for (let trial = 0; trial < trials; trial++) {
    const result =
      operation === 'tree-construction'
        ? timeConstruction(iterations, forceGcBeforeConstruction)
        : timeScalar(operation, iterations);
    values.push(result.value);
    resultSink += result.sink;
  }
  return { value: median(values), sink: resultSink };
};

parentPort.on('message', (message) => {
  try {
    parentPort.postMessage({ ok: true, ...run(message) });
  } catch (error) {
    parentPort.postMessage({
      ok: false,
      error: error instanceof Error ? error.stack ?? error.message : String(error),
    });
  }
});
