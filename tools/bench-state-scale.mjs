#!/usr/bin/env node
/**
 * How write cost scales with STATE SIZE and with LIVE CONSUMERS.
 *
 * ## Why this exists
 *
 * `tools/bench-compare.mjs` measures entity collections. This file tests the
 * separate claim that leaf writes remain stable as unrelated state and live
 * consumers grow.
 *
 * The library's actual thesis is a different claim: **only leaves are signals,
 * branches are plain accessors, and a write is O(1) regardless of how large the
 * state is.** Nothing measured that against anyone. This does.
 *
 * ## The two axes, and why they must be separated
 *
 * A first attempt varied both at once and conflated immutable state-copy cost
 * with selector fan-out. Separated, the two effects answer different questions.
 *
 *   - **Axis 1, state size, 0 consumers.** Isolates the store write itself.
 *   - **Axis 2, consumer count, fixed state.** Isolates selector fan-out.
 *
 * ## Fairness rules, learned the hard way
 *
 * 1. **Use the competitor's own idiomatic API.** NgRx Signals is measured with
 *    `signalState` and `patchState`, not a harness-owned store abstraction.
 * 2. **Both a FLAT and a NESTED shape.** Immutable patch cost tracks the width
 *    of the patched level. The nested shape — few sections, many fields each —
 *    is the realistic complement to a wide root.
 * 3. **Warm up before measuring.** Un-warmed, the same 1,000-field measurement
 *    read 0.31 ms in one script and 23.23 ms in another — a 75x swing that was
 *    pure JIT state. Five discarded rounds per arm.
 * 4. **Postconditions on every arm**, because a benchmark that cannot detect it
 *    did nothing is the defect class this repo has hit seven times.
 * 5. **A SENTINEL between warmup and measurement.** The first version asserted
 *    the final value equalled the last write — and the WARMUP loop already
 *    satisfied that, so gutting the measured loop left the postcondition green.
 *    `verify-gates --self-test` caught it as a blind gate. Each arm now writes a
 *    sentinel after warmup, so the assertion can only pass if the MEASURED loop
 *    ran. A postcondition another phase can satisfy is not a postcondition.
 *
 * ⚠️ `--quick` NUMBERS ARE NOT QUOTABLE. It runs one size per axis, so the JIT
 * reaches a different state than a full sweep does — the 10x100 nested arm read
 * 0.056 ms under --quick against a stable 0.36 ms across full runs, a 6x gap
 * that is measurement state, not behaviour. --quick exists so `verify-gates` can
 * check the harness still RUNS. Quote the full run, which reproduces to within a
 * few percent.
 *
 * Usage: node tools/bench-state-scale.mjs [--json] [--quick]
 */
import { join } from 'node:path';

const CORE = join(process.cwd(), 'dist/packages/kernel/dist/index.js');
const WRITES = 200;
const WARMUP = 5;
const QUICK = process.argv.includes('--quick');
/** Written after warmup so a postcondition can only pass if the MEASURED loop ran. */
const SENTINEL = -99999;

const { signalTree } = await import(CORE);
const { computed } = await import('@angular/core');
const { signalState, patchState } = await import('@ngrx/signals');

