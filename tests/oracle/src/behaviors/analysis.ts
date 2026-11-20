// Facts about a replayed sequence that several properties share: which
// locations each step changed, which transaction, link or row handle a step
// addressed, and each transaction's lifecycle. Everything here is read from
// the trace and the handle-numbering rules in model.ts; nothing decides what
// an outcome should be.
import {
  INITIAL_SCALARS,
  type Json,
  type LinkMode,
  type LinkSource,
  type Observation,
  type Op,
  type Outcome,
  type StateView,
  type StepRecord,
  type WriteOp,
} from '../model.js';
import { canonical, type SpecTrace } from '../trace.js';

/**
 * A location: `a`, `cfg.p`, `cfg.q` or `rows.<key>` (one row, by the key the
 * collection lists it under).
 */
export type Loc = string;

export const SCALAR_LOCS: readonly Loc[] = ['a', 'cfg.p', 'cfg.q'];
export const rowLoc = (key: string): Loc => `rows.${key}`;
export const isRowLoc = (loc: Loc): boolean => loc.startsWith('rows.');

export const INITIAL_STATE: StateView = { ...structuredClone(INITIAL_SCALARS), rows: [], ids: [] };

/** Value of a location in canonical form; absent rows are left out. */
export interface LocValues {
  readonly values: ReadonlyMap<Loc, string>;
  /** False when `ids` and `rows` could not be paired, so row presence is unknown. */
  readonly rowsKnown: boolean;
}

const isRecord = (v: unknown): v is Record<string, Json> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function locValues(state: StateView): LocValues {
  const values = new Map<Loc, string>();
  values.set('a', canonical(state.a));
  const cfg = isRecord(state.cfg) ? state.cfg : {};
  values.set('cfg.p', canonical(cfg['p']));
  values.set('cfg.q', canonical(cfg['q']));
  const { ids, rows } = state;
  const rowsKnown = Array.isArray(ids) && Array.isArray(rows) && ids.length === rows.length;
  if (rowsKnown) {
    ids.forEach((key, i) => values.set(rowLoc(String(key)), canonical(rows[i])));
  }
  return { values, rowsKnown };
}

/** The row stored under `key`, or undefined when absent or unknown. */
export function rowAt(state: StateView | undefined, key: string): Json | undefined {
  if (!state || !Array.isArray(state.ids) || !Array.isArray(state.rows)) return undefined;
  const i = state.ids.findIndex((k) => k === key);
  return i < 0 ? undefined : (state.rows[i] as Json);
}

/** Whether `key` is listed in the collection; undefined when the state is unreadable. */
export function hasRow(state: StateView | undefined, key: string): boolean | undefined {
  if (!state || !Array.isArray(state.ids)) return undefined;
  return state.ids.includes(key);
}

export interface StepInfo {
  readonly index: number;
  readonly op: Op;
  readonly outcome: Outcome;
  readonly observation: Observation;
  /** State before and after the step; undefined when the read failed. */
  readonly before: StateView | undefined;
  readonly after: StateView | undefined;
  /** Locations whose value differs between before and after. */
  readonly changed: ReadonlySet<Loc>;
  /**
   * The change set may be incomplete (a state read failed, or rows could not
   * be paired with ids), or may hold another step's asynchronous writes (an
   * earlier same-tick step scheduled link or declaration work that landed in
   * this step's drain).
   */
  readonly unknown: boolean;
  /** `transact` ok: the handle it opened. `inspect`, `confirm`, `rollback`: the handle it addressed. */
  readonly tx?: number;
  /** Link handle opened (`linkOpen`) or addressed (other link steps). */
  readonly link?: number;
  /** Row handle opened (`rowHold` ok) or addressed (`rowHeldRead`, `rowHeldWrite`). */
  readonly row?: number;
}

export interface TxInfo {
  readonly index: number;
  /** The step that opened it. */
  readonly step: number;
  readonly body: readonly WriteOp[];
  readonly undoable: boolean;
  /** Locations the opening step changed. */
  readonly changed: ReadonlySet<Loc>;
  readonly unknown: boolean;
  /** The step at which confirm() or rollback() succeeded. */
  readonly settled?: { readonly step: number; readonly how: 'confirmed' | 'rolledBack' };
}

export interface LinkInfo {
  readonly index: number;
  readonly step: number;
  readonly source: LinkSource;
  readonly mode: LinkMode;
  readonly opened: boolean;
}

export interface RowHandleInfo {
  readonly index: number;
  readonly step: number;
  readonly key: string;
}

