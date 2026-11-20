// The oracle's operation vocabulary and trace schema. Operation names are the
// spec's own (BRIEF.md section 4.4: transact, inspect, confirm, rollback,
// undoable, external, entityMap writes, changeId) or plain descriptions of what
// a step does. Subjects translate these operations into their own API and
// report outcomes in this shape, so generation and the behavior properties in
// behaviors/ stay implementation-neutral. No subject is an authority on what
// an outcome should be (BRIEF.md 12.1.4); the properties are.
//
// Provisional (BRIEF.md 11.2):
// - #6: no writer identity in these operations; the published packages have
//   none, so W1–W4 are not generated from them.
// - #7: no entityMap `move`; the published packages have none.
//
// Handle numbering, which the properties rely on to resolve references the
// same way every subject does:
// - a `transact` that returns ok opens the next transaction handle;
// - every applied `linkOpen` (ok or error) opens the next link handle;
// - a `rowHold` that returns ok with a `handle` opens the next row handle.
// A step's reference is resolved modulo the handles opened before it.

/** Scalar leaves in the fixture state. `cfg` is the one branch. */
export const LEAF_PATHS = ['a', 'cfg.p', 'cfg.q'] as const;
export type LeafPath = (typeof LEAF_PATHS)[number];

/** Row keys. A small pool keeps collisions (duplicates, missing ids, reuse) frequent. */
export const ROW_KEYS = ['r0', 'r1', 'r2', 'r3', 'r4', 'r5'] as const;
export type RowKey = (typeof ROW_KEYS)[number];

export interface Row {
  readonly id: RowKey;
  readonly n: number;
}

/** Initial state every subject builds: `{ a: 0, cfg: { p: 0, q: 0 }, rows: <empty entity map of Row> }`. */
export const INITIAL_SCALARS = { a: 0, cfg: { p: 0, q: 0 } } as const;

export const LINK_SOURCES = ['a', 'cfg', 'rows'] as const;
export type LinkSource = (typeof LINK_SOURCES)[number];

/**
 * How a link's endpoint acknowledges outbound writes:
 * sync      `set()` returns undefined (acknowledged at once)
 * deferred  `set()` returns a promise settled by a later `linkAck` operation
 * failing   `set()` throws
 */
export type LinkMode = 'sync' | 'deferred' | 'failing';

export type AddManyMode = 'strict' | 'skip' | 'overwrite';

/** Locations an observer can subscribe to: the scalar leaves and the `cfg` branch. */
export const OBSERVED_PATHS = ['a', 'cfg.p', 'cfg.q', 'cfg'] as const;
export type ObservedPath = (typeof OBSERVED_PATHS)[number];

/** A state write. Used top level, inside transactions and inside declarations. */
export type WriteOp =
  | { readonly kind: 'setLeaf'; readonly path: LeafPath; readonly value: number }
  | { readonly kind: 'updateLeaf'; readonly path: LeafPath; readonly delta: number }
  | { readonly kind: 'setBranch'; readonly p: number; readonly q: number }
  | { readonly kind: 'addOne'; readonly row: Row }
  | { readonly kind: 'addMany'; readonly rows: readonly Row[]; readonly mode: AddManyMode }
  | { readonly kind: 'setAll'; readonly rows: readonly Row[] }
  | { readonly kind: 'updateOne'; readonly id: RowKey; readonly n: number }
  | { readonly kind: 'updateMany'; readonly ids: readonly RowKey[]; readonly n: number }
  | { readonly kind: 'upsertOne'; readonly row: Row }
  | { readonly kind: 'upsertMany'; readonly rows: readonly Row[] }
  | { readonly kind: 'removeOne'; readonly id: RowKey }
  | { readonly kind: 'removeMany'; readonly ids: readonly RowKey[] }
  | { readonly kind: 'changeId'; readonly from: RowKey; readonly to: RowKey }
  | { readonly kind: 'prependOne'; readonly row: Row }
  | { readonly kind: 'replaceOne'; readonly id: RowKey; readonly row: Row }
  | { readonly kind: 'clear' }
  /** Write one field through a row handle: `rows.byId(id).n(value)`. */
  | { readonly kind: 'setField'; readonly id: RowKey; readonly n: number };

