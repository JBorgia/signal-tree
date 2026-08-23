#!/usr/bin/env node
/**
 * UPDATE-COST MATRIX — cross-library BASELINE, not a published comparison.
 *
 * Step 7.5 of the 15.0 lifecycle sequence. It exists to answer one question
 * before any further memory work changes the hot path:
 *
 *     does update cost stay ~O(1) in UNRELATED collection size, and scale
 *     predictably with the number of consumers actually affected?
 *
 * Not "who wins a microbenchmark". A headline ops/sec is a statement about one
 * fixture; a SHAPE across 1k -> 10k -> 100k and 0 -> 100 consumers is a
 * statement about the architecture, and only the second survives a change of
 * hardware.
 *
 * ## Read before quoting anything from this file
 *
 * 1. THIS IS CHECKPOINT 1 OF 3. Re-run unchanged after history-aware
 *    reclamation (Step 8), then once more from a clean pinned environment for
 *    the RC. Numbers from this run are a baseline to compare against, not v15's
 *    published figures.
 * 2. MACHINE LOAD MOVES THESE MORE THAN MOST CODE CHANGES DO. See the warning in
 *    docs/architecture/v15-performance-baseline.md — the same unchanged build
 *    measured a 3.8x spread on one operation inside a single session. Compare
 *    runs of this tool only against other runs of this tool taken back to back.
 * 3. TWO CONFIGURATIONS, ALWAYS BOTH. A library doing less looks faster. `raw`
 *    is minimum equivalent functionality; `featured` is a normal production
 *    configuration with history. Reporting only one of them is how a comparison
 *    becomes an advertisement.
 *
 * ## Fairness rules, inherited from bench-compare.mjs
 *
 * Every arm implements the same CAPABILITY using that library's own documented
 * API — `entityMap`, `@ngrx/signals/entities`, `elf` + `withEntities`, and a
 * hand-rolled Map-of-signals for "no library". Where a library has no
 * equivalent primitive the cell reports `n/a` and says why; it never reports a
 * hand-rolled substitute as if it were the library's own, and it never omits
 * the row to avoid an unflattering number.
 *
 * ONE CHILD PROCESS PER CELL. A cell is (library, config, axis point,
 * operation). Timing and heap both contaminate across arms in-process, and ops
 * within one arm contaminate each other through JIT and heap state.
 *
 * ## What each operation is for
 *
 *   update-one-field      the core hot path
 *   update-whole-entity   structural replacement cost
 *   update-10-fields      change-tracking scaling
 *   update-100-fields     the same, an order of magnitude out
 *   update-repeated       same field, same value region — revision/signal overhead
 *   update-batched-100    transaction/batching efficiency
 *   churn                 add + update + remove, lifecycle bookkeeping
 *   update-rollback       history/transaction cost (featured only)
 *
 * Usage:
 *   node --expose-gc tools/bench-update-matrix.mjs [--axis operations|consumers|memory|all]
 *                                                  [--samples 7] [--json]
 *   node --expose-gc tools/bench-update-matrix.mjs --cell <lib> <config> <op> <n> <consumers>
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { measureRetained, requireExposeGc } from './lib/heap-quiescence.mjs';

requireExposeGc('tools/bench-update-matrix.mjs');

const CORE = join(process.cwd(), 'dist/packages/core/dist/index.js');
if (!existsSync(CORE)) {
  console.error('❌ build first: nx run-many -t build --all');
  process.exit(1);
}

const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? dflt : process.argv[i + 1];
};

const SAMPLES = Number(arg('--samples', 5));
const WARMUP = 2;
const SIZES = [1_000, 10_000, 100_000];
const CONSUMER_COUNTS = [0, 1, 10, 100];
const CONSUMER_SIZE = 10_000;
const BATCH = 100;
const REPEATS = Number(arg('--repeats', 200));
const CHILD_HEAP_MB = Number(arg('--child-heap-mb', 8192));

const seed = (n) => {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({ id: i, name: 'name' + i, value: i, active: i % 2 === 0 });
  }
  return out;
};

/** A patch touching `count` distinct fields, for the change-tracking axis. */
const widePatch = (count, salt) => {
  const patch = {};
  for (let f = 0; f < count; f++) patch['f' + f] = `${salt}-${f}`;
  return patch;
};

