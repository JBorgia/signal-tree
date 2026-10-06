import { describe, expect, it } from 'vitest';
import { signalTree } from './signal-tree';
import { entityMap } from './markers/entity-map';
import { undoable } from './undoable';
import { transactions } from '../enhancers/transactions/transactions';
import { restoration } from '../enhancers/restoration/restoration';
import { batching } from '../enhancers/batching/batching';
import {
  getActiveWriteContext,
  isRecordedReplayWrite,
  runUserCallback,
  withWriteContext,
} from './write-context';

/**
 * One rule, wherever the tap runs: a tap's own writes are intercepted; an
 * undo, redo, jumpTo or rollback a tap starts is itself a replay, and its
 * writes are not.
 *
 * 9619b919 inferred where a replay began from the write origin, so it could
 * not tell a tap's real `undo()` or `rollback()` from a `transaction()` that
 * spread the inherited meta: inside another replay's tap, a genuine replay
 * was intercepted (round-4 probes A1, A2, A5). Replays now begin only where
 * restoration's and transactions' entry points say so, with an explicit
 * argument to withWriteContext.
 *
 * A2's outer row: the inner `undo()` a tap starts during the outer undo
 * re-applies the outer's still-current entry (the history cursor moves only
 * when the outer replay finishes), so on 9619b919 its interceptor calls named
 * both rows — the inner replay's writes, not the outer's.
 */
type Row = { id: string; n: number; p?: number };
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const declaration = () => ({
  rows: entityMap<Row, string>({ selectId: (row) => row.id }),
  log: entityMap<Row, string>({ selectId: (row) => row.id }),
});
const typed = () =>
  signalTree(declaration(), {
    enhancers: [transactions(), restoration(), batching()],
  });
type Tree = ReturnType<typeof typed>;
const make = (enhancers: readonly unknown[]): Tree =>
  signalTree(declaration(), {
    enhancers: enhancers as never,
  }) as unknown as Tree;

/** Transforming interceptors on both collections, recording every call. */
const intercept = (tree: Tree) => {
  const calls: string[] = [];
  for (const name of ['rows', 'log'] as const) {
    tree.$[name].intercept({
      onAdd: (row, ctx) => {
        calls.push(`${name}:add:${row.id}`);
        ctx.transform({ ...row, p: 9 });
      },
      onUpdate: (id, changes, ctx) => {
        calls.push(`${name}:update:${id}`);
        ctx.transform({ ...changes, p: 9 });
      },
      onRemove: (id) => void calls.push(`${name}:remove:${id}`),
    });
  }
  return calls;
};

