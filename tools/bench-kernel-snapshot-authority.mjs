import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

import {
  measureRetained,
  requireExposeGc,
} from './lib/heap-quiescence.mjs';

const kernelUrl = pathToFileURL(
  resolve('dist/packages/kernel/dist/index.js')
).href;
const { signalTree } = await import(kernelUrl);
const arm = process.argv.find((argument) => argument.startsWith('--arm='))?.slice(6);
const BRANCHES = 10_000;

const makeWideState = () => {
  const state = {};
  for (let index = 0; index < BRANCHES; index++) {
    state[`branch_${index}`] = { value: index };
  }
  return state;
};

const makeDeepState = (depth) => {
  let state = { value: 0 };
  for (let index = 0; index < depth; index++) state = { child: state };
  return state;
};

const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
};

const timeWrites = (build, writesPerSample, samples = 9) => {
  const values = [];
  for (let sample = 0; sample < samples; sample++) {
    const { write, read, destroy } = build();
    read();
    const start = process.hrtime.bigint();
    for (let index = 0; index < writesPerSample; index++) write(index);
    const elapsed = Number(process.hrtime.bigint() - start);
    values.push(elapsed / writesPerSample);
    destroy();
  }
  return median(values);
};

if (arm === 'unread' || arm === 'read') {
  requireExposeGc('bench-kernel-snapshot-authority');
  const result = await measureRetained(() => {
    const tree = signalTree(makeWideState());
    if (arm === 'read') void tree.$();
    return tree;
  }, { label: `KSA 10k ordinary branches ${arm}` });
  console.log(JSON.stringify({ arm, branches: BRANCHES, ...result }, null, 2));
} else if (arm === 'timing') {
  const shallowNs = timeWrites(() => {
    const tree = signalTree({ value: 0 });
    return {
      write: (value) => tree.$.value(value),
      read: () => tree.$(),
      destroy: () => tree.destroy(),
    };
  }, 100_000);

  const deepNs = timeWrites(() => {
    const tree = signalTree(makeDeepState(50));
    let leaf = tree.$;
    for (let depth = 0; depth < 50; depth++) leaf = leaf.child;
    return {
      write: (value) => leaf.value(value),
      read: () => tree.$(),
      destroy: () => tree.destroy(),
    };
  }, 100_000);

  const burstNs = timeWrites(() => {
    const tree = signalTree(makeDeepState(50));
    let leaf = tree.$;
    for (let depth = 0; depth < 50; depth++) leaf = leaf.child;
    let writes = 0;
    return {
      write: (value) => {
        leaf.value(value);
        writes++;
        if (writes === 100) {
          void tree.$();
          writes = 0;
        }
      },
      read: () => tree.$(),
      destroy: () => tree.destroy(),
    };
  }, 100_000);

  console.log(JSON.stringify({
    samples: 9,
    writesPerSample: 100_000,
    depth: 50,
    burstSize: 100,
    medianNsPerWrite: { shallow: shallowNs, deep: deepNs, burst: burstNs },
  }, null, 2));
} else {
  console.error('Usage: --arm=unread | --arm=read | --arm=timing');
  process.exit(1);
}
