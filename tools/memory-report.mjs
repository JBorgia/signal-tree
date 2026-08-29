#!/usr/bin/env node
/**
 * RETAINED HEAP — the axis bundle size does not measure.
 *
 * Bytes over the wire decide load time. Retained heap decides whether a page
 * survives on a low-end device, and it is a different question with a different
 * answer. SignalTree's shape — only leaves are Angular signals, branches are
 * plain accessors, writes are O(1) regardless of state size — should show up
 * here or nowhere.
 *
 * ⚠️ METHODOLOGY, learned expensively (docs/architecture/materialisation-prior-art.md §3.2):
 * a heap delta taken WITHOUT forced GC measures ALLOCATION, not RETENTION. The
 * same memo measurement read 25.71 MB un-GC'd and 3.32 MB with `--expose-gc` —
 * 8x high, and enough to have flipped a design recommendation. This file
 * REFUSES to run without `--expose-gc` rather than print a number that looks
 * like retention and is not.
 *
 * ⚠️ AND THAT WAS NOT ENOUGH. Forced GC alone is still not settled: a
 * synchronous `gc()` cannot reclaim what a turn boundary reclaims. This file
 * knew that — the note further down explains it — and then applied the turn
 * boundary to ONE scenario through a `yieldBeforeMeasure` flag, so the arms it
 * exists to compare were read at different points on the reclamation curve.
 * It published `entityMap 10k = 59.95 MB` against `+ transient byId() =
 * 18.03 MB`, i.e. an ablation in which materialising 10,000 nodes costs
 * NEGATIVE 42 MB. Under one protocol the pair is 11.26 -> 16.62. The settling
 * rule is no longer a per-scenario decision: it lives in
 * `tools/lib/heap-quiescence.mjs`, every scenario gets the same one, and
 * `tools/check-memory-harness.mjs` fails the build if any arm is measured
 * somewhere the others were not.
 *
 * ⚠️ ONE PROCESS PER SCENARIO, for the same reason the benchmark rule requires
 * it (design-thesis §3): scenarios sharing a process contaminate each other.
 * The first draft of this file ran them all in one and produced a result that
 * could not be true — `entityMap 10k + a held snapshot` retained LESS than the
 * same entityMap alone. Strictly more data cannot retain less; the number was
 * an artefact of the previous scenario's garbage and V8's lazy reclamation.
 * The driver below spawns a child per scenario.
 *
 * Usage: node --expose-gc tools/memory-report.mjs [--json]
 *        node --expose-gc tools/memory-report.mjs --scenario <name>   (internal)
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
// `quiesce` is used too, but only inside the read-growth child below, which
// imports it by URL into its own process.
import {
  MB,
  measureRetained,
  requireExposeGc,
} from './lib/heap-quiescence.mjs';

requireExposeGc('tools/memory-report.mjs');

const CORE = join(process.cwd(), 'dist/packages/kernel/dist/index.js');
if (!existsSync(CORE)) {
  console.error('❌ build first: nx run-many -t build --all');
  process.exit(1);
}
const { signalTree, entityMap } = await import(CORE);

const { signal } = await import('@angular/core');

/** name -> builder. Each runs in its OWN process; see the header. */
const SCENARIOS = {
  'leaves-20k': {
    label: 'signalTree, 20k scalar leaves',
    n: 20_000,
    unit: 'leaf',
    build: (n) => {
      const shape = {};
      for (let i = 0; i < n; i++) shape['k' + i] = i;
      const t = signalTree(shape);
      void t.$;
      return t;
    },
  },
  'plain-object-20k': {
    label: 'plain object, 20k keys (floor)',
    n: 20_000,
    unit: 'key',
    build: (n) => {
      const o = {};
      for (let i = 0; i < n; i++) o['k' + i] = i;
      return o;
    },
  },
  'raw-signals-20k': {
    label: 'plain object of 20k RAW Angular signals',
    n: 20_000,
    unit: 'signal',
    build: (n) => {
      const o = {};
      for (let i = 0; i < n; i++) o['k' + i] = signal(i);
      return o;
    },
  },
  'entitymap-1k': {
    label: 'entityMap, 1k entities',
    n: 1_000,
    unit: 'entity',
    build: (n) => {
      const t = signalTree({ rows: entityMap({ selectId: (r) => r.id }) });
      const data = [];
      for (let i = 0; i < n; i++) data.push({ id: i, name: 'n' + i, v: i });
      t.$.rows.setAll(data);
      void t.$.rows.all();
      return t;
    },
  },
  'entitymap-10k': {
    label: 'entityMap, 10k entities',
    n: 10_000,
    unit: 'entity',
    build: (n) => {
      const t = signalTree({ rows: entityMap({ selectId: (r) => r.id }) });
      const data = [];
      for (let i = 0; i < n; i++) data.push({ id: i, name: 'n' + i, v: i });
      t.$.rows.setAll(data);
      void t.$.rows.all();
      return t;
    },
  },
  'entitymap-10k-snapshot': {
    label: 'entityMap 10k + a held tree() snapshot',
    n: 10_000,
    unit: 'entity',
    build: (n) => {
      const t = signalTree({ rows: entityMap({ selectId: (r) => r.id }) });
      const data = [];
      for (let i = 0; i < n; i++) data.push({ id: i, name: 'n' + i, v: i });
      t.$.rows.setAll(data);
      return { t, snap: t() };
    },
  },
  /**
   * The shape that decides whether a large list survives on a phone.
   *
   * `byId()` materialises a per-entity node so one row can be bound and written
   * independently — the documented pattern for granular updates, and by far the
   * most expensive thing in this document. It was measured ONCE, by hand, at
   * 4,149 B/entity, and that number then sat in memory-profile.md while the
   * underlying cache was changed from strong to weak underneath it. A figure
   * that only exists in prose goes stale silently; this is here so it is
   * re-measured on every run.
   */
  'entitymap-10k-byid-all': {
    label: 'entityMap 10k + byId() on EVERY row',
    n: 10_000,
    unit: 'entity',
    build: (n) => {
      const t = signalTree({ rows: entityMap({ selectId: (r) => r.id }) });
      const data = [];
      for (let i = 0; i < n; i++) data.push({ id: i, name: 'n' + i, v: i });
      t.$.rows.setAll(data);
      // Held, so this measures RETENTION of the materialised nodes. Dropping
      // them would measure the weak cache collecting, which is a different
      // question and the one entity-node-cache.spec.ts covers.
      const nodes = [];
      for (let i = 0; i < n; i++) nodes.push(t.$.rows.byId(i));
      return { t, nodes };
    },
  },
  /**
   * The same walk, with the nodes DROPPED — and the honest counterpart to the
   * scenario above.
   *
   * The node cache became weak so that READING every row stops costing
   * permanently. It is easy to quote that as "byId got 4.9x cheaper", and it is
   * only true here, where nothing holds the nodes. Held, they still cost what
   * they cost: a materialised per-entity node is real state, and no cache
   * policy makes retained state free. Measuring both is the difference between
   * a fix and a claim.
   */
  'entitymap-10k-byid-transient': {
    label: 'entityMap 10k + byId() on every row, NOT held',
    n: 10_000,
    unit: 'entity',
    build: (n) => {
      const t = signalTree({ rows: entityMap({ selectId: (r) => r.id }) });
      const data = [];
      for (let i = 0; i < n; i++) data.push({ id: i, name: 'n' + i, v: i });
      t.$.rows.setAll(data);
      for (let i = 0; i < n; i++) void t.$.rows.byId(i);
      return t;
    },
  },
};

