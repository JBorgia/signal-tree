#!/usr/bin/env node
// F1 against the REAL KERNEL, incumbent mechanism, before any spike code.
//
// F1 (preregistered): P1 writes x,y; P2 writes y,z; every reject/confirm order
// -> settles correctly, with NO unnecessary refusal.
//
// This measures the INCUMBENT so the spike has a real baseline rather than a
// remembered one. The incumbent is a reference measurement, not an oracle: the
// frozen contract says what correct is. A refusal here is only "unnecessary" if
// a correct settlement was actually available.
import { build } from 'esbuild';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const bundled = await build({
  stdin: {
    contents: `export {signalTree} from './packages/kernel/src/index';
export {transactions} from './packages/kernel/src/enhancers/transactions/transactions';
export {getPathNotifier} from './packages/kernel/src/lib/path-notifier';`,
    resolveDir: root,
    sourcefile: 'f1-entry.ts',
    loader: 'ts',
  },
  absWorkingDir: root,
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  target: 'node24',
});
const K = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`
);

const flush = async (notifier) => {
  notifier.flushSync();
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

/**
 * P1 owns x,y. P2 owns y,z. They OVERLAP on y, which is the whole point:
 * settling one must not need to undo the other's independent facts.
 */
const scenario = async (order) => {
  const notifier = K.getPathNotifier();
  const tree = K.signalTree({ x: 0, y: 0, z: 0 }, { enhancers: [K.transactions()] });
  const outcome = { order: order.join(','), steps: [], final: null, refusals: [] };
  try {
    const p1 = tree.transact(() => {
      tree.$.x(1);
      tree.$.y(1);
    });
    await flush(notifier);
    const p2 = tree.transact(() => {
      tree.$.y(2);
      tree.$.z(2);
    });
    await flush(notifier);

    for (const step of order) {
      const [who, how] = step.split(':');
      const handle = who === 'p1' ? p1 : p2;
      try {
        handle[how]();
        outcome.steps.push({ step, result: 'settled' });
      } catch (error) {
        outcome.steps.push({ step, result: 'refused', message: String(error?.message ?? error).slice(0, 160) });
        outcome.refusals.push(step);
      }
      await flush(notifier);
    }
    outcome.final = { x: tree.$.x(), y: tree.$.y(), z: tree.$.z() };
  } catch (error) {
    outcome.error = String(error?.message ?? error).slice(0, 200);
  } finally {
    tree.destroy();
  }
  return outcome;
};

// Every order of settling both, in both directions, with both verbs.
const ORDERS = [];
for (const a of ['confirm', 'rollback'])
  for (const b of ['confirm', 'rollback']) {
    ORDERS.push([`p1:${a}`, `p2:${b}`]);
    ORDERS.push([`p2:${b}`, `p1:${a}`]);
  }

const results = [];
for (const order of ORDERS) results.push(await scenario(order));

const refused = results.filter((r) => r.refusals.length);
const report = {
  property: 'F1 overlapping pending scalar writers',
  mechanism: 'incumbent (baseline compensation), REAL kernel',
  orders: results.length,
  ordersWithRefusal: refused.length,
  results,
};
const out = resolve(
  dirname(fileURLToPath(import.meta.url)),
  'f1-incumbent-baseline.json'
);
writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify({ orders: results.length, ordersWithRefusal: refused.length, refusedOrders: refused.map((r) => r.order) })
);
