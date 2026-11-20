// Facts about a replayed sequence that several properties share: which
// locations each step changed and touched, which transaction, link or row
// handle a step addressed, and each transaction's lifecycle. Everything here
// is read from the trace and the handle-numbering rules in model.ts, except
// touch sets, which are derived from each write's name and kept only when
// they reproduce the state the subject left; nothing decides what an outcome
// should be.
import {
  INITIAL_SCALARS,
  payloadFor,
  type Json,
  type LeafPath,
  type LinkMode,
  type LinkSource,
  type Observation,
  type Op,
  type Outcome,
  type Reaction,
  type Reader,
  type Row,
  type StateView,
  type StepRecord,
  type WriteOp,
} from '../model.js';
import { canonical, type SpecTrace } from '../trace.js';

/**
 * A location (BRIEF.md T4): a scalar leaf (`a`, `cfg.p`, `cfg.q`), a row
 * field (`rows.<key>.<field>`, one field of the row the collection lists
 * under `<key>`: `id`, `n` or `m`), or a row's existence (`rows.<key>`: its
 * key and presence).
 */
export type Loc = string;

export const SCALAR_LOCS: readonly Loc[] = ['a', 'cfg.p', 'cfg.q'];
export const existenceLoc = (key: string): Loc => `rows.${key}`;
export const fieldLoc = (key: string, field: string): Loc => `rows.${key}.${field}`;
export const isRowLoc = (loc: Loc): boolean => loc.startsWith('rows.');

/** The key of a row location; undefined for a scalar leaf. Keys and field names hold no dot. */
export function rowKeyOf(loc: Loc): string | undefined {
  if (!isRowLoc(loc)) return undefined;
  const rest = loc.slice(5);
  const dot = rest.indexOf('.');
  return dot < 0 ? rest : rest.slice(0, dot);
}

export const isExistenceLoc = (loc: Loc): boolean => isRowLoc(loc) && !loc.slice(5).includes('.');

/**
 * Whether two locations overlap: they are equal, or one is a row's existence
 * and the other is that row's existence or one of its fields ("which every
 * field of the row depends on"). Two fields of one row do not overlap.
 */
export function overlaps(a: Loc, b: Loc): boolean {
  if (a === b) return true;
  const key = rowKeyOf(a);
  return key !== undefined && key === rowKeyOf(b) && (isExistenceLoc(a) || isExistenceLoc(b));
}

export const overlapsAny = (a: Iterable<Loc>, b: Iterable<Loc>): boolean => {
  const bs = [...b];
  return [...a].some((x) => bs.some((y) => overlaps(x, y)));
};

/** The locations of `of` that some location of `by` overlaps. */
export const overlapping = (by: Iterable<Loc>, of: Iterable<Loc>): Set<Loc> => {
  const bs = [...by];
  return new Set([...of].filter((x) => bs.some((y) => overlaps(x, y))));
};

export const INITIAL_STATE: StateView = { ...structuredClone(INITIAL_SCALARS), rows: [], ids: [] };

/** A present row's existence value in LocValues; an absent row has no entries. */
const PRESENT = '"present"';

/** Value of each location in canonical form; absent rows (and their fields) are left out. */
export interface LocValues {
  readonly values: ReadonlyMap<Loc, string>;
  /** False when `ids` and `rows` could not be paired, so row presence is unknown. */
  readonly rowsKnown: boolean;
}

const isRecord = (v: unknown): v is Record<string, Json> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The collection's rows by key, when `ids` and `rows` pair up one to one. */
function rowsByKey(state: StateView): Map<string, Json> | undefined {
  const { ids, rows } = state;
  if (!Array.isArray(ids) || !Array.isArray(rows) || ids.length !== rows.length) return undefined;
  const keys = ids.map(String);
  if (new Set(keys).size !== keys.length) return undefined;
  return new Map(keys.map((key, i) => [key, rows[i] as Json]));
}

function rowValues(values: Map<Loc, string>, key: string, row: Json): void {
  values.set(existenceLoc(key), PRESENT);
  if (isRecord(row)) for (const [field, v] of Object.entries(row)) values.set(fieldLoc(key, field), canonical(v));
}

export function locValues(state: StateView): LocValues {
  const values = new Map<Loc, string>();
  values.set('a', canonical(state.a));
  const cfg = isRecord(state.cfg) ? state.cfg : {};
  values.set('cfg.p', canonical(cfg['p']));
  values.set('cfg.q', canonical(cfg['q']));
  const rows = rowsByKey(state);
  if (rows) for (const [key, row] of rows) rowValues(values, key, row);
  return { values, rowsKnown: rows !== undefined };
}

