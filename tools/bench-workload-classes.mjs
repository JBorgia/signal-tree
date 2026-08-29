#!/usr/bin/env node
/**
 * WORKLOAD CLASSES — evaluate an architecture, not an operation.
 *
 * Isolated operation costs cannot decide a representation that trades
 * construction cost for steady-state cost. Total cost over a plausible lifetime
 * can, and that needs operation COUNTS as well as costs. The counts here are
 * explicit assumptions (docs/architecture/workload-assumptions.md), chosen to be
 * structurally distinct rather than accurate, and meant to be varied.
 *
 * ## Why an invalidation-cycle model, not totals
 *
 * A cached whole read costs ~0.0001 ms; a whole read after a mutation costs
 * ~0.39 ms at 10k. So a workload is not described by how many reads it performs,
 * it is described by how reads and mutations INTERLEAVE. The unit is a cycle:
 *
 *     mutations -> point reads -> whole consumers -> derived consumers
 *
 * One cycle = one invalidation period = at most one realized `all()`
 * reconstruction, followed by however many consumers traverse the result.
 *
 * That distinction is load-bearing. Angular `computed` is lazy AND shared, so
 * five derived consumers over one collection cost
 *
 *     1 x all() reconstruction  +  5 x traversal of the result
 *
 * NOT 5 x reconstruction. Any representation that speeds up reconstruction is
 * therefore amortized across fan-out and reaches a floor set by per-consumer
 * traversal.
 *
 * ## Why per-cycle integers
 *
 * A previous version declared totals and divided by a fixed step count, rounding
 * each quotient. `POINT_HEAVY` declared 10 whole reads and executed 0;
 * `BULK_LOAD` declared 50 whole reads / 100 mutations and executed 0 and 200.
 * Published numbers did not describe the published workload. Counts are now
 * per-cycle integers and the totals are derived from them, so declared and
 * executed cannot diverge.
 *
 * Usage: node --expose-gc tools/bench-workload-classes.mjs [--json] [--samples 5]
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { measureRetained, requireExposeGc } from './lib/heap-quiescence.mjs';

requireExposeGc('tools/bench-workload-classes.mjs');
const CORE = join(process.cwd(), 'dist/packages/kernel/dist/index.js');
if (!existsSync(CORE)) {
  console.error('❌ build first: nx build core');
  process.exit(1);
}
const { signalTree, entityMap } = await import(CORE);
const { computed } = await import('@angular/core');

const arg = (n, d) => {
  const i = process.argv.indexOf(n);
  return i === -1 ? d : process.argv[i + 1];
};
const SAMPLES = Number(arg('--samples', 5));
const cfg = { selectId: (r) => r.id };
const seed = (n) => {
  const d = [];
  for (let i = 0; i < n; i++) d.push({ id: i, name: 'n' + i, v: i });
  return d;
};
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[s.length >> 1];
};
const spread = (xs) => Math.max(...xs) - Math.min(...xs);

/** Per-cycle integers. Totals are derived, never declared. */
const CLASSES = {
  POINT_HEAVY: {
    n: 10_000,
    cycles: 1_000,
    mut: 10,
    point: 100,
    whole: 0,
    derived: 0,
  },
  PROJECTION_HEAVY: {
    n: 10_000,
    cycles: 2_000,
    mut: 1,
    point: 0,
    whole: 10,
    derived: 0,
  },
  REACTIVE_FANOUT: {
    n: 10_000,
    cycles: 400,
    mut: 5,
    point: 12,
    whole: 0,
    derived: 5,
  },
  BULK_LOAD: {
    n: 100_000,
    cycles: 50,
    mut: 2,
    point: 20,
    whole: 1,
    derived: 0,
  },
  REALTIME: {
    n: 10_000,
    cycles: 2_000,
    mut: 10,
    point: 10,
    whole: 1,
    derived: 3,
  },
};
const totals = (w) => ({
  mutations: w.cycles * w.mut,
  pointReads: w.cycles * w.point,
  wholeReads: w.cycles * w.whole,
  derivedReads: w.cycles * w.derived,
});

