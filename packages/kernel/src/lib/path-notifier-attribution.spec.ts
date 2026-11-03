import { describe, expect, it } from 'vitest';

import {
  entityMap,
  external,
  restoration,
  signalTree,
  transactions,
  undoable,
} from '../index';
import { observeWrites, type ObservedWriteFrame } from '../internals';

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

describe('same-tick notification attribution through public writes', () => {
  it('delivers identical entity paths independently for different trees', async () => {
    const make = () =>
      signalTree(
        { rows: entityMap<{ id: string; n: number }, string>() },
        { enhancers: [restoration()] }
      );
    const a = make();
    const b = make();
    const seen: ObservedWriteFrame[] = [];
    const off = observeWrites((frame) => seen.push(frame));
    try {
      a.$.rows.addOne({ id: 'same', n: 1 });
      b.$.rows.addOne({ id: 'same', n: 2 });
      await flush();
      const rows = seen.filter((frame) => frame.after !== undefined);
      expect(rows.map((frame) => frame.after)).toEqual([
        { id: 'same', n: 1 },
        { id: 'same', n: 2 },
      ]);
      expect(rows[0].path).toBe(rows[1].path);
      expect(rows[0].positionIds).toEqual(rows[1].positionIds);
      expect(rows[0].subjectIds).toEqual(rows[1].subjectIds);
      expect(rows[0].ownerId).toBeDefined();
      expect(rows[1].ownerId).toBeDefined();
      expect(rows[0].ownerId).not.toBe(rows[1].ownerId);
    } finally {
      off();
      a.destroy();
      b.destroy();
    }
  });

  it('keeps newest-first rollback notifications attributed to their transactions', async () => {
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const seen: ObservedWriteFrame[] = [];
    const off = observeWrites((frame) => seen.push(frame));
    try {
      const first = tree.transact(() => tree.$.x(1));
      const firstWrite = seen.find((frame) => frame.after === 1)!;
      const second = tree.transact(() => tree.$.x(2));
      const secondWrite = seen.find((frame) => frame.after === 2)!;
      seen.length = 0;
      second.rollback();
      first.rollback();
      await flush();
      expect(tree.$.x()).toBe(0);
      expect(
        seen.map(
          ({
            before,
            after,
            origin,
            participation,
            ownerId,
            transactionId,
          }) => ({
            before,
            after,
            origin,
            participation,
            ownerId,
            transactionId,
          })
        )
      ).toEqual([
        {
          before: 2,
          after: 1,
          origin: 'transaction-rollback',
          participation: 'realized',
          ownerId: secondWrite.ownerId,
          transactionId: secondWrite.transactionId,
        },
        {
          before: 1,
          after: 0,
          origin: 'transaction-rollback',
          participation: 'realized',
          ownerId: firstWrite.ownerId,
          transactionId: firstWrite.transactionId,
        },
      ]);
      expect(firstWrite.transactionId).toBeDefined();
      expect(firstWrite.transactionId).not.toBe(secondWrite.transactionId);
    } finally {
      off();
      tree.destroy();
    }
  });

  it('keeps rollback and external truth distinct in one tick', async () => {
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const seen: ObservedWriteFrame[] = [];
    const off = observeWrites((frame) => seen.push(frame));
    try {
      const pending = tree.transact(() => tree.$.x(1));
      const authored = seen.find((frame) => frame.after === 1)!;
      seen.length = 0;
      pending.rollback();
      external(() => tree.$.x(7));
      await flush();
      expect(seen).toMatchObject([
        {
          before: 1,
          after: 0,
          origin: 'transaction-rollback',
          participation: 'realized',
          ownerId: authored.ownerId,
          transactionId: authored.transactionId,
        },
        {
          before: 0,
          after: 7,
          origin: 'external',
          participation: 'realized',
          ownerId: authored.ownerId,
          transactionId: undefined,
        },
      ]);
      expect(tree.$.x()).toBe(7);
    } finally {
      off();
      tree.destroy();
    }
  });

  it('keeps rollback and undo distinct so redo remains eligible', async () => {
    const tree = signalTree(
      { x: 0 },
      { enhancers: [transactions(), restoration()] }
    );
    const seen: ObservedWriteFrame[] = [];
    const off = observeWrites((frame) => seen.push(frame));
    try {
      undoable(() => tree.$.x(1));
      await flush();
      const pending = tree.transact(() => tree.$.x(2));
      seen.length = 0;
      pending.rollback();
      tree.undo();
      await flush();
      expect(seen.map((frame) => frame.origin)).toEqual([
        'transaction-rollback',
        'restoration',
      ]);
      expect(seen.every((frame) => frame.ownerId !== undefined)).toBe(true);
      expect(tree.$.x()).toBe(0);
      expect(() => tree.redo()).not.toThrow();
      await flush();
      expect(tree.$.x()).toBe(1);
    } finally {
      off();
      tree.destroy();
    }
  });
});