// --- child mode: run exactly one scenario, print JSON, exit ----------------
const scenarioFlag = process.argv.indexOf('--scenario');
if (scenarioFlag !== -1) {
  const name = process.argv[scenarioFlag + 1];
  const s = SCENARIOS[name];
  if (!s) {
    console.error(`unknown scenario: ${name}`);
    process.exit(1);
  }
  const r = await measureRetained(() => s.build(s.n), { label: name });
  console.log(
    JSON.stringify({
      scenario: s.label,
      n: s.n,
      unit: s.unit,
      retainedMB: +r.retainedMB.toFixed(2),
      collectable: r.collectable,
      bytesPerUnit: Math.round((r.retainedMB * MB) / s.n),
      // Published so the protocol is auditable from the output alone. Every
      // scenario runs the same quiescence loop; the round count is how many
      // turn boundaries THAT shape needed before the heap stopped moving.
      quiesceRounds: r.quiesceRounds,
    })
  );
  process.exit(0);
}

// --- driver: one child per scenario ---------------------------------------
const { execFileSync } = await import('node:child_process');
const rows = [];
for (const name of Object.keys(SCENARIOS)) {
  const out = execFileSync(
    process.execPath,
    ['--expose-gc', new URL(import.meta.url).pathname, '--scenario', name],
    { encoding: 'utf8', cwd: process.cwd() }
  );
  rows.push(JSON.parse(out.trim().split('\n').pop()));
}

