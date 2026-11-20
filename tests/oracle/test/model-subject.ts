// A tiny in-memory subject for testing the generator itself: leaf, branch
// and a few entity writes, inbound link values, optimistic transactions with
// field-level rollback checks, optional undo/redo, and options that plant a
// defect, fix the cause a rollback refuses with, or make replays differ.
import { readerReads } from '../src/behaviors/analysis.js';
import {
  payloadFor,
  ROW_KEYS,
  type ErrorInfo,
  type HydrateValue,
  type Json,
  type LeafPath,
  type LinkSource,
  type Observation,
  type ObserverEvent,
  type Op,
  type OpKind,
  type Outcome,
  type Reaction,
  type ReadPaths,
  type Reader,
  type Row,
  type StateView,
  type WriteOp,
} from '../src/model.js';
import { attempt, describeError, HandleTable, type Session, type Subject } from '../src/subject.js';

export const MODEL_KINDS: readonly OpKind[] = [
  'setLeaf',
  'updateLeaf',
  'setBranch',
  'addOne',
  'updateOne',
  'removeOne',
  'transact',
  'confirm',
  'rollback',
];

/**
 * How rollback decides that a later write depends on the transaction:
 * field       a later write touched a location overlapping one it changed
 *             (BRIEF.md T4: a leaf, a row field, or a row's existence, which
 *             overlaps every field of the row); newer truth that removed the
 *             row supersedes it instead (T5)
 * row         planted: any touch on a row it changed counts, whatever the field
 * fields-only planted: later writes that touch a row's existence are ignored
 * none        never refuse; rollback restores the whole state before the transaction
 */
export type Conflicts = 'field' | 'row' | 'fields-only' | 'none';

export interface ModelOptions {
  readonly kinds?: readonly OpKind[];
  /** Return true to make the subject silently drop this write when it runs inside transact(). */
  readonly dropInTransaction?: (write: WriteOp) => boolean;
  /** When set, every rollback refuses with this cause. Otherwise rollback follows `conflicts`. */
  readonly rollbackCause?: string;
  /** Default 'field'. */
  readonly conflicts?: Conflicts;
  /** Planted: rollback restores each row the transaction changed whole, over other writers' fields. */
  readonly restoreWholeRows?: boolean;
  /**
   * Planted: an operation that replaced a row, or kept it through setAll,
   * changed only the field values that differ, not the row's existence, so a
   * later write to another field of that row is not a dependency.
   */
  readonly rewriteIsFieldOnly?: boolean;
  /** Planted: an inbound link value is the tree's own write, not newer truth, so its removal of a row is a dependency. */
  readonly linkIsOrdinary?: boolean;
  /** Planted: once newer truth removed a row, other later writes on that row stop counting as dependencies. */
  readonly supersessionMasks?: boolean;
  /** Each session adds a different offset to leaf writes, so replays of one sequence differ. */
  readonly nondeterministic?: boolean;
  /**
   * Adds undo and redo. Every undoable() write and undoable transaction gets a
   * history entry when it runs; undo skips and removes entries whose
   * transaction was rolled back, and undo and redo refuse when a later write
   * touched a location they would write (R2, R3).
   */
  readonly restoration?: boolean;
  /** Planted: undo restores only the first location an entry changed. */
  readonly undoPartial?: boolean;
  /** Planted: undo reverses even over a newer write. */
  readonly undoOverwrites?: boolean;
  /** Planted: undo steps past a rolled-back transaction's entry but leaves it in history. */
  readonly keepRolledBack?: boolean;
  /** Planted: redo re-applies even over a newer write. */
  readonly redoOverwrites?: boolean;
  /** Planted: redo refuses only when a location it re-applies no longer holds the value undo left there. */
  readonly redoByValue?: boolean;
  /** Planted (O1): every observer runs whenever an operation wrote, whatever it touched. */
  readonly coarseReaders?: boolean;
  /** Planted (O2): a transaction publishes each of its writes as it runs, not once at its end. */
  readonly publishEachWrite?: boolean;
  /** Planted (O2): history state is updated after the operation returns. */
  readonly historyLater?: boolean;
  /** Planted (O3): count() reads the count of the previous observation. */
  readonly staleCount?: boolean;
  /** Planted (O4): a reentrant write is applied at once, inside the turn being published. */
  readonly reentrantInline?: boolean;
  /** Planted (O4): a reentrant write is refused. */
  readonly refuseReentrant?: boolean;
  /** Planted (X3): a throwing observer stops the observers after it. */
  readonly faultStops?: boolean;
  /** Planted (X3): a throwing observer's error reaches the writer. */
  readonly faultToWriter?: boolean;
  /** Planted (D1): destroy() does nothing. */
  readonly destroyKeeps?: boolean;
  /** Planted (W5): writes after an await stay in the scope's transaction or history entry. */
  readonly scopeCarries?: boolean;
  /** Planted (H1): hydration writes each leaf as its own turn. */
  readonly hydrateInParts?: boolean;
}

