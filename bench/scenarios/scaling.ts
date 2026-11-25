/**
 * Node measurements for S8 (scaling). Each export runs alone in a fresh
 * `node --expose-gc` process (RunContext.isolate) for one collection size.
 * measureScaling times every operation it is given, each on its own tree
 * built from the same rows; measureReadAllocations counts the allocations of
 * all() and byId the way M1 counts a write's.
 *
 * Every operation is timed in batches, and only the batches are timed; the
 * work that puts the collection back (removing the rows addOne added,
 * re-adding the rows removeOne removed, making the writes undo reverts) runs
 * between them. A round is enough batches for S8_SETUP.roundNs of timed work;
 * the result is the median time per operation of MICRO_TIMING.rounds rounds
 * after MICRO_TIMING.warmRounds warm-up rounds. The rounds of all the
 * operations and the references are interleaved (interleaved()).
 *
 * Row operations go to a working set of S8_SETUP.workingSet rows spread
 * evenly over the collection, the same at both sizes, so a lookup that walks
 * the rows walks on average half of them, while an operation that does not
 * stays in cache at both sizes.
 *
 * The same process times the references S8's bound is relative to: Map.set
 * and Map.get on a plain Map from id to row holding the same rows, timed in
 * batches with the same calibration, rounds and median (referenceBench),
 * their rounds interleaved with the operations' rounds.
 */
import { setImmediate } from 'node:timers/promises';
import { allocationProbeSelfTest, countAllocations } from '../runner/alloc-probe.ts';
import { median } from '../runner/stats.ts';
import { loadSubject } from '../subjects/index.ts';
import { collectionSeed } from '../subjects/seed.ts';
import type { StoreSubject, SubjectCollection, SubjectTree, TreeOptions } from '../subjects/types.ts';
import { makeRows, type PlainRow } from './data.ts';
import { MICRO_TIMING } from './micro.ts';
import { S8_REFERENCES, type S8Operation, type S8Reference } from './s8-scaling.ts';

/** Harness choices S8 does not take from budgets.json. */
export const S8_SETUP = {
  /** Rows the row operations go to, spread evenly over the collection (a power of 2: loops index it with a mask). */
  workingSet: 16,
  /** Timed work in one round. */
  roundNs: 5_000_000,
  /** A round stops growing at this wall time, timed or not, so untimed set-up cannot dominate a run. */
  roundWallNs: 50_000_000,
  /** Calls per timed batch, per operation (setAll: one call that writes every row). */
  batch: { leafWrite: 1000, rowFieldWrite: 1000, addOne: 16, removeOne: 16, setAll: 1, updateOne: 1000, transactRollback: 100, undo: 50, all: 1000, byId: 1000 },
  /** restoration's cap for the undo operation; the brief configures only restoration({ retain: 100 }). */
  retain: 100,
  /**
   * Keys per timed batch of the Map references, as for the operations that
   * cost a few nanoseconds. In batches of 16 the timer's own cost (about
   * 50 ns a batch) is half of a Map.get at 1,000 rows and pulls the ratio
   * toward 1.
   */
  referenceBatch: 1000,
} as const satisfies { batch: Record<S8Operation, number> } & Record<string, unknown>;

const MAX_BATCHES_PER_ROUND = 1 << 16;
const WRITTEN_FIELD = 'f1';

type Row = PlainRow;
type Rows = SubjectCollection<Row, number>;

let sink = 0;

function gc(): void {
  const collect = (globalThis as { gc?: () => void }).gc;
  if (!collect) throw new Error('S8 measurements need node --expose-gc');
  collect();
  collect();
}

async function settle(): Promise<void> {
  for (let i = 0; i < 2; i++) {
    await setImmediate();
    gc();
  }
}

/** Ids of the working set, spread evenly over `rows` rows (ids are 0..rows-1, in order). */
function workingSet(rows: number): number[] {
  return Array.from({ length: S8_SETUP.workingSet }, (_, k) => Math.floor(((k + 0.5) * rows) / S8_SETUP.workingSet));
}

