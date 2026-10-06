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
  | ['setAllAdd', string]
  /** The op on another collection: `other`, or `items` nested in `group`. */
  | ['at', OtherCollection, Op];
export type OtherCollection = 'other' | 'items';

const SEED_IDS = ['a', 'b', 'c', 'd', 'e'];
const OTHER_IDS: Record<OtherCollection, string[]> = {
  other: ['p', 'q', 'r'],
  items: ['u', 'v'],
};

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
const declaration = () => ({
  rows: entityMap<Row, string>({ selectId: (row) => row.id }),
  other: entityMap<Row, string>({ selectId: (row) => row.id }),
  group: { items: entityMap<Row, string>({ selectId: (row) => row.id }) },
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

/** Fresh ids shared by every op generated for one scenario. */
export type IdSource = { fresh: number };

/**
 * One random turn: mostly operations on `rows`, some on the other
 * collection and on the nested one (`['at', ...]`).
 */
export function generateOps(
  next: () => number,
  ids: IdSource = { fresh: 0 },
  pools: Record<'rows' | OtherCollection, string[]> = {
    rows: [...SEED_IDS],
    other: [...OTHER_IDS.other],
    items: [...OTHER_IDS.items],
  }
): Op[] {
  const count = 1 + Math.floor(next() * 5);
  const ops: Op[] = [];
  for (let i = 0; i < count; i++) {
    const where = next();
    const collection: 'rows' | OtherCollection =
      where < 0.8 ? 'rows' : where < 0.9 ? 'other' : 'items';
    const op = generateOp(next, ids, pools[collection]);
    ops.push(collection === 'rows' ? op : ['at', collection, op]);
  }
  return ops;
}

function generateOp(next: () => number, ids: IdSource, pool: string[]): Op {
  const fresh = (prefix: string) => {
    const id = `${prefix}${ids.fresh++}`;
    pool.push(id);
    return id;
  };
  const pick = () => pool[Math.floor(next() * pool.length)];
  const choice = next();
  if (choice < 0.14) return ['add', fresh('x')];
  if (choice < 0.2) return ['addMany', fresh('x'), fresh('x')];
  if (choice < 0.34) return ['upd', pick()];
  if (choice < 0.39) return ['replaceDrop', pick()];
  if (choice < 0.51) return ['rm', pick()];
  if (choice < 0.63) return ['rmMany', pick(), pick()];
  if (choice < 0.68) return ['clear'];
  if (choice < 0.75) return ['pre', fresh('x')];
  if (choice < 0.82) return ['rmAdd', pick()];
  if (choice < 0.87) return ['rename', pick(), fresh('r')];
  if (choice < 0.92) return ['reorder'];
  if (choice < 0.96) return ['preOver'];
  return ['setAllAdd', fresh('x')];
}

/** 2 or 3 random turns sharing ids and pools. */
export function generateTurns(next: () => number): Op[][] {
  const ids: IdSource = { fresh: 0 };
  const pools = {
    rows: [...SEED_IDS],
    other: [...OTHER_IDS.other],
    items: [...OTHER_IDS.items],
  };
  return Array.from({ length: 2 + Math.floor(next() * 2) }, () =>
    generateOps(next, ids, pools)
  );
}

/** Applies ops the way an application would; an op that throws is skipped. */
export function applyOps(tree: Tree, ops: readonly Op[]): void {
  for (const op of ops) applyOp(tree, tree.$.rows, op);
}

function applyOp(tree: Tree, rows: Tree['$']['rows'], op: Op): void {
  try {
    switch (op[0]) {
      case 'at':
        applyOp(
          tree,
          op[1] === 'other' ? tree.$.other : tree.$.group.items,
          op[2]
        );
        break;
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
        if (last) rows.prependMany([{ ...last, n: 99 }], { mode: 'overwrite' });
        break;
      }
    }
  } catch {
    /* an invalid op for the current state; the turn continues */
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
  for (const id of OTHER_IDS.other) tree.$.other.addOne({ id, n: 0 });
  for (const id of OTHER_IDS.items) tree.$.group.items.addOne({ id, n: 0 });
  return tree;
};

/**
 * The oracle: every collection's keys and rows, in order (a changeId moves
 * the key, not the row).
 */
const stateOf = (tree: Tree) =>
  JSON.stringify([
    tree.$.rows.ids(),
    tree.$.rows.all(),
    tree.$.other.ids(),
    tree.$.other.all(),
    tree.$.group.items.ids(),
    tree.$.group.items.all(),
  ]);
/** History holds rows only: each collection's, in order. */
const rowsOf = (state: string) => {
  const parsed = JSON.parse(state);
  return JSON.stringify([parsed[1], parsed[3], parsed[5]]);
};
const historyRowsOf = (state: unknown) => {
  const tree = state as {
    rows: { all: unknown };
    other: { all: unknown };
    group: { items: { all: unknown } };
  };
  return JSON.stringify([tree.rows.all, tree.other.all, tree.group.items.all]);
};

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
        const all = historyRowsOf(state);
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

/** Operations of a rejection scenario (`checkRejection`). */
export type RejectionOp =
  | ['add', string]
  | ['rm', string]
  | ['pre', string]
  | ['rename', string, string]
  | ['reorder']
  /** setAll in the given id order (ids not present are skipped; the rest
   * keep their place after them). */
  | ['shuffle', string];

const applyRejectionOps = (tree: Tree, ops: readonly RejectionOp[]): void => {
  const rows = tree.$.rows;
  for (const op of ops) {
    try {
      if (op[0] === 'add') rows.addOne({ id: op[1], n: 1 });
      else if (op[0] === 'rm') rows.removeOne(op[1]);
      else if (op[0] === 'pre') rows.prependMany([{ id: op[1], n: 1 }]);
      else if (op[0] === 'rename') rows.changeId(op[1], op[2]);
      else if (op[0] === 'reorder') rows.setAll([...rows.all()].reverse());
      else {
        const want = op[1].split(',');
        const byId = new Map(rows.all().map((row) => [row.id, row]));
        rows.setAll([
          ...want.flatMap((id) => {
            const row = byId.get(id);
            return row ? [row] : [];
          }),
          ...rows.all().filter((row) => !want.includes(row.id)),
        ]);
      }
    } catch {
      /* an invalid op for the current state */
    }
  }
};

/**
 * Rejected transactions under later work: `tx` (and `second`) as open
 * transactions, then each of `later` as its own undoable turn, then every
 * transaction rolled back. A refused rollback is an answer (`refused:<kind>`).
 * Otherwise history must read, every undo, redo and jumpTo (both ways) must
 * land exactly on the state it named, with history read at every step.
 */
export async function checkRejection(
  enhancers: () => unknown[],
  scenario: {
    readonly seed?: string;
    readonly tx: readonly RejectionOp[];
    readonly second?: readonly RejectionOp[];
    readonly later: readonly (readonly RejectionOp[])[];
    /** Confirm the transactions instead: they stand under the later turns. */
    readonly settle?: 'rollback' | 'confirm';
  }
): Promise<string> {
  const tree = signalTree(declaration(), {
    enhancers: enhancers() as never,
  }) as unknown as Tree;
  try {
    for (const id of scenario.seed ?? 'abcd') tree.$.rows.addOne({ id, n: 0 });
    await flush();
    const pending = [
      tree.transaction(() => applyRejectionOps(tree, scenario.tx)),
    ];
    await flush();
    if (scenario.second) {
      pending.push(
        tree.transaction(() =>
          applyRejectionOps(tree, scenario.second as RejectionOp[])
        )
      );
      await flush();
    }
    for (const turn of scenario.later) {
      undoable(() => applyRejectionOps(tree, turn));
      await flush();
    }
    for (const transaction of pending) {
      const unsettled = stateOf(tree);
      try {
        if (scenario.settle === 'confirm') transaction.confirm();
        else transaction.rollback();
      } catch (error) {
        // A refusal is an answer only if it changed nothing and left the
        // transaction pending (it still confirms).
        await flush();
        if (stateOf(tree) !== unsettled) {
          return `refused-but-changed:${stateOf(tree)}`;
        }
        try {
          transaction.confirm();
        } catch (confirmError) {
          return `refused-not-pending:${describeError(confirmError)}`;
        }
        const kind = /\[([a-z-]+)\]/.exec(String((error as Error).message));
        return `refused:${kind?.[1] ?? describeError(error)}`;
      }
      await flush();
    }
    const read = (): string | undefined => {
      try {
        tree.getRestorationHistory();
        return undefined;
      } catch (error) {
        return describeError(error);
      }
    };
    const failed = read();
    if (failed) return `history-${failed}`;
    const count = tree.getRestorationHistory().length;
    const seen = [stateOf(tree)];
    const step = async (
      label: string,
      move: () => void,
      expected?: string
    ): Promise<string | undefined> => {
      try {
        move();
      } catch (error) {
        return `${label}-${describeError(error)}`;
      }
      await flush();
      const state = stateOf(tree);
      if (expected !== undefined && state !== expected) {
        return `${label}-wrong:${state}`;
      }
      const history = read();
      return history ? `${label}-history-${history}` : undefined;
    };
    for (let at = 0; at < count; at++) {
      const failure = await step(`undo${at}`, () => tree.undo());
      if (failure) return failure;
      seen.push(stateOf(tree));
    }
    for (let at = 0; at < count; at++) {
      const failure = await step(
        `redo${at}`,
        () => tree.redo(),
        seen[count - 1 - at]
      );
      if (failure) return failure;
    }
    for (let at = count - 1; at >= 0; at--) {
      const failure = await step(
        `jump${at}`,
        () => tree.jumpTo(at),
        seen[count - 1 - at]
      );
      if (failure) return failure;
    }
    for (let at = 0; at < count; at++) {
      const failure = await step(
        `jumpForward${at}`,
        () => tree.jumpTo(at),
        seen[count - 1 - at]
      );
      if (failure) return failure;
    }
    return 'ok';
  } finally {
    tree.destroy();
  }
}

/** A random rejection scenario (the order-delta review's generator). */
export function generateRejection(next: () => number): {
  tx: RejectionOp[];
  second?: RejectionOp[];
  later: RejectionOp[][];
} {
  const pool = ['a', 'b', 'c', 'd'];
  let fresh = 0;
  const id = () => {
    const created = `r${fresh++}`;
    pool.push(created);
    return created;
  };
  const pick = () => pool[Math.floor(next() * pool.length)];
  const shuffled = () => {
    const ids = [...pool];
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    return ids.join(',');
  };
  const txOps = ['add', 'rm', 'reorder', 'pre', 'rename'] as const;
  const tx = (): RejectionOp[] =>
    Array.from({ length: 1 + Math.floor(next() * 3) }, (): RejectionOp => {
      const kind = txOps[Math.floor(next() * txOps.length)];
      if (kind === 'add' || kind === 'pre') return [kind, id()];
      if (kind === 'rm') return ['rm', pick()];
      if (kind === 'rename') return ['rename', pick(), id()];
      return ['reorder'];
    });
  const laterTurn = (): RejectionOp[] =>
    Array.from({ length: 1 + Math.floor(next() * 2) }, (): RejectionOp => {
      const c = next();
      return c < 0.5
        ? ['shuffle', shuffled()]
        : c < 0.7
        ? ['add', id()]
        : c < 0.85
        ? ['rm', pick()]
        : ['reorder'];
    });
  const first = tx();
  const second = next() < 0.3 ? tx() : undefined;
  const later = Array.from({ length: 1 + Math.floor(next() * 3) }, laterTurn);
  return { tx: first, ...(second ? { second } : {}), later };
}
