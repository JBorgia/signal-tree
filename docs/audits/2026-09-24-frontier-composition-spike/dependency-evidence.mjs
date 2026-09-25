#!/usr/bin/env node
// Is the incumbent's later-pending-dependency refusal LOAD-BEARING, or is it a
// conservative over-approximation?
//
// The open owner decision records the premise that "y(1) and y(x()) have
// identical write evidence while x is pending", so a write-location comparison
// cannot prove read independence. That premise is TESTED here rather than
// repeated, because the F1 trade depends entirely on it:
//
//   LITERAL      P1: x=1     P2: y=1       P2 does NOT depend on x
//   DEPENDENT    P1: x=1     P2: y=x()     P2 genuinely depends on x
//
// Then roll P1 back while P2 is pending.
//
//   If the incumbent refuses BOTH identically, it cannot tell them apart, and
//   its refusal in the LITERAL case is over-approximation -- the exact refusal
//   frontier would convert into a settlement.
//
//   If it refuses only the DEPENDENT case, the refusal is load-bearing and
//   frontier converting it would be a REGRESSION, not an improvement.
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
    sourcefile: 'dep-entry.ts',
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

const flush = async (n) => {
  n.flushSync();
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

const run = async (label, writeP2) => {
  const n = K.getPathNotifier();
  const tree = K.signalTree({ x: 0, y: 0 }, { enhancers: [K.transactions()] });
  const out = { label, rollback: null, final: null };
  try {
    const p1 = tree.transact(() => tree.$.x(1));
    await flush(n);
    const p2 = tree.transact(() => writeP2(tree));
    await flush(n);
    out.pendingY = tree.$.y();
    try {
      p1.rollback();
      out.rollback = 'settled';
    } catch (error) {
      out.rollback = 'refused';
      out.reason = String(error?.message ?? error).slice(0, 120);
    }
    await flush(n);
    out.final = { x: tree.$.x(), y: tree.$.y() };
  } catch (error) {
    out.error = String(error?.message ?? error).slice(0, 160);
  } finally {
    tree.destroy();
  }
  return out;
};

const results = [
  // P2 writes a LITERAL. It does not read x. Rolling P1 back is safe: y is
  // P2's own fact and survives untouched.
  await run('literal   y(1)', (t) => t.$.y(1)),
  // P2 DERIVES y from P1's pending x. Rolling P1 back makes y stale, so a
  // refusal here is protecting something real.
  await run('dependent y(x())', (t) => t.$.y(t.$.x())),
  // Control: P2 derives from a location P1 never touched. No dependency on P1
  // at all, so this must behave like the literal case.
  await run('unrelated y(y()+5)', (t) => t.$.y(t.$.y() + 5)),
];

const verdict =
  results[0].rollback === results[1].rollback
    ? 'INDISTINGUISHABLE — the refusal is a conservative over-approximation'
    : 'DISTINGUISHED — the refusal is load-bearing';

const report = { question: 'is later-pending-dependency load-bearing?', verdict, results };
writeFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), 'dependency-evidence.json'),
  JSON.stringify(report, null, 2) + '\n'
);
for (const r of results)
  console.log(
    `${r.label.padEnd(20)} pendingY=${String(r.pendingY).padEnd(4)} rollback=${String(r.rollback).padEnd(9)} final=${JSON.stringify(r.final)}`
  );
console.log('\nVERDICT:', verdict);
