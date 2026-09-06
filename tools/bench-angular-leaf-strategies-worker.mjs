#!/usr/bin/env node
import { createRequire } from 'node:module';
import { parentPort, workerData } from 'node:worker_threads';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const { consumerRoot, label, mode } = workerData;
const require = createRequire(join(consumerRoot, 'package.json'));
const facade = await import(pathToFileURL(require.resolve('@signal-tree/angular')).href);
const angular = await import(pathToFileURL(require.resolve('@angular/core')).href);
const signalTree = facade.signalTree;
if (typeof signalTree !== 'function') {
  throw new Error(`${label} does not export the requested SignalTree factory`);
}

const median = (values) => {
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? (ordered[middle - 1] + ordered[middle]) / 2
    : ordered[middle];
};

const createEffectFreeProjection = (location) => {
  const value = angular.signal(location.peek());
  const publish = value.set.bind(value);
  const release = location.subscribe(() => publish(location.peek()));
  value.set = (next) => location(next);
  value.update = (update) => location(update);
  return { value, release };
};

const createLeafHarness = () => {
  const tree = signalTree({ count: 0 });
  const location = tree.$.count;
  let leaf = location;
  let release = () => undefined;

  if (mode === 'native-projection') {
    const projection = createEffectFreeProjection(location);
    leaf = projection.value;
    release = projection.release;
  } else if (mode === 'effect-wrapper') {
    const warn = console.warn;
    console.warn = () => undefined;
    try {
      leaf = facade.toWritableSignal(location);
    } finally {
      console.warn = warn;
    }
  } else if (mode === 'native-bridge') {
    leaf = facade.toWritableSignal(location);
  }

  const methods =
    mode === 'historical-native' ||
    mode === 'production-native' ||
    mode === 'native-projection' ||
    mode === 'effect-wrapper' ||
    mode === 'native-bridge';
  if (methods !== (typeof leaf.set === 'function' && typeof leaf.update === 'function')) {
    release();
    tree.destroy();
    throw new Error(`${label} exposed an unexpected leaf write surface`);
  }
  if (mode !== 'current-location' && !angular.isSignal(leaf)) {
    release();
    tree.destroy();
    throw new Error(`${label} did not expose a native Angular signal`);
  }

  return {
    tree,
    leaf,
    read: () => leaf(),
    replace: methods ? (value) => leaf.set(value) : (value) => leaf(value),
    derive: methods ? (update) => leaf.update(update) : (update) => leaf(update),
    destroy: () => {
      release();
      tree.destroy();
    },
  };
};

const timeScalar = (operation, iterations, fanout) => {
  const harness = createLeafHarness();
  const toggle = (value) => (value === 0 ? 1 : 0);
  let sink = 0;
  let dependents = [];

  if (operation === 'angular-fanout') {
    dependents = Array.from({ length: fanout }, (_, index) =>
      angular.computed(() => harness.read() + index)
    );
    for (const dependent of dependents) sink += dependent();
  } else if (operation === 'angular-chain') {
    let current = angular.computed(() => harness.read());
    for (let index = 0; index < fanout; index++) {
      const previous = current;
      current = angular.computed(() => previous() + 1);
    }
    dependents = [current];
    sink += current();
  } else if (operation === 'angular-diamond') {
    const left = angular.computed(() => harness.read() + 1);
    const right = angular.computed(() => harness.read() + 2);
    const joined = angular.computed(() => left() + right());
    dependents = [joined];
    sink += joined();
  }

  const started = process.hrtime.bigint();
  if (operation === 'scalar-read') {
    for (let index = 0; index < iterations; index++) sink += harness.read();
  } else if (operation === 'scalar-replace') {
    let next = 1;
    for (let index = 0; index < iterations; index++) {
      harness.replace(next);
      next = toggle(next);
    }
  } else if (operation === 'scalar-derive') {
    for (let index = 0; index < iterations; index++) harness.derive(toggle);
  } else if (operation === 'angular-fanout') {
    let next = 1;
    for (let index = 0; index < iterations; index++) {
      harness.replace(next);
      for (const dependent of dependents) sink += dependent();
      next = toggle(next);
    }
  } else if (operation === 'angular-chain' || operation === 'angular-diamond') {
    let next = 1;
    for (let index = 0; index < iterations; index++) {
      harness.replace(next);
      sink += dependents[0]();
      next = toggle(next);
    }
  } else {
    harness.destroy();
    throw new Error(`Unknown scalar operation: ${operation}`);
  }
  const elapsed = process.hrtime.bigint() - started;

  const expected = iterations % 2 === 0 ? 0 : 1;
  if (operation !== 'scalar-read' && harness.read() !== expected) {
    harness.destroy();
    throw new Error(`${label} ${operation} postcondition failed`);
  }
  sink += harness.read();
  harness.destroy();
  return { value: Number(elapsed) / iterations, sink };
};

const createState = (leafCount, seed) =>
  Object.fromEntries(
    Array.from({ length: leafCount }, (_, index) => [`value${index}`, seed + index])
  );

const timeConstruction = (iterations, leafCount, forceGc) => {
  if (forceGc) global.gc();
  const entries = [];
  const started = process.hrtime.bigint();
  for (let iteration = 0; iteration < iterations; iteration++) {
    const tree = signalTree(createState(leafCount, iteration));
    const releases = [];
    if (mode === 'native-projection') {
      for (let index = 0; index < leafCount; index++) {
        releases.push(createEffectFreeProjection(tree.$[`value${index}`]).release);
      }
    } else if (mode === 'effect-wrapper') {
      const warn = console.warn;
      console.warn = () => undefined;
      try {
        for (let index = 0; index < leafCount; index++) {
          facade.toWritableSignal(tree.$[`value${index}`]);
        }
      } finally {
        console.warn = warn;
      }
    }
    entries.push({ tree, releases });
  }
  const elapsed = process.hrtime.bigint() - started;

  const last = entries.at(-1)?.tree;
  if (!last || last.$[`value${leafCount - 1}`]() !== iterations - 1 + leafCount - 1) {
    for (const entry of entries) {
      for (const release of entry.releases) release();
      entry.tree.destroy();
    }
    throw new Error(`${label} construction postcondition failed`);
  }
  const sink = last.$[`value${leafCount - 1}`]();
  for (const entry of entries) {
    for (const release of entry.releases) release();
    entry.tree.destroy();
  }
  return { value: Number(elapsed) / iterations, sink };
};

const run = ({ operation, iterations, trials, fanout, leafCount, forceGc }) => {
  const values = [];
  let sink = 0;
  for (let trial = 0; trial < trials; trial++) {
    const result = operation === 'construction'
      ? timeConstruction(iterations, leafCount, forceGc)
      : timeScalar(operation, iterations, fanout);
    values.push(result.value);
    sink += result.sink;
  }
  return { value: median(values), sink };
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