describe.each([
  ['transactions(), restoration(), batching()', () => [transactions(), restoration(), batching()]],
  ['restoration(), transactions(), batching()', () => [restoration(), transactions(), batching()]],
  ['batching(), transactions(), restoration()', () => [batching(), transactions(), restoration()]],
] as const)('a replay a tap starts is a replay (%s)', (_name, enhancers) => {
  it('A1: another tree\'s undo() run from an undo\'s tap', async () => {
    const a = make(enhancers());
    const b = make(enhancers());
    try {
      a.$.rows.addOne({ id: 'x', n: 1 });
      b.$.rows.addOne({ id: 'y', n: 1 });
      await flush();
      undoable(() => a.$.rows.updateOne('x', { n: 2 }));
      undoable(() => b.$.rows.updateOne('y', { n: 2 }));
      await flush();
      const callsA = intercept(a);
      const callsB = intercept(b);
      a.$.rows.tap({ onUpdate: () => b.undo() });
      a.undo();
      await flush();
      expect(a.$.rows.byId('x')?.()).toStrictEqual({ id: 'x', n: 1 });
      expect(b.$.rows.byId('y')?.()).toStrictEqual({ id: 'y', n: 1 });
      expect(callsA).toStrictEqual([]);
      expect(callsB).toStrictEqual([]);
    } finally {
      a.destroy();
      b.destroy();
    }
  });

  it('A2: the same tree\'s undo() run from an undo\'s tap', async () => {
    const tree = make(enhancers());
    try {
      tree.$.rows.addOne({ id: 'x', n: 1 });
      tree.$.rows.addOne({ id: 'z', n: 1 });
      await flush();
      undoable(() => tree.$.rows.updateOne('z', { n: 2 }));
      undoable(() => tree.$.rows.updateOne('x', { n: 2 }));
      await flush();
      const calls = intercept(tree);
      let done = false;
      tree.$.rows.tap({
        onUpdate: (id) => {
          if (id !== 'x' || done) return;
          done = true;
          tree.undo();
        },
      });
      tree.undo();
      await flush();
      expect(calls).toStrictEqual([]);
      expect(tree.$.rows.all().every((row) => row.p === undefined)).toBe(true);
    } finally {
      tree.destroy();
    }
  });

  it('A3: two undo() calls from a forward write\'s tap replay; the forward write is intercepted', async () => {
    const tree = make(enhancers());
    try {
      tree.$.rows.addOne({ id: 'x', n: 1 });
      await flush();
      undoable(() => tree.$.rows.updateOne('x', { n: 2 }));
      undoable(() => tree.$.rows.updateOne('x', { n: 3 }));
      await flush();
      const calls = intercept(tree);
      let armed = true;
      tree.$.rows.tap({
        onAdd: () => {
          if (!armed) return;
          armed = false;
          tree.undo();
          tree.undo();
        },
      });
      tree.$.rows.addOne({ id: 'q', n: 1 });
      await flush();
      expect(calls).toStrictEqual(['rows:add:q']);
      expect(tree.$.rows.all()).toStrictEqual([
        { id: 'x', n: 1 },
        { id: 'q', n: 1, p: 9 },
      ]);
    } finally {
      tree.destroy();
    }
  });

  it('A4: a tap\'s own write during undo is intercepted', async () => {
    const tree = make(enhancers());
    try {
      tree.$.rows.addOne({ id: 'x', n: 1 });
      await flush();
      undoable(() => tree.$.rows.updateOne('x', { n: 2 }));
      await flush();
      const calls = intercept(tree);
      let armed = true;
      tree.$.rows.tap({
        onUpdate: () => {
          if (!armed) return;
          armed = false;
          tree.$.rows.addOne({ id: 'w', n: 1 });
        },
      });
      tree.undo();
      await flush();
      expect(calls).toStrictEqual(['rows:add:w']);
      expect(tree.$.rows.byId('x')?.()).toStrictEqual({ id: 'x', n: 1 });
      expect(tree.$.rows.byId('w')?.()).toStrictEqual({ id: 'w', n: 1, p: 9 });
    } finally {
      tree.destroy();
    }
  });

  it('A5: a rollback() run from a rollback\'s tap', async () => {
    const tree = make(enhancers());
    try {
      tree.$.rows.addOne({ id: 'x', n: 1 });
      tree.$.rows.addOne({ id: 'y', n: 1 });
      await flush();
      const p1 = tree.transaction(() => tree.$.rows.updateOne('x', { n: 2 }));
      const p2 = tree.transaction(() => tree.$.rows.updateOne('y', { n: 2 }));
      await flush();
      const calls = intercept(tree);
      let done = false;
      tree.$.rows.tap({
        onUpdate: (id) => {
          if (id !== 'x' || done) return;
          done = true;
          p2.rollback();
        },
      });
      p1.rollback();
      await flush();
      expect(calls).toStrictEqual([]);
      expect(tree.$.rows.all()).toStrictEqual([
        { id: 'x', n: 1 },
        { id: 'y', n: 1 },
      ]);
    } finally {
      tree.destroy();
    }
  });
});

/** The frame rules themselves, through withWriteContext directly. */
describe('replay frames', () => {
  it('a start frame is a replay; a spread frame keeps it; a frame naming another origin ends it', () => {
    const seen: boolean[] = [];
    withWriteContext(
      { origin: 'restoration' },
      () => {
        seen.push(isRecordedReplayWrite());
        withWriteContext({ ...getActiveWriteContext(), intent: 'system' }, () =>
          seen.push(isRecordedReplayWrite())
        );
        withWriteContext({ origin: 'external' }, () =>
          seen.push(isRecordedReplayWrite())
        );
        runUserCallback(() => {
          seen.push(isRecordedReplayWrite());
          withWriteContext({ ...getActiveWriteContext() }, () =>
            seen.push(isRecordedReplayWrite())
          );
          withWriteContext({ ...getActiveWriteContext() }, () =>
            seen.push(isRecordedReplayWrite()),
            true
          );
        });
      },
      true
    );
    withWriteContext({ origin: 'restoration' }, () =>
      seen.push(isRecordedReplayWrite())
    );
    expect(seen).toStrictEqual([true, true, false, false, false, true, false]);
  });
});