class ModelRefusal extends Error {}
/** The typed error the model throws for any read or write of a destroyed tree (D1). */
class ModelDestroyedError extends Error {}

let sessions = 0;

export function modelSubject(name: string, options: ModelOptions = {}): Subject {
  const supports = new Set<OpKind>([...(options.kinds ?? MODEL_KINDS), ...(options.restoration ? (['undo', 'redo'] as const) : [])]);
  return {
    name,
    description: 'in-memory model (generator tests only)',
    supports,
    open: (config) => new ModelSession(supports, options, options.nondeterministic ? sessions++ % 2 : 0, config.restoration),
  };
}

interface State {
  a: number;
  cfg: { p: number; q: number };
  rows: Map<string, Row>;
}

const copy = (s: State): State => ({ a: s.a, cfg: { ...s.cfg }, rows: new Map(s.rows) });

/**
 * Locations, as in analysis.ts: `a`, `cfg.p`, `cfg.q`, `rows.<key>` (the
 * row's existence; its value is the whole row) and `rows.<key>.<field>`.
 */
const LEAVES = ['a', 'cfg.p', 'cfg.q'] as const;
const keyOf = (loc: string): string | undefined => (loc.startsWith('rows.') ? (loc.slice(5).split('.')[0] as string) : undefined);
const isExistence = (loc: string) => loc.startsWith('rows.') && loc.split('.').length === 2;
const overlaps = (x: string, y: string) =>
  x === y || (keyOf(x) !== undefined && keyOf(x) === keyOf(y) && (isExistence(x) || isExistence(y)));

function get(s: State, loc: string): string | undefined {
  if (loc === 'a') return String(s.a);
  if (loc === 'cfg.p') return String(s.cfg.p);
  if (loc === 'cfg.q') return String(s.cfg.q);
  const [, key, field] = loc.split('.') as [string, string, string | undefined];
  const row = s.rows.get(key);
  if (!row) return undefined;
  return field === undefined ? JSON.stringify(row) : JSON.stringify(row[field as keyof Row]);
}

function put(s: State, loc: string, value: string | undefined): void {
  if (loc === 'a') s.a = Number(value);
  else if (loc === 'cfg.p') s.cfg = { ...s.cfg, p: Number(value) };
  else if (loc === 'cfg.q') s.cfg = { ...s.cfg, q: Number(value) };
  else {
    const [, key, field] = loc.split('.') as [string, string, string | undefined];
    const row = s.rows.get(key);
    if (field === undefined) {
      if (value === undefined) s.rows.delete(key);
      else s.rows.set(key, JSON.parse(value) as Row);
    } else if (row && value !== undefined) {
      s.rows.set(key, { ...row, [field]: JSON.parse(value) as unknown });
    }
  }
}

