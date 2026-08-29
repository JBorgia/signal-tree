#!/usr/bin/env node
/**
 * C6-PERF-BASELINE-INTERLEAVED-0 — the authoritative timing protocol.
 *
 * ⚠️ THE SEQUENTIAL METHOD IS FALSIFIED FOR DELTA CLAIMS. Whole-suite runs of
 * IDENTICAL code produced +77%, +127% and +190%. Those numbers are not deleted —
 * they are QUARANTINED for delta claims. Deterministic representation counts
 * measured in the same period remain authoritative, because they were never
 * timing-dependent.
 *
 * What earns authority here:
 *
 *   ISOLATION   each arm runs in its own worker with its own module graph, so a
 *               baseline and a candidate build cannot share the realization
 *               port, tracking suppression or notifier singletons.
 *
 *   INTERLEAVE  arms alternate inside every block, order randomized per block,
 *               both workers kept warm — machine drift then hits both arms over
 *               the same interval instead of whichever ran while it was busy.
 *
 *   PAIRING     the statistic is the WITHIN-BLOCK delta, not two independent
 *               global medians. Both halves of a pair saw the same conditions.
 *
 *   SENSITIVITY the known-bad arm (wrapper cell per leaf) must separate, or the
 *               run has no authority to say anything about the candidate.
 *
 *     THE KNOWN-BAD ARM IS A GATE ON THE GATE. IT IS NEVER AN S1 SURROGATE.
 *
 * Dimensions stay a vector: this measures TIME only. Retained memory,
 * representation counts, allocations and bundle size are measured elsewhere and
 * are not mixed in here.
 */
import { Worker } from 'node:worker_threads';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };

const METHOD = 'interleaved-v1';
const OPS = ['construct-plain', 'scalar-read', 'scalar-write', 'merge-write-many'];
const N = Number(arg('n', '20000'));
const BLOCKS = Number(arg('blocks', '25'));
const WARM = Number(arg('warm', '3'));
const SEED = Number(arg('seed', '1'));
const A_BUILD = arg('a', `${ROOT}/dist/packages/kernel/dist/index.js`);
const B_BUILD = arg('b', A_BUILD);
const B_MODE = arg('bmode', 'native');            // 'native' | 'wrapped'
const LABEL = arg('label', B_MODE === 'wrapped' ? 'known-bad' : (B_BUILD === A_BUILD ? 'A/A' : 'candidate'));

/** Deterministic PRNG so a run's block order is reproducible from the seed. */
let s = SEED >>> 0;
const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);

const spawn = (buildPath, mode) => new Worker(`${ROOT}/tools/bench-c6-worker.mjs`, { workerData: { buildPath, mode } });
const ask = (w, msg) => new Promise((res, rej) => {
  const onMsg = (m) => { w.off('error', onErr); w.off('message', onMsg); res(m); };
  const onErr = (e) => { w.off('message', onMsg); rej(e); };
  w.once('message', onMsg); w.once('error', onErr); w.postMessage(msg);
});

const A = spawn(A_BUILD, 'native');
const B = spawn(B_BUILD, B_MODE);
await Promise.all([ask(A, { kind: 'warm', rounds: WARM }), ask(B, { kind: 'warm', rounds: WARM })]);

/** op -> array of within-block percentage deltas (B relative to A). */
const paired = Object.fromEntries(OPS.map((o) => [o, []]));
let sawIdleArm = false;

for (let blk = 0; blk < BLOCKS; blk++) {
  for (const op of OPS) {
    const aFirst = rnd() < 0.5;
    const first = aFirst ? A : B, second = aFirst ? B : A;
    const r1 = await ask(first, { kind: 'run', op, n: N });
    const r2 = await ask(second, { kind: 'run', op, n: N });
    const aMs = aFirst ? r1.ms : r2.ms;
    const bMs = aFirst ? r2.ms : r1.ms;
    if (!r1.ok || !r2.ok) sawIdleArm = true;
    paired[op].push(((bMs - aMs) / aMs) * 100);
  }
}
await Promise.all([A.terminate(), B.terminate()]);

if (sawIdleArm) { console.error('❌ an arm reported no work — measurement void.'); process.exit(1); }

const med = (xs) => { const v = [...xs].sort((x, y) => x - y); return v[Math.floor(v.length / 2)]; };
const pctl = (xs, p) => { const v = [...xs].sort((x, y) => x - y); return v[Math.min(v.length - 1, Math.floor(v.length * p))]; };

const summary = OPS.map((op) => ({
  op,
  medianDeltaPct: +med(paired[op]).toFixed(2),
  p10: +pctl(paired[op], 0.1).toFixed(2),
  p90: +pctl(paired[op], 0.9).toFixed(2),
  blocksSlower: paired[op].filter((d) => d > 0).length,
}));

const record = { method: METHOD, label: LABEL, node: process.version, n: N, blocks: BLOCKS,
  warm: WARM, seed: SEED, ops: OPS, aBuild: A_BUILD.replace(ROOT, '.'), bBuild: B_BUILD.replace(ROOT, '.'),
  bMode: B_MODE, summary };

console.log(`${LABEL}  method=${METHOD}  n=${N} blocks=${BLOCKS} seed=${SEED}`);
console.log(`  A=${record.aBuild}`);
console.log(`  B=${record.bBuild} (${B_MODE})\n`);
console.log('  op                     median Δ     p10      p90    blocks B slower');
for (const r of summary) {
  console.log(`  ${r.op.padEnd(22)}${String(r.medianDeltaPct).padStart(7)}% ${String(r.p10).padStart(8)}% ${String(r.p90).padStart(8)}%   ${r.blocksSlower}/${BLOCKS}`);
}

const OUT = arg('save', '');
if (OUT) { writeFileSync(`${ROOT}/${OUT}`, JSON.stringify(record, null, 2)); console.log(`\nsaved -> ${OUT}`); }

// ── comparability guard, same rule as the sequential harness needed ────────
const BASE = arg('against', '');
if (BASE) {
  if (!existsSync(`${ROOT}/${BASE}`)) { console.error(`❌ no artifact at ${BASE}`); process.exit(1); }
  const b = JSON.parse(readFileSync(`${ROOT}/${BASE}`, 'utf8'));
  const mismatch = [];
  if (b.method !== METHOD) mismatch.push(`method ${b.method} vs ${METHOD}`);
  if (b.n !== N) mismatch.push(`n ${b.n} vs ${N}`);
  if (b.blocks !== BLOCKS) mismatch.push(`blocks ${b.blocks} vs ${BLOCKS}`);
  if (String(b.ops) !== String(OPS)) mismatch.push('operation set differs');
  if (mismatch.length) {
    console.error(`\n❌ INCOMPARABLE: ${mismatch.join('; ')}`);
    console.error('   Equivalent operation is part of the evidence, not benchmark trivia.');
    process.exit(1);
  }
  console.log(`\ncomparable to ${BASE} (${b.label}): method/n/blocks/ops all match.`);
}
