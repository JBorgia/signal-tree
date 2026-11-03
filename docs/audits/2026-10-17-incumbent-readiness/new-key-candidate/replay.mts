import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(process.argv[2] ?? process.cwd());
const load = (file: string) => import(pathToFileURL(join(root, file)).href);
const { signalTree } = await load('packages/kernel/src/lib/signal-tree.ts');
const { transactions } = await load('packages/kernel/src/enhancers/transactions/transactions.ts');
const { getTreeScalarSlotRuntime } = await load('packages/kernel/src/lib/internals/tree-scalar-slot-port.ts');
const tree = signalTree({ trigger: [{ x: 0 }] }, { enhancers: [transactions()] });
const runtime = getTreeScalarSlotRuntime(tree.$);
const initial = runtime.slotCount();
const counts: number[] = [];
try {
  for (let i = 0; i < 5; i++) {
    assert.throws(() => tree.$({
      trigger: [{ get x() { throw new Error('equality failure'); } }],
      fresh: new Uint8Array(100_000),
    }), /equality failure/);
    assert.deepEqual(tree.$(), { trigger: [{ x: 0 }] });
    counts.push(runtime.slotCount());
  }
  console.log(JSON.stringify({ root, initial, counts, snapshot: tree.$() }));
  assert.deepEqual(counts, Array(5).fill(initial), 'Failed writes must not retain uninstalled payload slots');
} finally {
  tree.destroy();
}
