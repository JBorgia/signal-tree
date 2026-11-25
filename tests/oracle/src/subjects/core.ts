// The new core (packages/core) as an oracle subject, judged by the core gate
// (gate.ts). Phase 1 (BRIEF.md 12.6) has no plugins, so this subject replays
// the vocabulary that needs none: leaf, branch and entity writes, held rows,
// observers, destroy and hydrate. Everything else reports `unsupported` until
// its plugin exists (#107, adopted provisionally).
//
// Readers subscribe the way an application would: a leaf or row field through
// its plain cell, a collection reader (all, ids, count) and the `cfg` branch
// through an observer on the root scope, filtered to the locations it reads.
import { entityMap, signalTree } from '@signal-tree/core';
import type { Plugin, ScopeHandle, TreeErrorEvent, WriteEffect } from '@signal-tree/core';
import type { ErrorInfo, HydrateValue, Json, LeafPath, Observation, ObserverEvent, ObservedPath, Op, OpKind, Outcome, Reader, Reaction, ReadPaths, Row, StateView, WriteOp } from '../model.js';
import { INITIAL_SCALARS, ROW_KEYS } from '../model.js';
import type { Session, Subject } from '../subject.js';
import { FirstSeenLabels, HandleTable, attempt, describeError, stCodeOf, toJson } from '../subject.js';

interface Cell<T = unknown> {
  get(): T;
  set(value: T): void;
  update(fn: (current: T) => T): void;
  subscribe(listener: () => void): () => void;
}

interface RowHandle {
  get(): unknown;
  readonly [field: string]: unknown;
}

interface Rows {
  addOne(row: Row): void;
  addMany(rows: Row[]): void;
  setAll(rows: Row[]): void;
  updateOne(id: string, changes: object): void;
  updateMany(updates: { id: string; changes: object }[]): void;
  upsertOne(row: Row): void;
  upsertMany(rows: Row[]): void;
  removeOne(id: string): void;
  removeMany(ids: string[]): void;
  changeId(from: string, to: string): void;
  clear(): void;
  byId(id: string): RowHandle | undefined;
  ids(): readonly unknown[];
  all(): readonly unknown[];
  count(): number;
}

interface CoreTree {
  readonly $: {
    get(): unknown;
    set(value: unknown): void;
    readonly a: Cell<number>;
    readonly cfg: { get(): unknown; set(value: unknown): void; readonly p: Cell<number>; readonly q: Cell<number> };
    readonly rows: Rows;
  };
  destroy(): void;
}

/** Op kinds the core replays without plugins. */
const SUPPORTED: ReadonlySet<OpKind> = new Set<OpKind>([
  'setLeaf',
  'updateLeaf',
  'setBranch',
  'addOne',
  'addMany',
  'setAll',
  'updateOne',
  'updateMany',
  'upsertOne',
  'upsertMany',
  'removeOne',
  'removeMany',
  'changeId',
  'clear',
  'setField',
  'observerOpen',
  'rowHold',
  'rowHeldRead',
  'rowHeldWrite',
  'observe',
  'destroy',
  'hydrate',
]);

export function coreSubject(): Subject {
  return {
    name: 'core',
    description: '@signal-tree/core from this repository, plain adapter, no plugins (Phase 1)',
    supports: SUPPORTED,
    // No plugins exist yet, so a sequence's plugin choice changes nothing here (#107).
    open: () => new CoreSession(),
  };
}

/** Hands the root scope to the session: an observer there sees every turn's effects once (O2). */
function rootScope(onAttach: (scope: ScopeHandle) => void): Plugin<object> {
  return { name: 'oracle-root-scope', attach: (scope) => (onAttach(scope), { api: {}, detach: () => {} }) };
}

const initialState = () => ({ ...structuredClone(INITIAL_SCALARS), rows: entityMap<Row, string>() });

class CoreSession implements Session {
  readonly #tree: CoreTree;
  #scope!: ScopeHandle;
  readonly #rowHandles = new HandleTable<RowHandle>();
  readonly #carriers = new FirstSeenLabels('c');
  readonly #unsubscribe: (() => void)[] = [];
  #observerThrows = 0;
  #observerCount = 0;
  #observerEvents: ObserverEvent[] = [];
  #reentrant = 0;
  readonly #wroteSinceObservation = new Set<number>();
  #treeErrors: Observation['treeErrors'][number][] = [];
  #warnings: Observation['warnings'][number][] = [];
  readonly #restoreConsole: () => void;

