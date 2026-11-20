// A tiny in-memory subject for testing the generator itself: leaf, branch
// and a few entity writes, optimistic transactions, and options that plant a
// defect, fix the cause a rollback refuses with, or make replays differ.
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
}

class ModelRefusal extends Error {}

let sessions = 0;

export function modelSubject(name: string, options: ModelOptions = {}): Subject {
  const supports = new Set(options.kinds ?? MODEL_KINDS);
  return {
    name,
    description: 'in-memory model (generator tests only)',
    supports,
    open: () => new ModelSession(supports, options, options.nondeterministic ? sessions++ % 2 : 0),
  };
}

interface State {
  a: number;
  cfg: { p: number; q: number };
  rows: Map<string, Row>;
}

const copy = (s: State): State => ({ a: s.a, cfg: { ...s.cfg }, rows: new Map(s.rows) });

class ModelSession implements Session {
  #state: State = { a: 0, cfg: { p: 0, q: 0 }, rows: new Map() };
  readonly #txs = new HandleTable<{ before: State; settled: boolean }>();
  readonly #supports: ReadonlySet<OpKind>;
  readonly #options: ModelOptions;
  readonly #offset: number;

  constructor(supports: ReadonlySet<OpKind>, options: ModelOptions, offset: number) {
    this.#supports = supports;
    this.#options = options;
    this.#offset = offset;
  }

  apply(op: Op): Outcome {
    const kind = op.kind === 'write' ? op.write.kind : op.kind;
    const nested = op.kind === 'transact' ? op.body.map((w) => w.kind) : [];
    if (![kind, ...nested].every((k) => this.#supports.has(k))) {
      return { status: 'unsupported', detail: `model has no ${kind}` };
    }
    switch (op.kind) {
      case 'write':
        return attempt(() => this.#write(op.write));
      case 'transact':
        return attempt(() => {
          const before = copy(this.#state);
          for (const w of op.body) if (!this.#options.dropInTransaction?.(w)) this.#write(w);
          return { tx: this.#txs.add({ before, settled: false }) };
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
    };
  }

  close(): void {}
}