// --- repeated-read growth, its own child too ------------------------------
let readGrowth = 0;
{
  // Same quiescence protocol as every scenario above. Its own `settle()` here
  // was the last place in this file where a heap number was read without a turn
  // boundary — a read-growth check is exactly where "allocation read as
  // retention" would masquerade as a per-read leak.
  const quiescePath = new URL('./lib/heap-quiescence.mjs', import.meta.url)
    .href;
  const code = `
    const { quiesce } = await import(${JSON.stringify('QUIESCE_URL')});
    const { signalTree, entityMap } = await import(${JSON.stringify(CORE)});
    const t = signalTree({ rows: entityMap({ selectId: (r) => r.id }) });
    const data = [];
    for (let i = 0; i < 5000; i++) data.push({ id: i, name: 'n'+i, v: i });
    t.$.rows.setAll(data);
    t();
    const before = (await quiesce({ label: 'read-growth (baseline)' })).heapUsed;
    for (let i = 0; i < 2000; i++) void t();
    const after = (await quiesce({ label: 'read-growth (after reads)' })).heapUsed;
    console.log(((after - before) / (1024*1024)).toFixed(3));
  `.replace('QUIESCE_URL', quiescePath);
  readGrowth = Number(
    execFileSync(
      process.execPath,
      ['--expose-gc', '--input-type=module', '-e', code],
      {
        encoding: 'utf8',
        cwd: process.cwd(),
      }
    ).trim()
  );
}

if (process.argv.includes('--json')) {
  console.log(
    JSON.stringify({ rows, readGrowthMB: +readGrowth.toFixed(3) }, null, 2)
  );
} else {
  console.log('RETAINED HEAP (quiesced per tools/lib/heap-quiescence.mjs)\n');
  console.log(
    '  scenario'.padEnd(46) +
      'retained'.padStart(10) +
      'per unit'.padStart(14) +
      '  collectable'
  );
  console.log('  ' + '─'.repeat(77));
  for (const r of rows) {
    console.log(
      '  ' +
        r.scenario.padEnd(44) +
        `${r.retainedMB.toFixed(2)} MB`.padStart(10) +
        `${r.bytesPerUnit} B/${r.unit}`.padStart(14) +
        `       ${r.collectable ? '✅' : '❌ LEAK'}`
    );
  }
  console.log(
    `\n  2,000 repeated tree() reads grew the heap by ${readGrowth.toFixed(
      3
    )} MB` +
      `\n  (a memo that grows per READ rather than per WRITE would be a leak in any` +
      `\n   app that renders in a loop — this is the check for that.)`
  );
  console.log(
    '\n  "collectable" is a WeakRef check after release — the definitive test.' +
      '\n  A heap delta that has not come back down yet is NOT evidence of a leak;' +
      '\n  V8 reclaims lazily, and reading it that way invented one here.'
  );
}