/** Locations whose value differs: a row's existence when its presence differs, its fields when present on both sides. */
function changedLocs(before: State, after: State): string[] {
  const out: string[] = LEAVES.filter((l) => get(before, l) !== get(after, l));
  for (const key of new Set([...before.rows.keys(), ...after.rows.keys()])) {
    const b = before.rows.get(key);
    const a = after.rows.get(key);
    if (!b || !a) {
      if (b || a) out.push(`rows.${key}`);
      continue;
    }
    for (const f of new Set([...Object.keys(b), ...Object.keys(a)])) {
      if (JSON.stringify(b[f as keyof Row]) !== JSON.stringify(a[f as keyof Row])) out.push(`rows.${key}.${f}`);
    }
  }
  return out;
}

interface Entry {
  readonly before: State;
  readonly after: State;
  /** Locations the operation changed, in T4's terms (see `changedIn`). */
  readonly locs: readonly string[];
  readonly tx?: number;
  rolledBack: boolean;
  undone: boolean;
  /** Log length when it was last applied (recorded or redone), or undone. */
  at: number;
}

/** One write in the order it ran, with what it touched (a write the seam skips touches nothing). */
interface Logged {
  readonly touched: ReadonlySet<string>;
  /** Rows it removed. */
  readonly removed: ReadonlySet<string>;
  /** Newer truth: a write inside external() or an inbound link value. */
  readonly truth: boolean;
  /** The transaction whose body ran it. */
  readonly tx?: number;
  /** A rollback's compensation (T7: never a dependency). */
  readonly compensation?: boolean;
  /** An undo's or redo's own write. */
  readonly restoration?: boolean;
  /** The history entry of the operation that made it. */
  entry?: Entry;
}

interface Tx {
  readonly before: State;
  readonly changed: readonly string[];
  /** Log length when it opened; its own writes follow. */
  readonly logAt: number;
  settled: false | 'confirmed' | 'rolledBack';
  readonly entry?: Entry;
}

class ModelSession implements Session {
  #state: State = { a: 0, cfg: { p: 0, q: 0 }, rows: new Map() };
  readonly #txs = new HandleTable<Tx>();
  readonly #links = new HandleTable<LinkSource>();
  readonly #log: Logged[] = [];
  readonly #supports: ReadonlySet<OpKind>;
  readonly #options: ModelOptions;
  readonly #offset: number;
  readonly #restoration: boolean;
  readonly #history: Entry[] = [];
  /** Index of the last applied entry; entries above it can be redone. */
  #index = -1;
  readonly #watchers: { readonly index: number; readonly reader: Reader; readonly react: Reaction }[] = [];
  #events: ObserverEvent[] = [];
  #observerThrows = 0;
  #reentrant = 0;
  /** Writing observers that wrote since the last observation (each writes at most once in between, as in subjects/kernel.ts). */
  readonly #wrote = new Set<number>();
  /** Reentrant writes waiting for the turn being published to end. */
  readonly #queued: { readonly path: LeafPath; readonly value: number }[] = [];
  #destroyed = false;
  #atReturn: Observation['restorationAtReturn'];
  /** count() at the previous observation (staleCount). */
  #lastCount = 0;

  constructor(supports: ReadonlySet<OpKind>, options: ModelOptions, offset: number, restoration: boolean) {
    this.#supports = supports;
    this.#options = options;
    this.#offset = offset;
    this.#restoration = restoration && !!options.restoration;
  }

