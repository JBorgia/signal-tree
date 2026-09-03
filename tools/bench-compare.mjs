#!/usr/bin/env node
/**
 * CROSS-LIBRARY, REAL IMPLEMENTATIONS.
 *
 * An earlier memory comparison used `signal(rows)` for raw Angular and
 * `signalState({ rows })` for @ngrx/signals against SignalTree's `entityMap`.
 * Those are not the same CAPABILITY — one holds an array, the other maintains a
 * keyed collection with O(1) lookup and per-entity updates — so the numbers were
 * not comparable even though they were correctly measured.
 *
 * Every arm here implements the same thing, the way that library's own docs say
 * to:
 *
 *   signaltree     entityMap({ selectId })
 *   ngrx-signals   signalState + @ngrx/signals/entities updaters (setAllEntities,
 *                  updateEntity) — the official entity API
 *   elf            createStore + withEntities + setEntities/updateEntities
 *   raw-signals    a hand-rolled Map-of-signals store, which is what you write
 *                  when you have no library
 *
 * TWO WORKLOADS:
 *
 *   collection  build 10k, then 200 SINGLE-ENTITY updates, then read all
 *   undo-redo   50 writes recorded to history, then 50 undos
 *
 * Undo/redo is where the libraries genuinely differ. SignalTree ships
 * `restoration()`; elf ships `@ngneat/elf-state-history`, which is installed here
 * and used — testing elf WITHOUT its own history primitive would have been a
 * strawman, and the first run of this file did exactly that.
 *
 * @ngrx/signals has no history primitive for a SignalStore, so its arm does the
 * idiomatic hand-rolled thing: snapshot state per change. That is not a
 * strawman either — it is what the absence of a primitive forces on a user.
 *
 * ONE PROCESS PER ARM (timing and heap both contaminate across arms in-process —
 * design-thesis §3).
 *
 * ONE PROCESS PER *PHASE*, TOO, which is the harder-won half. This file used to
 * run five timing iterations and then take the memory baseline in the same
 * process, separated only by four synchronous `gc()` calls. Those calls do not
 * reclaim what a turn boundary reclaims, so the baseline was read on top of the
 * timing phase's garbage. The proof is unambiguous: add a turn boundary to that
 * flow and the signaltree arm reports MINUS 294 MB retained. A negative
 * retention is not a small error, it is a demonstration that both endpoints
 * were noise — and 66.12 MB came out of the same subtraction. The memory phase
 * now gets a virgin process that builds one store, runs the workload once, and
 * measures. It never sees a timing iteration.
 *
 * AND ONE SETTLING RULE FOR ALL ARMS. Retention is read through
 * `tools/lib/heap-quiescence.mjs`, which drains turn boundaries until the heap
 * stops moving. This matters more than it sounds: adding that boundary moves
 * signaltree by ~54 MB and moves elf, ngrx-signals and raw-signals by 0.00 MB
 * each, because signaltree is the only arm here with a microtask-deferred
 * notifier, weak caches and a FinalizationRegistry. A protocol that only one
 * arm is sensitive to is not a comparison, and the old table was one.
 *
 * Usage: node --expose-gc tools/bench-compare.mjs [--n 10000] [--json]
 *        node --expose-gc tools/bench-compare.mjs --arm <a> --workload <w> --phase <p> --n <n>
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { measureRetained, requireExposeGc } from './lib/heap-quiescence.mjs';

requireExposeGc('tools/bench-compare.mjs');
const CORE = join(process.cwd(), 'dist/packages/kernel/dist/index.js');
if (!existsSync(CORE)) {
  console.error('❌ build first: nx run-many -t build --all');
  process.exit(1);
}

const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? dflt : process.argv[i + 1];
};
const N = Number(arg('--n', 10_000));
const UPDATES = 200;
const HISTORY_WRITES = 50;
// A MICROTASK, not a timer. The notifier flushes via queueMicrotask, so this
// is enough to make history record — and 100 setTimeout(0) calls add ~100ms of
// pure timer granularity to EVERY arm, which swamped the differences being
// measured. Verified below that history still reaches 52 entries.
const tick = () => Promise.resolve();
const seed = (n) => {
  const out = [];
  for (let i = 0; i < n; i++)
    out.push({ id: i, name: 'name' + i, value: i, active: i % 2 === 0 });
  return out;
};

// ---------------------------------------------------------------------------
// REAL IMPLEMENTATIONS — each exposes setAll / updateOne / readAll / snapshot /
// restore so the workloads below are identical across arms.
// ---------------------------------------------------------------------------
const IMPLS = {
  signaltree: async (withHistory) => {
    const { signalTree, entityMap, restoration, undoable } = await import(CORE);
    // v15: the enhancer is DECLARED, so the two arms differ in their build
    // plan as well as their history. That is the real shape now — a tree with
    // no restoration no longer pays for the causal runtime — and it is exactly
    // what the comparison should measure.
    const tree = signalTree(
      { rows: entityMap({ selectId: (r) => r.id }) },
      {
        enhancers: withHistory ? [restoration({ maxHistorySize: 200 })] : [],
        ...(withHistory ? { capabilities: ['causal-runtime'] } : {}),
      }
    );
    return {
      store: tree,
      setAll: (d) => tree.$.rows.setAll(d),
      // RC-HARNESS-1. This called `updateOne` bare while the undo workload
      // described these as "50 undoable USER ACTIONS". v15 restoration is
      // OPT-IN: an undesignated write is deliberately NOT restorable, so the
      // arm measured a contract SignalTree no longer offers and reported
      // "undo restored NOTHING". `undoable(...)` is the public door, so a
      // benchmark user action goes through it — the harness now expresses the
      // frozen contract instead of the pre-v15 automatic-history model.
      updateOne: (id, changes) =>
        withHistory
          ? undoable(() => tree.$.rows.updateOne(id, changes))
          : tree.$.rows.updateOne(id, changes),
      readAll: () => tree.$.rows.all(),
      readOne: (id) => tree.$.rows.byId(id)?.(),
      // Built-in. History entries are snapshot REFERENCES, not clones.
      hasBuiltInHistory: true,
      undo: () => tree.undo(),
    };
  },

  'ngrx-signals': async () => {
    const { signalState, patchState, getState } = await import('@ngrx/signals');
    const { setAllEntities, updateEntity } = await import(
      '@ngrx/signals/entities'
    );
    const store = signalState({ entityMap: {}, ids: [] });
    const history = [];
    return {
      store,
      setAll: (d) => patchState(store, setAllEntities(d)),
      updateOne: (id, changes) =>
        patchState(store, updateEntity({ id, changes })),
      readAll: () => store.ids().map((i) => store.entityMap()[i]),
      readOne: (id) => store.entityMap()[id],
      hasBuiltInHistory: false,
      // No history primitive exists for a SignalStore; this is the hand-rolled
      // equivalent a user has to write.
      record: () => history.push(structuredClone(getState(store))),
      undo: () => {
        const prev = history.pop();
        if (prev) patchState(store, () => prev);
      },
      history,
    };
  },

  elf: async (withHistory) => {
    const { createStore, withProps } = await import('@ngneat/elf');
    const {
      withEntities,
      setEntities,
      updateEntities,
      getAllEntities,
      getEntity,
    } = await import('@ngneat/elf-entities');
    // elf's OWN history primitive — the fair comparison for this library.
    const { stateHistory } = await import('@ngneat/elf-state-history');
    const store = createStore(
      { name: 'bench' },
      withProps({}),
      withEntities({ initialValue: [] })
    );
    const history = withHistory ? stateHistory(store, { maxAge: 200 }) : null;
    return {
      store,
      setAll: (d) => store.update(setEntities(d)),
      updateOne: (id, changes) => store.update(updateEntities(id, changes)),
      readAll: () => store.query(getAllEntities()),
      readOne: (id) => store.query(getEntity(id)),
      hasBuiltInHistory: true,
      undo: () => history?.undo(),
    };
  },

  'raw-signals': async () => {
    const { signal } = await import('@angular/core');
    // What you actually write with no library: a keyed map of per-entity
    // signals plus an id list, so a single-row update does not rebuild the
    // array. This is the fair counterpart to entityMap, not `signal(array)`.
    const byId = new Map();
    const ids = signal([]);
    const history = [];
    const snapshot = () => ids().map((i) => byId.get(i)());
    return {
      store: { byId, ids },
      setAll: (d) => {
        byId.clear();
        for (const e of d) byId.set(e.id, signal(e));
        ids.set(d.map((e) => e.id));
      },
      updateOne: (id, changes) => {
        const s = byId.get(id);
        if (s) s.set({ ...s(), ...changes });
      },
      readAll: snapshot,
      readOne: (id) => byId.get(id)?.(),
      hasBuiltInHistory: false,
      record: () => history.push(structuredClone(snapshot())),
      undo: () => {
        const prev = history.pop();
        if (!prev) return;
        byId.clear();
        for (const e of prev) byId.set(e.id, signal(e));
        ids.set(prev.map((e) => e.id));
      },
      history,
    };
  },
};

// ---------------------------------------------------------------------------
// WORKLOADS
// ---------------------------------------------------------------------------
const WORKLOADS = {
  collection: async (impl, n) => {
    const data = seed(n);
    const t0 = performance.now();
    impl.setAll(data);
    for (let i = 0; i < UPDATES; i++) {
      impl.updateOne(i % n, { value: i + 1_000_000 });
    }
    const all = impl.readAll();
    const t1 = performance.now();
    if (all.length !== n)
      throw new Error(`readAll returned ${all.length}, expected ${n}`);
    return { durationMs: t1 - t0 };
  },

  'undo-redo': async (impl, n) => {
    impl.setAll(seed(n));
    // SignalTree records history on a FLUSH, not on a write — the notifier
    // schedules via queueMicrotask. Let the initial setAll settle before timing.
    await tick();

    const probeId = 0;
    const t0 = performance.now();
    for (let i = 0; i < HISTORY_WRITES; i++) {
      if (!impl.hasBuiltInHistory) impl.record();
      impl.updateOne(probeId, { value: 900_000 + i });
      // One turn per write. 50 undoable USER ACTIONS are 50 separate turns in a
      // real app, and without a turn between them SignalTree coalesces the lot
      // into a single history entry — which is exactly how the first version of
      // this harness measured SignalTree doing nothing at all.
      await tick();
    }
    const afterWrites = impl.readOne(probeId);
    const recordEnd = performance.now();
    const valuesAfterUndo = [];
    for (let i = 0; i < HISTORY_WRITES; i++) {
      impl.undo();
      await tick();
      valuesAfterUndo.push(impl.readOne(probeId)?.value);
    }
    const t1 = performance.now();

    // POSTCONDITIONS — every arm, not just ours. A benchmark that cannot detect
    // it did nothing is the same defect class it exists to expose.
    if (afterWrites?.value !== 900_000 + HISTORY_WRITES - 1) {
      throw new Error(
        `writes did not land: expected ${900_000 + HISTORY_WRITES - 1}, got ${
          afterWrites?.value
        }`
      );
    }
    for (let i = 0; i < HISTORY_WRITES; i++) {
      const expected =
        i === HISTORY_WRITES - 1 ? 0 : 900_000 + HISTORY_WRITES - i - 2;
      if (valuesAfterUndo[i] !== expected) {
        throw new Error(
          `undo ${i + 1} restored ${
            valuesAfterUndo[i]
          }, expected ${expected} — ` +
            `the arm did not retain every write as a distinct history step`
        );
      }
    }
    return {
      durationMs: t1 - t0,
      phases: {
        recordMs: recordEnd - t0,
        undoMs: t1 - recordEnd,
      },
    };
  },
};

// --- child ------------------------------------------------------------------
const armName = arg('--arm', null);
if (armName) {
  const workload = arg('--workload', 'collection');
  const make = IMPLS[armName];
  const run = WORKLOADS[workload];
  if (!make || !run) {
    console.error('unknown arm/workload');
    process.exit(1);
  }

  // History is ON only for the undo/redo workload. Leaving it on during the
  // collection workload confounded the first run: signaltree and elf paid for
  // recording while ngrx-signals and raw-signals did not, because they have no
  // primitive to enable. Each workload now isolates one thing.
  const withHistory = workload === 'undo-redo';

  // ONE PHASE PER PROCESS. `--phase timing` never reads the heap and
  // `--phase memory` never runs a timing iteration, so neither can contaminate
  // the other's endpoints. Splitting these was not a tidiness change: sharing
  // the process is what produced the 66.12 MB this file used to publish.
  const phase = arg('--phase', 'timing');

  if (phase === 'timing') {
    const measurements = [];
    for (let i = 0; i < 5; i++) {
      const impl = await make(withHistory);
      measurements.push(await run(impl, N));
    }
    const times = measurements.map(({ durationMs }) => durationMs);
    times.sort((a, b) => a - b);
    const phaseMedians = Object.fromEntries(
      Object.keys(measurements[0]?.phases ?? {}).map((phaseName) => {
        const samples = measurements
          .map(({ phases }) => phases?.[phaseName])
          .filter((value) => typeof value === 'number')
          .sort((left, right) => left - right);
        return [phaseName, +samples[Math.floor(samples.length / 2)].toFixed(2)];
      })
    );
    console.log(
      JSON.stringify({
        arm: armName,
        workload,
        phase,
        medianMs: +times[2].toFixed(2),
        phaseMedians,
        builtInHistory: (await make(withHistory)).hasBuiltInHistory,
      })
    );
    process.exit(0);
  }

  if (phase === 'memory') {
    // One setup, one workload, one measurement — and `historyLen` is captured
    // inside the closure so holding `impl` for later inspection cannot keep the
    // arm alive past the measurement.
    // WARM THE MODULE GRAPH FIRST, outside the measured window.
    //
    // `make()` does `await import(...)` for its library, and ESM caches
    // modules — so without this the FIRST arm construction charges the whole
    // library's module graph to the collection. That is not a rounding error
    // and it is not equal across arms: @signal-tree/kernel (which pulls Angular)
    // retains 6.67 MB of module graph, @ngrx/signals 5.88 MB, @angular/core
    // alone 5.75 MB, @ngneat/elf 2.18 MB. Charging each arm its own library's
    // load made SignalTree read 18.12 MB against an isolated-probe 11.41 MB for
    // the identical collection, and made the cross-arm gap look 4x smaller than
    // it is by padding every competitor with its own import cost.
    //
    // The warm-up result is garbage by the time the baseline is taken —
    // measureRetained quiesces before it reads `before`.
    await make(withHistory);

    let historyLen = null;
    const measured = await measureRetained(
      async () => {
        const impl = await make(withHistory);
        await run(impl, N);
        historyLen = impl.history ? impl.history.length : null;
        return impl;
      },
      { label: `${armName}/${workload}` }
    );
    console.log(
      JSON.stringify({
        arm: armName,
        workload,
        phase,
        retainedMB: +measured.retainedMB.toFixed(2),
        quiesceRounds: measured.quiesceRounds,
        collectable: measured.collectable,
        historyLen,
      })
    );
    process.exit(0);
  }

  console.error(`unknown phase: ${phase}`);
  process.exit(1);
}

// --- driver -----------------------------------------------------------------
const out = { n: N, workloads: {} };
for (const workload of Object.keys(WORKLOADS)) {
  out.workloads[workload] = [];
  for (const arm of Object.keys(IMPLS)) {
    // Two children per arm: timing and retention never share a process. See the
    // header — sharing one is what produced the number this file used to print.
    const runPhase = (phase) => {
      const res = execFileSync(
        process.execPath,
        [
          '--expose-gc',
          new URL(import.meta.url).pathname,
          '--arm',
          arm,
          '--workload',
          workload,
          '--phase',
          phase,
          '--n',
          String(N),
        ],
        {
          encoding: 'utf8',
          cwd: process.cwd(),
          stdio: ['ignore', 'pipe', 'pipe'],
        }
      );
      return JSON.parse(res.trim().split('\n').pop());
    };
    try {
      const timing = runPhase('timing');
      const memory = runPhase('memory');
      out.workloads[workload].push({
        ...timing,
        ...memory,
        phase: 'timing+memory',
      });
    } catch (err) {
      out.workloads[workload].push({
        arm,
        error: String(err.stderr || err.message)
          .split('\n')
          .filter(Boolean)
          .pop()
          ?.slice(0, 90),
      });
    }
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(out, null, 2));
} else {
  const title = {
    collection: `COLLECTION (no history) — build ${N.toLocaleString()}, ${UPDATES} single-entity updates, read all`,
    'undo-redo': `UNDO/REDO (history ON) — ${HISTORY_WRITES} recorded writes then ${HISTORY_WRITES} undos, over ${N.toLocaleString()} entities`,
  };
  for (const [workload, rows] of Object.entries(out.workloads)) {
    console.log(`\n${title[workload]}`);
    console.log('  ' + '─'.repeat(66));
    console.log(
      '  ' +
        'arm'.padEnd(18) +
        'median'.padStart(11) +
        'retained'.padStart(12) +
        '   history'
    );
    const ok = rows
      .filter((r) => !r.error)
      .sort((a, b) => a.medianMs - b.medianMs);
    for (const r of ok) {
      console.log(
        '  ' +
          r.arm.padEnd(18) +
          `${r.medianMs.toFixed(2)} ms`.padStart(11) +
          `${r.retainedMB.toFixed(2)} MB`.padStart(12) +
          `   ${r.builtInHistory ? 'BUILT-IN' : 'hand-rolled'}`
      );
    }
    for (const r of rows.filter((r) => r.error)) {
      console.log('  ' + r.arm.padEnd(18) + '  — ' + r.error);
    }
    // Say what was covered, not just what was measured. A table with a missing
    // row looks exactly like a table, and the reader has no way to tell that an
    // arm crashed unless it is counted out loud.
    console.log(
      `  ${ok.length}/${rows.length} arms completed` +
        (ok.length < rows.length
          ? ` — ${
              rows.length - ok.length
            } FAILED and are absent from the ranking above`
          : '')
    );
  }
  console.log(
    "\n  Every arm implements the same capability using that library's own entity\n" +
      '  API. SignalTree and elf use their own history primitives; ngrx-signals\n' +
      '  and raw signals snapshot state per change because they have none.'
  );
}

/**
 * A crashed arm must fail the process, not just print a line.
 *
 * The per-arm postconditions catch an arm that did no work, but they run in the
 * CHILD; the parent caught the failure, dropped the arm from the ranking, and
 * exited 0. A benchmark that measured 1 of 4 arms was therefore indistinguishable
 * — to a shell `&&`, to CI, to `verify-gates` — from one that measured all four.
 * That is the same defect as the idle-arm bug this harness was rewritten to fix,
 * one level up: there the arm did nothing, here the arm is missing entirely.
 *
 * `--allow-missing` exists for the legitimate case of a comparison library not
 * being installed, and it says so rather than passing quietly.
 */
const failedArms = Object.entries(out.workloads).flatMap(([workload, rows]) =>
  rows.filter((r) => r.error).map((r) => `${workload}/${r.arm}: ${r.error}`)
);
if (failedArms.length) {
  console.error(`\n${failedArms.length} arm run(s) FAILED:`);
  for (const f of failedArms) console.error(`  ✗ ${f}`);
  if (process.argv.includes('--allow-missing')) {
    console.error('  (--allow-missing: continuing anyway)');
  } else {
    console.error(
      '\nExiting non-zero. Pass --allow-missing if a comparison library is ' +
        'genuinely absent; do NOT publish a table with arms silently missing.'
    );
    process.exit(1);
  }
}