function treeOptions(op: S8Operation): TreeOptions {
  if (op === 'transactRollback') return { plugins: { transactions: true } };
  if (op === 'undo') return { plugins: { restoration: { retain: S8_SETUP.retain } } };
  return {};
}

function loadedTree(subject: StoreSubject, options: TreeOptions, base: readonly Row[]): { tree: SubjectTree; rows: Rows } {
  const tree = subject.createTree({ meta: { cursor: 0, label: 'scaling' }, rows: collectionSeed('id') }, options);
  const rows = tree.collection<Row, number>(['rows']);
  // A copy of the array, so a store that keeps and changes the array it was given does not change `base`.
  rows.setAll(base.slice());
  return { tree, rows };
}

/** One operation, timed in batches; `verify` throws if the operation did not do what it should. */
export interface Bench {
  /** Operations one timed batch performs (setAll: rows written). */
  readonly perBatch: number;
  before?(batch: number): void;
  timed(batch: number): void;
  after?(batch: number): void;
  verify(): void;
}

function check(condition: boolean, message: () => string): void {
  if (!condition) throw new Error(`S8: ${message()}`);
}

function fieldValue(rows: Rows, id: number): unknown {
  return readHandle(rows.field(id, WRITTEN_FIELD));
}

/** Reads a handle outside the timed code: an Angular signal by calling it, a plain cell with .get() (#103). */
function readHandle<T>(handle: unknown): T {
  return typeof handle === 'function' ? (handle as () => T)() : (handle as { get(): T }).get();
}

