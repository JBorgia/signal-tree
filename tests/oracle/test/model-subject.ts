// A tiny in-memory subject for testing the generator itself: leaf, branch
// and a few entity writes, optimistic transactions, optional undo/redo, and
// options that plant a defect, fix the cause a rollback refuses with, or make
// replays differ.
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

export interface ModelOptions {
  readonly kinds?: readonly OpKind[];
  /** Return true to make the subject silently drop this write when it runs inside transact(). */
  readonly dropInTransaction?: (write: WriteOp) => boolean;
  /** When set, every rollback refuses with this cause. Otherwise rollback restores the state before the transaction. */
  readonly rollbackCause?: string;
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

/** Locations: `a`, `cfg.p`, `cfg.q`, `rows.<key>`; an absent row reads as undefined. */
const LEAVES = ['a', 'cfg.p', 'cfg.q'] as const;
const locsOf = (s: State) => [...LEAVES, ...[...s.rows.keys()].map((k) => `rows.${k}`)];
function get(s: State, loc: string): string | undefined {
  if (loc === 'a') return String(s.a);
  if (loc === 'cfg.p') return String(s.cfg.p);
  if (loc === 'cfg.q') return String(s.cfg.q);
  const row = s.rows.get(loc.slice(5));
  return row ? JSON.stringify(row) : undefined;
}
function put(s: State, loc: string, value: string | undefined): void {
  if (loc === 'a') s.a = Number(value);
  else if (loc === 'cfg.p') s.cfg = { ...s.cfg, p: Number(value) };
  else if (loc === 'cfg.q') s.cfg = { ...s.cfg, q: Number(value) };
  else if (value === undefined) s.rows.delete(loc.slice(5));
  else s.rows.set(loc.slice(5), JSON.parse(value) as Row);
}

interface Entry {
  readonly before: State;
  readonly after: State;
  /** Locations the operation changed. */
  readonly locs: readonly string[];
  readonly tx?: number;
  rolledBack: boolean;
}

class ModelSession implements Session {
  #state: State = { a: 0, cfg: { p: 0, q: 0 }, rows: new Map() };
  readonly #txs = new HandleTable<{ before: State; settled: boolean; entry?: Entry }>();
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
    const locs = [...new Set([...locsOf(before), ...locsOf(after)])].filter((l) => get(before, l) !== get(after, l));
    const entry: Entry = { before, after, locs, ...(tx === undefined ? {} : { tx }), rolledBack: false };
    this.#history.splice(this.#index + 1);
    this.#history.push(entry);
    this.#index = this.#history.length - 1;
    return entry;
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
    for (const l of this.#options.undoPartial ? entry.locs.slice(0, 1) : entry.locs) put(this.#state, l, get(entry.before, l));
    this.#index--;
  }

  #redo(): void {
    const entry = this.#history[this.#index + 1];
    if (!entry) return;
    if (!this.#options.redoOverwrites && entry.locs.some((l) => get(this.#state, l) !== get(entry.before, l))) {
      throw new ModelRefusal('redo refused [newer-write]', { cause: { kind: 'newer-write' } });
    }
    for (const l of entry.locs) put(this.#state, l, get(entry.after, l));
    this.#index++;
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
            value = this.#write(op.write);
          });
          return value;
        });
      case 'transact':
        return attempt(() => {
          const before = copy(this.#state);
          const tx = this.#txs.size;
          const entry = this.#recorded(
            op.undoable,
            () => {
              for (const w of op.body) if (!this.#options.dropInTransaction?.(w)) this.#write(w);
            },
            tx
          );
          return { tx: this.#txs.add({ before, settled: false, ...(entry ? { entry } : {}) }) };
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
            this.#state = copy(tx.before);
            if (tx.entry) tx.entry.rolledBack = true;
          }
          tx.settled = true;
          return { tx: resolved.index };
        });
      }
      default:
        return { status: 'unsupported', detail: `model has no ${op.kind}` };
    }
  }

  #write(w: WriteOp): string | undefined {
    const s = this.#state;
    switch (w.kind) {
      case 'setLeaf':
        this.#setLeaf(w.path, w.value + this.#offset);
        return undefined;
      case 'updateLeaf':
        this.#setLeaf(w.path, this.#leaf(w.path) + w.delta);
        return undefined;
      case 'setBranch':
        s.cfg = { p: w.p, q: w.q };
        return undefined;
      case 'addOne':
        if (s.rows.has(w.row.id)) throw new Error(`Entity with id ${w.row.id} already exists`);
        s.rows.set(w.row.id, { ...w.row });
        return w.row.id;
      case 'updateOne': {
        const row = s.rows.get(w.id);
        if (!row) throw new Error(`Entity with id ${w.id} not found`);
        s.rows.set(w.id, { ...row, n: w.n });
        return undefined;
      }
      case 'removeOne':
        if (!s.rows.delete(w.id)) throw new Error(`Entity with id ${w.id} not found`);
        return undefined;
      default:
        throw new Error(`unreachable: ${w.kind}`);
    }
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
    const rows = [...this.#state.rows.values()].map((r) => ({ id: r.id, n: r.n }));
    return {
      state: { a: this.#state.a, cfg: { ...this.#state.cfg }, rows, ids: rows.map((r) => r.id) },
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
