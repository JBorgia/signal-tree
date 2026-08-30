#!/usr/bin/env node
/**
 * A LIVE CONSUMER MUST KEEP RECEIVING UPDATES ACROSS GARBAGE COLLECTION.
 *
 * ## Why this exists
 *
 * `entitySignals` is a strong `Map<SubjectId, WritableSignal>`, populated
 * lazily on first observation and never pruned for a live subject. That costs
 * ~568 B/entity once a collection has been read, and the obvious cheaper
 * policy is the one `nodeCache` already uses in the same file: hold the signals
 * weakly, on the theory that a live consumer's dependency edge keeps its signal
 * reachable and the slot drops when nothing can observe it.
 *
 * That policy was implemented and measured. It looked excellent:
 *
 *     core suite                    1,791 pass / 0 fail
 *     post-read residue    1,054 -> 498 B/entity
 *     churn, byId reads      798 -> 249 B/retired
 *
 * It was also silently broken. A live `computed` re-fetches the signal on every
 * read rather than holding it, so its dependency edge does not reliably keep
 * the signal reachable across a collection. The write path then finds a cleared
 * `WeakRef`, skips, and the consumer keeps serving its stale cached value — no
 * error, no failing test, wrong UI.
 *
 * **The suite cannot catch this.** Nothing in 1,791 tests forces a garbage
 * collection, and the property is only observable across one. So the acceptance
 * criterion for any future change to signal retention is this file, not the
 * suite.
 *
 * ## What it asserts
 *
 * Durability of reactive identity, and its deliberate limits:
 *
 *   1. a live consumer still invalidates after GC + allocation pressure
 *   2. a held reference survives remove -> undo of the SAME subject
 *   3. a held reference does NOT follow a fresh occupant of a reused key
 *      (identity is subject-based, not key-based)
 *   4. independent consumers of one member all invalidate
 *
 * 3 is included because an earlier probe asserted key-based continuity and
 * "found" a defect that was the documented contract working correctly.
 *
 * Usage: node --expose-gc tools/check-signal-identity-durability.mjs [--self-test]
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

if (typeof globalThis.gc !== 'function') {
  console.error(
    '❌ requires --expose-gc. This gate exists precisely to exercise a property\n' +
      '   that is only observable across a garbage collection.'
  );
  process.exit(1);
}

const results = [];
const record = (name, ok, detail = '') => results.push({ name, ok, detail });
const collect = () => {
  for (let i = 0; i < 6; i++) globalThis.gc();
};
const turn = () => new Promise((r) => setTimeout(r, 30));
/** Real pressure, so a WeakRef target is genuinely collectable, not merely eligible. */
async function pressure() {
  for (let r = 0; r < 4; r++) {
    collect();
    await turn();
  }
  let ballast = [];
  for (let i = 0; i < 200_000; i++) ballast.push({ i });
  void ballast.length;
  ballast = null;
  collect();
  await turn();
  collect();
}

if (process.argv.includes('--self-test')) {
  // Prove the detection logic can fail: a deliberately non-durable stand-in for
  // the interning map must be caught by the same comparison the live checks use.
  const { signal, computed } = await import('@angular/core');
  const durable = new Map();
  const leaky = new Map();
  const read = (m, k) => {
    let s = m.get(k);
    if (!s) {
      s = signal('initial');
      if (m === durable) m.set(k, s);
    }
    return s;
  };
  const cD = computed(() => read(durable, 1)());
  const cL = computed(() => read(leaky, 1)());
  void cD();
  void cL();
  read(durable, 1).set('updated');
  read(leaky, 1).set('updated'); // writes to a NEW signal; cL never learns
  const detectsLeak = cL() === 'initial';
  const acceptsDurable = cD() === 'updated';
  if (!detectsLeak || !acceptsDurable) {
    console.error(
      `\n❌ self-test FAILED — detects-non-durable=${detectsLeak} accepts-durable=${acceptsDurable}`
    );
    process.exit(1);
  }
  console.log(
    '✅ self-test: detects a non-durable identity map, accepts a durable one'
  );
  process.exit(0);
}