  constructor() {
    this.#restoreConsole = this.#captureConsole();
    this.#tree = signalTree(initialState(), {
      plugins: [rootScope((scope) => (this.#scope = scope))],
      onTreeError: (event: TreeErrorEvent) => {
        this.#treeErrors.push({
          operation: event.code,
          ...(event.path.length ? { path: event.path.map(String).join('.') } : {}),
          error: describeError(event.error),
        });
      },
    }) as unknown as CoreTree;
  }

  #captureConsole(): () => void {
    const { warn, error } = console;
    const record = (level: 'warn' | 'error') => (...args: unknown[]) => {
      const message = args.map((a) => (typeof a === 'string' ? a : a instanceof Error ? `${a.constructor.name}: ${a.message}` : String(a))).join(' ');
      const st = stCodeOf(message);
      this.#warnings.push({ level, ...(st ? { st } : {}), message });
    };
    console.warn = record('warn');
    console.error = record('error');
    return () => {
      console.warn = warn;
      console.error = error;
    };
  }

  apply(op: Op): Outcome {
    const kinds = op.kind === 'write' ? [op.write.kind] : op.kind === 'transact' || op.kind === 'declare' ? [op.kind, ...op.body.map((w) => w.kind)] : [op.kind];
    const missing = kinds.filter((kind) => !SUPPORTED.has(kind));
    if (missing.length) return { status: 'unsupported', detail: `core has no ${missing.join(', ')} yet` };
    switch (op.kind) {
      case 'write':
        if (op.wrap !== 'none') return { status: 'unsupported', detail: `core has no ${op.wrap}() yet` };
        if (op.write.kind === 'addMany' && op.write.mode !== 'strict') return { status: 'unsupported', detail: `core addMany has no ${op.write.mode} mode (BRIEF.md 12.5 E3)` };
        return attempt(() => this.#write(op.write));
      case 'observerOpen':
        return attempt(() => {
          const observer = this.#unsubscribe.length;
          this.#unsubscribe.push(
            this.#subscribeObserved(op.path, () => {
              this.#observerThrows++;
              throw new Error('observer threw');
            }),
          );
          return { observer };
        });
      case 'rowHold':
        return attempt((): Json => {
          const row = this.#tree.$.rows.byId(op.id);
          if (!row) return { found: false };
          return { handle: this.#rowHandles.add(row) };
        });
      case 'rowHeldRead':
        return this.#withRow(op.handle, (row, handle) => ({ handle, value: toJson(row.get()), carrier: this.#carriers.label(row['n']) }));
      case 'rowHeldWrite':
        return this.#withRow(op.handle, (row, handle) => {
          const carrier = this.#carriers.label(row['n']);
          (row['n'] as Cell<number>).set(op.n);
          return { handle, carrier };
        });
      case 'observe':
        return this.#observe(op.reader, op.react);
      case 'destroy':
        return attempt(() => {
          this.#tree.destroy();
          return undefined;
        });
      case 'hydrate':
        return attempt(() => this.#hydrate());
      default:
        return { status: 'unsupported', detail: `core has no ${op.kind} yet` };
    }
  }

  #leaf(path: LeafPath): Cell<number> {
    const $ = this.#tree.$;
    return path === 'a' ? $.a : path === 'cfg.p' ? $.cfg.p : $.cfg.q;
  }

  #write(w: WriteOp): Json | undefined {
    const rows = this.#tree.$.rows;
    const copy = (r: Row): Row => ({ id: r.id, n: r.n, m: r.m });
    switch (w.kind) {
      case 'setLeaf':
        this.#leaf(w.path).set(w.value);
        return undefined;
      case 'updateLeaf':
        this.#leaf(w.path).update((current) => current + w.delta);
        return undefined;
      case 'setBranch':
        this.#tree.$.cfg.set({ p: w.p, q: w.q });
        return undefined;
      case 'addOne':
        rows.addOne(copy(w.row));
        return undefined;
      case 'addMany':
        rows.addMany(w.rows.map(copy));
        return undefined;
      case 'setAll':
        rows.setAll(w.rows.map(copy));
        return undefined;
      case 'updateOne':
        rows.updateOne(w.id, { [w.field]: w.value });
        return undefined;
      case 'updateMany':
        rows.updateMany(w.ids.map((id) => ({ id, changes: { [w.field]: w.value } })));
        return undefined;
      case 'upsertOne':
        rows.upsertOne(copy(w.row));
        return undefined;
      case 'upsertMany':
        rows.upsertMany(w.rows.map(copy));
        return undefined;
      case 'removeOne':
        rows.removeOne(w.id);
        return undefined;
      case 'removeMany':
        rows.removeMany([...w.ids]);
        return undefined;
      case 'changeId':
        rows.changeId(w.from, w.to);
        return undefined;
      case 'clear':
        rows.clear();
        return undefined;
      case 'setField': {
        const row = rows.byId(w.id);
        if (!row) return { found: false };
        (row[w.field] as Cell<number>).set(w.value);
        return undefined;
      }
      default:
        throw new Error(`core has no ${w.kind}`);
    }
  }

  /** An observer on `path` that runs once per turn that changed it. */
  #subscribeObserved(path: ObservedPath, run: () => void): () => void {
    if (path !== 'cfg') return this.#leaf(path).subscribe(run);
    return this.#scope.observe((effects) => {
      if (effects.some((e) => e.location[0] === 'cfg')) run();
    });
  }

  /** Subscribes `run` to a reader, or reports why it cannot. */
  #subscribeReader(reader: Reader, run: () => void): (() => void) | { found: false } {
    if (reader.kind === 'leaf') return this.#leaf(reader.path).subscribe(run);
    if (reader.kind === 'field') {
      const row = this.#tree.$.rows.byId(reader.id);
      return row ? (row[reader.field] as Cell<number>).subscribe(run) : { found: false };
    }
    // all() changes with any row write; ids() and count() only when a row's existence or key changes.
    const reads = reader.kind === 'all' ? (e: WriteEffect) => e.location.length >= 2 : (e: WriteEffect) => e.location.length === 2;
    return this.#scope.observe((effects) => {
      if (effects.some((e) => e.location[0] === 'rows' && reads(e))) run();
    });
  }

  #observe(reader: Reader, react: Reaction): Outcome {
    return attempt((): Json => {
      const observer = this.#observerCount;
      const subscribed = this.#subscribeReader(reader, () => {
        this.#observerEvents.push({ kind: 'run', observer, saw: readState(this.#tree) });
        if (react.kind === 'throw') {
          this.#observerThrows++;
          throw new Error('observer threw');
        }
        if (react.kind === 'write' && !this.#wroteSinceObservation.has(observer)) {
          this.#wroteSinceObservation.add(observer);
          const value = 10 + this.#reentrant++;
          const event: { kind: 'write'; observer: number; path: LeafPath; value: number; error?: ErrorInfo } = { kind: 'write', observer, path: react.path, value };
          this.#observerEvents.push(event);
          try {
            this.#leaf(react.path).set(value);
          } catch (thrown) {
            event.error = describeError(thrown);
          }
        }
      });
      if (typeof subscribed !== 'function') return subscribed;
      this.#unsubscribe.push(subscribed);
      this.#observerCount++;
      return { observer };
    });
  }

  /** Serializes the snapshot and hydrates a fresh tree by one whole-value write. */
  #hydrate(): Json {
    const json = JSON.stringify(this.#tree.$.get());
    const fresh = signalTree(initialState()) as unknown as CoreTree;
    try {
      const watched = (['a', 'cfg.p', 'cfg.q'] as const).map((path) => {
        const saw: HydrateValue['observers'][number]['saw'][number][] = [];
        const cell = path === 'a' ? fresh.$.a : path === 'cfg.p' ? fresh.$.cfg.p : fresh.$.cfg.q;
        cell.subscribe(() => saw.push(readState(fresh)));
        return { path, saw };
      });
      fresh.$.set(JSON.parse(json));
      const value: HydrateValue = { state: readState(fresh), observers: watched };
      return toJson(value);
    } finally {
      try {
        fresh.destroy();
      } catch {
        // The fresh tree is the harness's own; its teardown is not an outcome.
      }
    }
  }

  #withRow(ref: number, fn: (row: RowHandle, handle: number) => Json): Outcome {
    const resolved = this.#rowHandles.resolve(ref);
    if (!resolved) return { status: 'skipped', detail: 'no row handle held' };
    return attempt(() => fn(resolved.item, resolved.index));
  }

  observe(): Observation {
    const observation: Observation = {
      state: readState(this.#tree),
      pushes: [],
      probes: [],
      receipts: [],
      treeErrors: this.#treeErrors,
      warnings: this.#warnings,
      observerThrows: this.#observerThrows,
      observerEvents: this.#observerEvents,
      paths: readPaths(this.#tree),
    };
    this.#treeErrors = [];
    this.#warnings = [];
    this.#observerThrows = 0;
    this.#observerEvents = [];
    this.#wroteSinceObservation.clear();
    return observation;
  }

  close(): void {
    try {
      for (const unsubscribe of this.#unsubscribe) {
        try {
          unsubscribe();
        } catch {
          // Not an outcome of the sequence.
        }
      }
      try {
        this.#tree.destroy();
      } catch {
        // A sequence may have destroyed the tree already.
      }
    } finally {
      this.#restoreConsole();
    }
  }
}

function readState(tree: CoreTree): StateView | { readError: ErrorInfo } {
  try {
    const rows = tree.$.rows;
    return { a: toJson(tree.$.a.get()), cfg: toJson(tree.$.cfg.get()), rows: toJson(rows.all()), ids: toJson(rows.ids()) };
  } catch (thrown) {
    return { readError: describeError(thrown) };
  }
}

function readPaths(tree: CoreTree): ReadPaths | { readError: ErrorInfo } {
  try {
    const $ = tree.$;
    const byId: Record<string, ReadPaths['byId'][string]> = {};
    for (const key of ROW_KEYS) {
      const row = $.rows.byId(key);
      if (!row) {
        byId[key] = null;
        continue;
      }
      const fields: Record<string, Json> = {
        n: toJson((row['n'] as Cell).get()),
        m: toJson((row['m'] as Cell).get()),
        id: toJson((row['id'] as Cell).get()),
      };
      byId[key] = { row: toJson(row.get()), fields };
    }
    return {
      leaves: { a: toJson($.a.get()), 'cfg.p': toJson($.cfg.p.get()), 'cfg.q': toJson($.cfg.q.get()) },
      branch: toJson($.cfg.get()),
      snapshot: toJson($.get()),
      count: toJson($.rows.count()),
      byId,
    };
  } catch (thrown) {
    return { readError: describeError(thrown) };
  }
}