// ---------------------------------------------------------------------------
// IMPLEMENTATIONS
//
// Same contract for every arm. `null` for a capability means "this library has
// no equivalent" and the cell reports n/a — it does NOT mean "substitute
// something hand-rolled and call it theirs".
// ---------------------------------------------------------------------------
const IMPLS = {
  signaltree: async (featured) => {
    const { signalTree, entityMap, timeTravel, batching, transactions } =
      await import(CORE);
    const { computed } = await import('@angular/core');
    const enhancers = featured
      ? [timeTravel({ maxHistorySize: 200 }), batching(), transactions()]
      : [];
    const tree = signalTree(
      { rows: entityMap({ selectId: (r) => r.id }) },
      { enhancers }
    );
    return {
      setAll: (d) => tree.$.rows.setAll(d),
      updateOne: (id, changes) => tree.$.rows.updateOne(id, changes),
      replaceOne: (id, row) => tree.$.rows.replaceOne(id, row),
      addOne: (row) => tree.$.rows.addOne(row),
      removeOne: (id) => tree.$.rows.removeOne(id),
      readOne: (id) => tree.$.rows.byId(id)?.(),
      count: () => tree.$.rows.count(),
      // A consumer that recomputes when ONE row's field changes. `byId` returns
      // the row node, so this is the granular subscription the library offers.
      makeConsumer: (id) => {
        const node = tree.$.rows.byId(id);
        return computed(() => node?.()?.value);
      },
      // A tree that has taken writes is retained until destroyed — measured, not
      // assumed: six abandoned builds accumulate 452 MB and then OOM, while six
      // destroyed builds settle at 7.4 MB.
      // See tools/probe-history-sample-isolation.mjs.
      teardown: () => tree.destroy(),
      batch: featured ? (fn) => tree.batch(fn) : null,
      rollback: featured
        ? (fn) => {
            const pending = tree.transaction(fn);
            pending.rollback();
          }
        : null,
    };
  },

  'ngrx-signals': async (featured) => {
    const { signalState, patchState, getState } = await import('@ngrx/signals');
    const { setAllEntities, updateEntity, setEntity, addEntity, removeEntity } =
      await import('@ngrx/signals/entities');
    const { computed } = await import('@angular/core');
    const store = signalState({ entityMap: {}, ids: [] });
    const history = [];
    return {
      setAll: (d) => patchState(store, setAllEntities(d)),
      updateOne: (id, changes) =>
        patchState(store, updateEntity({ id, changes })),
      replaceOne: (id, row) => patchState(store, setEntity(row)),
      addOne: (row) => patchState(store, addEntity(row)),
      removeOne: (id) => patchState(store, removeEntity(id)),
      readOne: (id) => store.entityMap()[id],
      count: () => store.ids().length,
      makeConsumer: (id) => computed(() => store.entityMap()[id]?.value),
      // patchState already applies its updaters in one state transition, so a
      // "batch" of N updates is N updaters in one call — the library's own way.
      batch: null,
      batchUpdaters: (updaters) => patchState(store, ...updaters),
      makeUpdater: (id, changes) => updateEntity({ id, changes }),
      // No transaction primitive for a SignalStore. Snapshot/restore is what
      // its absence forces, and it is reported as hand-rolled, not as theirs.
      rollback: featured
        ? (fn) => {
            const before = structuredClone(getState(store));
            fn();
            patchState(store, () => before);
          }
        : null,
      rollbackIsHandRolled: true,
      history,
    };
  },

  elf: async (featured) => {
    const { createStore, withProps } = await import('@ngneat/elf');
    const {
      withEntities,
      setEntities,
      updateEntities,
      addEntities,
      deleteEntities,
      getEntity,
      getEntitiesCount,
      selectEntity,
    } = await import('@ngneat/elf-entities');
    const { stateHistory } = await import('@ngneat/elf-state-history');
    const store = createStore(
      { name: 'bench' },
      withProps({}),
      withEntities({ initialValue: [] })
    );
    // Attached in the featured config so its per-update recording cost is IN
    // the measurement, which is the whole point of the featured arm. Never read
    // here — `undo()` belongs to bench-compare.mjs, not to an update matrix.
    const elfHistory = featured ? stateHistory(store, { maxAge: 200 }) : null;
    void elfHistory;
    const subscriptions = [];
    return {
      setAll: (d) => store.update(setEntities(d)),
      updateOne: (id, changes) => store.update(updateEntities(id, changes)),
      replaceOne: (id, row) => store.update(updateEntities(id, () => row)),
      addOne: (row) => store.update(addEntities(row)),
      removeOne: (id) => store.update(deleteEntities(id)),
      readOne: (id) => store.query(getEntity(id)),
      count: () => store.query(getEntitiesCount()),
      makeConsumer: (id) => {
        let last;
        const sub = store.pipe(selectEntity(id)).subscribe((e) => {
          last = e?.value;
        });
        subscriptions.push(sub);
        return () => last;
      },
      teardown: () => {
        for (const sub of subscriptions) sub.unsubscribe();
        store.destroy();
      },
      // elf has no batching primitive that coalesces N separate `update` calls;
      // its unit of atomicity is the single `update`.
      batch: null,
      // and no transaction/rollback primitive either. `stateHistory().undo()`
      // is history, not a transaction boundary, so it is NOT substituted here.
      rollback: null,
    };
  },

  'raw-signals': async (featured) => {
    const { signal, computed } = await import('@angular/core');
    const byId = new Map();
    const ids = signal([]);
    const snapshot = () => ids().map((i) => byId.get(i)());
    return {
      setAll: (d) => {
        byId.clear();
        for (const e of d) byId.set(e.id, signal(e));
        ids.set(d.map((e) => e.id));
      },
      updateOne: (id, changes) => {
        const s = byId.get(id);
        if (s) s.set({ ...s(), ...changes });
      },
      replaceOne: (id, row) => byId.get(id)?.set(row),
      addOne: (row) => {
        byId.set(row.id, signal(row));
        ids.set([...ids(), row.id]);
      },
      removeOne: (id) => {
        byId.delete(id);
        ids.set(ids().filter((i) => i !== id));
      },
      readOne: (id) => byId.get(id)?.(),
      count: () => ids().length,
      makeConsumer: (id) => {
        const s = byId.get(id);
        return computed(() => s?.()?.value);
      },
      batch: null,
      rollback: featured
        ? (fn) => {
            const before = structuredClone(snapshot());
            fn();
            byId.clear();
            for (const e of before) byId.set(e.id, signal(e));
            ids.set(before.map((e) => e.id));
          }
        : null,
      rollbackIsHandRolled: true,
    };
  },
};