export type WriteKind = WriteOp['kind'];
export const WRITE_KINDS: readonly WriteKind[] = [
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
  'prependOne',
  'replaceOne',
  'clear',
  'setField',
];

/**
 * How a top-level write is classified:
 * none      an ordinary write
 * undoable  inside undoable(): eligible for undo
 * external  inside external(): truth from another authority, not authored work
 */
export type Wrap = 'none' | 'undoable' | 'external';

export type DeclarationKind = 'independent' | 'unknown' | 'dependent' | 'malformed';

/**
 * Handle references (`tx`, `link`) are indexes into the handles a sequence has
 * opened so far, taken modulo their count. That keeps every reference valid
 * while fast-check shrinks the sequence. With no handle open the step is
 * skipped by every subject alike.
 */
export type Op =
  | { readonly kind: 'write'; readonly write: WriteOp; readonly wrap: Wrap }
  | { readonly kind: 'transact'; readonly body: readonly WriteOp[]; readonly undoable: boolean }
  | { readonly kind: 'inspect'; readonly tx: number }
  | { readonly kind: 'confirm'; readonly tx: number }
  | { readonly kind: 'rollback'; readonly tx: number }
  | { readonly kind: 'undo' }
  | { readonly kind: 'redo' }
  | { readonly kind: 'linkOpen'; readonly source: LinkSource; readonly mode: LinkMode }
  | { readonly kind: 'linkDispose'; readonly link: number }
  | { readonly kind: 'linkSettled'; readonly link: number }
  | { readonly kind: 'linkRetrieve'; readonly link: number; readonly value: number }
  | { readonly kind: 'linkPush'; readonly link: number; readonly value: number }
  | { readonly kind: 'linkAck'; readonly link: number; readonly ok: boolean }
  | {
      readonly kind: 'declare';
      readonly link: number;
      readonly declaration: DeclarationKind;
      readonly owners: readonly number[];
      readonly body: readonly WriteOp[];
    }
  /** Subscribe an observer to `path` that throws every time it is notified. */
  | { readonly kind: 'observerOpen'; readonly path: ObservedPath }
  /** Look up `rows.byId(id)` and keep the handle. Ok with `{ found: false }` when there is no such row. */
  | { readonly kind: 'rowHold'; readonly id: RowKey }
  /** Read the row through a held handle: ok with `{ handle, value, carrier }`. */
  | { readonly kind: 'rowHeldRead'; readonly handle: number }
  /** Write field `n` through a held handle: ok with `{ handle, carrier }`. */
  | { readonly kind: 'rowHeldWrite'; readonly handle: number; readonly n: number };

export type ControlKind = Exclude<Op['kind'], 'write'>;
/** Every operation kind a subject may or may not support. */
export type OpKind = WriteKind | ControlKind;

export const CONTROL_KINDS: readonly ControlKind[] = [
  'transact',
  'inspect',
  'confirm',
  'rollback',
  'undo',
  'redo',
  'linkOpen',
  'linkDispose',
  'linkSettled',
  'linkRetrieve',
  'linkPush',
  'linkAck',
  'declare',
  'observerOpen',
  'rowHold',
  'rowHeldRead',
  'rowHeldWrite',
];

export const ALL_KINDS: readonly OpKind[] = [...WRITE_KINDS, ...CONTROL_KINDS];

/** Plugins a sequence installs. Steps that need a missing plugin are skipped by the runner. */
export interface TreeConfig {
  readonly transactions: boolean;
  readonly restoration: boolean;
}

export type Plugin = keyof TreeConfig;

export interface Step {
  readonly op: Op;
  /** When true the runner does not drain after this step, so the next step lands in the same turn. */
  readonly sameTick: boolean;
}

export interface Sequence {
  readonly config: TreeConfig;
  readonly steps: readonly Step[];
}

/** JSON-safe value. Subjects clone everything they report into this shape. */
export type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };

export interface ErrorInfo {
  /** Constructor name, e.g. SignalTreeRollbackError, Error, TypeError. */
  readonly class: string;
  /** The error's `code` property when it is a string. */
  readonly code?: string;
  /** The [ST####] code found in the message, without brackets. */
  readonly st?: string;
  /** `cause.kind`, the refusal cause a rollback names. */
  readonly causeKind?: string;
  /** SignalTreePublicationError stage and reason. */
  readonly stage?: string;
  readonly reason?: string;
  /** Whether the error offers a recovery handle, and what it says about the callback. */
  readonly recovery?: { readonly callbackFailed: boolean };
  readonly message: string;
}

export type Outcome =
  | { readonly status: 'ok'; readonly value?: Json }
  | { readonly status: 'error'; readonly error: ErrorInfo }
  /** The subject has no such operation. */
  | { readonly status: 'unsupported'; readonly detail: string }
  /** The step could not run in this sequence: no handle open, or a plugin not installed. */
  | { readonly status: 'skipped'; readonly detail: string };

export interface StateView {
  readonly a: Json;
  readonly cfg: Json;
  /** `all()` in collection order. */
  readonly rows: Json;
  /** `ids()` in collection order. After changeId() a row keeps its own `id` field, so both are read. */
  readonly ids: Json;
}

export interface Observation {
  readonly state: StateView | { readonly readError: ErrorInfo };
  /** Present when restoration is installed. A read that throws is observed as `{ readError }`. */
  readonly restoration?: {
    readonly canUndo: Json;
    readonly canRedo: Json;
    readonly index: Json;
    readonly length: Json;
  };
  /** Outbound endpoint writes since the previous observation, in delivery order. */
  readonly pushes: readonly { readonly link: number; readonly value: Json }[];
  /** Every settled()/retrieve() probe opened so far and where it stands. */
  readonly probes: readonly {
    readonly link: number;
    readonly kind: 'settled' | 'retrieve';
    readonly status: 'pending' | 'resolved' | 'rejected';
    readonly error?: ErrorInfo;
  }[];
  /** Every publication receipt issued so far, read now. */
  readonly receipts: readonly Json[];
  /** onTreeError events since the previous observation (tree identity left out). */
  readonly treeErrors: readonly { readonly operation: string; readonly path?: string; readonly error: ErrorInfo }[];
  /** console.warn / console.error calls since the previous observation. */
  readonly warnings: readonly { readonly level: 'warn' | 'error'; readonly st?: string; readonly message: string }[];
  /** Times an `observerOpen` observer was notified (and threw) since the previous observation. */
  readonly observerThrows: number;
}

/**
 * The value an `inspect` step returns when it succeeds. `path` is the changed
 * location in dot form: `a`, `cfg.p`, `cfg` (the branch), `rows` (the whole
 * collection), `rows.<key>` or `rows.<key>.<field>`.
 */
export interface InspectValue {
  readonly tx: number;
  readonly changes: readonly { readonly path: string; readonly status: string }[];
}

export interface StepRecord {
  /** 0-based step index; the final record (after the last drain) has op `end`. */
  readonly index: number;
  readonly label: string;
  readonly outcome: Outcome;
  readonly observation: Observation;
  /** Errors thrown asynchronously (uncaught) while this step ran or drained. */
  readonly asyncErrors: readonly ErrorInfo[];
}

export type Trace = readonly StepRecord[];

/** The plugin an operation kind needs, if any. */
export function pluginForKind(kind: OpKind): Plugin | undefined {
  switch (kind) {
    case 'transact':
    case 'inspect':
    case 'confirm':
    case 'rollback':
      return 'transactions';
    case 'undo':
    case 'redo':
      return 'restoration';
    default:
      return undefined;
  }
}

/** Plugins a step needs that `config` does not install. */
export function missingPlugins(op: Op, config: TreeConfig): readonly Plugin[] {
  const plugin = pluginForKind(op.kind === 'write' ? op.write.kind : op.kind);
  return plugin && !config[plugin] ? [plugin] : [];
}

/** Every operation kind a step exercises, nested writes included. */
export function kindsOf(op: Op): readonly OpKind[] {
  switch (op.kind) {
    case 'write':
      return [op.write.kind];
    case 'transact':
    case 'declare':
      return [op.kind, ...op.body.map((w) => w.kind)];
    default:
      return [op.kind];
  }
}

