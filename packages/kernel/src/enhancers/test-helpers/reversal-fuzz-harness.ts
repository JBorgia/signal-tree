/**
 * Spec-only harness for the differential reversal fuzz
 * (`../transactions/reversal-differential-fuzz.spec.ts`) and its carriers
 * (`../transactions/reversal-order.spec.ts`): random collection operations as
 * one turn, then every public reversal path, with the state itself as the
 * oracle. Not part of the public surface.
 */
import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { undoable } from '../../lib/undoable';
import { restoration } from '../restoration/restoration';
import { transactions } from '../transactions/transactions';

type Row = { id: string; n: number; tag?: string };
export type Op =
  | ['add', string]
  | ['addMany', string, string]
  | ['upd', string]
  | ['replaceDrop', string]
  | ['rm', string]
  | ['rmMany', string, string]
  | ['clear']
  | ['pre', string]
  | ['rmAdd', string]
  | ['rename', string, string]
  /** setAll of the current rows, reversed: a reorder of survivors. */
  | ['reorder']
  /** An overwriting prependMany of the last row: moves it to the front. */
  | ['preOver']
  /** setAll of the current rows plus one: an add, survivors in place. */
  | ['setAllAdd', string];

const SEED_IDS = ['a', 'b', 'c', 'd', 'e'];

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
const declaration = () => ({
  rows: entityMap<Row, string>({ selectId: (row) => row.id }),
});
const _typed = () =>
  signalTree(declaration(), { enhancers: [transactions(), restoration()] });
type Tree = ReturnType<typeof _typed>;

export const configurations: Record<string, () => unknown[]> = {
  'restoration()': () => [restoration()],
  'transactions(), restoration()': () => [transactions(), restoration()],
  'restoration(), transactions()': () => [restoration(), transactions()],
};

export function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function generateOps(next: () => number): Op[] {
  const count = 1 + Math.floor(next() * 5);
  const ops: Op[] = [];
  const pool = [...SEED_IDS];
  let fresh = 0;
  const pick = () => pool[Math.floor(next() * pool.length)];
  for (let i = 0; i < count; i++) {
    const choice = next();
    if (choice < 0.15) {
      const id = `x${fresh++}`;
      ops.push(['add', id]);
      pool.push(id);
    } else if (choice < 0.22) {
      const first = `x${fresh++}`;
      const second = `x${fresh++}`;
      ops.push(['addMany', first, second]);
      pool.push(first, second);
    } else if (choice < 0.37) ops.push(['upd', pick()]);
    else if (choice < 0.42) ops.push(['replaceDrop', pick()]);
    else if (choice < 0.55) ops.push(['rm', pick()]);
    else if (choice < 0.68) ops.push(['rmMany', pick(), pick()]);
    else if (choice < 0.74) ops.push(['clear']);
    else if (choice < 0.82) {
      const id = `x${fresh++}`;
      ops.push(['pre', id]);
      pool.push(id);
    } else if (choice < 0.9) ops.push(['rmAdd', pick()]);
    else if (choice < 0.95) {
      const to = `r${fresh++}`;
      ops.push(['rename', pick(), to]);
      pool.push(to);
    } else if (choice < 0.975) ops.push(['reorder']);
    else ops.push(['preOver']);
  }
  return ops;
}

/** Applies ops the way an application would; an op that throws is skipped. */
export function applyOps(tree: Tree, ops: readonly Op[]): void {
  const rows = tree.$.rows;
  for (const op of ops) {
    try {
      switch (op[0]) {
        case 'add':
          rows.addOne({ id: op[1], n: 1 });
          break;
        case 'addMany':
          rows.addMany([
            { id: op[1], n: 1 },
            { id: op[2], n: 1 },
          ]);
          break;
        case 'upd':
          rows.updateOne(op[1], { n: 9, tag: 't' });
          break;
        case 'replaceDrop':
          rows.replaceOne(op[1], { id: op[1], n: 7 });
          break;
        case 'rm':
          rows.removeOne(op[1]);
          break;
        case 'rmMany':
          rows.removeMany([op[1], op[2]]);
          break;
        case 'clear':
          rows.clear();
          break;
        case 'pre':
          rows.prependMany([{ id: op[1], n: 1 }]);
          break;
        case 'rmAdd':
          rows.removeOne(op[1]);
          rows.addOne({ id: op[1], n: 2 });
          break;
        case 'rename':
          rows.changeId(op[1], op[2]);
          break;
        case 'reorder':
          rows.setAll([...rows.all()].reverse());
          break;
        case 'setAllAdd':
          rows.setAll([...rows.all(), { id: op[1], n: 1 }]);
          break;
        case 'preOver': {
          const all = rows.all();
          const last = all[all.length - 1];
          if (last)
            rows.prependMany([{ ...last, n: 99 }], { mode: 'overwrite' });
          break;
        }
      }
    } catch {
      /* an invalid op for the current state; the turn continues */
    }
  }
}

const seeded = (): Row[] =>
  SEED_IDS.map((id, index) => ({
    id,
    n: 0,
    ...(index % 2 === 0 ? { tag: `s${id}` } : {}),
  }));

const make = (enhancers: () => unknown[]): Tree => {
  const tree = signalTree(declaration(), {
    enhancers: enhancers() as never,
  }) as unknown as Tree;
  for (const row of seeded()) tree.$.rows.addOne(row);
  return tree;
};