// ---------------------------------------------------------------------------
// OPERATIONS
//
// Each returns { skip } when the arm has no equivalent, or runs `body` once and
// asserts a POSTCONDITION. An arm whose write silently did nothing is the
// failure mode a timing harness cannot see, so every op proves its effect.
// ---------------------------------------------------------------------------
const OPS = {
  'update-one-field': {
    detail: 'one field of one row — the core hot path',
    setup: (impl, n) => impl.setAll(seed(n)),
    run: (impl, n, i) => impl.updateOne(i % n, { value: 900000 + i }),
    check: (impl, n, iterations) =>
      impl.readOne((iterations - 1) % n)?.value ===
      900000 + (iterations - 1),
    iterations: REPEATS,
  },

  'update-whole-entity': {
    detail: 'structural replacement of the whole row',
    setup: (impl, n) => impl.setAll(seed(n)),
    run: (impl, n, i) =>
      impl.replaceOne(i % n, {
        id: i % n,
        name: 'replaced' + i,
        value: 900000 + i,
        active: true,
      }),
    check: (impl, n, iterations) =>
      impl.readOne((iterations - 1) % n)?.name ===
      'replaced' + (iterations - 1),
    iterations: REPEATS,
  },

  'update-10-fields': {
    detail: 'ten fields at once — change-tracking scaling',
    // Capped at 10k. This axis varies FIELD count, not row count, and seeding
    // 100k rows x 100 fields nine times per cell measures the seed loop.
    sizes: [1_000, 10_000],
    setup: (impl, n) => impl.setAll(seed(n).map((r) => ({ ...r, ...widePatch(10, 'init') }))),
    run: (impl, n, i) => impl.updateOne(i % n, widePatch(10, 'w' + i)),
    check: (impl, n, iterations) =>
      impl.readOne((iterations - 1) % n)?.f9 === `w${iterations - 1}-9`,
    iterations: REPEATS,
  },

  'update-100-fields': {
    detail: 'a hundred fields at once — the same axis, 10x out',
    sizes: [1_000, 10_000],
    setup: (impl, n) => {
      const data = seed(n).map((r) => ({ ...r, ...widePatch(100, 'init') }));
      impl.setAll(data);
    },
    run: (impl, n, i) => impl.updateOne(i % n, widePatch(100, 'w' + i)),
    check: (impl, n, iterations) =>
      impl.readOne((iterations - 1) % n)?.f99 === `w${iterations - 1}-99`,
    iterations: REPEATS,
  },

  'update-repeated': {
    detail: 'the SAME field of the SAME row, repeatedly — revision overhead',
    setup: (impl, n) => impl.setAll(seed(n)),
    run: (impl, n, i) => impl.updateOne(0, { value: 900000 + i }),
    check: (impl, n, iterations) =>
      impl.readOne(0)?.value === 900000 + (iterations - 1),
    iterations: REPEATS,
  },

  'update-batched-100': {
    detail: 'a hundred updates inside the library batching primitive',
    unit: 'batch of 100',
    sizes: [1_000, 10_000],
    // Only for arms that HAVE one. ngrx-signals composes updaters into a single
    // patchState, which is its own equivalent and is measured as such; elf and
    // raw signals have neither and report n/a.
    setup: (impl, n) => impl.setAll(seed(n)),
    run: (impl, n, i) => {
      if (impl.batch) {
        impl.batch(() => {
          for (let k = 0; k < BATCH; k++) {
            impl.updateOne(k % n, { value: 800000 + i * BATCH + k });
          }
        });
        return;
      }
      const updaters = [];
      for (let k = 0; k < BATCH; k++) {
        updaters.push(impl.makeUpdater(k % n, { value: 800000 + i * BATCH + k }));
      }
      impl.batchUpdaters(updaters);
    },
    skip: (impl) =>
      impl.batch || impl.batchUpdaters
        ? undefined
        : 'no batching or multi-updater primitive',
    check: (impl) => impl.readOne(0)?.value >= 800000,
    iterations: 20,
  },

  churn: {
    detail: 'add + update + remove — lifecycle bookkeeping',
    unit: 'add+update+remove cycle',
    setup: (impl, n) => impl.setAll(seed(n)),
    run: (impl, n, i) => {
      const id = n + i;
      impl.addOne({ id, name: 'churn' + i, value: i, active: false });
      impl.updateOne(id, { value: i + 1 });
      impl.removeOne(id);
    },
    check: (impl, n) => impl.count() === n,
    iterations: REPEATS,
  },

  'update-rollback': {
    detail: 'update inside a transaction, then roll it back',
    unit: 'update+rollback',
    // A rollback snapshots whole state in the hand-rolled arms, so 100k here
    // measures structuredClone, not the transaction boundary.
    sizes: [1_000, 10_000],
    setup: (impl, n) => impl.setAll(seed(n)),
    run: (impl, n, i) => {
      impl.rollback(() => impl.updateOne(i % n, { value: 700000 + i }));
    },
    skip: (impl, featured) => {
      if (!featured) return 'raw config has no transaction boundary';
      if (!impl.rollback) return 'no transaction/rollback primitive';
      return undefined;
    },
    // The row must be BACK to its seeded value. A rollback that silently did
    // nothing would otherwise time as the fastest arm in the table.
    check: (impl, n, iterations) => {
      const id = (iterations - 1) % n;
      return impl.readOne(id)?.value === id;
    },
    iterations: 50,
    handRolledFor: (impl) => Boolean(impl.rollbackIsHandRolled),
  },
};