/** Field locations `values` holds for `key`. */
const fieldsOf = (values: ReadonlyMap<Loc, string>, key: string): Loc[] =>
  [...values.keys()].filter((loc) => loc.startsWith(`rows.${key}.`));

/**
 * `locs` with each row existence among them widened to the fields that row
 * has in any of `views`: restoring a row's existence restores its fields.
 */
export function withRowFields(locs: Iterable<Loc>, ...views: readonly LocValues[]): Set<Loc> {
  const out = new Set<Loc>();
  for (const loc of locs) {
    out.add(loc);
    const key = rowKeyOf(loc);
    if (key !== undefined && isExistenceLoc(loc)) for (const v of views) for (const f of fieldsOf(v.values, key)) out.add(f);
  }
  return out;
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

/**
 * Locations a step's writes touched, per T4. A write the seam skips as
 * unchanged is not a write; with no interceptor covering a location the
 * seam's equality is Object.is (BRIEF.md 4.2 item 3), applied per location:
 * - a scalar leaf or row field is written a number, so writing the number it
 *   already holds is skipped and touches nothing. A branch write (setBranch)
 *   is read as one write per leaf, since a leaf is the cell the seam commits.
 * - a row's existence is written a row object the caller allocated, which
 *   Object.is never finds equal, so it is touched even when the row it
 *   leaves looks the same ("wrote the same value").
 * Each vocabulary write, as both published kernels run it:
 * - setLeaf, updateLeaf, setBranch: the leaves whose value it changes;
 * - updateOne, updateMany, setField: the fields whose value it changes (none
 *   on a missing key: updateOne and updateMany refuse, setField does nothing);
 * - upsertOne, upsertMany: on a listed key an update, so the fields whose
 *   value it changes; otherwise an add;
 * - addOne, prependOne, addMany: the existence of each row added, and with
 *   mode overwrite of each listed row replaced (strict refuses a listed or
 *   repeated key; skip leaves a listed key alone);
 * - replaceOne: the existence of the key replaced (the row keeps its key);
 * - removeOne, removeMany: the existence of each row removed;
 * - changeId: the existence of both keys (nothing when they are equal);
 * - setAll: the existence of every row listed before or after; clear: of
 *   every row listed before;
 * - an inbound link value (linkPush, linkRetrieve): the source's own write of
 *   that value (setLeaf, setBranch, or setAll of the rows).
 * `maybe` holds locations the step may or may not have touched.
 */
export interface Touches {
  readonly sure: ReadonlySet<Loc>;
  readonly maybe: ReadonlySet<Loc>;
}

const NONE: ReadonlySet<Loc> = new Set();

interface Sim {
  readonly scalars: Map<Loc, Json>;
  readonly rows: Map<string, Record<string, Json>>;
}

function simOf(state: StateView | undefined): Sim | undefined {
  if (!state || !isRecord(state.cfg)) return undefined;
  const rows = rowsByKey(state);
  if (!rows || ![...rows.values()].every(isRecord)) return undefined;
  return {
    scalars: new Map<Loc, Json>([
      ['a', state.a],
      ['cfg.p', state.cfg['p'] ?? null],
      ['cfg.q', state.cfg['q'] ?? null],
    ]),
    rows: new Map([...rows].map(([k, r]) => [k, { ...(r as Record<string, Json>) }])),
  };
}

function simMatches(sim: Sim, view: LocValues): boolean {
  if (!view.rowsKnown) return false;
  const values = new Map<Loc, string>();
  for (const [loc, v] of sim.scalars) values.set(loc, canonical(v));
  for (const [key, row] of sim.rows) rowValues(values, key, row);
  return values.size === view.values.size && [...values].every(([loc, v]) => view.values.get(loc) === v);
}

/**
 * Applies one vocabulary write to `sim` as Touches describes, adding what it
 * touched to `sure`. False when the write refuses (a duplicate add, a
 * missing key) and so touches nothing. Checked afterwards against the state
 * the subject left: a step whose writes do not reproduce that state has no
 * touch set (`touches` undefined).
 */
function simWrite(sim: Sim, w: WriteOp, sure: Set<Loc>): boolean {
  const { rows } = sim;
  const setScalar = (loc: Loc, v: Json) => {
    if (Object.is(sim.scalars.get(loc), v)) return;
    sim.scalars.set(loc, v);
    sure.add(loc);
  };
  const setField = (key: string, field: string, v: Json) => {
    const row = rows.get(key) as Record<string, Json>;
    if (Object.is(row[field], v)) return;
    rows.set(key, { ...row, [field]: v });
    sure.add(fieldLoc(key, field));
  };
  const put = (key: string, row: Row) => {
    rows.set(key, { ...row });
    sure.add(existenceLoc(key));
  };
  const drop = (key: string) => {
    rows.delete(key);
    sure.add(existenceLoc(key));
  };
  switch (w.kind) {
    case 'setLeaf':
      setScalar(w.path, w.value);
      return true;
    case 'updateLeaf': {
      const current = sim.scalars.get(w.path);
      if (typeof current !== 'number') return false;
      setScalar(w.path, current + w.delta);
      return true;
    }
    case 'setBranch':
      setScalar('cfg.p', w.p);
      setScalar('cfg.q', w.q);
      return true;
    case 'addOne':
    case 'prependOne':
      if (rows.has(w.row.id)) return false;
      put(w.row.id, w.row);
      return true;
    case 'addMany': {
      if (w.mode === 'strict') {
        const ids = w.rows.map((r) => r.id);
        if (new Set(ids).size !== ids.length || ids.some((id) => rows.has(id))) return false;
      }
      for (const r of w.rows) if (w.mode !== 'skip' || !rows.has(r.id)) put(r.id, r);
      return true;
    }
    case 'setAll':
      for (const key of rows.keys()) sure.add(existenceLoc(key));
      rows.clear();
      for (const r of w.rows) put(r.id, r);
      return true;
    case 'clear':
      for (const key of [...rows.keys()]) drop(key);
      return true;
    case 'updateOne':
      if (!rows.has(w.id)) return false;
      setField(w.id, w.field, w.value);
      return true;
    case 'updateMany':
      if (w.ids.some((id) => !rows.has(id))) return false;
      for (const id of w.ids) setField(id, w.field, w.value);
      return true;
    case 'setField':
      if (rows.has(w.id)) setField(w.id, w.field, w.value);
      return true;
    case 'upsertOne':
    case 'upsertMany':
      for (const r of w.kind === 'upsertOne' ? [w.row] : w.rows) {
        // On a listed key an upsert updates the row's fields; otherwise it adds the row.
        if (!rows.has(r.id)) put(r.id, r);
        else for (const [field, v] of Object.entries(r)) setField(r.id, field, v);
      }
      return true;
    case 'removeOne':
      if (!rows.has(w.id)) return false;
      drop(w.id);
      return true;
    case 'removeMany':
      if (w.ids.some((id) => !rows.has(id))) return false;
      for (const id of new Set(w.ids)) drop(id);
      return true;
    case 'changeId': {
      const row = rows.get(w.from);
      if (!row || (w.from !== w.to && rows.has(w.to))) return false;
      if (w.from === w.to) return true;
      rows.delete(w.from);
      rows.set(w.to, row);
      sure.add(existenceLoc(w.from));
      sure.add(existenceLoc(w.to));
      return true;
    }
    case 'replaceOne':
      // The row keeps its key; its content, `id` field included, is replaced.
      if (!rows.has(w.id)) return false;
      put(w.id, w.row);
      return true;
  }
}

/**
 * The locations an operation changed in T4's terms: those whose value it
 * changed, plus the existence of every row whose existence it touched. A
 * replace, or a setAll that keeps a key, leaves the row present with the
 * same key but still changes its existence, which every field of the row
 * depends on (ruling on #26).
 */
export function changedLocations(changed: ReadonlySet<Loc>, touches: Touches | undefined): Set<Loc> {
  return new Set([...changed, ...[...(touches?.sure ?? [])].filter(isExistenceLoc)]);
}

/** The writes an inbound link value makes on its source: the value written as the source's own write. */
function linkWrites(source: LinkSource, value: number): WriteOp[] {
  switch (source) {
    case 'a':
      return [{ kind: 'setLeaf', path: 'a', value }];
    case 'cfg':
      return [{ kind: 'setBranch', p: value, q: value }];
    case 'rows':
      return [{ kind: 'setAll', rows: payloadFor('rows', value) as unknown as Row[] }];
  }
}

export interface StepInfo {
  readonly index: number;
  readonly op: Op;
  readonly outcome: Outcome;
  readonly observation: Observation;
  /** State before and after the step; undefined when the read failed. */
  readonly before: StateView | undefined;
  readonly after: StateView | undefined;
  /**
   * Locations whose value differs between before and after: a row's
   * existence when its presence differs, its fields when it is present on
   * both sides.
   */
  readonly changed: ReadonlySet<Loc>;
  /**
   * Locations its writes touched (see Touches). For a vocabulary write, a
   * transaction or an inbound link value that ran, derived from the writes
   * and checked against the state; undefined when they do not reproduce it.
   * For any other step, the locations it changed.
   */
  readonly touches: Touches | undefined;
  /**
   * The change set may be incomplete (a state read failed, or rows could not
   * be paired with ids), or may hold writes that are not the operation's own:
   * another step's asynchronous writes (an earlier same-tick step scheduled
   * link or declaration work that landed in this step's drain), or an
   * observer's reentrant writes.
   */
  readonly unknown: boolean;
  /** `transact` ok: the handle it opened. `inspect`, `confirm`, `rollback`: the handle it addressed. */
  readonly tx?: number;
  /** Link handle opened (`linkOpen`) or addressed (other link steps). */
  readonly link?: number;
  /** Row handle opened (`rowHold` ok) or addressed (`rowHeldRead`, `rowHeldWrite`). */
  readonly row?: number;
  /** Observer handle opened (`observe` ok with an observer). */
  readonly observer?: number;
  /**
   * Writes observers made while this step's turn was published, in order
   * (O4). A step with any is `unknown`: its change set holds writes that are
   * not its operation's.
   */
  readonly reentrant: readonly { readonly observer: number; readonly path: LeafPath; readonly value: number }[];
}

export interface ObserverInfo {
  readonly index: number;
  /** The step that opened it. */
  readonly step: number;
  readonly reader: Reader;
  readonly react: Reaction;
}

export interface TxInfo {
  readonly index: number;
  /** The step that opened it. */
  readonly step: number;
  readonly body: readonly WriteOp[];
  readonly undoable: boolean;
  /** Locations whose value the opening step changed. */
  readonly changed: ReadonlySet<Loc>;
  /** The locations it changed in T4's terms (see changedLocations). */
  readonly locs: ReadonlySet<Loc>;
  /** Locations its body touched; undefined when the body does not reproduce the state it left. */
  readonly touches: Touches | undefined;
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
  readonly observers: readonly ObserverInfo[];
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
    const keys = new Set([...b.values.keys(), ...a.values.keys()].filter(isExistenceLoc).map((loc) => rowKeyOf(loc) as string));
    for (const key of keys) {
      const exists = existenceLoc(key);
      if (b.values.has(exists) !== a.values.has(exists)) {
        changed.add(exists);
      } else {
        for (const loc of new Set([...fieldsOf(b.values, key), ...fieldsOf(a.values, key)])) {
          if (b.values.get(loc) !== a.values.get(loc)) changed.add(loc);
        }
      }
    }
  }
  return { changed, unknown: !rowsKnown };
}