/** The oracle: keys and rows (a changeId moves the key, not the row). */
const stateOf = (tree: Tree) =>
  JSON.stringify([tree.$.rows.ids(), tree.$.rows.all()]);
/** History holds rows only. */
const rowsOf = (state: string) => JSON.stringify(JSON.parse(state)[1]);

const describeError = (error: unknown) =>
  `throw:${String((error as Error)?.message ?? error).slice(0, 70)}`;

/** Undo, redo, undo again: each must land exactly. */
export async function checkUndoRedo(
  enhancers: () => unknown[],
  ops: readonly Op[]
): Promise<string> {
  const tree = make(enhancers);
  try {
    await flush();
    const before = stateOf(tree);
    undoable(() => applyOps(tree, ops));
    await flush();
    const after = stateOf(tree);
    if (before === after) return 'ok';
    const steps: Array<['undo' | 'redo', string]> = [
      ['undo', before],
      ['redo', after],
      ['undo', before],
    ];
    for (const [step, expected] of steps) {
      try {
        tree[step]();
      } catch (error) {
        return `${step}-${describeError(error)}`;
      }
      await flush();
      const actual = stateOf(tree);
      if (actual !== expected) return `${step}-wrong:${actual}`;
    }
    try {
      tree.getRestorationHistory();
    } catch (error) {
      return `history-${describeError(error)}`;
    }
    return 'ok';
  } finally {
    tree.destroy();
  }
}

/** Rollback of the same turn as a pending transaction. */
export async function checkRollback(
  enhancers: () => unknown[],
  ops: readonly Op[]
): Promise<string> {
  const tree = make(enhancers);
  try {
    await flush();
    const before = stateOf(tree);
    const pending = tree.transaction(() => applyOps(tree, ops));
    await flush();
    try {
      pending.rollback();
    } catch (error) {
      return `rollback-${describeError(error)}`;
    }
    await flush();
    const actual = stateOf(tree);
    return actual === before ? 'ok' : `rollback-wrong:${actual}`;
  } finally {
    tree.destroy();
  }
}

/**
 * Several turns, each its own undoable entry: undo them one at a time, redo
 * them, undo them again, then jumpTo the newest and the oldest entry; every
 * step lands exactly, and history materializes every entry's state. Each turn
 * must change the rows (a turn that does not records no entry).
 */
export async function checkTurns(
  enhancers: () => unknown[],
  turns: readonly (readonly Op[])[]
): Promise<string> {
  const tree = make(enhancers);
  try {
    await flush();
    const states = [stateOf(tree)];
    for (const [index, ops] of turns.entries()) {
      undoable(() => applyOps(tree, ops));
      await flush();
      states.push(stateOf(tree));
      if (states[index + 1] === states[index]) return `noop-turn-${index}`;
    }
    const last = turns.length;
    const steps: Array<[string, () => void, string]> = [];
    const history = () => {
      const entries = tree.getRestorationHistory();
      entries.forEach(({ state }, index) => {
        const all = JSON.stringify(
          (state as unknown as { rows: { all: unknown } }).rows.all
        );
        if (all !== rowsOf(states[index + 1])) {
          throw new Error(`entry ${index}: ${all}`);
        }
      });
    };
    for (let at = last; at > 0; at--)
      steps.push([`undo-${at}`, () => tree.undo(), states[at - 1]]);
    for (let at = 1; at <= last; at++)
      steps.push([`redo-${at}`, () => tree.redo(), states[at]]);
    for (let at = last; at > 0; at--)
      steps.push([`undo-again-${at}`, () => tree.undo(), states[at - 1]]);
    steps.push([`jump-newest`, () => tree.jumpTo(last - 1), states[last]]);
    steps.push([`jump-oldest`, () => tree.jumpTo(0), states[1]]);
    steps.push([
      `jump-newest-again`,
      () => tree.jumpTo(last - 1),
      states[last],
    ]);
    try {
      history();
    } catch (error) {
      return `history-${describeError(error)}`;
    }
    for (const [step, run, expected] of steps) {
      try {
        run();
      } catch (error) {
        return `${step}-${describeError(error)}`;
      }
      await flush();
      const actual = stateOf(tree);
      if (actual !== expected) return `${step}-wrong:${actual}`;
      // History reads at every position, undone entries included.
      try {
        history();
      } catch (error) {
        return `history-after-${step}-${describeError(error)}`;
      }
    }
    return 'ok';
  } finally {
    tree.destroy();
  }
}

/** Each turn a pending transaction; roll them back newest first. */
export async function checkTurnsRollback(
  enhancers: () => unknown[],
  turns: readonly (readonly Op[])[]
): Promise<string> {
  const tree = make(enhancers);
  try {
    await flush();
    const states = [stateOf(tree)];
    const pending = [];
    for (const ops of turns) {
      pending.push(tree.transaction(() => applyOps(tree, ops)));
      await flush();
      states.push(stateOf(tree));
    }
    for (let at = turns.length; at > 0; at--) {
      try {
        pending[at - 1].rollback();
      } catch (error) {
        return `rollback-${at}-${describeError(error)}`;
      }
      await flush();
      const actual = stateOf(tree);
      if (actual !== states[at - 1]) return `rollback-${at}-wrong:${actual}`;
    }
    return 'ok';
  } finally {
    tree.destroy();
  }
}
