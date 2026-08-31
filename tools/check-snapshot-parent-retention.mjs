import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

import { collect, quiesce, requireExposeGc } from './lib/heap-quiescence.mjs';

requireExposeGc('check-snapshot-parent-retention');

const kernelUrl = pathToFileURL(
  resolve('dist/packages/kernel/dist/index.js')
).href;
const { signalTree } = await import(kernelUrl);
let tree = signalTree({
  rootOnly: { value: 1 },
  held: { nested: { value: 2 } },
});
const held = tree.$.held.nested;
void tree.$();

let rootStore = tree.$;
if (!rootStore || typeof rootStore !== 'object') {
  throw new Error('Expected the root accessor to expose its backing store.');
}
const rootRef = new WeakRef(rootStore);

rootStore = null;
tree = null;
await quiesce({ label: 'snapshot parent retention' });

if (rootRef.deref() !== undefined) {
  let pressure = [];
  for (let index = 0; index < 250_000; index++) pressure.push({ index });
  pressure = null;
  collect();
  await quiesce({ label: 'snapshot parent retention after pressure' });
}

if (rootRef.deref() !== undefined) {
  throw new Error(
    'A held nested accessor retained the root backing store through snapshot parentage.'
  );
}
if (held().value !== 2) {
  throw new Error('The held nested accessor stopped reading its own live state.');
}

console.log('✓ held nested accessor remains readable without retaining the root store');
