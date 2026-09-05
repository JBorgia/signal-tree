#!/usr/bin/env node
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { MB, quiesce, requireExposeGc } from './lib/heap-quiescence.mjs';

requireExposeGc('tools/bench-angular-leaf-memory-worker.mjs');

const argument = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
};
const consumerRoot = argument('--consumer-root', '');
const mode = argument('--mode', 'location');
const leafCount = Number(argument('--leaves', 10_000));
const observedCount = Number(argument('--observed', 0));
if (!consumerRoot) throw new Error('Provide --consumer-root');
if (!Number.isSafeInteger(leafCount) || leafCount < 1) {
  throw new Error('--leaves must be a positive integer');
}
if (
  !Number.isSafeInteger(observedCount) ||
  observedCount < 0 ||
  observedCount > leafCount
) {
  throw new Error('--observed must be between zero and --leaves');
}

const require = createRequire(join(consumerRoot, 'package.json'));
const facade = await import(pathToFileURL(require.resolve('@signal-tree/angular')).href);
const signalTree = facade.signalTree;
if (typeof signalTree !== 'function') {
  throw new Error('The requested SignalTree factory is unavailable');
}

const state = (count) =>
  Object.fromEntries(
    Array.from({ length: count }, (_, index) => [`value${index}`, index])
  );

const createHeld = (count, observed) => {
  const tree = signalTree(state(count));
  const native = [];
  for (let index = 0; index < observed; index++) {
    const location = tree.$[`value${index}`];
    if (mode === 'bridge') native.push(facade.toWritableSignal(location));
    else location();
  }
  return { tree, native };
};

{
  const warmup = createHeld(Math.min(1_000, leafCount), Math.min(100, observedCount));
  warmup.tree.destroy();
}
await quiesce({ label: 'Angular leaf memory warmup' });

const before = (await quiesce({ label: 'Angular leaf memory baseline' })).heapUsed;
let held = createHeld(leafCount, observedCount);
const treeRef = new WeakRef(held.tree);
const leafRef = new WeakRef(held.tree.$.value0);
const nativeRef = held.native[0] ? new WeakRef(held.native[0]) : undefined;
const after = (await quiesce({ label: 'Angular leaf memory retained' })).heapUsed;
const retainedBytes = after - before;

held.tree.destroy();
held = undefined;
await quiesce({ label: 'Angular leaf memory released' });

console.log(
  JSON.stringify({
    consumerRoot,
    mode,
    leafCount,
    observedCount,
    retainedBytes,
    retainedMB: +(retainedBytes / MB).toFixed(3),
    bytesPerLeaf: Math.round(retainedBytes / leafCount),
    collectable: {
      tree: treeRef.deref() === undefined,
      leaf: leafRef.deref() === undefined,
      native: nativeRef ? nativeRef.deref() === undefined : null,
    },
  })
);