/** The operation `op` on `rows` rows, with values that always differ from the current ones. */
function bench(op: S8Operation, tree: SubjectTree, rows: Rows, base: readonly Row[], alternate: readonly Row[]): Bench {
  const size = base.length;
  const fieldCount = Object.keys(base[0]!).length;
  const ids = workingSet(size);
  const mask = S8_SETUP.workingSet - 1;
  const n = S8_SETUP.batch[op];
  let next = 1_000_000;
  switch (op) {
    case 'leafWrite': {
      const leaf = tree.leaf<number>(['meta', 'cursor']);
      return {
        perBatch: n,
        timed() {
          for (let i = 0; i < n; i++) leaf.set(next++);
        },
        verify: () => check(readHandle(leaf) === next - 1, () => `leaf write: read ${readHandle(leaf)} after writing ${next - 1}`),
      };
    }
    case 'rowFieldWrite': {
      const cells = ids.map((id) => rows.writableField!(id, WRITTEN_FIELD));
      return {
        perBatch: n,
        timed() {
          for (let i = 0; i < n; i++) cells[i & mask]!.set(next++);
        },
        verify: () => check(fieldValue(rows, ids[(n - 1) & mask]!) === next - 1, () => `row field write: the row does not hold ${next - 1}`),
      };
    }
    case 'updateOne':
      return {
        perBatch: n,
        timed() {
          for (let i = 0; i < n; i++) rows.updateOne(ids[i & mask]!, { [WRITTEN_FIELD]: next++ });
        },
        verify: () => check(fieldValue(rows, ids[(n - 1) & mask]!) === next - 1, () => `updateOne: the row does not hold ${next - 1}`),
      };
    case 'addOne': {
      // Fresh ids every batch: re-adding the ids just removed would grow those keys' chains in a V8 Map
      // (deleted entries stay chained until a rehash, which comes later the larger the map is).
      const template = makeRows(1, fieldCount)[0]!;
      let fresh = size;
      let added: Row[] = [];
      return {
        perBatch: n,
        before() {
          added = Array.from({ length: n }, () => ({ ...template, id: fresh++ }));
        },
        timed() {
          for (let k = 0; k < n; k++) rows.addOne!(added[k]!);
        },
        after() {
          for (let k = 0; k < n; k++) rows.removeOne!(added[k]!.id);
        },
        verify() {
          this.before!(0);
          this.timed(0);
          check(rows.count() === size + n, () => `addOne: ${rows.count()} rows after adding ${n} to ${size}`);
          this.after!(0);
        },
      };
    }
    case 'removeOne': {
      // Batch b removes ids k·stride + (b mod stride): every id once per `stride` batches, spread over the collection.
      const stride = Math.floor(size / n);
      const victim = (batch: number, k: number) => k * stride + (batch % stride);
      return {
        perBatch: n,
        timed(batch) {
          for (let k = 0; k < n; k++) rows.removeOne!(victim(batch, k));
        },
        after(batch) {
          for (let k = 0; k < n; k++) rows.addOne!(base[victim(batch, k)]!);
        },
        verify() {
          this.timed(0);
          check(rows.count() === size - n, () => `removeOne: ${rows.count()} rows after removing ${n} of ${size}`);
          this.after!(0);
        },
      };
    }
    case 'setAll': {
      // Alternates between two sets of rows with the same ids and different values. The arrays are
      // handed over as they are: copying 100,000 rows between calls would cost more than an O(1) setAll.
      let last: readonly Row[] = base;
      return {
        perBatch: size,
        before(batch) {
          last = batch % 2 === 0 ? alternate : base;
        },
        timed() {
          rows.setAll(last);
        },
        verify: () => check(fieldValue(rows, ids[0]!) === last[ids[0]!]![WRITTEN_FIELD], () => 'setAll: the row does not hold the value it was given'),
      };
    }
    case 'transactRollback':
      return {
        perBatch: n,
        timed() {
          for (let i = 0; i < n; i++) tree.transact!(() => rows.updateOne(ids[i & mask]!, { [WRITTEN_FIELD]: next++ })).rollback();
        },
        verify: () => check(fieldValue(rows, ids[0]!) === base[ids[0]!]![WRITTEN_FIELD], () => 'transact + rollback: the row does not hold its value from before'),
      };
    case 'undo':
      return {
        perBatch: n,
        before() {
          for (let i = 0; i < n; i++) tree.undoable!(() => rows.updateOne(ids[i & mask]!, { [WRITTEN_FIELD]: next++ }));
        },
        timed() {
          for (let i = 0; i < n; i++) tree.undo!();
        },
        verify: () => check(fieldValue(rows, ids[0]!) === base[ids[0]!]![WRITTEN_FIELD], () => 'undo: the row does not hold its value from before'),
      };
    case 'all':
      return {
        perBatch: n,
        timed() {
          let seen = 0;
          for (let i = 0; i < n; i++) seen ^= rows.all!().length;
          sink ^= seen;
        },
        verify: () => check(rows.all!().length === size, () => `all(): ${rows.all!().length} rows of ${size}`),
      };
    case 'byId':
      return {
        perBatch: n,
        timed() {
          let found = 0;
          for (let i = 0; i < n; i++) if (rows.byId!(ids[i & mask]!) !== undefined) found++;
          sink ^= found;
        },
        verify: () => check(ids.every((id) => rows.byId!(id) !== undefined), () => 'byId: a row of the working set was not found'),
      };
  }
}

/**
 * The reference `ref` (S8_REFERENCES) on its own plain Map<number, row>
 * holding `base` under its ids. mapSet overwrites existing keys, with another
 * row object on every other visit so that each set changes the value; the
 * map's size never changes. mapGet reads existing keys.
 *
 * Each batch visits S8_SETUP.referenceBatch keys spread over the whole map:
 * batch b visits k·stride + (b mod stride) with stride = rows ÷
 * referenceBatch, so every key is visited once every stride batches (at
 * 1,000 rows, all of them in every batch). At 100,000 rows an entry has gone
 * out of the nearest cache since its last visit; at 1,000 the whole map stays
 * there. The ratio is what the larger collection costs a constant-time keyed
 * operation that reaches keys all over the map, as removeOne does.
 */
