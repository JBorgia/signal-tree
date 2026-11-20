/**
 * Test double for the harness's own tests (bench/test): a small in-memory
 * store with every capability, so each scenario can run end to end before a
 * real subject has the capability. Never a gate subject; its numbers mean
 * nothing.
 *
 * Planted faults make one budget check fail each. They are read when a tree
 * is created, from BENCH_FAKE_FAULTS in Node or __BENCH_FAKE_FAULTS__ in the
 * page (runner/browser.ts copies the variable into the page):
 *   longChunk      S3: the first chunk of setAll({ chunk: 'auto' }) blocks for LONG_CHUNK_MS, then yields
 *   slowApply      S4a: transact() blocks 30 ms
 *   slowInspect    S4a: inspect() blocks 10 ms
 *   slowRollback   S4a: rollback() blocks 30 ms
 *   slowUndo       S4b: undo() blocks 30 ms
 *   ignoreHolds    S4c: holds are not enforced
 *   slowKeystroke  S4c: a write to a held location blocks 80 ms
 *   leakHistory    S5: every write is kept forever with padding, history over its cap
 *   scopedCost     S6(b): scoped plugins add work to every write, in scope or not
 *   ownerCost      S7: each owner of the written location adds 1 µs
 *   linksScan      S7: every write walks every link in the tree
 *   slowRead       harness tests: every leaf read does extra work
 *   copyRows       S2 heap: setAll keeps a full copy next to the rows it was given
 */
import { signal, untracked, type Signal, type WritableSignal } from '@angular/core';
import { measuredTurn } from './bench-flag.ts';
import { isCollectionSeed } from './seed.ts';
import type {
  Capability,
  HoldPolicy,
  Path,
  PluginCollectionSize,
  StoreSubject,
  SubjectCollection,
  SubjectTransaction,
  SubjectTree,
  TreeOptions,
  WriterContextLike,
} from './types.ts';

const ALL: readonly Capability[] = [
  'leaf', 'build', 'collection', 'collectionFieldWrite', 'chunkedSetAll', 'writers', 'hold', 'transactions',
  'transactionInspect', 'restoration', 'selectiveUndo', 'links', 'scopedPlugins', 'pluginCollectionSizes',
];

function readFaults(): ReadonlySet<string> {
  const g = globalThis as { __BENCH_FAKE_FAULTS__?: string; process?: { env?: Record<string, string | undefined> } };
  const raw = g.__BENCH_FAKE_FAULTS__ ?? g.process?.env?.['BENCH_FAKE_FAULTS'] ?? '';
  return new Set(raw.split(',').filter(Boolean));
}

/**
 * longChunk's block, by the wall clock: well past S3's 50 ms so that load on
 * the machine cannot hide it.
 */
export const LONG_CHUNK_MS = 200;

function busyMs(ms: number): void {
  const end = performance.now() + ms;
  while (performance.now() < end);
}

let sink = 0;
function extraWork(iterations: number): void {
  for (let i = 0; i < iterations; i++) sink = (sink + i * 31) | 0;
}

/** A location as the seam sees it: how to read it and how to store a value the seam accepted. */
interface Cell {
  readonly key: string;
  read(): unknown;
  apply(value: unknown): void;
}

function signalCell(key: string, initial: unknown): Cell & { readonly value: WritableSignal<unknown> } {
  const value = signal(initial);
  return { key, value, read: () => untracked(value), apply: (next) => value.set(next) };
}

interface Holder {
  readonly context: WriterContextLike;
  readonly policy: HoldPolicy;
}

interface Change {
  readonly cell: Cell;
  readonly before: unknown;
  readonly after: unknown;
}

interface Transaction {
  readonly changes: Change[];
  open: boolean;
}

interface Operation {
  readonly writer: string;
  readonly changes: Change[];
  readonly pad?: unknown[];
}

const USER: WriterContextLike = { writer: 'user', origin: 'user' };

class FakeStore {
  readonly faults: ReadonlySet<string>;
  readonly retain: number;
  readonly scoped: boolean;
  writer: WriterContextLike = USER;
  readonly holders = new Map<string, Holder[]>();
  readonly queued = new Map<string, { cell: Cell; value: unknown; context: WriterContextLike }[]>();
  readonly owningTransactions = new Map<string, number>();
  readonly pending = new Set<Transaction>();
  readonly history: Operation[] = [];
  readonly links: number[] = [];
  recording: Transaction | undefined;
  operation: Operation | undefined;
  dependencies = 0;