// ---------------------------------------------------------------------------
// CHILD — one cell
// ---------------------------------------------------------------------------
const cellFlag = process.argv.indexOf('--cell');
if (cellFlag !== -1) {
  const [lib, config, opName, nRaw, consumersRaw] = process.argv.slice(
    cellFlag + 1,
    cellFlag + 6
  );
  const n = Number(nRaw);
  const consumers = Number(consumersRaw ?? 0);
  const featured = config === 'featured';
  const op = OPS[opName];
  if (!IMPLS[lib] || !op) {
    console.error(`unknown cell: ${lib} / ${opName}`);
    process.exit(1);
  }

  const emit = (payload) => {
    console.log(JSON.stringify({ lib, config, op: opName, n, consumers, ...payload }));
    process.exit(0);
  };

  const build = async () => {
    const impl = await IMPLS[lib](featured);
    op.setup(impl, n);
    const held = [];
    for (let c = 0; c < consumers; c++) {
      // Every consumer watches the SAME row, which is the row the op writes.
      // Spreading them across rows would measure "did anything fire" rather
      // than fan-out, and fan-out is the axis.
      const consumer = impl.makeConsumer(0);
      consumer();
      held.push(consumer);
    }
    return { impl, held };
  };

  const first = await IMPLS[lib](featured);
  const skip = op.skip?.(first, featured);
  if (skip) emit({ skip });

  if (process.argv.includes('--memory')) {
    // Retention AFTER the workload, quiesced. Speed that hides retention is the
    // thing this column exists to expose.
    // NOTE: deliberately no teardown here. This arm measures what a LIVE store
    // retains; destroying it would measure the empty case.
    const measured = await measureRetained(
      async () => {
        const { impl, held } = await build();
        for (let i = 0; i < op.iterations; i++) op.run(impl, n, i);
        for (const consumer of held) consumer();
        if (!op.check(impl, n, op.iterations)) {
          throw new Error(`${lib}/${opName}: postcondition failed`);
        }
        return { impl, held };
      },
      { label: `${lib}/${config}/${opName}/${n}` }
    );
    // `collectable` is reported alongside: a retention figure for a graph that
    // never came back down is a statement about GC timing, not about the store.
    emit({
      retainedMB: +measured.retainedMB.toFixed(2),
      collectable: measured.collectable,
    });
  }

  const samples = [];
  for (let s = 0; s < SAMPLES + WARMUP; s++) {
    // RELEASE THE PREVIOUS SAMPLE'S STORE BEFORE BUILDING THE NEXT.
    //
    // Dropping the reference is NOT enough, and getting this wrong produced a
    // wrong finding before it produced a crash. An abandoned SignalTree that has
    // taken writes stays fully reachable: six builds accumulate 452 MB and OOM,
    // while six builds that call `destroy()` settle at 7.4 MB. The harness was
    // abandoning them, so the largest featured cells died and the failure was
    // written up as if the library's history representation were at fault.
    //
    // It is a LIFECYCLE CONTRACT, not a leak — `destroy()` releases it — and the
    // teardown below is the harness honouring that contract.
    // Discriminated in tools/probe-history-sample-isolation.mjs.
    globalThis.gc?.();
    let sample = await build();
    const { impl, held } = sample;
    const start = performance.now();
    for (let i = 0; i < op.iterations; i++) op.run(impl, n, i);
    // Reading the consumers INSIDE the timed region is the point: a library
    // that defers invalidation has not finished the update until the dependent
    // value is available again.
    for (const consumer of held) consumer();
    const elapsed = performance.now() - start;

    if (!op.check(impl, n, op.iterations)) {
      console.error(
        `❌ ${lib}/${config}/${opName}/n=${n}: postcondition failed — the ` +
          `writes did not land, so any timing here is meaningless.`
      );
      process.exit(1);
    }
    impl.teardown?.();
    if (s >= WARMUP) samples.push(elapsed / op.iterations);
    sample = undefined;
  }


  samples.sort((a, b) => a - b);
  emit({
    medianUs: +(samples[Math.floor(samples.length / 2)] * 1000).toFixed(3),
    minUs: +(samples[0] * 1000).toFixed(3),
    maxUs: +(samples.at(-1) * 1000).toFixed(3),
    iterations: op.iterations,
    handRolled: Boolean(op.handRolledFor?.(first)),
  });
}