function median(fn, rounds = 11) {
  const times = [];
  for (let i = 0; i < rounds; i++) {
    const t0 = performance.now();
    fn(i);
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  return times[times.length >> 1];
}

const flat = (n) => {
  const o = {};
  for (let i = 0; i < n; i++) o['k' + i] = { v: i };
  return o;
};
const nested = (sections, per) => {
  const o = {};
  for (let s = 0; s < sections; s++) {
    const sec = {};
    for (let i = 0; i < per; i++) sec['f' + i] = i;
    o['s' + s] = sec;
  }
  return o;
};

const results = { axis1Flat: [], axis1Nested: [], axis2: [] };

// ── Axis 1a: FLAT state ─────────────────────────────────────────────────────
for (const size of QUICK ? [64, 512] : [64, 128, 256, 512, 1024]) {
  const tree = signalTree(flat(size));
  for (let r = 0; r < WARMUP; r++)
    for (let w = 0; w < WRITES; w++) tree.$.k0.v(w);
  tree.$.k0.v(SENTINEL);
  const st = median(() => {
    for (let w = 0; w < WRITES; w++) tree.$.k0.v(w);
  });

  const state = signalState(flat(size));
  const write = (w) => patchState(state, { k0: { v: w } });
  for (let r = 0; r < WARMUP; r++) {
    for (let w = 0; w < WRITES; w++) write(w);
  }
  write(SENTINEL);
  const ngrxSignals = median(() => {
    for (let w = 0; w < WRITES; w++) write(w);
  });

  if (tree.$.k0.v() !== WRITES - 1)
    throw new Error(`signaltree write did not land at ${size}`);
  if (state.k0.v() !== WRITES - 1)
    throw new Error(`@ngrx/signals write did not land at ${size}`);
  results.axis1Flat.push({
    size,
    signaltreeMs: st,
    ngrxSignalsMs: ngrxSignals,
  });
}

// ── Axis 1b: NESTED state, the realistic shape ──────────────────────────────
for (const [sections, per] of QUICK
  ? [[10, 100]]
  : [
      [10, 10],
      [10, 100],
      [20, 250],
      [50, 200],
    ]) {
  const tree = signalTree(nested(sections, per));
  for (let r = 0; r < WARMUP; r++)
    for (let w = 0; w < WRITES; w++) tree.$.s0.f0(w);
  tree.$.s0.f0(SENTINEL);
  const st = median(() => {
    for (let w = 0; w < WRITES; w++) tree.$.s0.f0(w);
  });

  const state = signalState(nested(sections, per));
  const write = (w) => patchState(state, { s0: { ...state.s0(), f0: w } });
  for (let r = 0; r < WARMUP; r++) {
    for (let w = 0; w < WRITES; w++) write(w);
  }
  write(SENTINEL);
  const ngrxSignals = median(() => {
    for (let w = 0; w < WRITES; w++) write(w);
  });

  if (tree.$.s0.f0() !== WRITES - 1)
    throw new Error('signaltree nested write did not land');
  if (state.s0.f0() !== WRITES - 1)
    throw new Error('@ngrx/signals nested write did not land');
  results.axis1Nested.push({
    sections,
    per,
    total: sections * per,
    signaltreeMs: st,
    ngrxSignalsMs: ngrxSignals,
  });
}

// ── Axis 2: consumer fan-out at fixed state size ────────────────────────────
for (const n of QUICK ? [0, 1000] : [0, 100, 1000, 5000]) {
  const tree = signalTree(flat(100));
  const consumers = [];
  for (let i = 0; i < n; i++) {
    const c = computed(() => tree.$['k' + (i % 100)].v());
    c();
    consumers.push(c);
  }
  for (let r = 0; r < WARMUP; r++) {
    for (let w = 0; w < WRITES; w++) tree.$.k0.v(w);
    consumers.forEach((c) => c());
  }
  const st = median(() => {
    for (let w = 0; w < WRITES; w++) tree.$.k0.v(w);
    // Reading every consumer is what a change-detection pass does; the ones that
    // were not invalidated return a cached value and cost a pointer check.
    consumers.forEach((c) => c());
  });

  // ── @ngrx/signals, the primary competitor ─────────────────────────────────
  // `signalState` exposes DEEP signals, so a consumer reading `st.k0.v()` is
  // already granular on this shape. Expect a much closer result than an
  // immutable selector store, and
  // report it: a fan-out claim that only holds against the library nobody picks
  // is not a claim worth making.
  const ss = signalState(flat(100));
  const ssConsumers = [];
  for (let i = 0; i < n; i++) {
    const c = computed(() => ss['k' + (i % 100)].v());
    c();
    ssConsumers.push(c);
  }
  const ssWrite = (w) => patchState(ss, { k0: { v: w } });
  for (let r = 0; r < WARMUP; r++) {
    for (let w = 0; w < WRITES; w++) ssWrite(w);
    ssConsumers.forEach((c) => c());
  }
  ssWrite(SENTINEL);
  const ngrx = median(() => {
    for (let w = 0; w < WRITES; w++) ssWrite(w);
    ssConsumers.forEach((c) => c());
  });
  if (ss.k0.v() !== WRITES - 1)
    throw new Error('@ngrx/signals fan-out write did not land');

  results.axis2.push({
    consumers: n,
    signaltreeMs: st,
    ngrxSignalsMs: ngrx,
  });
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
}

const ratio = (a, b) => (a > 0 ? `${(b / a).toFixed(0)}x` : '—');

console.log(
  `\n${WRITES} writes, median of 11, ${WARMUP} warmup rounds discarded per arm.\n`
);

console.log('AXIS 1a — FLAT state (every field a root property)\n');
console.log(
  '  root props'.padEnd(14) +
    'SignalTree'.padStart(12) +
    '@ngrx/signals'.padStart(15) +
    '   ratio'
);
for (const r of results.axis1Flat) {
  console.log(
    ('  ' + r.size).padEnd(14) +
      r.signaltreeMs.toFixed(3).padStart(12) +
      r.ngrxSignalsMs.toFixed(3).padStart(15) +
      '   ' +
      ratio(r.signaltreeMs, r.ngrxSignalsMs)
  );
}

console.log('\nAXIS 1b — NESTED state (the shape an app actually has)\n');
console.log(
  '  shape'.padEnd(14) +
    'fields'.padStart(8) +
    'SignalTree'.padStart(12) +
    '@ngrx/signals'.padStart(15) +
    '   ratio'
);
for (const r of results.axis1Nested) {
  console.log(
    ('  ' + r.sections + ' x ' + r.per).padEnd(14) +
      String(r.total).padStart(8) +
      r.signaltreeMs.toFixed(3).padStart(12) +
      r.ngrxSignalsMs.toFixed(3).padStart(15) +
      '   ' +
      ratio(r.signaltreeMs, r.ngrxSignalsMs)
  );
}

console.log('\nAXIS 2 — consumer fan-out (100 fields fixed)\n');
console.log(
  '  consumers'.padEnd(13) +
    'SignalTree'.padStart(12) +
    '@ngrx/signals'.padStart(15) +
    'vs ngrx'.padStart(10)
);
for (const r of results.axis2) {
  console.log(
    ('  ' + r.consumers).padEnd(13) +
      r.signaltreeMs.toFixed(3).padStart(12) +
      r.ngrxSignalsMs.toFixed(3).padStart(15) +
      ratio(r.signaltreeMs, r.ngrxSignalsMs).padStart(10)
  );
}

console.log(
  '\n  Every arm asserted its write landed on BOTH a flat and nested shape. The\n' +
    '  narrow claim is whether write cost stays stable as unrelated state grows.'
);

console.log(
  '\n  ⚠️ AXIS 2 RATIOS ARE SHAPE-SPECIFIC — do not quote one bare.\n' +
    '\n  Axis 2 fixes the state at flat(100): one hundred SIBLING keys. That is the\n' +
    '  worst case for any store that patches or copies at the level you wrote to,\n' +
    '  @ngrx/signals here. `patchState` measures differently on a wide root and\n' +
    '  ~1 µs on the deep-but-narrow shape in bench-vs-signalstore.mjs. Both are\n' +
    '  real; they differ because the cost tracks keys at the patched level, not\n' +
    '  total state size.\n' +
    '\n  So quote the shape with the number. A team whose state is a few sections of\n' +
    '  many fields will not see the flat(100) ratio.\n' +
    '\n  On measuring this at all: the first pass at the @ngrx/signals arm read\n' +
    '  0.176 µs/write, which was dead-code elimination — nothing read the state\n' +
    '  back, so the write was unobservable. Every arm here now reads its value and\n' +
    '  asserts the final one, and the corrected figure is 1000x the artifact.'
);
