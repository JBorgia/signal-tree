// Subject for the published @signal-tree/kernel packages (15.4.9 and
// 16.0.0-rc.1). Both share one public shape, read from each version's
// dist/index.d.ts; the differences are named in KernelProfile and checked
// against the loaded module, never assumed.
import {
  ALL_KINDS,
  INITIAL_SCALARS,
  ROW_KEYS,
  payloadFor,
  type DeclarationKind,
  type ErrorInfo,
  type Json,
  type LeafPath,
  type LinkMode,
  type ObservedPath,
  type LinkSource,
  type Observation,
  type HydrateValue,
  type StateView,
  type Op,
  type OpKind,
  type ObserverEvent,
  type Outcome,
  type Reaction,
  type ReadPaths,
  type Reader,
  type Row,
  type RowField,
  type TreeConfig,
  type WriteOp,
  kindsOf,
} from '../model.js';
import {
  FirstSeenLabels,
  HandleTable,
  attempt,
  describeError,
  stCodeOf,
  toJson,
  type Session,
  type Subject,
} from '../subject.js';

/** Call-style location: `node()` reads, `node(value)` or `node(updater)` writes. */
interface KernelLocation {
  (): unknown;
  (valueOrUpdater: unknown): void;
  subscribe(listener: () => void): () => void;
}

interface KernelRowNode extends KernelLocation {
  readonly id?: KernelLocation;
  readonly n: KernelLocation;
  readonly m: KernelLocation;
}

/** A collection reader: callable, and subscribable on some versions. */
interface KernelReader {
  (): unknown;
  readonly subscribe?: (listener: () => void) => () => void;
}

interface KernelRows {
  addOne(row: Row): unknown;
  addMany(rows: Row[], opts: { mode: string }): unknown;
  setAll(rows: Row[]): void;
  updateOne(id: string, changes: Partial<Record<RowField, number>>): void;
  updateMany(ids: string[], changes: Partial<Record<RowField, number>>): void;
  upsertOne(row: Row): unknown;
  upsertMany(rows: Row[]): unknown;
  removeOne(id: string): void;
  removeMany(ids: string[]): void;
  changeId(from: string, to: string): void;
  prependOne(row: Row): unknown;
  replaceOne(id: string, row: Row): void;
  clear(): void;
  byId(id: string): KernelRowNode | undefined;
  readonly all: KernelReader;
  readonly ids: KernelReader;
  readonly count: KernelReader;
}

interface KernelPending {
  confirm(): void;
  rollback(): void;
  inspect?(): {
    changes: readonly { path: string; address: readonly string[] | undefined; subject?: number; status: string }[];
  };
}

interface KernelReceipt {
  read(): unknown;
}

interface KernelLink {
  declare?(declaration: unknown, work: () => void): KernelReceipt;
  retrieve(): Promise<void>;
  settled(): Promise<void>;
  dispose(): void;
}

interface KernelTree {
  readonly $: KernelLocation & {
    readonly a: KernelLocation;
    readonly cfg: KernelLocation & { readonly p: KernelLocation; readonly q: KernelLocation };
    readonly rows: KernelRows;
  };
  undo?(): void;
  redo?(): void;
  canUndo?(): boolean;
  canRedo?(): boolean;
  getCurrentIndex?(): number;
  getRestorationHistory?(): readonly unknown[];
  destroy(): void;
  readonly [verb: string]: unknown;
}

export interface KernelModule {
  signalTree(state: object, config: { enhancers: unknown[] }): KernelTree;
  entityMap(config: { selectId: (row: Row) => string }): unknown;
  transactions(): unknown;
  restoration(): unknown;
  undoable<R>(operation: () => R): R;
  external<R>(operation: () => R): R;
  link(source: unknown, endpoint: object): KernelLink;
  onTreeError(listener: (event: { error: unknown; operation: string; path?: string }) => void): () => void;
}

