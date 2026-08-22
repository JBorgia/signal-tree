#!/usr/bin/env node
/**
 * WHERE entityMap's RETAINED BYTES ACTUALLY GO — by layer, one protocol.
 *
 * ## Why this exists
 *
 * A single headline ("10k entities cost ~60 MB") is unactionable and, as it
 * turned out, wrong. It was wrong twice over: the 60 MB was read before the
 * heap had settled (see `tools/lib/heap-quiescence.mjs`), and the ablation that
 * was supposed to attribute it compared arms measured at different settling
 * points. The corrected picture is not a smaller headline, it is a DIFFERENT
 * SHAPE: the base collection is cheap and the cost is concentrated in one
 * optional thing an application chooses to do.
 *
 * ## What each arm may and may not be called
 *
 * These names are deliberately narrow. An earlier write-up of this same data
 * called L1 "the framework-neutral kernel" and the L4->L5 delta "Angular
 * observation", and neither label is what the arms isolate:
 *
 *   - L1 constructs `StructuralStore` + `EntityValueStore` DIRECTLY. Those two
 *     are framework-neutral, but they are not the whole of any neutral kernel —
 *     the arm bypasses mutation framing, commit machinery and identity
 *     plumbing, which a real neutral path would pay for. It is a floor for the
 *     physical stores, not a measurement of "the kernel".
 *
 *   - L2 goes through `createEntitySignal`, and that module imports `signal`
 *     and `computed` from `@angular/core` at its top. Angular has already
 *     entered by L2. "Entity semantics WITHOUT Angular" is not an arm here and
 *     cannot be one without a different build.
 *
 *   - The L4->L5 delta bundles Angular field `computed()`s together with the
 *     callable node object, the set/update/asReadonly closures, the property
 *     descriptors and the metadata getters. Calling the whole delta "Angular"
 *     charges Angular for facade machinery that is ours. L5m/L5 splits the
 *     metadata share back out; the rest stays jointly attributed until a
 *     narrower arm exists.
 *
 * What the arms DO support is the load-bearing conclusion: holding a node for
 * every row is the dominant term, and it is a per-application choice rather
 * than a cost of having 10,000 entities.
 *
 * ONE PROCESS PER ARM, one settling protocol for all of them. Usage:
 *   node --expose-gc tools/bench-entity-layers.mjs [--n 10000] [--json]
 *   node --expose-gc tools/bench-entity-layers.mjs --arm <name> --n <n>
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { measureRetained, requireExposeGc } from './lib/heap-quiescence.mjs';

requireExposeGc('tools/bench-entity-layers.mjs');

const DIST = join(process.cwd(), 'dist/packages/core/dist');
if (!existsSync(join(DIST, 'index.js'))) {
  console.error('❌ build first: nx run-many -t build --all');
  process.exit(1);
}

/**
 * EVERY module is loaded here, at the top, for EVERY arm — including the arms
 * that do not use it.
 *
 * The first version of this file imported inside each arm's builder, which put
 * module load inside the measured window. L0 imports nothing and L4 pulls in
 * core plus Angular, so the payload floor was measured against a baseline the
 * public arm did not have: L4 read 17.87 MB here against 11.35 MB for the same
 * shape in `memory-report.mjs`, and the 6.5 MB gap was module objects, not
 * entities. Same defect class as the one this whole exercise started from —
 * arms measured under conditions that differ from each other — just on a
 * different axis. Hoisting it out charges every arm the same zero.
 */
const [
  { signalTree, entityMap },
  { createEntitySignal },
  { PathNotifier },
  { StructuralStore },
  { EntityValueStore },
] = await Promise.all([
  import(`${DIST}/index.js`),
  import(`${DIST}/lib/entity-signal.js`),
  import(`${DIST}/lib/path-notifier.js`),
  import(`${DIST}/lib/physical/structural-store.js`),
  import(`${DIST}/lib/physical/entity-value-store.js`),
]);

const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? dflt : process.argv[i + 1];
};
const N = Number(arg('--n', 10_000));

const cfg = { selectId: (r) => r.id };
const seed = (n) => {
  const d = [];
  for (let i = 0; i < n; i++) d.push({ id: i, name: 'n' + i, v: i });
  return d;
};
const NO_METADATA = {
  ownerMetadataEnabled: false,
  subjectMetadataEnabled: false,
  positionMetadataEnabled: false,
};

/**
 * `label` is what the arm measures. `claims` is what may be said about it —
 * separated because the first write-up of this data went wrong entirely in the
 * gap between the two.
 */