/** A short label for a step, recorded in its trace record. */
export function patternOf(op: Op): string {
  switch (op.kind) {
    case 'write':
      return op.wrap === 'none' ? op.write.kind : `${op.wrap}(${op.write.kind})`;
    case 'transact':
      return op.undoable ? 'transact(undoable)' : 'transact';
    case 'declare':
      return `declare(${op.declaration})`;
    case 'linkOpen':
      return `linkOpen(${op.mode})`;
    default:
      return op.kind;
  }
}

/** The value an endpoint supplies for `source`, derived from one generated number so every subject agrees. */
export function payloadFor(source: LinkSource, value: number): Json {
  switch (source) {
    case 'a':
      return value;
    case 'cfg':
      return { p: value, q: value };
    case 'rows': {
      const id = ROW_KEYS[value % ROW_KEYS.length] as RowKey;
      return [{ id, n: value }];
    }
  }
}

const rowText = (r: Row) => `${r.id}:${r.n}`;

export function formatWrite(w: WriteOp): string {
  switch (w.kind) {
    case 'setLeaf':
      return `setLeaf(${w.path}=${w.value})`;
    case 'updateLeaf':
      return `updateLeaf(${w.path}+=${w.delta})`;
    case 'setBranch':
      return `setBranch(cfg={p:${w.p},q:${w.q}})`;
    case 'addOne':
    case 'upsertOne':
    case 'prependOne':
      return `${w.kind}(${rowText(w.row)})`;
    case 'replaceOne':
      return `replaceOne(${w.id},${rowText(w.row)})`;
    case 'clear':
      return 'clear()';
    case 'addMany':
      return `addMany([${w.rows.map(rowText).join(',')}],${w.mode})`;
    case 'setAll':
    case 'upsertMany':
      return `${w.kind}([${w.rows.map(rowText).join(',')}])`;
    case 'updateOne':
    case 'setField':
      return `${w.kind}(${w.id},n=${w.n})`;
    case 'updateMany':
      return `updateMany([${w.ids.join(',')}],n=${w.n})`;
    case 'removeOne':
      return `removeOne(${w.id})`;
    case 'removeMany':
      return `removeMany([${w.ids.join(',')}])`;
    case 'changeId':
      return `changeId(${w.from}->${w.to})`;
  }
}

export function formatOp(op: Op): string {
  switch (op.kind) {
    case 'write':
      return op.wrap === 'none' ? formatWrite(op.write) : `${op.wrap}(${formatWrite(op.write)})`;
    case 'transact': {
      const body = op.body.map(formatWrite).join('; ');
      return `transact(${op.undoable ? `undoable(${body})` : body})`;
    }
    case 'inspect':
    case 'confirm':
    case 'rollback':
      return `${op.kind}(tx${op.tx})`;
    case 'undo':
    case 'redo':
      return `${op.kind}()`;
    case 'linkOpen':
      return `linkOpen(${op.source},${op.mode})`;
    case 'linkDispose':
    case 'linkSettled':
      return `${op.kind}(link${op.link})`;
    case 'linkRetrieve':
    case 'linkPush':
      return `${op.kind}(link${op.link},${op.value})`;
    case 'linkAck':
      return `linkAck(link${op.link},${op.ok ? 'ok' : 'fail'})`;
    case 'declare': {
      const owners = op.declaration === 'dependent' ? `[${op.owners.map((o) => `tx${o}`).join(',')}]` : '';
      return `declare(link${op.link},${op.declaration}${owners}: ${op.body.map(formatWrite).join('; ')})`;
    }
    case 'observerOpen':
      return `observerOpen(${op.path}, throws)`;
    case 'rowHold':
      return `rowHold(${op.id})`;
    case 'rowHeldRead':
      return `rowHeldRead(h${op.handle})`;
    case 'rowHeldWrite':
      return `rowHeldWrite(h${op.handle},n=${op.n})`;
  }
}

export function formatSequence(seq: Sequence): string[] {
  const plugins = (Object.keys(seq.config) as Plugin[]).filter((p) => seq.config[p]);
  return [
    `plugins: ${plugins.length ? plugins.join(', ') : 'none'}`,
    ...seq.steps.map((s, i) => `${i}: ${formatOp(s.op)}${s.sameTick ? '  (same tick as next)' : ''}`),
  ];
}