  constructor(options: TreeOptions | undefined) {
    this.faults = readFaults();
    this.retain = options?.plugins?.restoration?.retain ?? 100;
    this.scoped = options?.variant === 'scoped-plugins';
  }

  /** The write seam: holds, owners, transaction and history records, then commit. */
  write(cell: Cell, incoming: unknown): void {
    let value = incoming;
    if (this.scoped && this.faults.has('scopedCost')) extraWork(100);
    if (this.faults.has('linksScan')) for (const link of this.links) this.dependencies += link & 1;
    const before = cell.read();
    const holders = this.holders.get(cell.key);
    if (this.faults.has('slowKeystroke') && holders?.some((h) => h.context.writer === this.writer.writer)) busyMs(80);
    if (holders && !this.faults.has('ignoreHolds')) {
      for (const holder of holders) {
        if (this.faults.has('ownerCost')) busyMs(0.001);
        if (holder.context.writer === this.writer.writer) continue;
        if (holder.policy.kind === 'refuse') throw new Error(`refused: ${cell.key} is held by ${holder.context.writer}`);
        if (holder.policy.kind === 'queue') {
          const queue = this.queued.get(cell.key) ?? [];
          queue.push({ cell, value, context: this.writer });
          this.queued.set(cell.key, queue);
          return;
        }
        value = holder.policy.merge(before, value, this.writer);
      }
    }
    const owners = this.owningTransactions.get(cell.key) ?? 0;
    for (let i = 0; i < owners; i++) {
      this.dependencies++;
      if (this.faults.has('ownerCost')) busyMs(0.001);
    }
    if (Object.is(before, value)) return;
    if (this.recording || this.operation || this.faults.has('leakHistory')) {
      const change: Change = { cell, before, after: value };
      if (this.recording) {
        if (!this.recording.changes.some((c) => c.cell.key === cell.key)) this.owningTransactions.set(cell.key, owners + 1);
        this.recording.changes.push(change);
      }
      this.operation?.changes.push(change);
      if (this.faults.has('leakHistory')) this.history.push({ writer: this.writer.writer, changes: [change], pad: new Array(64).fill(0) });
    }
    cell.apply(value);
  }

  close(tx: Transaction): void {
    if (!tx.open) return;
    tx.open = false;
    this.pending.delete(tx);
    const keys = new Set(tx.changes.map((c) => c.cell.key));
    for (const key of keys) {
      const left = (this.owningTransactions.get(key) ?? 1) - 1;
      if (left > 0) this.owningTransactions.set(key, left);
      else this.owningTransactions.delete(key);
    }
  }
}

/** A WritableSignal-shaped handle whose writes go through the fake's seam. */
function handle<T>(store: FakeStore, cell: Cell & { readonly value: WritableSignal<unknown> }): WritableSignal<T> {
  const read = store.faults.has('slowRead')
    ? () => {
        extraWork(20);
        return cell.value() as T;
      }
    : () => cell.value() as T;
  const out = read as unknown as WritableSignal<T> & { set(value: T): void; update(fn: (v: T) => T): void };
  out.set = (value: T) => store.write(cell, value);
  out.update = (fn: (v: T) => T) => store.write(cell, fn(cell.read() as T));
  (out as unknown as { asReadonly(): Signal<T> }).asReadonly = () => cell.value.asReadonly() as Signal<T>;
  return out;
}