export interface KernelProfile {
  readonly name: string;
  readonly description: string;
  /** 15.4.9 names it `transaction()`, 16.0.0-rc.1 `transact()`; same operation. */
  readonly transactVerb: 'transaction' | 'transact';
  /** `PendingTransaction.inspect()` exists (16 only). */
  readonly inspect: boolean;
  /** `Link.declare()` and publication receipts exist (16 only). */
  readonly declare: boolean;
}

/** 15.4.9 lacks inspect() and declare(). */
function supportedKinds(profile: KernelProfile): ReadonlySet<OpKind> {
  const missing = new Set<OpKind>();
  if (!profile.inspect) missing.add('inspect');
  if (!profile.declare) missing.add('declare');
  return new Set(ALL_KINDS.filter((kind) => !missing.has(kind)));
}

export function kernelSubject(kernel: KernelModule, profile: KernelProfile): Subject {
  const subject: Subject = {
    name: profile.name,
    description: profile.description,
    supports: supportedKinds(profile),
    open: (config) => new KernelSession(kernel, profile, subject.supports, config),
  };
  verifyProfile(kernel, profile);
  return subject;
}

/** Fails loudly if the loaded module does not have the shape the profile claims. */
function verifyProfile(kernel: KernelModule, profile: KernelProfile): void {
  const tree = kernel.signalTree(
    { ...structuredClone(INITIAL_SCALARS), rows: kernel.entityMap({ selectId: (r) => r.id }) },
    { enhancers: [kernel.transactions(), kernel.restoration()] }
  );
  try {
    const verb = tree[profile.transactVerb];
    if (typeof verb !== 'function') throw new Error(`${profile.name}: tree.${profile.transactVerb} is not a function`);
    const pending = (verb as (fn: () => void) => KernelPending).call(tree, () => tree.$.a(1));
    if ((typeof pending.inspect === 'function') !== profile.inspect) {
      throw new Error(`${profile.name}: inspect() presence does not match the profile`);
    }
    pending.rollback();
    const connection = kernel.link(tree.$.a, { set: () => undefined });
    if ((typeof connection.declare === 'function') !== profile.declare) {
      throw new Error(`${profile.name}: Link.declare() presence does not match the profile`);
    }
    connection.dispose();
  } finally {
    tree.destroy();
  }
}

interface LinkEntry {
  readonly source: LinkSource;
  readonly mode: LinkMode;
  handle?: KernelLink;
  subscriber: ((value: unknown) => void) | undefined;
  readonly acks: { resolve: () => void; reject: (reason: Error) => void }[];
  retrieveValue: Json;
}

interface Probe {
  readonly link: number;
  readonly kind: 'settled' | 'retrieve';
  status: 'pending' | 'resolved' | 'rejected';
  error?: ErrorInfo;
}

class KernelSession implements Session {
  readonly #k: KernelModule;
  readonly #profile: KernelProfile;
  readonly #supports: ReadonlySet<OpKind>;
  readonly #config: TreeConfig;
  readonly #tree: KernelTree;
  readonly #txs = new HandleTable<KernelPending>();
  readonly #links = new HandleTable<LinkEntry>();
  readonly #receipts = new HandleTable<KernelReceipt>();
  readonly #rowHandles = new HandleTable<KernelRowNode>();
  readonly #probes: Probe[] = [];
  readonly #labels = new FirstSeenLabels();
  readonly #carriers = new FirstSeenLabels('c');
  readonly #observers: (() => void)[] = [];
  #observerThrows = 0;
  /** `observe` observers opened so far (their handles). */
  #observerCount = 0;
  #observerEvents: ObserverEvent[] = [];
  /** Reentrant writes made so far; the next one writes 10 + this. */
  #reentrant = 0;
  /** Writing observers that wrote since the last observation: each writes at most once in between, so a chain of reentrant writes ends. */
  readonly #wroteSinceObservation = new Set<number>();
  #atReturn: Observation['restorationAtReturn'];
  #pushes: { link: number; value: Json }[] = [];
  #treeErrors: Observation['treeErrors'][number][] = [];
  #warnings: Observation['warnings'][number][] = [];
  readonly #offTreeError: () => void;
  readonly #restoreConsole: () => void;