export interface Analysis {
  readonly trace: SpecTrace;
  readonly steps: readonly StepInfo[];
  readonly txs: readonly TxInfo[];
  readonly links: readonly LinkInfo[];
  readonly rowHandles: readonly RowHandleInfo[];
}

const applied = (outcome: Outcome) => outcome.status === 'ok' || outcome.status === 'error';

const stateOf = (record: StepRecord | undefined): StateView | undefined => {
  if (!record) return INITIAL_STATE;
  const { state } = record.observation;
  return 'readError' in state ? undefined : state;
};

function diff(before: StateView | undefined, after: StateView | undefined): { changed: Set<Loc>; unknown: boolean } {
  const changed = new Set<Loc>();
  if (!before || !after) return { changed, unknown: true };
  const b = locValues(before);
  const a = locValues(after);
  for (const loc of SCALAR_LOCS) if (b.values.get(loc) !== a.values.get(loc)) changed.add(loc);
  const rowsKnown = b.rowsKnown && a.rowsKnown;
  if (rowsKnown) {
    const keys = new Set([...b.values.keys(), ...a.values.keys()].filter(isRowLoc));
    for (const loc of keys) if (b.values.get(loc) !== a.values.get(loc)) changed.add(loc);
  }
  return { changed, unknown: !rowsKnown };
}

const cache = new WeakMap<SpecTrace, Analysis>();

/** Operations whose effects may land after they return, in the next drain. */
const ASYNC_KINDS = new Set<Op['kind']>([
  'linkOpen',
  'linkDispose',
  'linkSettled',
  'linkRetrieve',
  'linkPush',
  'linkAck',
  'declare',
]);

export function analyze(trace: SpecTrace): Analysis {
  const cached = cache.get(trace);
  if (cached) return cached;
  const steps: StepInfo[] = [];
  const txs: { -readonly [K in keyof TxInfo]: TxInfo[K] }[] = [];
  const links: LinkInfo[] = [];
  const rowHandles: RowHandleInfo[] = [];
  const resolve = (ref: number, count: number) => (count === 0 ? undefined : ref % count);
  let asyncCarried = false;

  trace.sequence.steps.forEach((step, index) => {
    const record = trace.records[index];
    if (!record) throw new Error(`trace has no record for step ${index}`);
    const before = stateOf(trace.records[index - 1]);
    const after = stateOf(record);
    const diffed = diff(before, after);
    const { changed } = diffed;
    const unknown = diffed.unknown || asyncCarried;
    const { op } = step;
    asyncCarried = step.sameTick && (asyncCarried || ASYNC_KINDS.has(op.kind));
    const { outcome } = record;
    const info: { -readonly [K in keyof StepInfo]: StepInfo[K] } = {
      index,
      op,
      outcome,
      observation: record.observation,
      before,
      after,
      changed,
      unknown,
    };
    switch (op.kind) {
      case 'transact':
        if (outcome.status === 'ok') {
          info.tx = txs.length;
          txs.push({ index: txs.length, step: index, body: op.body, undoable: op.undoable, changed, unknown });
        }
        break;
      case 'inspect':
      case 'confirm':
      case 'rollback': {
        const tx = resolve(op.tx, txs.length);
        if (tx !== undefined) info.tx = tx;
        const target = tx === undefined ? undefined : txs[tx];
        if (target && !target.settled && outcome.status === 'ok' && op.kind !== 'inspect') {
          target.settled = { step: index, how: op.kind === 'confirm' ? 'confirmed' : 'rolledBack' };
        }
        break;
      }
      case 'linkOpen':
        if (applied(outcome)) {
          info.link = links.length;
          links.push({ index: links.length, step: index, source: op.source, mode: op.mode, opened: outcome.status === 'ok' });
        }
        break;
      case 'linkDispose':
      case 'linkSettled':
      case 'linkRetrieve':
      case 'linkPush':
      case 'linkAck':
      case 'declare': {
        const link = resolve(op.link, links.length);
        if (link !== undefined) info.link = link;
        break;
      }
      case 'rowHold': {
        const value = outcome.status === 'ok' ? outcome.value : undefined;
        if (isRecord(value) && typeof value['handle'] === 'number') {
          info.row = rowHandles.length;
          rowHandles.push({ index: rowHandles.length, step: index, key: op.id });
        }
        break;
      }
      case 'rowHeldRead':
      case 'rowHeldWrite': {
        const row = resolve(op.handle, rowHandles.length);
        if (row !== undefined) info.row = row;
        break;
      }
      default:
        break;
    }
    steps.push(info);
  });

  const analysis: Analysis = { trace, steps, txs, links, rowHandles };
  cache.set(trace, analysis);
  return analysis;
}