const ARMS = {
  'L0-payload': {
    label: 'plain Map of the same entities',
    claims: 'payload floor — no library involved',
    build: (n) => {
      const m = new Map();
      for (const e of seed(n)) m.set(e.id, e);
      return m;
    },
  },
  'L1-physical-stores': {
    label: 'StructuralStore + EntityValueStore, populated directly',
    claims: 'physical entity stores only; NOT "the framework-neutral kernel"',
    build: (n) => {
      const ss = new StructuralStore();
      const vs = new EntityValueStore();
      for (const e of seed(n)) {
        const sid = ss.allocateFreshSubjectId();
        ss.createSubject(sid, e.id);
        vs.retainSubjectValue(sid, e);
      }
      return { ss, vs };
    },
  },
  'L2-entity-semantics-nometa': {
    label: 'createEntitySignal + setAll, metadata off',
    claims: 'entity realization — ALREADY includes Angular signal/computed',
    build: (n) => {
      const es = createEntitySignal(
        cfg,
        new PathNotifier(),
        'rows',
        NO_METADATA
      );
      es.setAll(seed(n));
      return es;
    },
  },
  'L3-entity-semantics': {
    label: 'createEntitySignal + setAll, metadata on (default)',
    claims: 'metadata flags cost ~nothing until a node exists',
    build: (n) => {
      const es = createEntitySignal(cfg, new PathNotifier(), 'rows');
      es.setAll(seed(n));
      return es;
    },
  },
  'L4-public-entitymap': {
    label: 'signalTree({ rows: entityMap() }) + setAll',
    claims: 'THE PUBLIC BASELINE — what having N entities actually costs',
    build: (n) => {
      const t = signalTree({ rows: entityMap(cfg) });
      t.$.rows.setAll(seed(n));
      return t;
    },
  },
  'L5t-nodes-transient': {
    label: 'public + byId() on every row, nodes dropped',
    claims:
      'residue of a full read: the strong entitySignals map, never pruned',
    build: (n) => {
      const t = signalTree({ rows: entityMap(cfg) });
      t.$.rows.setAll(seed(n));
      for (let i = 0; i < n; i++) void t.$.rows.byId(i);
      return t;
    },
  },
  'L5-nodes-held': {
    label: 'public + byId() on every row, ALL nodes held',
    claims: 'held per-row node/field realization — the dominant term',
    build: (n) => {
      const t = signalTree({ rows: entityMap(cfg) });
      t.$.rows.setAll(seed(n));
      const nodes = [];
      for (let i = 0; i < n; i++) nodes.push(t.$.rows.byId(i));
      return { t, nodes };
    },
  },
  'L5m-nodes-held-nometa': {
    label: 'all nodes held, owner/subject/position metadata OFF',
    claims: 'control for L5 — the difference is the metadata accessors',
    build: (n) => {
      const es = createEntitySignal(
        cfg,
        new PathNotifier(),
        'rows',
        NO_METADATA
      );
      es.setAll(seed(n));
      const nodes = [];
      for (let i = 0; i < n; i++) nodes.push(es.byId(i));
      return { es, nodes };
    },
  },
};

// --- child ------------------------------------------------------------------
const armFlag = process.argv.indexOf('--arm');
if (armFlag !== -1) {
  const name = process.argv[armFlag + 1];
  const a = ARMS[name];
  if (!a) {
    console.error(`unknown arm: ${name}`);
    process.exit(1);
  }
  const m = await measureRetained(() => a.build(N), { label: name });
  console.log(
    JSON.stringify({
      arm: name,
      label: a.label,
      claims: a.claims,
      retainedMB: +m.retainedMB.toFixed(2),
      bytesPerEntity: Math.round(m.retainedBytes / N),
      quiesceRounds: m.quiesceRounds,
      collectable: m.collectable,
    })
  );
  process.exit(0);
}

// --- driver -------------------------------------------------------------------
const rows = [];
for (const name of Object.keys(ARMS)) {
  try {
    const out = execFileSync(
      process.execPath,
      [
        '--expose-gc',
        new URL(import.meta.url).pathname,
        '--arm',
        name,
        '--n',
        String(N),
      ],
      {
        encoding: 'utf8',
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
    rows.push(JSON.parse(out.trim().split('\n').pop()));
  } catch (err) {
    rows.push({
      arm: name,
      error: String(err.stderr || err.message)
        .split('\n')
        .filter(Boolean)
        .pop()
        ?.slice(0, 100),
    });
  }
}

const ok = rows.filter((r) => !r.error);
if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ n: N, rows }, null, 2));
} else {
  console.log(
    `\nRETAINED HEAP BY LAYER — ${N.toLocaleString()} entities, 3 fields each`
  );
  console.log(
    'quiesced per tools/lib/heap-quiescence.mjs; one process per arm\n'
  );
  console.log(
    '  ' +
      'arm'.padEnd(28) +
      'retained'.padStart(11) +
      'per entity'.padStart(13) +
      '   what it isolates'
  );
  console.log('  ' + '─'.repeat(100));
  for (const r of ok) {
    console.log(
      '  ' +
        r.arm.padEnd(28) +
        `${r.retainedMB.toFixed(2)} MB`.padStart(11) +
        `${r.bytesPerEntity} B`.padStart(13) +
        `   ${r.claims}`
    );
  }
  for (const r of rows.filter((r) => r.error)) {
    console.log('  ' + r.arm.padEnd(28) + '  — ' + r.error);
  }
  const get = (n) => ok.find((r) => r.arm === n)?.retainedMB;
  const base = get('L4-public-entitymap');
  const held = get('L5-nodes-held');
  const heldNoMeta = get('L5m-nodes-held-nometa');
  if (base !== undefined && held !== undefined && heldNoMeta !== undefined) {
    console.log(
      `\n  Held per-row node/field realization: +${(held - base).toFixed(
        2
      )} MB ` +
        `(${(((held - base) / held) * 100).toFixed(
          0
        )}% of the all-held configuration).`
    );
    console.log(
      `  Of that, ${(held - heldNoMeta).toFixed(
        2
      )} MB is the owner/subject/position` +
        ` metadata accessors.\n  The remainder is jointly the Angular field computeds AND the` +
        ` node/facade objects;\n  no arm here separates those two, so neither is charged alone.`
    );
  }
  console.log(
    `\n  ${ok.length}/${rows.length} arms completed` +
      (ok.length < rows.length ? ' — the rest FAILED and are absent above' : '')
  );
}