const ROOT = process.cwd();
const ANGULAR = join(ROOT, 'dist/packages/angular');
const KERNEL = join(ROOT, 'dist/packages/kernel');
if (!existsSync(ANGULAR) || !existsSync(KERNEL)) {
  console.error('❌ build first: nx build angular');
  process.exit(1);
}
const fixture = mkdtempSync(join(tmpdir(), 'st-signal-identity-'));
const modules = join(fixture, 'node_modules');
const scope = join(modules, '@signal-tree');
mkdirSync(scope, { recursive: true });
cpSync(ANGULAR, join(scope, 'angular'), { recursive: true });
cpSync(KERNEL, join(scope, 'kernel'), { recursive: true });
mkdirSync(join(modules, '@angular'), { recursive: true });
for (const dependency of ['core']) {
  cpSync(
    join(ROOT, 'node_modules', '@angular', dependency),
    join(modules, '@angular', dependency),
    { recursive: true, dereference: true }
  );
}
for (const dependency of ['rxjs', 'tslib']) {
  cpSync(join(ROOT, 'node_modules', dependency), join(modules, dependency), {
    recursive: true,
    dereference: true,
  });
}
process.on('exit', () => rmSync(fixture, { recursive: true, force: true }));

const angularEntry = join(scope, 'angular', 'dist/index.js');
const { signalTree, entityMap, restoration, undoable } = await import(
  pathToFileURL(angularEntry).href
);
const requireFromFixture = createRequire(join(fixture, 'package.json'));
const { computed } = await import(
  pathToFileURL(requireFromFixture.resolve('@angular/core')).href
);
const cfg = { selectId: (r) => r.id };

// 1 — the decisive one
{
  const t = signalTree({ rows: entityMap(cfg) });
  t.$.rows.setAll([
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
  ]);
  const node = t.$.rows.byId(1);
  const seen = computed(() => node()?.name);
  const before = seen();
  await pressure();
  t.$.rows.updateOne(1, { name: 'Alicia' });
  await turn();
  record(
    'live consumer invalidates after GC pressure',
    seen() === 'Alicia',
    `${before} -> ${seen()}`
  );
}
// 2 — same-subject restore
{
  const t = signalTree({ rows: entityMap(cfg) }, { enhancers: [restoration({ maxHistorySize: 20 })] });
  t.$.rows.setAll([
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
  ]);
  await turn();
  const field = t.$.rows.byId(1).name;
  const seen = computed(() => field());
  const a = seen();
  // ⚠️ DESIGNATED. HIST-C2 made restoration eligibility OPT-IN, and this probe
  // lives outside the test suite so the 194-row migration never reached it.
  // Undesignated, the remove never enters restoration history, `t.undo()` does
  // nothing, and the row reported "reactive identity is not durable" — a stale
  // instrument, not a product defect.
  undoable(() => t.$.rows.removeOne(1));
  await turn();
  const gone = seen();
  await pressure();
  t.undo();
  await turn();
  record(
    'held ref survives remove -> undo of the same subject',
    a === 'Alice' && gone === undefined && seen() === 'Alice',
    `${a} / ${gone} / ${seen()}`
  );
}
// 3 — stale-handle isolation (the limit, not a defect)
{
  const t = signalTree({ rows: entityMap(cfg) });
  t.$.rows.setAll([{ id: 1, name: 'Alice' }]);
  const field = t.$.rows.byId(1).name;
  const seen = computed(() => field());
  void seen();
  t.$.rows.removeOne(1);
  await turn();
  t.$.rows.addOne({ id: 1, name: 'Different' });
  await turn();
  await pressure();
  record(
    'held ref does NOT follow a fresh occupant of a reused key',
    seen() === undefined && t.$.rows.byId(1).name() === 'Different',
    `stale=${seen()} live=${t.$.rows.byId(1).name()}`
  );
}
// 4 — shared identity
{
  const t = signalTree({ rows: entityMap(cfg) });
  t.$.rows.setAll([{ id: 1, name: 'Alice' }]);
  const c1 = computed(() => t.$.rows.byId(1)?.().name);
  const c2 = computed(() => t.$.rows.byId(1)?.().name);
  void c1();
  void c2();
  await pressure();
  t.$.rows.updateOne(1, { name: 'Both' });
  await turn();
  record(
    'independent consumers of one member all invalidate',
    c1() === 'Both' && c2() === 'Both',
    `${c1()} / ${c2()}`
  );
}

const failed = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`  ${r.ok ? '✅' : '❌'} ${r.name.padEnd(56)} ${r.detail}`);
}
if (failed.length) {
  console.error(
    `\n❌ reactive identity is not durable (${failed.length}/${results.length} failed).\n` +
      '   A consumer that stops receiving updates produces wrong UI with no error.\n' +
      '   If signal retention was just changed, this is why the suite still passed.\n'
  );
  process.exit(1);
}
console.log(
  `\n✅ reactive identity durable across GC (${results.length} properties)`
);