/** A transaction's state just before `step`. */
export function txStatus(tx: TxInfo, step: number): 'pending' | 'confirmed' | 'rolledBack' {
  if (!tx.settled || tx.settled.step >= step) return 'pending';
  return tx.settled.how;
}

export const intersects = (a: ReadonlySet<Loc>, b: ReadonlySet<Loc>): boolean => [...a].some((loc) => b.has(loc));
export const intersection = (a: ReadonlySet<Loc>, b: ReadonlySet<Loc>): Set<Loc> => new Set([...a].filter((loc) => b.has(loc)));

/** Locations a link's source covers. Rows are matched by prefix. */
export function sourceCovers(source: LinkSource, loc: Loc): boolean {
  if (source === 'a') return loc === 'a';
  if (source === 'cfg') return loc === 'cfg.p' || loc === 'cfg.q';
  return isRowLoc(loc);
}

/**
 * Locations an inspect() change path names, per the InspectValue contract in
 * model.ts. `rows` covers every row. Undefined when the path is not in that
 * form.
 */
export function locsOfPath(path: string): { readonly locs: readonly Loc[]; readonly allRows: boolean } | undefined {
  if (path === 'a' || path === 'cfg.p' || path === 'cfg.q') return { locs: [path], allRows: false };
  if (path === 'cfg') return { locs: ['cfg.p', 'cfg.q'], allRows: false };
  if (path === 'rows') return { locs: [], allRows: true };
  const match = /^rows\.([^.]+)(\.[^.]+)?$/.exec(path);
  return match ? { locs: [rowLoc(match[1] as string)], allRows: false } : undefined;
}

/** Steps whose op changes `key`'s identity: a changeId naming it, top level or in a body. */
export function rekeys(op: Op, key: string): boolean {
  const writes: readonly WriteOp[] =
    op.kind === 'write' ? [op.write] : op.kind === 'transact' || op.kind === 'declare' ? op.body : [];
  return writes.some((w) => w.kind === 'changeId' && (w.from === key || w.to === key));
}

/** An outcome in the terms properties report: `ok`, or the refusal's class, cause and message. */
export function outcomeSummary(outcome: Outcome): Json {
  if (outcome.status === 'error') {
    return { error: outcome.error.class, cause: outcome.error.causeKind ?? null, message: outcome.error.message };
  }
  return outcome.status;
}

/** Locations a write names, whatever it ends up changing. */
export function writeTargets(w: WriteOp): { readonly locs: readonly Loc[]; readonly allRows: boolean } {
  switch (w.kind) {
    case 'setLeaf':
    case 'updateLeaf':
      return { locs: [w.path], allRows: false };
    case 'setBranch':
      return { locs: ['cfg.p', 'cfg.q'], allRows: false };
    case 'addOne':
    case 'upsertOne':
    case 'prependOne':
      return { locs: [rowLoc(w.row.id)], allRows: false };
    case 'addMany':
    case 'upsertMany':
      return { locs: w.rows.map((r) => rowLoc(r.id)), allRows: false };
    case 'updateOne':
    case 'removeOne':
    case 'setField':
      return { locs: [rowLoc(w.id)], allRows: false };
    case 'updateMany':
    case 'removeMany':
      return { locs: w.ids.map(rowLoc), allRows: false };
    case 'changeId':
      return { locs: [rowLoc(w.from), rowLoc(w.to)], allRows: false };
    case 'replaceOne':
      return { locs: [rowLoc(w.id), rowLoc(w.row.id)], allRows: false };
    case 'setAll':
    case 'clear':
      return { locs: [], allRows: true };
  }
}

/**
 * Whether a step may have written `loc`, even to the value it already had.
 * Writes are judged by the locations they name; steps whose targets the
 * vocabulary does not name (undo, redo, rollback, link traffic, held-handle
 * writes) may have written anything.
 */
export function mayWrite(op: Op, loc: Loc): boolean {
  const names = (w: WriteOp) => {
    const t = writeTargets(w);
    return t.locs.includes(loc) || (t.allRows && isRowLoc(loc));
  };
  switch (op.kind) {
    case 'write':
      return names(op.write);
    case 'transact':
    case 'declare':
      return op.body.some(names);
    case 'undo':
    case 'redo':
    case 'rollback':
    case 'linkOpen':
    case 'linkPush':
    case 'linkRetrieve':
    case 'linkAck':
    case 'rowHeldWrite':
      return true;
    default:
      return false;
  }
}