// ---------------------------------------------------------------------------
// DRIVER
// ---------------------------------------------------------------------------
const LIBS = ['signaltree', 'ngrx-signals', 'elf', 'raw-signals'];
const CONFIGS = ['raw', 'featured'];
const axis = arg('--axis', 'all');

const REDUCED_SAMPLES = 3;

function runCell(lib, config, op, n, consumers, memory = false, samples = SAMPLES) {
  const argv = [
    '--expose-gc',
    // Applied to EVERY cell equally, so it is a resource setting and not a
    // per-arm methodology change. Needed because the largest featured cells
    // hold a 100k-row store with a 200-entry history — ~190 MB each — and the
    // sample loop builds several. Without it the run OOMs and reports the crash
    // as if the library under test had failed.
    `--max-old-space-size=${CHILD_HEAP_MB}`,
    join(process.cwd(), 'tools/bench-update-matrix.mjs'),
    '--cell',
    lib,
    config,
    op,
    String(n),
    String(consumers),
    '--samples',
    String(samples),
  ];
  if (memory) argv.push('--memory');
  try {
    const out = execFileSync(process.execPath, argv, {
      encoding: 'utf8',
      maxBuffer: 1 << 26,
    });
    return JSON.parse(out.trim().split('\n').at(-1));
  } catch (error) {
    const stderr = String(error.stderr ?? error.message);
    // The last stderr line of a V8 OOM is a dyld stack frame, which says
    // nothing. Classify the failure instead of reporting its last line.
    if (/JavaScript heap out of memory/.test(stderr)) {
      // RETRY ONCE WITH FEWER SAMPLES, and mark the cell. Do not silently lower
      // the sample count for everyone to make one cell fit — the reduction IS a
      // finding, and hiding it inside a default would erase it.
      //
      // ⚠️ THE FIRST EXPLANATION WRITTEN HERE WAS WRONG. It said the
      // history-recording update loop accumulates across samples. Two things
      // refuted it (tools/probe-history-sample-isolation.mjs):
      //
      //   - a single build costs 84.3 MB at ZERO updates and 94.99 MB at 400,
      //     so history is ~27 KB/update and is not what fills the heap
      //   - adding `destroy()` to this teardown — which does release an
      //     abandoned store, 452 MB -> 7.4 MB over six builds — did NOT clear
      //     this cell
      //
      // What is actually happening in this ONE cell is not yet localized:
      // seeding it costs ~142 KB/row inside this harness against ~8 KB/row in
      // every standalone reproduction, including one running the harness's own
      // impl code inside the harness's own process. Linear in n, reproducible,
      // unexplained. See the OPEN ITEM in
      // docs/architecture/v15-update-matrix-baseline.md — and do not quote the
      // featured wide-field row until it is closed.
      if (samples > REDUCED_SAMPLES) {
        const retried = runCell(
          lib,
          config,
          op,
          n,
          consumers,
          memory,
          REDUCED_SAMPLES
        );
        if (!retried.error) {
          return { ...retried, reducedSamples: REDUCED_SAMPLES };
        }
      }
      return {
        lib,
        config,
        op,
        n,
        consumers,
        error: `OOM at ${samples} samples — the harness cannot hold this cell`,
      };
    }
    return {
      lib,
      config,
      op,
      n,
      consumers,
      error: stderr.trim().split('\n').at(-1),
    };
  }
}

