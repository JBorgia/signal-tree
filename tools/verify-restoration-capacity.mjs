#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const entry = resolve('dist/packages/kernel/dist/index.js');
if (!existsSync(entry)) {
  console.error('build first: pnpm nx build kernel');
  process.exit(1);
}

const { restoration, signalTree, undoable } = await import(
  pathToFileURL(entry).href
);
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const cases = [
  { capacity: undefined, expected: 10 },
  { capacity: 0, expected: 0 },
  { capacity: 1, expected: 1 },
  { capacity: 2, expected: 2 },
  { capacity: 5, expected: 5 },
];

for (const { capacity, expected } of cases) {
  const tree = signalTree(
    { n: 0 },
    {
      enhancers: [
        restoration(
          capacity === undefined ? {} : { maxHistorySize: capacity }
        ),
      ],
    }
  );
  for (let value = 1; value <= 10; value++) {
    undoable(() => tree.$.n.set(value));
    await flush();
  }
  let spent = 0;
  while (tree.canUndo()) {
    tree.undo();
    spent += 1;
  }
  tree.destroy();
  if (spent !== expected) {
    throw new Error(
      `capacity ${String(capacity)} spent ${spent} undo steps; expected ${expected}`
    );
  }
}

console.log('restoration capacity contract passed: omitted=10, 0=0, 1=1, 2=2, 5=5');
