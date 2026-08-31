#!/usr/bin/env node
/**
 * C6 PERFORMANCE BASELINE — same vertical, before vs after.
 *
 * ⚠️ THIS IS A RECORDED BASELINE, NOT A PASS/FAIL TIMING GATE. This repository
 * deliberately refuses to assert wall-clock numbers in `verify-gates`, because
 * "timings move with the machine, so asserting them would make the suite flaky
 * and teach people to ignore it". That judgement stands. What C6 needs is a
 * BEFORE picture of the Angular vertical so that a neutrality change can be
 * shown not to have taxed it — comparison on demand, by a human, not a red gate
 * on a laptop that happened to be busy.
 *
 * The deterministic half of the C6 performance requirement — no wrapper cell, no
 * duplicate graph, no dispatch branch — is asserted structurally in
 * `c6-neutrality-invariants.spec.ts`, where it belongs, because those facts do
 * NOT move with the machine.
 *
 * ⚠️ EVERY ARM ASSERTS ITS WORK LANDED. An arm that silently stopped doing
 * anything would otherwise report as "faster" — the exact idle-arm defect this
 * repo has published once before.
 */
import { performance } from 'node:perf_hooks';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const { signalTree } = await import(`${ROOT}/dist/packages/kernel/dist/index.js`);

const REPS = Number(process.argv.find((a) => a.startsWith('--reps='))?.slice(7) ?? 7);
const N = Number(process.argv.find((a) => a.startsWith('--n='))?.slice(4) ?? 2000);

function measure(label, setup, run, postcondition) {
  const times = [];
  for (let r = 0; r < REPS; r++) {
    const ctx = setup();
    // warmup
    run(ctx, Math.min(50, N));
    const t0 = performance.now();
    run(ctx, N);
    times.push(performance.now() - t0);
    const ok = postcondition(ctx);
    if (!ok) { console.error(`\n❌ ${label}: POSTCONDITION FAILED — the arm did no work.`); process.exit(1); }
  }
  times.sort((a, b) => a - b);
  return { label, medianMs: +times[Math.floor(times.length / 2)].toFixed(4), n: N };
}

const wide = (n) => { const o = {}; for (let i = 0; i < n; i++) o[`k${i}`] = i; return o; };

const results = [];

results.push(measure('construct-plain-tree',
  () => ({ made: 0 }),
  (ctx, n) => { for (let i = 0; i < n; i++) { signalTree({ a: 1, b: { c: 2 } }); ctx.made++; } },
  (ctx) => ctx.made > 0));

results.push(measure('construct-wide-tree-256',
  () => ({ t: null }),
  (ctx, n) => { for (let i = 0; i < Math.max(1, n / 100); i++) ctx.t = signalTree(wide(256)); },
  (ctx) => ctx.t !== null && ctx.t.$.k255() === 255));

results.push(measure('scalar-read',
  () => ({ t: signalTree({ a: 1 }), sum: 0 }),
  (ctx, n) => { for (let i = 0; i < n; i++) ctx.sum += ctx.t.$.a(); },
  (ctx) => ctx.sum > 0));

results.push(measure('scalar-write-leaf-set',
  () => ({ t: signalTree({ a: 0 }) }),
  (ctx, n) => { for (let i = 0; i < n; i++) ctx.t.$.a.set(i); },
  (ctx) => ctx.t.$.a() > 0));

results.push(measure('merge-write-same-leaf',
  () => ({ t: signalTree({ a: 0 }) }),
  (ctx, n) => { for (let i = 0; i < n; i++) ctx.t.$({ a: i }); },
  (ctx) => ctx.t.$.a() > 0));

results.push(measure('merge-write-many-leaves',
  () => ({ t: signalTree(wide(64)) }),
  (ctx, n) => { for (let i = 0; i < Math.max(1, n / 64); i++) { const p = {}; for (let k = 0; k < 64; k++) p[`k${k}`] = i + k; ctx.t.$(p); } },
  (ctx) => ctx.t.$.k0() > 0));

results.push(measure('causal-tree-write',
  () => ({ t: signalTree({ a: 0 }, { capabilities: ['causal-runtime'] }) }),
  (ctx, n) => { for (let i = 0; i < n; i++) ctx.t.$.a.set(i); },
  (ctx) => ctx.t.$.a() > 0));

const out = {
  measuredAt: 'unstamped (Date is not used so runs stay comparable)',
  reps: REPS, n: N,
  node: process.version,
  results,
};

const BASELINE = `${ROOT}/tools/c6-perf-baseline.json`;
if (process.argv.includes('--check')) {
  if (!existsSync(BASELINE)) { console.error('❌ no baseline recorded; run without --check first.'); process.exit(1); }
  const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
  // ⚠️ REFUSE AN INCOMPARABLE COMPARISON. `medianMs` is time for `n` operations,
  // so comparing a baseline recorded at one `n` against a run at another is
  // meaningless — and it silently reports the ratio of the WORKLOADS as though
  // it were a regression. A `--reps=25 --n=4000` check against an `n=2000`
  // baseline produced "+269.7% worst regression" that measured nothing.
  //
  //     A COMPARISON IS ONLY A MEASUREMENT WHEN BOTH SIDES DID THE SAME WORK.
  if (base.n !== N || base.reps !== REPS) {
    console.error(`❌ incomparable: baseline was reps=${base.reps} n=${base.n}, this run is reps=${REPS} n=${N}.`);
    console.error('   Re-run --check with matching parameters, or re-record the baseline.');
    process.exit(1);
  }
  const byLabel = new Map(base.results.map((r) => [r.label, r]));
  console.log('arm                          baseline      now        delta');
  let worst = 0;
  for (const r of results) {
    const b = byLabel.get(r.label);
    if (!b) { console.log(`  ${r.label.padEnd(28)} (new)`); continue; }
    const pct = ((r.medianMs - b.medianMs) / b.medianMs) * 100;
    worst = Math.max(worst, pct);
    console.log(`  ${r.label.padEnd(28)}${String(b.medianMs).padStart(9)}${String(r.medianMs).padStart(11)}   ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`);
  }
  console.log(`\nworst regression: ${worst >= 0 ? '+' : ''}${worst.toFixed(1)}%`);
  console.log('⚠️ ADVISORY. Wall-clock on a shared machine is noisy; read the shape, not the digits.');
  process.exit(0);
}
writeFileSync(BASELINE, JSON.stringify(out, null, 2));
console.log(`recorded ${results.length} arms -> tools/c6-perf-baseline.json (reps=${REPS}, n=${N})`);
for (const r of results) console.log(`  ${r.label.padEnd(28)} ${String(r.medianMs).padStart(9)} ms / ${r.n}`);
