// A tiny in-memory subject for testing the generator itself: leaf, branch
// and a few entity writes, optimistic transactions with field-level rollback
// checks, optional undo/redo, and options that plant a defect, fix the cause
// a rollback refuses with, or make replays differ.
import type { LeafPath, Observation, Op, OpKind, Outcome, Row, WriteOp } from '../src/model.js';
import { attempt, HandleTable, type Session, type Subject } from '../src/subject.js';

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
  /** Each session adds a different offset to leaf writes, so replays of one sequence differ. */
  readonly nondeterministic?: boolean;
  /**
   * Adds undo and redo. Every undoable() write and undoable transaction gets a
   * history entry when it runs; undo skips and removes entries whose
   * transaction was rolled back, and undo and redo refuse when a newer write
   * would be overwritten.
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
}

class ModelRefusal extends Error {}

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
  /** Locations the operation changed. */
  readonly locs: readonly string[];
  readonly tx?: number;
  rolledBack: boolean;
}

/** One write in the order it ran, with what it touched (a write the seam skips touches nothing). */
interface Logged {
  readonly touched: ReadonlySet<string>;
  /** Rows it removed. */
  readonly removed: ReadonlySet<string>;
  readonly external: boolean;
  /** The transaction whose body ran it. */
  readonly tx?: number;
  /** A rollback's compensation (T7: never a dependency). */
  readonly compensation?: boolean;
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
  readonly #log: Logged[] = [];
  readonly #supports: ReadonlySet<OpKind>;
  readonly #options: ModelOptions;
  readonly #offset: number;
  readonly #restoration: boolean;
  readonly #history: Entry[] = [];
  /** Index of the last applied entry; entries above it can be redone. */
  #index = -1;

  constructor(supports: ReadonlySet<OpKind>, options: ModelOptions, offset: number, restoration: boolean) {
    this.#supports = supports;
    this.#options = options;
    this.#offset = offset;
    this.#restoration = restoration && !!options.restoration;
  }

  /** Runs `fn` and, when it is undoable and restoration is on, records a history entry. */
  #recorded(undoable: boolean, fn: () => void, tx?: number): Entry | undefined {
    const before = copy(this.#state);
    fn();
    if (!undoable || !this.#restoration) return undefined;
    const after = copy(this.#state);
    const entry: Entry = { before, after, locs: changedLocs(before, after), ...(tx === undefined ? {} : { tx }), rolledBack: false };
    this.#history.splice(this.#index + 1);
    this.#history.push(entry);
    this.#index = this.#history.length - 1;
    return entry;
  }

  /** Runs `fn` (which changes state outside the write vocabulary) and logs what it changed. */
  #logged(fn: () => void, compensation = false): void {
    const before = copy(this.#state);
    fn();
    const touched = new Set(changedLocs(before, this.#state));
    this.#log.push({ touched, removed: removedRows(before, this.#state), external: false, compensation });
  }

  #undo(): void {
    while (this.#index >= 0 && this.#history[this.#index]?.rolledBack) {
      if (!this.#options.keepRolledBack) this.#history.splice(this.#index, 1);
      this.#index--;
    }
    const entry = this.#history[this.#index];
    if (!entry) return;
    if (!this.#options.undoOverwrites && entry.locs.some((l) => get(this.#state, l) !== get(entry.after, l))) {
      throw new ModelRefusal('undo refused [newer-write]', { cause: { kind: 'newer-write' } });
    }
    this.#logged(() => {
      for (const l of this.#options.undoPartial ? entry.locs.slice(0, 1) : entry.locs) put(this.#state, l, get(entry.before, l));
    });
    this.#index--;
  }

  #redo(): void {
    const entry = this.#history[this.#index + 1];
    if (!entry) return;
    if (!this.#options.redoOverwrites && entry.locs.some((l) => get(this.#state, l) !== get(entry.before, l))) {
      throw new ModelRefusal('redo refused [newer-write]', { cause: { kind: 'newer-write' } });
    }
    this.#logged(() => {
      for (const l of entry.locs) put(this.#state, l, get(entry.after, l));
    });
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
    let pending = false;
    let confirmed = false;
    for (const w of this.#log.slice(tx.logAt)) {
      if (w.compensation || w.tx === own) continue;
      const by = w.tx === undefined ? undefined : this.#txs.all()[w.tx];
      if (by?.settled === 'rolledBack') continue;
      const hit = counts(w.touched);
      if (hit.length === 0) continue;
      if (by && !by.settled) pending = true;
      else if (!w.external || !hit.every((loc) => w.removed.has(keyOf(loc) ?? ''))) confirmed = true;
      else for (const loc of hit) superseded.add(keyOf(loc) as string);
    }
    const cause = pending ? 'later-pending-dependency' : confirmed ? 'later-confirmed-dependency' : undefined;
    if (cause) throw new ModelRefusal(`rollback refused [${cause}]`, { cause: { kind: cause } });
    this.#logged(() => {
      const back = tx.changed.filter((loc) => !superseded.has(keyOf(loc) ?? ''));
      const restore = this.#options.restoreWholeRows
        ? [...new Set(back.map((loc) => (keyOf(loc) === undefined ? loc : `rows.${keyOf(loc)}`)))]
        : [...back.filter(isExistence), ...back.filter((loc) => !isExistence(loc))];
      for (const loc of restore) put(this.#state, loc, get(tx.before, loc));
    }, true);
  }