const cell = (row) => {
  if (row.skip) return 'n/a';
  if (row.error) return 'OOM';
  if (row.retainedMB !== undefined) return `${row.retainedMB.toFixed(2)}MB`;
  const marks = `${row.handRolled ? '*' : ''}${row.reducedSamples ? '\u2020' : ''}`;
  return `${row.medianUs.toFixed(2)}${marks}`;
};

const table = (title, subtitle, columns, rows) => {
  console.log(`\n${title}`);
  if (subtitle) console.log(`  ${subtitle}`);
  const width = Math.max(22, ...rows.map((r) => r.label.length + 2));
  console.log(
    '  ' +
      'arm'.padEnd(width) +
      columns.map((c) => String(c).padStart(12)).join('')
  );
  console.log('  ' + '─'.repeat(width + columns.length * 12));
  for (const row of rows) {
    console.log(
      '  ' + row.label.padEnd(width) + row.cells.map((c) => c.padStart(12)).join('')
    );
  }
};

const report = { samples: SAMPLES, axes: {} };
const notes = new Set();

function collectSkips(rows) {
  for (const row of rows) {
    if (row.skip) notes.add(`${row.lib} / ${row.op}: ${row.skip}`);
    if (row.error) notes.add(`${row.lib} / ${row.op} @ n=${row.n}: ${row.error}`);
    if (row.reducedSamples) {
      notes.add(
        `${row.lib} / ${row.op} @ n=${row.n}: reduced to ${row.reducedSamples} ` +
          `samples (\u2020) — it OOMs at ${SAMPLES}, and the cause is NOT yet ` +
          `localized. Not history (27 KB/update measured) and not the abandoned ` +
          `store (destroy() is called and does release it). Do not quote this ` +
          `row; see the OPEN ITEM in v15-update-matrix-baseline.md.`
      );
    }
    if (row.handRolled) {
      notes.add(
        `${row.lib} / ${row.op}: HAND-ROLLED (*) — the library has no primitive, ` +
          `so this is what its absence forces on a user, not its own feature`
      );
    }
  }
}

