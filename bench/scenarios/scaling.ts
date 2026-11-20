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
 * after MICRO_TIMING.warmRounds warm-up rounds.
 *
 * Row operations go to a working set of S8_SETUP.workingSet rows spread
 * evenly over the collection, the same at both sizes, so a lookup that walks
 * the rows walks on average half of them, while an operation that does not
 * stays in cache at both sizes.
 */
import { setImmediate } from 'node:timers/promises';
import { allocationProbeSelfTest, countAllocations } from '../runner/alloc-probe.ts';
import { median } from '../runner/stats.ts';
import { loadSubject } from '../subjects/index.ts';
import { collectionSeed } from '../subjects/seed.ts';
import type { StoreSubject, SubjectCollection, SubjectTree, TreeOptions } from '../subjects/types.ts';
import { makeRows, type PlainRow } from './data.ts';
import { MICRO_TIMING } from './micro.ts';
import type { S8Operation } from './s8-scaling.ts';

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
interface Bench {
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
  return rows.field(id, WRITTEN_FIELD)();
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
        verify: () => check(leaf() === next - 1, () => `leaf write: read ${leaf()} after writing ${next - 1}`),
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

/**
 * Median ns per operation: batches per round doubled until a round has
 * S8_SETUP.roundNs of timed work (or takes S8_SETUP.roundWallNs), again
 * after warm-up, then the rounds.
 */
function nsPerOperation(b: Bench): number {
  const state = { batch: 0 };
  const calibrate = (from: number) => {
    let count = from;
    for (;;) {
      const { timed, wall } = timeBatches(b, count, state);
      if (timed >= S8_SETUP.roundNs || wall >= S8_SETUP.roundWallNs || count >= MAX_BATCHES_PER_ROUND) return count;
      count *= 2;
    }
  };
  let count = calibrate(1);
  for (let r = 0; r < MICRO_TIMING.warmRounds; r++) timeBatches(b, count, state);
  count = calibrate(count);
  const samples: number[] = [];
  for (let r = 0; r < MICRO_TIMING.rounds; r++) samples.push(timeBatches(b, count, state).timed / (count * b.perBatch));
  return median(samples);
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

/** S8, one size: median ns per operation (setAll: per row written) for each operation, each on its own tree. */
export async function measureScaling(args: ScalingArgs): Promise<Record<string, number>> {
  const subject = await loadSubject(args.subject);
  const base = makeRows(args.rows, args.fields);
  const out: Record<string, number> = {};
  for (const op of args.operations) {
    // setAll's second set of rows exists only while setAll is measured, so the other operations run in the smaller heap.
    const alternate = op === 'setAll' ? makeRows(args.rows, args.fields, 1) : base;
    await settle();
    const { tree, rows } = loadedTree(subject, treeOptions(op), base);
    const b = bench(op, tree, rows, base, alternate);
    out[op] = nsPerOperation(b);
    b.verify();
    check(rows.count() === args.rows, () => `${op}: ${rows.count()} rows after measuring, of ${args.rows}`);
    tree.destroy();
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
