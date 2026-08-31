#!/usr/bin/env node
/**
 * Whole-tree materialisation memo cost.
 *
 * These figures are quoted on `llms.txt`, `llms-full.txt` and
 * `packages/kernel/README.md` — roughly 50 numbers across the three — and until
 * this file existed NOTHING produced them. They were the same class of claim as
 * the "Performance targets (Sept 2025)" table, which turned out to be wrong by
 * 10x-1000x once someone finally measured it.
 *
 * The equality helpers this tool originally measured were deliberately removed
 * from the RC surface. Their arms were deleted rather than kept as an executable
 * dependency on APIs users cannot import.
 *
 *   node tools/bench-leaf-equality.mjs
 *   node tools/bench-leaf-equality.mjs --json
 */
import { signalTree } from '../dist/packages/kernel/dist/index.js';

const ROUNDS = 7;

let sink = 0;
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// ── The materialisation memo ─────────────────────────────────────────────────
function buildWide(leaves) {
  const state = {};
  for (let i = 0; i < leaves / 10; i++) {
    const branch = {};
    for (let j = 0; j < 10; j++) branch[`f${j}`] = `${i}_${j}`;
    state[`b${i}`] = branch;
  }
  return state;
}

function readWholeState() {
  const tree = signalTree(buildWide(10_000));
  const leaf = tree.$.b0.f0;
  for (let i = 0; i < 50; i++) {
    leaf.set(`w${i}`);
    sink += Object.keys(tree.$()).length;
  }

  const afterWrite = [];
  const unchanged = [];
  for (let r = 0; r < ROUNDS; r++) {
    // Time `tree.$()` ALONE. An earlier version timed `Object.keys(tree.$())`,
    // which walks 1,000 branches and swamped the thing being measured — the
    // unchanged read came out at 15.8µs when the actual call is ~nanoseconds.
    leaf.set(`x${r}`);
    let t = process.hrtime.bigint();
    const a = tree.$();
    afterWrite.push(Number(process.hrtime.bigint() - t) / 1000);
    sink += a ? 1 : 0;

    t = process.hrtime.bigint();
    const b = tree.$(); // nothing changed since the line above
    unchanged.push(Number(process.hrtime.bigint() - t) / 1000);
    sink += b === a ? 1 : 0; // identical object, by reference
  }
  return { afterWrite: median(afterWrite), unchanged: median(unchanged) };
}
const memo = readWholeState();

const results = { materialisation: memo };

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(results, null, 2));
} else {
  console.log(`\nMATERIALISATION MEMO — read whole state, 10,000 leaves`);
  console.log(`    after a one-leaf write   ${memo.afterWrite.toFixed(1)}µs`);
  console.log(
    `    with NOTHING changed     ${memo.unchanged.toFixed(3)}µs   ` +
      `(the identical object is returned)`
  );
  console.log(
    `\n  Absolute values are hardware-specific; compare repeated runs.\n`
  );
}

if (sink === -1) console.log(sink);