  constructor(kernel: KernelModule, profile: KernelProfile, supports: ReadonlySet<OpKind>, config: TreeConfig) {
    this.#k = kernel;
    this.#profile = profile;
    this.#supports = supports;
    this.#config = config;
    this.#offTreeError = kernel.onTreeError((event) => {
      this.#treeErrors.push({
        operation: event.operation,
        ...(event.path === undefined ? {} : { path: event.path }),
        error: describeError(event.error),
      });
    });
    this.#restoreConsole = this.#captureConsole();
    this.#tree = this.#createTree();
  }

  #createTree(): KernelTree {
    const kernel = this.#k;
    const enhancers: unknown[] = [];
    if (this.#config.transactions) enhancers.push(kernel.transactions());
    if (this.#config.restoration) enhancers.push(kernel.restoration());
    return kernel.signalTree({ ...structuredClone(INITIAL_SCALARS), rows: kernel.entityMap({ selectId: (r) => r.id }) }, { enhancers });
  }

  #captureConsole(): () => void {
    const { warn, error } = console;
    const record = (level: 'warn' | 'error') => (...args: unknown[]) => {
      const message = args.map((a) => (typeof a === 'string' ? a : describeValue(a))).join(' ');
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

  /** Runs the operation, then reads the restoration state before anything else can run (O2). */
  apply(op: Op): Outcome | Promise<Outcome> {
    const outcome = this.#apply(op);
    if (outcome instanceof Promise) {
      return outcome.then((o) => {
        this.#atReturn = this.#readRestoration();
        return o;
      });
    }
    this.#atReturn = this.#readRestoration();
    return outcome;
  }

  #readRestoration(): Observation['restorationAtReturn'] {
    if (!this.#config.restoration) return undefined;
    const tree = this.#tree as Required<Pick<KernelTree, 'canUndo' | 'canRedo' | 'getCurrentIndex' | 'getRestorationHistory'>>;
    return {
      canUndo: readOrError(() => tree.canUndo()),
      canRedo: readOrError(() => tree.canRedo()),
      index: readOrError(() => tree.getCurrentIndex()),
      length: readOrError(() => tree.getRestorationHistory().length),
    };
  }

  #apply(op: Op): Outcome | Promise<Outcome> {
    const missing = kindsOf(op).filter((kind) => !this.#supports.has(kind));
    if (missing.length) return { status: 'unsupported', detail: `${this.#profile.name} has no ${missing.join(', ')}` };
    switch (op.kind) {
      case 'write':
        return attempt(() => this.#wrapped(op.wrap, () => this.#write(op.write)));
      case 'transact':
        return attempt(() => {
          const verb = this.#tree[this.#profile.transactVerb] as (fn: () => void) => KernelPending;
          const body = () => this.#body(op.body);
          const handle = verb.call(this.#tree, op.undoable ? () => this.#k.undoable(body) : body);
          return { tx: this.#txs.add(handle) };
        });
      case 'inspect':
        return this.#withTx(op.tx, (handle, tx) => {
          const inspection = (handle.inspect as NonNullable<KernelPending['inspect']>).call(handle);
          return {
            tx,
            changes: inspection.changes.map((c) => ({
              path: c.path,
              address: c.address === undefined ? null : toJson(c.address),
              subject: c.subject === undefined ? null : this.#labels.label(c.subject),
              status: c.status,
            })),
          };
        });
      case 'confirm':
        return this.#withTx(op.tx, (handle, tx) => {
          handle.confirm();
          return { tx };
        });
      case 'rollback':
        return this.#withTx(op.tx, (handle, tx) => {
          handle.rollback();
          return { tx };
        });
      case 'undo':
        return attempt(() => {
          (this.#tree.undo as () => void).call(this.#tree);
          return undefined;
        });
      case 'redo':
        return attempt(() => {
          (this.#tree.redo as () => void).call(this.#tree);
          return undefined;
        });
      case 'linkOpen':
        return this.#linkOpen(op.source, op.mode);
      case 'linkDispose':
        return this.#withLink(op.link, (entry, link) => {
          entry.handle?.dispose();
          return { link };
        });
      case 'linkSettled':
        return this.#withLink(op.link, (entry, link) => ({
          link,
          probe: this.#probe(link, 'settled', () => (entry.handle as KernelLink).settled()),
        }));
      case 'linkRetrieve':
        return this.#withLink(op.link, (entry, link) => {
          entry.retrieveValue = payloadFor(entry.source, op.value);
          return { link, probe: this.#probe(link, 'retrieve', () => (entry.handle as KernelLink).retrieve()) };
        });
      case 'linkPush': {
        const resolved = this.#links.resolve(op.link);
        if (!resolved) return { status: 'skipped', detail: 'no link open' };
        const { subscriber } = resolved.item;
        if (!subscriber) return { status: 'skipped', detail: 'link has no live subscription' };
        return attempt(() => {
          subscriber(toJson(payloadFor(resolved.item.source, op.value)));
          return { link: resolved.index };
        });
      }
      case 'linkAck': {
        const resolved = this.#links.resolve(op.link);
        if (!resolved) return { status: 'skipped', detail: 'no link open' };
        const ack = resolved.item.acks.shift();
        if (!ack) return { status: 'skipped', detail: 'no outbound write awaiting acknowledgement' };
        if (op.ok) ack.resolve();
        else ack.reject(new Error('endpoint rejected the write'));
        return { status: 'ok', value: { link: resolved.index } };
      }
      case 'declare':
        return this.#withLink(op.link, (entry, link) => {
          const declaration = this.#declaration(op.declaration, op.owners);
          const declare = (entry.handle as KernelLink).declare as NonNullable<KernelLink['declare']>;
          const receipt = declare.call(entry.handle, declaration, () => this.#body(op.body));
          return { link, receipt: this.#receipts.add(receipt), state: toJson(receipt.read()) };
        });
      case 'observerOpen':
        return attempt(() => {
          const unsubscribe = this.#observed(op.path).subscribe(() => {
            this.#observerThrows++;
            throw new Error('observer threw');
          });
          this.#observers.push(unsubscribe);
          return { observer: this.#observers.length - 1 };
        });
      case 'rowHold':
        return attempt((): Json => {
          const node = this.#tree.$.rows.byId(op.id);
          if (!node) return { found: false };
          return { handle: this.#rowHandles.add(node) };
        });
      case 'rowHeldRead':
        return this.#withRow(op.handle, (node, handle) => {
          const carrier = this.#carriers.label(node.n);
          return { handle, value: toJson(node()), carrier };
        });
      case 'rowHeldWrite':
        return this.#withRow(op.handle, (node, handle) => {
          const carrier = this.#carriers.label(node.n);
          node.n(op.n);
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
      case 'scopeAwait':
        return this.#scopeAwait(op.scope, op.before, op.after);
    }
  }

  /** The node a reader subscribes to, or why there is none. */
  #readerNode(reader: Reader): { node: KernelReader } | { skip: string } | { found: false } {
    const rows = this.#tree.$.rows;
    if (reader.kind === 'leaf') return { node: this.#leaf(reader.path) };
    if (reader.kind === 'field') {
      const row = rows.byId(reader.id);
      return row ? { node: row[reader.field] } : { found: false };
    }
    const node = rows[reader.kind];
    return typeof node.subscribe === 'function' ? { node } : { skip: `${this.#profile.name} rows.${reader.kind} cannot be subscribed` };
  }

  #observe(reader: Reader, react: Reaction): Outcome {
    const target = this.#readerNode(reader);
    if ('skip' in target) return { status: 'skipped', detail: target.skip };
    if ('found' in target) return { status: 'ok', value: { found: false } };
    const subscribe = target.node.subscribe;
    if (typeof subscribe !== 'function') return { status: 'skipped', detail: `${this.#profile.name} ${reader.kind} reader cannot be subscribed` };
    return attempt(() => {
      const observer = this.#observerCount;
      const unsubscribe = subscribe.call(target.node, () => {
        this.#observerEvents.push({ kind: 'run', observer, saw: readState(this.#tree) });
        if (react.kind === 'throw') {
          this.#observerThrows++;
          throw new Error('observer threw');
        }
        if (react.kind === 'write' && !this.#wroteSinceObservation.has(observer)) {
          this.#wroteSinceObservation.add(observer);
          const value = 10 + this.#reentrant++;
          // Recorded as issued, so a nested write comes after the write that caused it.
          const event: { kind: 'write'; observer: number; path: LeafPath; value: number; error?: ErrorInfo } = {
            kind: 'write',
            observer,
            path: react.path,
            value,
          };
          this.#observerEvents.push(event);
          try {
            this.#leaf(react.path)(value);
          } catch (thrown) {
            event.error = describeError(thrown);
          }
        }
      });
      this.#observers.push(unsubscribe);
      this.#observerCount++;
      return { observer };
    });
  }

  /** Serializes through the snapshot read and hydrates a fresh tree by a whole-value write. */
  #hydrate(): Json {
    const json = JSON.stringify(this.#tree.$());
    const fresh = this.#createTree();
    try {
      const watched = (['a', 'cfg.p', 'cfg.q'] as const).map((path) => {
        const saw: HydrateValue['observers'][number]['saw'][number][] = [];
        const node = path === 'a' ? fresh.$.a : path === 'cfg.p' ? fresh.$.cfg.p : fresh.$.cfg.q;
        node.subscribe(() => saw.push(readState(fresh)));
        return { path, saw };
      });
      fresh.$(JSON.parse(json));
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

  /** scope(async () => { before; await; after }), waiting for the body to finish. */
  async #scopeAwait(scope: 'transact' | 'undoable', before: readonly WriteOp[], after: readonly WriteOp[]): Promise<Outcome> {
    let body: Promise<void> | undefined;
    const run = (): Promise<void> => {
      body = (async () => {
        this.#body(before);
        await Promise.resolve();
        this.#body(after);
      })();
      return body;
    };
    const outcome = attempt((): Json | undefined => {
      if (scope === 'undoable') {
        this.#k.undoable(run);
        return undefined;
      }
      const verb = this.#tree[this.#profile.transactVerb] as (fn: () => unknown) => KernelPending;
      return { tx: this.#txs.add(verb.call(this.#tree, run)) };
    });
    await (body as Promise<void> | undefined)?.catch(() => undefined);
    return outcome;
  }

  #observed(path: ObservedPath): KernelLocation {
    const $ = this.#tree.$;
    return path === 'cfg' ? $.cfg : this.#leaf(path);
  }

  #withRow(ref: number, fn: (node: KernelRowNode, handle: number) => Json): Outcome {
    const resolved = this.#rowHandles.resolve(ref);
    if (!resolved) return { status: 'skipped', detail: 'no row handle held' };
    return attempt(() => fn(resolved.item, resolved.index));
  }

  #wrapped(wrap: 'none' | 'undoable' | 'external', fn: () => Json | undefined): Json | undefined {
    if (wrap === 'undoable') return this.#k.undoable(fn);
    if (wrap === 'external') return this.#k.external(fn);
    return fn();
  }

  #body(body: readonly WriteOp[]): void {
    for (const write of body) this.#write(write);
  }

  #leaf(path: LeafPath): KernelLocation {
    const $ = this.#tree.$;
    return path === 'a' ? $.a : path === 'cfg.p' ? $.cfg.p : $.cfg.q;
  }

  #write(w: WriteOp): Json | undefined {
    const rows = this.#tree.$.rows;
    const copy = (r: Row): Row => ({ id: r.id, n: r.n, m: r.m });
    switch (w.kind) {
      case 'setLeaf':
        this.#leaf(w.path)(w.value);
        return undefined;
      case 'updateLeaf':
        this.#leaf(w.path)((current: number) => current + w.delta);
        return undefined;
      case 'setBranch':
        this.#tree.$.cfg({ p: w.p, q: w.q });
        return undefined;
      case 'addOne':
        return toJson(rows.addOne(copy(w.row)));
      case 'addMany':
        return toJson(rows.addMany(w.rows.map(copy), { mode: w.mode }));
      case 'setAll':
        rows.setAll(w.rows.map(copy));
        return undefined;
      case 'updateOne':
        rows.updateOne(w.id, { [w.field]: w.value });
        return undefined;
      case 'updateMany':
        rows.updateMany([...w.ids], { [w.field]: w.value });
        return undefined;
      case 'upsertOne':
        return toJson(rows.upsertOne(copy(w.row)));
      case 'upsertMany':
        return toJson(rows.upsertMany(w.rows.map(copy)));
      case 'removeOne':
        rows.removeOne(w.id);
        return undefined;
      case 'removeMany':
        rows.removeMany([...w.ids]);
        return undefined;
      case 'changeId':
        rows.changeId(w.from, w.to);
        return undefined;
      case 'prependOne':
        return toJson(rows.prependOne(copy(w.row)));
      case 'replaceOne':
        rows.replaceOne(w.id, copy(w.row));
        return undefined;
      case 'clear':
        rows.clear();
        return undefined;
      case 'setField': {
        const node = rows.byId(w.id);
        if (!node) return { found: false };
        node[w.field](w.value);
        return undefined;
      }
    }
  }

  #withTx(ref: number, fn: (handle: KernelPending, tx: number) => Json): Outcome {
    const resolved = this.#txs.resolve(ref);
    if (!resolved) return { status: 'skipped', detail: 'no transaction open' };
    return attempt(() => fn(resolved.item, resolved.index));
  }

  #withLink(ref: number, fn: (entry: LinkEntry, link: number) => Json): Outcome {
    const resolved = this.#links.resolve(ref);
    if (!resolved) return { status: 'skipped', detail: 'no link open' };
    if (!resolved.item.handle) return { status: 'skipped', detail: 'link failed to open' };
    return attempt(() => fn(resolved.item, resolved.index));
  }

  #linkOpen(source: LinkSource, mode: LinkMode): Outcome {
    const index = this.#links.size;
    const entry: LinkEntry = { source, mode, subscriber: undefined, acks: [], retrieveValue: null };
    const endpoint = {
      get: () => toJson(entry.retrieveValue),
      set: (value: unknown) => {
        this.#pushes.push({ link: index, value: toJson(value) });
        if (mode === 'failing') throw new Error('endpoint refused the write');
        if (mode === 'deferred') {
          return new Promise<void>((resolve, reject) => entry.acks.push({ resolve, reject }));
        }
        return undefined;
      },
      subscribe: (next: (value: unknown) => void) => {
        entry.subscriber = next;
        return () => {
          if (entry.subscriber === next) entry.subscriber = undefined;
        };
      },
    };
    const $ = this.#tree.$;
    const node = source === 'a' ? $.a : source === 'cfg' ? $.cfg : $.rows;
    const outcome = attempt(() => {
      entry.handle = this.#k.link(node, endpoint);
      return { link: index };
    });
    this.#links.add(entry);
    return outcome;
  }

  #probe(link: number, kind: Probe['kind'], start: () => Promise<void>): number {
    const probe: Probe = { link, kind, status: 'pending' };
    this.#probes.push(probe);
    start().then(
      () => {
        probe.status = 'resolved';
      },
      (reason: unknown) => {
        probe.status = 'rejected';
        probe.error = describeError(reason);
      }
    );
    return this.#probes.length - 1;
  }

  #declaration(kind: DeclarationKind, owners: readonly number[]): unknown {
    switch (kind) {
      case 'independent':
      case 'unknown':
        return { kind };
      case 'dependent': {
        const handles = new Set<KernelPending>();
        for (const ref of owners) {
          const resolved = this.#txs.resolve(ref);
          if (resolved) handles.add(resolved.item);
        }
        return { kind: 'dependent', owners: [...handles] };
      }
      case 'malformed':
        // A declaration kind the API does not define.
        return { kind: 'conditional' };
    }
  }

  observe(): Observation {
    const rows = this.#tree.$.rows;
    let state: Observation['state'];
    try {
      state = {
        a: toJson(this.#tree.$.a()),
        cfg: toJson(this.#tree.$.cfg()),
        rows: toJson(rows.all()),
        ids: toJson(rows.ids()),
      };
    } catch (thrown) {
      state = { readError: describeError(thrown) };
    }
    const observation: {
      -readonly [K in keyof Observation]: Observation[K];
    } = {
      state,
      pushes: this.#pushes,
      probes: this.#probes.map((p) => ({ link: p.link, kind: p.kind, status: p.status, ...(p.error ? { error: p.error } : {}) })),
      receipts: this.#receipts.all().map((r) => readOrError(() => r.read())),
      treeErrors: this.#treeErrors,
      warnings: this.#warnings,
      observerThrows: this.#observerThrows,
      observerEvents: this.#observerEvents,
      paths: readPaths(this.#tree),
      ...(this.#atReturn ? { restorationAtReturn: this.#atReturn } : {}),
    };
    if (this.#config.restoration) {
      const tree = this.#tree as Required<Pick<KernelTree, 'canUndo' | 'canRedo' | 'getCurrentIndex' | 'getRestorationHistory'>>;
      observation.restoration = {
        canUndo: readOrError(() => tree.canUndo()),
        canRedo: readOrError(() => tree.canRedo()),
        index: readOrError(() => tree.getCurrentIndex()),
        length: readOrError(() => tree.getRestorationHistory().length),
      };
    }
    this.#pushes = [];
    this.#treeErrors = [];
    this.#warnings = [];
    this.#observerThrows = 0;
    this.#observerEvents = [];
    this.#wroteSinceObservation.clear();
    this.#atReturn = undefined;
    return observation;
  }

  close(): void {
    try {
      for (const unsubscribe of this.#observers) {
        try {
          unsubscribe();
        } catch {
          // As for links below: not an outcome of the sequence.
        }
      }
      for (const entry of this.#links.all()) {
        try {
          entry.handle?.dispose();
        } catch {
          // A failing dispose is not an outcome of the sequence; the tree goes next.
        }
      }
      try {
        this.#tree.destroy();
      } catch {
        // A sequence may have destroyed the tree already.
      }
    } finally {
      this.#offTreeError();
      this.#restoreConsole();
    }
  }
}

/** The state as StateView reads it, or `{ readError }`. */
function readState(tree: KernelTree): StateView | { readError: ErrorInfo } {
  try {
    const rows = tree.$.rows;
    return { a: toJson(tree.$.a()), cfg: toJson(tree.$.cfg()), rows: toJson(rows.all()), ids: toJson(rows.ids()) };
  } catch (thrown) {
    return { readError: describeError(thrown) };
  }
}

/** Every read path O3 names, or `{ readError }` when one throws. */
function readPaths(tree: KernelTree): ReadPaths | { readError: ErrorInfo } {
  try {
    const $ = tree.$;
    const byId: Record<string, ReadPaths['byId'][string]> = {};
    for (const key of ROW_KEYS) {
      const node = $.rows.byId(key);
      if (!node) {
        byId[key] = null;
        continue;
      }
      const fields: Record<string, Json> = { n: toJson(node.n()), m: toJson(node.m()) };
      if (typeof node.id === 'function') fields['id'] = toJson(node.id());
      byId[key] = { row: toJson(node()), fields };
    }
    return {
      leaves: { a: toJson($.a()), 'cfg.p': toJson($.cfg.p()), 'cfg.q': toJson($.cfg.q()) },
      branch: toJson($.cfg()),
      snapshot: toJson($()),
      count: toJson($.rows.count()),
      byId,
    };
  } catch (thrown) {
    return { readError: describeError(thrown) };
  }
}

/** A read's value, or `{ readError }` when the read throws: observation never throws. */
function readOrError(read: () => unknown): Json {
  try {
    return toJson(read());
  } catch (thrown) {
    return { readError: toJson(describeError(thrown)) };
  }
}

function describeValue(value: unknown): string {
  if (value instanceof Error) return `${value.constructor.name}: ${value.message}`;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}