function referenceBench(ref: S8Reference, base: readonly Row[]): Bench {
  const map = new Map<number, Row>();
  for (const row of base) map.set(row.id, row);
  const size = base.length;
  const n = S8_SETUP.referenceBatch;
  const stride = Math.floor(size / n);
  // A row written in place of each visited row on every other visit, so every set changes the value.
  const spare = makeRows(1, Object.keys(base[0]!).length, 1)[0]!;
  const keys = new Array<number>(n).fill(0);
  const values = new Array<Row>(n).fill(spare);
  const visit = (batch: number) => {
    const offset = batch % stride;
    const replace = Math.floor(batch / stride) % 2 === 0;
    for (let k = 0; k < n; k++) {
      keys[k] = k * stride + offset;
      values[k] = replace ? spare : base[keys[k]!]!;
    }
  };
  if (ref === 'mapSet') {
    return {
      perBatch: n,
      before: visit,
      timed() {
        for (let k = 0; k < n; k++) map.set(keys[k]!, values[k]!);
      },
      verify: () => check(map.size === size && map.get(keys[0]!) === values[0], () => `Map.set: ${map.size} entries of ${size}, or the last value written is not there`),
    };
  }
  return {
    perBatch: n,
    before: visit,
    timed() {
      let found = 0;
      for (let k = 0; k < n; k++) if (map.get(keys[k]!) !== undefined) found++;
      sink ^= found;
    },
    verify: () => check(keys.every((id) => map.get(id) === base[id]), () => 'Map.get: a visited key does not hold its row'),
  };
}

/** Timed nanoseconds of `count` batches, and the wall time they took with the untimed work between them. */
function timeBatches(b: Bench, count: number, state: { batch: number }): { timed: number; wall: number } {
  let ns = 0n;
  const wallStart = process.hrtime.bigint();
  for (let c = 0; c < count; c++) {
    const batch = state.batch++;
    b.before?.(batch);
    const start = process.hrtime.bigint();
    b.timed(batch);
    ns += process.hrtime.bigint() - start;
    b.after?.(batch);
  }
  return { timed: Number(ns), wall: Number(process.hrtime.bigint() - wallStart) };
}

/** One measurement S8 interleaves with the others: a reference or an operation. */
export interface Measurement {
  readonly id: string;
  readonly bench: Bench;
  /** Batches timed so far, timed or not: a bench's batch number keeps counting across calibration, warm-up and rounds. */
  readonly state: { batch: number };
  /** Batches per round. */
  count: number;
  /** ns per operation, one per round. */
  readonly samples: number[];
  /** Checks the bench and releases it after the rounds. */
  finish(): void;
}

/**
 * Batches per round: doubled from `from` until a round has S8_SETUP.roundNs
 * of timed work (or takes S8_SETUP.roundWallNs).
 */
function calibrate(m: Measurement, from: number): number {
  let count = from;
  for (;;) {
    const { timed, wall } = timeBatches(m.bench, count, m.state);
    if (timed >= S8_SETUP.roundNs || wall >= S8_SETUP.roundWallNs || count >= MAX_BATCHES_PER_ROUND) return count;
    count *= 2;
  }
}

/** One round of every measurement, starting at measurements[offset mod length] and going round. */
function sweep(measurements: readonly Measurement[], offset: number, record: boolean): void {
  for (let j = 0; j < measurements.length; j++) {
    const m = measurements[(offset + j) % measurements.length]!;
    const { timed } = timeBatches(m.bench, m.count, m.state);
    if (record) m.samples.push(timed / (m.count * m.bench.perBatch));
  }
}

/**
 * Median ns per operation of every measurement, interleaved: each is
 * calibrated alone, then MICRO_TIMING.warmRounds warm-up sweeps, each is
 * calibrated again, then MICRO_TIMING.rounds sweeps. Sweep i times one round
 * of each measurement, starting with measurement i mod n and going round, so
 * no measurement always runs first and a disturbance during a sweep reaches
 * the references and the operations alike.
 */
export function interleaved(measurements: readonly Measurement[]): void {
  for (const m of measurements) m.count = calibrate(m, 1);
  for (let w = 0; w < MICRO_TIMING.warmRounds; w++) sweep(measurements, w, false);
  for (const m of measurements) m.count = calibrate(m, m.count);
  for (let r = 0; r < MICRO_TIMING.rounds; r++) sweep(measurements, r, true);
}

export function measurement(id: string, bench: Bench, finish: () => void): Measurement {
  return { id, bench, state: { batch: 0 }, count: 1, samples: [], finish };
}