if (axis === 'operations' || axis === 'all') {
  for (const config of CONFIGS) {
    for (const opName of Object.keys(OPS)) {
      const rows = [];
      const raw = [];
      const opSizes = OPS[opName].sizes ?? SIZES;
      for (const lib of LIBS) {
        const cells = [];
        for (const n of opSizes) {
          const result = runCell(lib, config, opName, n, 0);
          raw.push(result);
          cells.push(cell(result));
        }
        rows.push({ label: lib, cells });
      }
      collectSkips(raw);
      report.axes[`operations/${config}/${opName}`] = raw;
      table(
        `${opName.toUpperCase()} — ${config}  (µs per ${OPS[opName].unit ?? 'operation'}, median of ${SAMPLES})`,
        OPS[opName].detail,
        opSizes.map((n) => `${n / 1000}k rows`),
        rows
      );
    }
  }
}

if (axis === 'consumers' || axis === 'all') {
  for (const config of CONFIGS) {
    const rows = [];
    const raw = [];
    for (const lib of LIBS) {
      const cells = [];
      for (const consumers of CONSUMER_COUNTS) {
        const result = runCell(
          lib,
          config,
          'update-one-field',
          CONSUMER_SIZE,
          consumers
        );
        raw.push(result);
        cells.push(cell(result));
      }
      rows.push({ label: lib, cells });
    }
    collectSkips(raw);
    report.axes[`consumers/${config}`] = raw;
    table(
      `CONSUMER FAN-OUT — ${config}  (µs per update, ${CONSUMER_SIZE / 1000}k rows)`,
      'every consumer watches the row being written; they are read inside the timed region',
      CONSUMER_COUNTS.map((c) => `${c} cons`),
      rows
    );
  }
}

if (axis === 'memory' || axis === 'all') {
  for (const config of CONFIGS) {
    const rows = [];
    const raw = [];
    for (const lib of LIBS) {
      const cells = [];
      for (const n of SIZES) {
        const result = runCell(lib, config, 'update-one-field', n, 0, true);
        raw.push(result);
        cells.push(cell(result));
      }
      rows.push({ label: lib, cells });
    }
    collectSkips(raw);
    report.axes[`memory/${config}`] = raw;
    table(
      `RETAINED AFTER QUIESCENCE — ${config}  (${REPEATS} updates, then settle)`,
      'speed that hides retention shows up here and nowhere else',
      SIZES.map((n) => `${n / 1000}k rows`),
      rows
    );
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
}

if (notes.size > 0) {
  console.log('\nNOTES');
  for (const note of [...notes].sort()) console.log(`  - ${note}`);
}

// A CELL THAT ERRORED IS A FAILED RUN, not a footnote.
//
// This exited 0 with the failure printed in the table until a gate self-test
// caught it: breaking signaltree's `updateOne` so no write landed produced a
// table full of errors and a successful exit. A harness that tolerates a broken
// arm silently is exactly the failure mode the gates in this repo exist to
// prevent, and a benchmark is the worst place for it — the output still looks
// like data.
//
// A `skip` is different and does NOT fail: it is a declared absence of a
// primitive, printed as n/a with a reason.
const errored = Object.values(report.axes)
  .flat()
  .filter((row) => row.error);

if (errored.length > 0) {
  console.error(`\n\u274c ${errored.length} cell(s) failed to produce a measurement:`);
  for (const row of errored) {
    console.error(
      `   - ${row.lib} / ${row.config} / ${row.op} @ n=${row.n}, ` +
        `consumers=${row.consumers}: ${row.error}`
    );
  }
  process.exit(1);
}

console.log(
  `\n  BASELINE ONLY — checkpoint 1 of 3. Re-run unchanged after Step 8, then\n` +
    `  from a pinned environment for the RC. Compare runs of this tool only\n` +
    `  against other runs taken back to back: machine load moves these numbers\n` +
    `  more than most code changes do.\n` +
    `  Quote the SHAPE across sizes and consumer counts, never a single cell.`
);