  apply(op: Op): Outcome {
    const kind = op.kind === 'write' ? op.write.kind : op.kind;
    const nested = op.kind === 'transact' ? op.body.map((w) => w.kind) : [];
    if (![kind, ...nested].every((k) => this.#supports.has(k))) {
      return { status: 'unsupported', detail: `model has no ${kind}` };
    }
    switch (op.kind) {
      case 'write':
        return attempt(() => {
          let value: string | undefined;
          this.#recorded(op.wrap === 'undoable', () => {
            value = this.#write(op.write, op.wrap === 'external');
          });
          return value;
        });
      case 'transact':
        return attempt(() => {
          const before = copy(this.#state);
          const index = this.#txs.size;
          const logAt = this.#log.length;
          const entry = this.#recorded(
            op.undoable,
            () => {
              for (const w of op.body) if (!this.#options.dropInTransaction?.(w)) this.#write(w, false, index);
            },
            index
          );
          const tx: Tx = { before, changed: changedLocs(before, this.#state), logAt, settled: false, ...(entry ? { entry } : {}) };
          return { tx: this.#txs.add(tx) };
        });
      case 'undo':
        return attempt(() => {
          this.#undo();
          return undefined;
        });
      case 'redo':
        return attempt(() => {
          this.#redo();
          return undefined;
        });
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
            this.#rollback(tx);
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

  /** Applies one write and logs what it touched; a value equal to the one there is skipped (Object.is), a row object never is. */
  #write(w: WriteOp, external: boolean, tx?: number): string | undefined {
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
      default:
        throw new Error(`unreachable: ${w.kind}`);
    }
    this.#log.push({ touched, removed: removedRows(before, s), external, ...(tx === undefined ? {} : { tx }) });
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
    const rows = [...this.#state.rows.values()].map((r) => ({ ...r }));
    return {
      state: { a: this.#state.a, cfg: { ...this.#state.cfg }, rows, ids: [...this.#state.rows.keys()] },
      pushes: [],
      probes: [],
      receipts: [],
      treeErrors: [],
      warnings: [],
      observerThrows: 0,
      ...(this.#restoration
        ? {
            restoration: {
              canUndo: this.#index >= 0,
              canRedo: this.#index < this.#history.length - 1,
              index: this.#index,
              length: this.#history.length,
            },
          }
        : {}),
    };
  }

  close(): void {}
}

const removedRows = (before: State, after: State): Set<string> =>
  new Set([...before.rows.keys()].filter((key) => !after.rows.has(key)));
