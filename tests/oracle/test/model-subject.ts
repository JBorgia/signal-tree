// A tiny in-memory subject for testing the runner itself: leaf, branch and a
// few entity writes, with an optional planted defect.
import type { Observation, Op, OpKind, Outcome, Row, WriteOp } from '../src/model.js';
import { attempt, type Session, type Subject } from '../src/subject.js';

export const MODEL_KINDS: readonly OpKind[] = ['setLeaf', 'updateLeaf', 'setBranch', 'addOne', 'updateOne', 'removeOne'];

export interface ModelOptions {
  readonly kinds?: readonly OpKind[];
  /** Return true to make the subject silently ignore this write. */
  readonly ignore?: (write: WriteOp) => boolean;
}

export function modelSubject(name: string, options: ModelOptions = {}): Subject {
  const supports = new Set(options.kinds ?? MODEL_KINDS);
  return {
    name,
    description: 'in-memory model (runner tests only)',
    supports,
    open: () => new ModelSession(supports, options.ignore ?? (() => false)),
  };
}

class ModelSession implements Session {
  #a = 0;
  #cfg = { p: 0, q: 0 };
  readonly #rows = new Map<string, Row>();

  constructor(
    private readonly supports: ReadonlySet<OpKind>,
    private readonly ignore: (write: WriteOp) => boolean
  ) {}

  apply(op: Op): Outcome {
    if (op.kind !== 'write' || !this.supports.has(op.write.kind)) {
      return { status: 'unsupported', detail: `model has no ${op.kind === 'write' ? op.write.kind : op.kind}` };
    }
    const w = op.write;
    if (this.ignore(w)) return { status: 'ok' };
    return attempt(() => {
      switch (w.kind) {
        case 'setLeaf':
          this.#setLeaf(w.path, w.value);
          return undefined;
        case 'updateLeaf':
          this.#setLeaf(w.path, this.#leaf(w.path) + w.delta);
          return undefined;
        case 'setBranch':
          this.#cfg = { p: w.p, q: w.q };
          return undefined;
        case 'addOne':
          if (this.#rows.has(w.row.id)) throw new Error(`Entity with id ${w.row.id} already exists`);
          this.#rows.set(w.row.id, { ...w.row });
          return w.row.id;
        case 'updateOne': {
          const row = this.#rows.get(w.id);
          if (!row) throw new Error(`Entity with id ${w.id} not found`);
          this.#rows.set(w.id, { ...row, n: w.n });
          return undefined;
        }
        case 'removeOne':
          if (!this.#rows.delete(w.id)) throw new Error(`Entity with id ${w.id} not found`);
          return undefined;
        default:
          throw new Error(`unreachable: ${w.kind}`);
      }
    });
  }

  #leaf(path: 'a' | 'cfg.p' | 'cfg.q'): number {
    return path === 'a' ? this.#a : path === 'cfg.p' ? this.#cfg.p : this.#cfg.q;
  }

  #setLeaf(path: 'a' | 'cfg.p' | 'cfg.q', value: number): void {
    if (path === 'a') this.#a = value;
    else this.#cfg = path === 'cfg.p' ? { ...this.#cfg, p: value } : { ...this.#cfg, q: value };
  }

  observe(): Observation {
    const rows = [...this.#rows.values()].map((r) => ({ id: r.id, n: r.n }));
    return {
      state: { a: this.#a, cfg: { ...this.#cfg }, rows, ids: rows.map((r) => r.id) },
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