/**
 * What a step's writes touched. `writes` are the vocabulary writes it ran,
 * or undefined for a step that runs none of its own (its touches are then
 * the locations it changed). `inbound`: the writes are a link's inbound
 * value, which may land later or not at all, so a write that would leave
 * the state as it was cannot be told from no write.
 */
function touchesOf(
  writes: readonly WriteOp[] | undefined,
  inbound: boolean,
  before: StateView | undefined,
  after: StateView | undefined,
  changed: ReadonlySet<Loc>
): Touches | undefined {
  if (!writes) return { sure: changed, maybe: NONE };
  const sim = simOf(before);
  if (!sim || !after) return undefined;
  const sure = new Set<Loc>();
  for (const w of writes) if (!simWrite(sim, w, sure)) return undefined;
  if (!simMatches(sim, locValues(after))) return undefined;
  if (inbound && before && simMatches(sim, locValues(before))) return { sure: NONE, maybe: sure };
  return { sure, maybe: NONE };
}

/**
 * Locations each group of writes touched, run one group after another from
 * `before`; undefined unless together they reproduce `after`.
 */
export function touchesOfGroups(
  before: StateView | undefined,
  after: StateView | undefined,
  groups: readonly (readonly WriteOp[])[]
): Set<Loc>[] | undefined {
  const sim = simOf(before);
  if (!sim || !after) return undefined;
  const out: Set<Loc>[] = [];
  for (const group of groups) {
    const sure = new Set<Loc>();
    for (const w of group) if (!simWrite(sim, w, sure)) return undefined;
    out.push(sure);
  }
  return simMatches(sim, locValues(after)) ? out : undefined;
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

/** Whether an operation's effects may land after it returns, in the next drain. */
export const isAsyncKind = (kind: Op['kind']): boolean => ASYNC_KINDS.has(kind);

export function analyze(trace: SpecTrace): Analysis {
  const cached = cache.get(trace);
  if (cached) return cached;
  const steps: StepInfo[] = [];
  const txs: { -readonly [K in keyof TxInfo]: TxInfo[K] }[] = [];
  const links: LinkInfo[] = [];
  const rowHandles: RowHandleInfo[] = [];
  const observers: ObserverInfo[] = [];
  const resolve = (ref: number, count: number) => (count === 0 ? undefined : ref % count);
  let asyncCarried = false;

  trace.sequence.steps.forEach((step, index) => {
    const record = trace.records[index];
    if (!record) throw new Error(`trace has no record for step ${index}`);
    const before = stateOf(trace.records[index - 1]);
    const after = stateOf(record);
    const diffed = diff(before, after);
    const { changed } = diffed;
    const reentrant = (record.observation.observerEvents ?? []).flatMap((e) =>
      e.kind === 'write' && !e.error ? [{ observer: e.observer, path: e.path, value: e.value }] : []
    );
    const unknown = diffed.unknown || asyncCarried || reentrant.length > 0;
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
      touches: undefined,
      unknown,
      reentrant,
    };
    let writes: readonly WriteOp[] | undefined;
    let inbound = false;
    if (outcome.status === 'ok') {
      if (op.kind === 'write') writes = [op.write];
      else if (op.kind === 'transact' || op.kind === 'declare') writes = op.body;
      else if (op.kind === 'scopeAwait') writes = [...op.before, ...op.after];
    }
    switch (op.kind) {
      case 'transact':
        if (outcome.status === 'ok') info.tx = txs.length;
        break;
      case 'scopeAwait':
        if (op.scope === 'transact' && outcome.status === 'ok') info.tx = txs.length;
        break;
      case 'observe': {
        const value = outcome.status === 'ok' ? outcome.value : undefined;
        if (isRecord(value) && typeof value['observer'] === 'number') {
          info.observer = observers.length;
          observers.push({ index: observers.length, step: index, reader: op.reader, react: op.react });
        }
        break;
      }
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
        const source = link === undefined ? undefined : links[link]?.source;
        if ((op.kind === 'linkPush' || op.kind === 'linkRetrieve') && outcome.status === 'ok' && source) {
          writes = linkWrites(source, op.value);
          inbound = true;
        }
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
    // Reentrant writes land after the step's own (O4); they are leaf writes like any other.
    const reentrantWrites = reentrant.map((r): WriteOp => ({ kind: 'setLeaf', path: r.path, value: r.value }));
    info.touches = touchesOf(writes && [...writes, ...reentrantWrites], inbound, before, after, changed);
    if (info.tx !== undefined && (op.kind === 'transact' || op.kind === 'scopeAwait')) {
      txs.push({
        index: txs.length,
        step: index,
        body: op.kind === 'transact' ? op.body : op.before,
        undoable: op.kind === 'transact' && op.undoable,
        changed,
        locs: changedLocations(changed, info.touches),
        touches: info.touches,
        // A transaction whose body awaited: which writes belong to it is W5's question, not one the other rows answer.
        unknown: unknown || op.kind === 'scopeAwait',
      });
    }
    steps.push(info);
  });

  const analysis: Analysis = { trace, steps, txs, links, rowHandles, observers };
  cache.set(trace, analysis);
  return analysis;
}

/** A transaction's state just before `step`. */
export function txStatus(tx: TxInfo, step: number): 'pending' | 'confirmed' | 'rolledBack' {
  if (!tx.settled || tx.settled.step >= step) return 'pending';
  return tx.settled.how;
}

/** The step at which destroy() succeeded, if any. */
export function destroyedAt(analysis: Analysis): number | undefined {
  return analysis.steps.find((s) => s.op.kind === 'destroy' && s.outcome.status === 'ok')?.index;
}

/**
 * Whether a reader reads `loc` (O1): a leaf reads itself; a field reader its
 * field (and so the row's existence, which overlaps it); all() every row
 * location; ids() and count() every row's existence.
 */
export function readerReads(reader: Reader, loc: Loc): boolean {
  switch (reader.kind) {
    case 'leaf':
      return loc === reader.path;
    case 'field':
      return overlaps(loc, fieldLoc(reader.id, reader.field));
    case 'all':
      return isRowLoc(loc);
    case 'ids':
    case 'count':
      return isExistenceLoc(loc);
  }
}

/**
 * The first step at which an observer may no longer read what it opened on:
 * for a field reader, the first later step that touched or may have touched
 * its row's existence (the row it subscribed through may be gone or rekeyed,
 * E1), or whose touches cannot be seen; for any reader, the step that
 * destroyed the tree. Infinity when there is none.
 */
export function observerValidUntil(analysis: Analysis, observer: ObserverInfo): number {
  const destroyed = destroyedAt(analysis) ?? Infinity;
  const { reader } = observer;
  if (reader.kind !== 'field') return destroyed;
  const exists = existenceLoc(reader.id);
  for (const s of analysis.steps.slice(observer.step + 1)) {
    if (s.index >= destroyed) break;
    const t = s.touches;
    if (s.unknown || !t || t.sure.has(exists) || t.maybe.has(exists) || s.changed.has(exists)) return s.index;
  }
  return destroyed;
}

/** Locations a link's source covers. Rows are matched by prefix. */
export function sourceCovers(source: LinkSource, loc: Loc): boolean {
  if (source === 'a') return loc === 'a';
  if (source === 'cfg') return loc === 'cfg.p' || loc === 'cfg.q';
  return isRowLoc(loc);
}

/**
 * Locations an inspect() change path names, per the InspectValue contract in
 * model.ts: `rows.<key>` names the row's existence, `rows.<key>.<field>` one
 * field, `rows` every row. Undefined when the path is not in that form.
 */
export function locsOfPath(path: string): { readonly locs: readonly Loc[]; readonly allRows: boolean } | undefined {
  if (path === 'a' || path === 'cfg.p' || path === 'cfg.q') return { locs: [path], allRows: false };
  if (path === 'cfg') return { locs: ['cfg.p', 'cfg.q'], allRows: false };
  if (path === 'rows') return { locs: [], allRows: true };
  const match = /^rows\.([^.]+)(?:\.([^.]+))?$/.exec(path);
  if (!match) return undefined;
  const key = match[1] as string;
  return { locs: [match[2] === undefined ? existenceLoc(key) : fieldLoc(key, match[2])], allRows: false };
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

/**
 * Locations a write names, whatever it ends up touching: the leaves or
 * fields it writes, or the existence of each row it adds, removes, replaces,
 * upserts or rekeys (`allRows` for setAll and clear).
 */
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
      return { locs: [existenceLoc(w.row.id)], allRows: false };
    case 'addMany':
    case 'upsertMany':
      return { locs: w.rows.map((r) => existenceLoc(r.id)), allRows: false };
    case 'updateOne':
    case 'setField':
      return { locs: [fieldLoc(w.id, w.field)], allRows: false };
    case 'updateMany':
      return { locs: w.ids.map((id) => fieldLoc(id, w.field)), allRows: false };
    case 'removeOne':
    case 'replaceOne':
      return { locs: [existenceLoc(w.id)], allRows: false };
    case 'removeMany':
      return { locs: w.ids.map(existenceLoc), allRows: false };
    case 'changeId':
      return { locs: [existenceLoc(w.from), existenceLoc(w.to)], allRows: false };
    case 'setAll':
    case 'clear':
      return { locs: [], allRows: true };
  }
}

/** Whether a step that ran names a location overlapping `loc` in one of its own writes (writes, transactions, declarations). */
export function names(op: Op, status: string, loc: Loc): boolean {
  if (status !== 'ok' && status !== 'error') return false;
  const writes: readonly WriteOp[] =
    op.kind === 'write'
      ? [op.write]
      : op.kind === 'transact' || op.kind === 'declare'
        ? op.body
        : op.kind === 'scopeAwait'
          ? [...op.before, ...op.after]
          : [];
  return writes.some((w) => {
    const t = writeTargets(w);
    return t.locs.some((l) => overlaps(l, loc)) || (t.allRows && isRowLoc(loc));
  });
}

/**
 * Whether a step may have written a location overlapping `loc`, even to the
 * value it already had. Writes are judged by the locations they name; steps
 * whose targets the vocabulary does not name (undo, redo, rollback, link
 * traffic, held-handle writes) may have written anything.
 */
export function mayWrite(op: Op, loc: Loc): boolean {
  switch (op.kind) {
    case 'write':
    case 'transact':
    case 'declare':
    case 'scopeAwait':
      return names(op, 'ok', loc);
    case 'undo':
    case 'destroy':
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