function walk(root: unknown, path: Path): unknown {
  let node = root;
  for (const key of path) node = (node as Record<string, unknown> | undefined)?.[key];
  return node;
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * A deep copy shaped like the rows themselves: parsed from JSON (as the
 * harness makes its rows) with each distinct string duplicated once, so the
 * copy does not share the originals' strings. Object spread would not do: the
 * reference app's build lowers it to a helper whose objects are several
 * times larger than the parsed rows.
 */
function deepCopy(rows: readonly Record<string, unknown>[]): Record<string, unknown>[] {
  const strings = new Map<string, string>();
  return JSON.parse(JSON.stringify(rows), (_key, value: unknown) => {
    if (typeof value !== 'string') return value;
    let copy = strings.get(value);
    if (copy === undefined) {
      copy = `${value} `.slice(0, -1);
      strings.set(value, copy);
    }
    return copy;
  }) as Record<string, unknown>[];
}

class FakeCollection<E, K extends string | number> implements SubjectCollection<E, K> {
  /** The rows array the caller gave to setAll, kept as is (a sharing store). */
  private list: Record<string, unknown>[] = [];
  /** Position of each id, built only when ids are not their positions. */
  private index: Map<K, number> | undefined;
  /** copyRows fault: a full copy kept next to the given rows (a copying store). */
  private copy: Record<string, unknown>[] | undefined;
  /** Cells handed out for rendering; rows written without one get a transient cell. */
  private readonly cells = new Map<string, Cell & { readonly value: WritableSignal<unknown>; readonly id: K; readonly field: string }>();
  private readonly store: FakeStore;
  private readonly path: string;
  private readonly idField: string;

  constructor(store: FakeStore, path: string, idField: string) {
    this.store = store;
    this.path = path;
    this.idField = idField;
  }

  private key(id: K, field: string): string {
    return `${this.path}/${String(id)}/${field}`;
  }

  private position(id: K): number | undefined {
    if (typeof id === 'number' && this.list[id]?.[this.idField] === id) return id;
    if (!this.index) {
      this.index = new Map();
      this.list.forEach((row, i) => this.index!.set(row[this.idField] as K, i));
    }
    return this.index.get(id);
  }

  private row(id: K): Record<string, unknown> | undefined {
    const at = this.position(id);
    return at === undefined ? undefined : this.list[at];
  }

  private commitField(id: K, field: string, value: unknown): void {
    const at = this.position(id);
    if (at !== undefined) this.list[at] = { ...this.list[at], [field]: value };
    this.cells.get(this.key(id, field))?.value.set(value);
  }

  private handed(id: K, field: string) {
    const key = this.key(id, field);
    let cell = this.cells.get(key);
    if (!cell) {
      const value = signal(this.row(id)?.[field]);
      cell = { key, id, field, value, read: () => this.row(id)?.[field], apply: (next) => this.commitField(id, field, next) };
      this.cells.set(key, cell);
    }
    return cell;
  }

  private replace(rows: readonly Record<string, unknown>[]): void {
    this.list = rows as Record<string, unknown>[];
    this.index = undefined;
    this.copy = this.store.faults.has('copyRows') ? deepCopy(rows) : undefined;
    for (const cell of this.cells.values()) cell.value.set(this.row(cell.id)?.[cell.field]);
  }

  setAll(rows: readonly E[]): void {
    this.replace(rows as readonly Record<string, unknown>[]);
  }

  async setAllChunked(rows: readonly E[]): Promise<void> {
    if (this.store.faults.has('longChunk')) {
      // A chunk of its own: the yield ends it before anything asks for a render (issue #75).
      busyMs(LONG_CHUNK_MS);
      await yieldToBrowser();
    }
    const next: Record<string, unknown>[] = [];
    let chunkStart = performance.now();
    for (const row of rows as readonly Record<string, unknown>[]) {
      next.push(row);
      if (performance.now() - chunkStart > 8) {
        await yieldToBrowser();
        chunkStart = performance.now();
      }
    }
    this.replace(next);
  }

  updateOne(id: K, changes: Partial<E>): void {
    if (this.position(id) === undefined) return;
    for (const [field, value] of Object.entries(changes as Record<string, unknown>)) {
      const cell: Cell = this.cells.get(this.key(id, field)) ?? {
        key: this.key(id, field),
        read: () => this.row(id)?.[field],
        apply: (next) => this.commitField(id, field, next),
      };
      this.store.write(cell, value);
    }
  }

  field<F extends keyof E & string>(id: K, field: F): Signal<E[F]> {
    return this.handed(id, field).value.asReadonly() as Signal<E[F]>;
  }

  writableField<F extends keyof E & string>(id: K, field: F): WritableSignal<E[F]> {
    return handle<E[F]>(this.store, this.handed(id, field));
  }

  count(): number {
    return this.list.length;
  }
}

function createTree(state: object, options?: TreeOptions): SubjectTree {
  const store = new FakeStore(options);
  const leaves = new Map<string, Cell & { readonly value: WritableSignal<unknown> }>();
  const collections = new Map<string, FakeCollection<unknown, string | number>>();
  return {
    leaf<T>(path: Path): WritableSignal<T> {
      const key = path.join('/');
      let cell = leaves.get(key);
      if (!cell) {
        cell = signalCell(key, walk(state, path));
        leaves.set(key, cell);
      }
      return handle<T>(store, cell);
    },
    collection<E, K extends string | number>(path: Path): SubjectCollection<E, K> {
      const key = path.join('/');
      let collection = collections.get(key);
      if (!collection) {
        const seed = walk(state, path);
        if (!isCollectionSeed(seed)) throw new Error(`test-fake: no collection at ${key}`);
        collection = new FakeCollection(store, key, seed.idField);
        collections.set(key, collection);
      }
      return collection as unknown as SubjectCollection<E, K>;
    },
    turn(label, fn) {
      measuredTurn(label, fn);
    },
    as<R>(context: WriterContextLike, fn: () => R): R {
      const previous = store.writer;
      store.writer = context;
      try {
        return fn();
      } finally {
        store.writer = previous;
      }
    },
    hold(path, context, policy = { kind: 'refuse' }) {
      const key = path.join('/');
      const holder: Holder = { context, policy };
      store.holders.set(key, [...(store.holders.get(key) ?? []), holder]);
      return () => {
        const left = (store.holders.get(key) ?? []).filter((h) => h !== holder);
        if (left.length) store.holders.set(key, left);
        else store.holders.delete(key);
        const queue = store.queued.get(key) ?? [];
        store.queued.delete(key);
        for (const item of queue) {
          const previous = store.writer;
          store.writer = item.context;
          try {
            store.write(item.cell, item.value);
          } finally {
            store.writer = previous;
          }
        }
      };
    },
    transact(fn): SubjectTransaction {
      const tx: Transaction = { changes: [], open: true };
      const previous = store.recording;
      store.recording = tx;
      try {
        fn();
      } finally {
        store.recording = previous;
      }
      if (store.faults.has('slowApply')) busyMs(30);
      store.pending.add(tx);
      return {
        inspect() {
          if (store.faults.has('slowInspect')) busyMs(10);
          return tx.changes.map((c) => ({ location: c.cell.key, status: Object.is(c.cell.read(), c.after) ? 'current' : 'superseded' }));
        },
        confirm() {
          store.close(tx);
        },
        rollback() {
          if (store.faults.has('slowRollback')) busyMs(30);
          for (const c of [...tx.changes].reverse()) c.cell.apply(c.before);
          store.close(tx);
        },
      };
    },
    undoable(fn) {
      const op: Operation = { writer: store.writer.writer, changes: [] };
      const previous = store.operation;
      store.operation = op;
      try {
        fn();
      } finally {
        store.operation = previous;
      }
      store.history.push(op);
      if (!store.faults.has('leakHistory')) while (store.history.length > store.retain) store.history.shift();
    },
    undo(filter) {
      if (store.faults.has('slowUndo')) busyMs(30);
      for (let i = store.history.length - 1; i >= 0; i--) {
        const op = store.history[i]!;
        if (filter?.writer !== undefined && op.writer !== filter.writer) continue;
        for (const c of [...op.changes].reverse()) if (Object.is(c.cell.read(), c.after)) c.cell.apply(c.before);
        store.history.splice(i, 1);
        if (filter?.writer === undefined) return;
      }
    },
    linkMany(_path, count) {
      const added = Array.from({ length: count }, (_, i) => i);
      store.links.push(...added);
      return () => {
        store.links.splice(store.links.length - added.length, added.length);
      };
    },
    pluginCollections(): readonly PluginCollectionSize[] {
      return [{ plugin: 'restoration', collection: 'history', size: store.history.length, cap: store.retain }];
    },
    destroy() {
      leaves.clear();
      collections.clear();
    },
  };
}

export const testFake: StoreSubject = {
  id: 'test-fake',
  description: 'Test double with every capability, for the harness tests only; never a gate subject',
  packages: {},
  capabilities: new Set<Capability>(ALL),
  createTree,
};