export interface ScalingArgs {
  readonly subject: string;
  /** Rows in the collection. */
  readonly rows: number;
  /** Fields per row, id included (data.ts). */
  readonly fields: number;
  /** The operations the subject has. */
  readonly operations: readonly S8Operation[];
}

/**
 * S8, one size: median ns per call of each reference (S8_REFERENCES), each on
 * its own Map, and median ns per operation (setAll: per row written) of each
 * operation, each on its own tree, all measured interleaved (interleaved()).
 * Every Map and tree is built first and lives until the rounds end, so the
 * process's heap holds all of them while any one is timed.
 */
export async function measureScaling(args: ScalingArgs): Promise<Record<string, number>> {
  const subject = await loadSubject(args.subject);
  const base = makeRows(args.rows, args.fields);
  // setAll alternates between `base` and a second set of rows with the same ids.
  const alternate = args.operations.includes('setAll') ? makeRows(args.rows, args.fields, 1) : base;
  const measurements: Measurement[] = [];
  for (const { id: ref } of S8_REFERENCES) {
    const b = referenceBench(ref, base);
    measurements.push(measurement(ref, b, () => b.verify()));
  }
  for (const op of args.operations) {
    const { tree, rows } = loadedTree(subject, treeOptions(op), base);
    const b = bench(op, tree, rows, base, alternate);
    measurements.push(
      measurement(op, b, () => {
        b.verify();
        check(rows.count() === args.rows, () => `${op}: ${rows.count()} rows after measuring, of ${args.rows}`);
        tree.destroy();
      }),
    );
  }
  await settle();
  interleaved(measurements);
  const out: Record<string, number> = {};
  for (const m of measurements) {
    out[m.id] = median(m.samples);
    m.finish();
  }
  out['sink'] = sink;
  return out;
}

// The loops keep their results small integers (XOR): a sum past 2^30 would be a
// heap number, and storing it allocates in the counted frame.
function allReadLoop(rows: Rows, n: number): void {
  let seen = 0;
  for (let i = 0; i < n; i++) seen ^= rows.all!().length;
  sink ^= seen;
}

function byIdReadLoop(rows: Rows, ids: readonly number[], n: number): void {
  const mask = ids.length - 1;
  let found = 0;
  for (let i = 0; i < n; i++) if (rows.byId!(ids[i & mask]!) !== undefined) found++;
  sink ^= found;
}

export interface ReadAllocations {
  readonly perCall: Partial<Record<'all' | 'byId', { readonly allocations: number; readonly bytes: number }>>;
  readonly probeAllocatingPerWrite: number;
}

/**
 * S8, one size: allocations and bytes per all() and byId call over `calls`
 * calls after warm-up, counted by runner/alloc-probe.ts under
 * ALLOCATION_NODE_FLAGS; the probe's self-test runs first in the same
 * process and the measurement fails if the probe does not prove itself.
 */
export async function measureReadAllocations(
  args: Omit<ScalingArgs, 'operations'> & { readonly operations: readonly ('all' | 'byId')[]; readonly calls: number },
): Promise<ReadAllocations> {
  const probe = await allocationProbeSelfTest(args.calls);
  if (!probe.ok) throw new Error(`allocation probe self-test failed: ${JSON.stringify(probe)}`);
  const subject = await loadSubject(args.subject);
  const base = makeRows(args.rows, args.fields);
  const { tree, rows } = loadedTree(subject, {}, base);
  const ids = workingSet(args.rows);
  const perCall: ReadAllocations['perCall'] = {};
  for (const op of args.operations) {
    const name = op === 'all' ? allReadLoop.name : byIdReadLoop.name;
    const loop = op === 'all' ? () => allReadLoop(rows, args.calls) : () => byIdReadLoop(rows, ids, args.calls);
    for (let r = 0; r < MICRO_TIMING.warmRounds; r++) loop();
    const counted = await countAllocations(name, args.calls, loop);
    perCall[op] = { allocations: counted.allocations / args.calls, bytes: counted.bytes / args.calls };
  }
  check(rows.count() === args.rows, () => `${rows.count()} rows after counting, of ${args.rows}`);
  tree.destroy();
  return { perCall, probeAllocatingPerWrite: probe.allocatingPerWrite };
}