  /** Runs `fn` as one turn: once it returns, observers of what it touched run, then reentrant writes run as turns of their own. */
  #turn<T>(fn: () => T): T {
    const logAt = this.#log.length;
    const result = fn();
    this.#publish(this.#log.slice(logAt));
    return result;
  }

  #publish(entries: readonly Logged[]): void {
    const touched = entries.flatMap((w) => [...w.touched]);
    const due = this.#watchers.filter((o) =>
      this.#options.coarseReaders ? entries.length > 0 : touched.some((loc) => readerReads(o.reader, loc))
    );
    let fault: Error | undefined;
    for (const o of due) {
      this.#events.push({ kind: 'run', observer: o.index, saw: this.#view() });
      if (o.react.kind === 'throw') {
        this.#observerThrows++;
        if (this.#options.faultToWriter) fault ??= new Error('observer threw');
        if (this.#options.faultStops) break;
      } else if (o.react.kind === 'write' && !this.#wrote.has(o.index)) {
        this.#wrote.add(o.index);
        const event: { kind: 'write'; observer: number; path: LeafPath; value: number; error?: ErrorInfo } = {
          kind: 'write',
          observer: o.index,
          path: o.react.path,
          value: 10 + this.#reentrant++,
        };
        this.#events.push(event);
        if (this.#options.refuseReentrant) event.error = describeError(new ModelRefusal('reentrant write refused'));
        else if (this.#options.reentrantInline) this.#write({ kind: 'setLeaf', path: event.path, value: event.value - this.#offset }, false);
        else this.#queued.push({ path: event.path, value: event.value });
      }
    }
    for (let next = this.#queued.shift(); next; next = this.#queued.shift()) {
      const { path, value } = next;
      this.#turn(() => this.#write({ kind: 'setLeaf', path, value: value - this.#offset }, false));
    }
    if (fault) throw fault;
  }

  #view(state: State = this.#state): StateView {
    const rows = [...state.rows.values()].map((r) => ({ ...r }));
    return { a: state.a, cfg: { ...state.cfg }, rows, ids: [...state.rows.keys()] };
  }

  #paths(): ReadPaths {
    const s = this.#state;
    const byId: Record<string, ReadPaths['byId'][string]> = {};
    for (const key of ROW_KEYS) {
      const row = s.rows.get(key);
      byId[key] = row ? { row: { ...row }, fields: { id: row.id, n: row.n, m: row.m } } : null;
    }
    const count = this.#options.staleCount ? this.#lastCount : s.rows.size;
    this.#lastCount = s.rows.size;
    return {
      leaves: { a: s.a, 'cfg.p': s.cfg.p, 'cfg.q': s.cfg.q },
      branch: { ...s.cfg },
      snapshot: { a: s.a, cfg: { ...s.cfg }, rows: { all: [...s.rows.values()].map((r) => ({ ...r })) } },
      count,
      byId,
    };
  }

  #restorationState(): Observation['restorationAtReturn'] {
    if (!this.#restoration) return undefined;
    return { canUndo: this.#index >= 0, canRedo: this.#index < this.#history.length - 1, index: this.#index, length: this.#history.length };
  }

  /** The fresh tree a hydration leaves, and what its leaf observers read: one turn, or (planted) one per leaf. */
  #hydrate(): HydrateValue {
    const state = this.#view();
    const fresh: Record<'a' | 'cfg.p' | 'cfg.q', number> = { a: 0, 'cfg.p': 0, 'cfg.q': 0 };
    const target: Record<'a' | 'cfg.p' | 'cfg.q', number> = { a: this.#state.a, 'cfg.p': this.#state.cfg.p, 'cfg.q': this.#state.cfg.q };
    const paths = ['a', 'cfg.p', 'cfg.q'] as const;
    return {
      state,
      observers: paths.map((path, i) => {
        if (target[path] === fresh[path]) return { path, saw: [] };
        if (!this.#options.hydrateInParts) return { path, saw: [state] };
        // Leaves land one at a time, rows last.
        const part = (p: (typeof paths)[number]) => (paths.indexOf(p) <= i ? target[p] : fresh[p]);
        return { path, saw: [{ a: part('a'), cfg: { p: part('cfg.p'), q: part('cfg.q') }, rows: [], ids: [] }] };
      }),
    };
  }

  /**
   * The locations an operation that ran from `before` and logged from `logAt`
   * changed, in T4's terms: those whose value differs, plus the existence of
   * every row its writes touched (a replace, or a setAll keeping the key,
   * changes the row's existence).
   */
  #changedIn(before: State, logAt: number): string[] {
    const locs = new Set(changedLocs(before, this.#state));
    if (!this.#options.rewriteIsFieldOnly) {
      for (const w of this.#log.slice(logAt)) for (const t of w.touched) if (isExistence(t)) locs.add(t);
    }
    return [...locs];
  }

  /** Runs `fn` and, when it is undoable and restoration is on, records a history entry. */
  #recorded(undoable: boolean, fn: () => void, tx?: number): Entry | undefined {
    const before = copy(this.#state);
    const logAt = this.#log.length;
    fn();
    if (!undoable || !this.#restoration) return undefined;
    const after = copy(this.#state);
    const entry: Entry = {
      before,
      after,
      locs: this.#changedIn(before, logAt),
      ...(tx === undefined ? {} : { tx }),
      rolledBack: false,
      undone: false,
      at: this.#log.length,
    };
    for (const w of this.#log.slice(logAt)) w.entry = entry;
    this.#history.splice(this.#index + 1);
    this.#history.push(entry);
    this.#index = this.#history.length - 1;
    return entry;
  }

  /** Runs `fn` (which changes state outside the write vocabulary) and logs what it changed. */
  #logged(fn: () => void, kind: 'compensation' | 'restoration'): void {
    const before = copy(this.#state);
    fn();
    const touched = new Set(changedLocs(before, this.#state));
    this.#log.push({ touched, removed: removedRows(before, this.#state), truth: false, [kind]: true });
  }

  /**
   * Whether a write logged from `at` that still stands touched a location
   * overlapping `locs`. Undo's and redo's own writes, writes of operations
   * now undone, writes of rolled-back transactions and their compensation do
   * not stand (R2).
   */
  #touchedSince(at: number, locs: readonly string[]): boolean {
    return this.#log.slice(at).some((w) => {
      if (w.compensation || w.restoration || w.entry?.undone) return false;
      if (w.tx !== undefined && this.#txs.all()[w.tx]?.settled === 'rolledBack') return false;
      return [...w.touched].some((t) => locs.some((l) => overlaps(t, l)));
    });
  }

  #undo(): void {
    while (this.#index >= 0 && this.#history[this.#index]?.rolledBack) {
      if (!this.#options.keepRolledBack) this.#history.splice(this.#index, 1);
      this.#index--;
    }
    const entry = this.#history[this.#index];
    if (!entry) return;
    if (!this.#options.undoOverwrites && this.#touchedSince(entry.at, entry.locs)) {
      throw new ModelRefusal('undo refused [newer-write]', { cause: { kind: 'newer-write' } });
    }
    this.#logged(() => {
      for (const l of this.#options.undoPartial ? entry.locs.slice(0, 1) : entry.locs) put(this.#state, l, get(entry.before, l));
    }, 'restoration');
    entry.undone = true;
    entry.at = this.#log.length;
    this.#index--;
  }

  #redo(): void {
    const entry = this.#history[this.#index + 1];
    if (!entry) return;
    const newer = this.#options.redoByValue
      ? entry.locs.some((l) => get(this.#state, l) !== get(entry.before, l))
      : this.#touchedSince(entry.at, entry.locs);
    if (!this.#options.redoOverwrites && newer) {
      throw new ModelRefusal('redo refused [newer-write]', { cause: { kind: 'newer-write' } });
    }
    this.#logged(() => {
      for (const l of entry.locs) put(this.#state, l, get(entry.after, l));
    }, 'restoration');
    entry.undone = false;
    entry.at = this.#log.length;
    this.#index++;
  }

  #rollback(tx: Tx): void {
    const conflicts = this.#options.conflicts ?? 'field';
    if (conflicts === 'none') {
      this.#state = copy(tx.before);
      return;
    }
    const hits = (t: string, loc: string): boolean => {
      if (conflicts === 'row') return t === loc || (keyOf(t) !== undefined && keyOf(t) === keyOf(loc));
      if (conflicts === 'fields-only' && isExistence(t)) return false;
      return overlaps(t, loc);
    };
    const counts = (touched: ReadonlySet<string>): string[] => tx.changed.filter((loc) => [...touched].some((t) => hits(t, loc)));
    const own = this.#txs.all().indexOf(tx);
    const superseded = new Set<string>();
    const depends: string[] = [];
    let pending = false;
    for (const w of this.#log.slice(tx.logAt)) {
      if (w.compensation || w.tx === own) continue;
      const by = w.tx === undefined ? undefined : this.#txs.all()[w.tx];
      if (by?.settled === 'rolledBack') continue;
      const hit = counts(w.touched);
      if (hit.length === 0) continue;
      if (by && !by.settled) pending = true;
      // Each write on its own: newer truth's removal supersedes, every other touch depends (T4, T5).
      else if (w.truth && hit.every((loc) => w.removed.has(keyOf(loc) ?? ''))) for (const loc of hit) superseded.add(keyOf(loc) as string);
      else depends.push(...hit);
    }
    const masked = this.#options.supersessionMasks ? depends.filter((loc) => !superseded.has(keyOf(loc) ?? '')) : depends;
    const cause = pending ? 'later-pending-dependency' : masked.length > 0 ? 'later-confirmed-dependency' : undefined;
    if (cause) throw new ModelRefusal(`rollback refused [${cause}]`, { cause: { kind: cause } });
    this.#logged(() => {
      const back = tx.changed.filter((loc) => !superseded.has(keyOf(loc) ?? ''));
      const restore = this.#options.restoreWholeRows
        ? [...new Set(back.map((loc) => (keyOf(loc) === undefined ? loc : `rows.${keyOf(loc)}`)))]
        : [...back.filter(isExistence), ...back.filter((loc) => !isExistence(loc))];
      for (const loc of restore) put(this.#state, loc, get(tx.before, loc));
    }, 'compensation');
  }

  /** Runs the operation, then reads the history state as it returns (O2). */
  apply(op: Op): Outcome {
    const prior = this.#restorationState();
    const outcome = this.#apply(op);
    this.#atReturn = this.#options.historyLater ? prior : this.#restorationState();
    return outcome;
  }

  /** scope(async () => { before; await; after }): the writes after the await are later turns of their own. */
  #scopeAwait(scope: 'transact' | 'undoable', before: readonly WriteOp[], after: readonly WriteOp[]): Json | undefined {
    const carries = !!this.#options.scopeCarries;
    if (scope === 'undoable') {
      this.#turn(() =>
        this.#recorded(true, () => {
          for (const w of before) this.#write(w, false);
          if (carries) for (const w of after) this.#write(w, false);
        })
      );
      if (!carries) this.#turn(() => after.forEach((w) => this.#write(w, false)));
      return undefined;
    }
    const start = copy(this.#state);
    const index = this.#txs.size;
    const logAt = this.#log.length;
    this.#turn(() => before.forEach((w) => this.#write(w, false, index)));
    if (carries) this.#turn(() => after.forEach((w) => this.#write(w, false, index)));
    const tx: Tx = { before: start, changed: this.#changedIn(start, logAt), logAt, settled: false };
    if (!carries) this.#turn(() => after.forEach((w) => this.#write(w, false)));
    return { tx: this.#txs.add(tx) };
  }

  #apply(op: Op): Outcome {
    const kind = op.kind === 'write' ? op.write.kind : op.kind;
    const body = op.kind === 'transact' ? op.body : op.kind === 'scopeAwait' ? [...op.before, ...op.after] : [];
    const nested = body.map((w) => w.kind);
    if (op.kind === 'linkOpen' || op.kind === 'linkPush') {
      if (!this.#supports.has(op.kind)) return { status: 'unsupported', detail: `model has no ${op.kind}` };
      if (this.#destroyed) return { status: 'error', error: describeError(new ModelDestroyedError('the tree is destroyed')) };
      return this.#link(op);
    }
    if (![kind, ...nested].every((k) => this.#supports.has(k))) {
      return { status: 'unsupported', detail: `model has no ${kind}` };
    }
    if (this.#destroyed) return { status: 'error', error: describeError(new ModelDestroyedError('the tree is destroyed')) };
    switch (op.kind) {
      case 'write':
        return attempt(() => {
          let value: string | undefined;
          this.#turn(() =>
            this.#recorded(op.wrap === 'undoable', () => {
              value = this.#write(op.write, op.wrap === 'external');
            })
          );
          return value;
        });
      case 'transact':
        return attempt(() => {
          const before = copy(this.#state);
          const index = this.#txs.size;
          const logAt = this.#log.length;
          const body = () => {
            for (const w of op.body) {
              if (this.#options.dropInTransaction?.(w)) continue;
              if (this.#options.publishEachWrite) this.#turn(() => this.#write(w, false, index));
              else this.#write(w, false, index);
            }
          };
          const entry = this.#options.publishEachWrite
            ? this.#recorded(op.undoable, body, index)
            : this.#turn(() => this.#recorded(op.undoable, body, index));
          const tx: Tx = { before, changed: this.#changedIn(before, logAt), logAt, settled: false, ...(entry ? { entry } : {}) };
          return { tx: this.#txs.add(tx) };
        });
      case 'undo':
        return attempt(() => {
          this.#turn(() => this.#undo());
          return undefined;
        });
      case 'redo':
        return attempt(() => {
          this.#turn(() => this.#redo());
          return undefined;
        });
      case 'observe': {
        const { reader, react } = op;
        if (reader.kind === 'field' && !this.#state.rows.has(reader.id)) return { status: 'ok', value: { found: false } };
        const index = this.#watchers.length;
        this.#watchers.push({ index, reader, react });
        return { status: 'ok', value: { observer: index } };
      }
      case 'destroy':
        if (!this.#options.destroyKeeps) {
          this.#destroyed = true;
          this.#watchers.length = 0;
        }
        return { status: 'ok' };
      case 'hydrate':
        return { status: 'ok', value: this.#hydrate() as unknown as Json };
      case 'scopeAwait':
        return attempt(() => this.#scopeAwait(op.scope, op.before, op.after));
      case 'confirm':
      case 'rollback': {
        const resolved = this.#txs.resolve(op.tx);
        if (!resolved) return { status: 'skipped', detail: 'no transaction open' };
        return attempt(() => {
          const tx = resolved.item;
          if (tx.settled) throw new Error('transaction already settled');
          if (op.kind === 'rollback') {
            const cause = this.#options.rollbackCause;
            if (cause) throw new ModelRefusal(`rollback refused [${cause}]`, { cause: { kind: cause } });
            this.#turn(() => this.#rollback(tx));
            if (tx.entry) tx.entry.rolledBack = true;
          }
          tx.settled = op.kind === 'confirm' ? 'confirmed' : 'rolledBack';
          return { tx: resolved.index };
        });
      }
      default:
        return { status: 'unsupported', detail: `model has no ${op.kind}` };
    }
  }

  /** An inbound link value is the source's own write, by another writer context (origin 'sync'). */
  #link(op: Extract<Op, { kind: 'linkOpen' | 'linkPush' }>): Outcome {
    if (op.kind === 'linkOpen') return { status: 'ok', value: { link: this.#links.add(op.source) } };
    const resolved = this.#links.resolve(op.link);
    if (!resolved) return { status: 'skipped', detail: 'no link open' };
    const source = resolved.item;
    const value = payloadFor(source, op.value);
    const w: WriteOp =
      source === 'a'
        ? { kind: 'setLeaf', path: 'a', value: value as number }
        : source === 'cfg'
          ? { kind: 'setBranch', p: op.value, q: op.value }
          : { kind: 'setAll', rows: value as unknown as Row[] };
    return attempt(() => {
      this.#turn(() => this.#write(w, !this.#options.linkIsOrdinary));
      return { link: resolved.index };
    });
  }

  /** Applies one write and logs what it touched; a value equal to the one there is skipped (Object.is), a row object never is. */
  #write(w: WriteOp, truth: boolean, tx?: number): string | undefined {
    const s = this.#state;
    const before = copy(s);
    const touched = new Set<string>();
    let value: string | undefined;
    const leaf = (path: LeafPath, v: number) => {
      if (Object.is(this.#leaf(path), v)) return;
      this.#setLeaf(path, v);
      touched.add(path);
    };
    switch (w.kind) {
      case 'setLeaf':
        leaf(w.path, w.value + this.#offset);
        break;
      case 'updateLeaf':
        leaf(w.path, this.#leaf(w.path) + w.delta);
        break;
      case 'setBranch':
        leaf('cfg.p', w.p);
        leaf('cfg.q', w.q);
        break;
      case 'addOne':
        if (s.rows.has(w.row.id)) throw new Error(`Entity with id ${w.row.id} already exists`);
        s.rows.set(w.row.id, { ...w.row });
        touched.add(`rows.${w.row.id}`);
        value = w.row.id;
        break;
      case 'updateOne': {
        const row = s.rows.get(w.id);
        if (!row) throw new Error(`Entity with id ${w.id} not found`);
        if (!Object.is(row[w.field], w.value)) {
          s.rows.set(w.id, { ...row, [w.field]: w.value });
          touched.add(`rows.${w.id}.${w.field}`);
        }
        break;
      }
      case 'removeOne':
        if (!s.rows.delete(w.id)) throw new Error(`Entity with id ${w.id} not found`);
        touched.add(`rows.${w.id}`);
        break;
      case 'setAll':
        for (const key of s.rows.keys()) touched.add(`rows.${key}`);
        s.rows.clear();
        for (const r of w.rows) {
          s.rows.set(r.id, { ...r });
          touched.add(`rows.${r.id}`);
        }
        break;
      case 'replaceOne':
        // The row keeps its key; its content is replaced.
        if (!s.rows.has(w.id)) throw new Error(`Entity with id ${w.id} not found`);
        s.rows.set(w.id, { ...w.row });
        touched.add(`rows.${w.id}`);
        break;
      default:
        throw new Error(`unreachable: ${w.kind}`);
    }
    this.#log.push({ touched, removed: removedRows(before, s), truth, ...(tx === undefined ? {} : { tx }) });
    return value;
  }

  #leaf(path: LeafPath): number {
    const s = this.#state;
    return path === 'a' ? s.a : path === 'cfg.p' ? s.cfg.p : s.cfg.q;
  }

  #setLeaf(path: LeafPath, value: number): void {
    const s = this.#state;
    if (path === 'a') s.a = value;
    else s.cfg = path === 'cfg.p' ? { ...s.cfg, p: value } : { ...s.cfg, q: value };
  }

  observe(): Observation {
    const destroyed = { readError: describeError(new ModelDestroyedError('the tree is destroyed')) };
    const restoration = this.#restorationState();
    const observation: Observation = {
      state: this.#destroyed ? destroyed : this.#view(),
      pushes: [],
      probes: [],
      receipts: [],
      treeErrors: [],
      warnings: [],
      observerThrows: this.#observerThrows,
      observerEvents: this.#events,
      ...(this.#destroyed ? {} : { paths: this.#paths() }),
      ...(restoration ? { restoration } : {}),
      ...(this.#atReturn ? { restorationAtReturn: this.#atReturn } : {}),
    };
    this.#events = [];
    this.#observerThrows = 0;
    this.#wrote.clear();
    this.#atReturn = undefined;
    return observation;
  }

  close(): void {}
}

const removedRows = (before: State, after: State): Set<string> =>
  new Set([...before.rows.keys()].filter((key) => !after.rows.has(key)));