function runOnce(w) {
  const t = signalTree({ rows: entityMap(cfg) });
  const c0 = performance.now();
  t.$.rows.setAll(seed(w.n));
  const constructionMs = performance.now() - c0;
  if (t.$.rows.count() !== w.n) throw new Error('construction postcondition');

  const consumers = [];
  for (let c = 0; c < w.derived; c++) {
    consumers.push(
      computed(() => t.$.rows.all().filter((e) => e.v % (c + 2) === 0).length)
    );
  }
  for (const c of consumers) void c();

  let sink = 0;
  const s0 = performance.now();
  for (let cy = 0; cy < w.cycles; cy++) {
    for (let i = 0; i < w.mut; i++)
      t.$.rows.updateOne((cy * 7 + i) % w.n, { v: cy + i });
    for (let i = 0; i < w.point; i++) {
      const node = t.$.rows.byId((cy * 13 + i) % w.n);
      sink += node ? 1 : 0;
    }
    for (let i = 0; i < w.whole; i++) sink += t.$.rows.all().length;
    for (const c of consumers) sink += c();
  }
  const steadyMs = performance.now() - s0;
  if (sink < 0) throw new Error('sink');
  return { constructionMs, steadyMs };
}

const rows = [];
for (const [name, w] of Object.entries(CLASSES)) {
  const cons = [],
    steady = [];
  for (let s = 0; s < SAMPLES; s++) {
    const r = runOnce(w);
    cons.push(r.constructionMs);
    steady.push(r.steadyMs);
  }
  const mem = await measureRetained(
    () => {
      const m = signalTree({ rows: entityMap(cfg) });
      m.$.rows.setAll(seed(w.n));
      return m;
    },
    { label: name }
  );
  rows.push({
    class: name,
    n: w.n,
    cycles: w.cycles,
    ...totals(w),
    // Construction and steady are reported SEPARATELY and never summed: a read-path
    // change cannot alter construction, so a combined total lets construction
    // variance masquerade as a steady-state result. It did exactly that once.
    constructionMs: +median(cons).toFixed(2),
    constructionSpread: +spread(cons).toFixed(2),
    steadyMs: +median(steady).toFixed(2),
    steadySpread: +spread(steady).toFixed(2),
    retainedMB: +mem.retainedMB.toFixed(2),
    bytesPerEntity: Math.round(mem.retainedBytes / w.n),
  });
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ samples: SAMPLES, rows }, null, 2));
} else {
  console.log(
    `\nWORKLOAD CLASSES — median of ${SAMPLES}; counts are ASSUMPTIONS\n`
  );
  console.log(
    '  ' +
      'class'.padEnd(18) +
      'N'.padStart(8) +
      'cycles'.padStart(8) +
      'mut'.padStart(8) +
      'whole'.padStart(7) +
      'deriv'.padStart(7) +
      'construct'.padStart(16) +
      'steady'.padStart(17) +
      'B/ent'.padStart(8)
  );
  console.log('  ' + '─'.repeat(97));
  for (const r of rows) {
    console.log(
      '  ' +
        r.class.padEnd(18) +
        String(r.n).padStart(8) +
        String(r.cycles).padStart(8) +
        String(r.mutations).padStart(8) +
        String(r.wholeReads).padStart(7) +
        String(r.derivedReads).padStart(7) +
        `${r.constructionMs}±${r.constructionSpread}`.padStart(16) +
        `${r.steadyMs}±${r.steadySpread}`.padStart(17) +
        String(r.bytesPerEntity).padStart(8)
    );
  }
  console.log(
    '\n  construct and steady are separate: a read-path change cannot move construction,'
  );
  console.log(
    '  so summing them lets construction variance impersonate a steady-state win.'
  );
  console.log(
    '  ± is max-min across samples. A delta inside the spread is not a result.'
  );
}
