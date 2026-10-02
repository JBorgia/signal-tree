import { describe, expect, it } from 'vitest';

import { external } from '../../lib/external';
import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { undoable } from '../../lib/undoable';
import { transactions } from '../transactions/transactions';
import { restoration } from './restoration';

type Row = { id: string; n: number; opt?: string };
const hasOwn = (row: Row) => Object.prototype.hasOwnProperty.call(row, 'opt');
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

describe.each([
  ['transactions first', () => [transactions(), restoration()]],
  ['restoration first', () => [restoration(), transactions()]],
] as const)('field presence capture: %s', (_order, enhancers) => {
  const make = () =>
    signalTree({ rows: entityMap<Row, string>() }, { enhancers: enhancers() });

  it('coalesces an added field to present undefined without losing its reversal', async () => {
    const tree = make();
    try {
      tree.$.rows.addOne({ id: 'a', n: 1 });
      await flush();
      undoable(() => {
        tree.$.rows.updateOne('a', { opt: 'temporary' });
        tree.$.rows.updateOne('a', { opt: undefined });
      });
      await flush();
      expect(hasOwn(tree.$.rows.byIdOrFail('a')())).toBe(true);
      tree.undo();
      expect(hasOwn(tree.$.rows.byIdOrFail('a')())).toBe(false);
      tree.redo();
      expect(tree.$.rows.byIdOrFail('a')()).toStrictEqual({
        id: 'a',
        n: 1,
        opt: undefined,
      });
    } finally {
      tree.destroy();
    }
  });

  it('coalesces present undefined to absent while retaining its original membership', async () => {
    const tree = make();
    try {
      tree.$.rows.addOne({ id: 'a', n: 1, opt: undefined });
      await flush();
      undoable(() => {
        tree.$.rows.updateOne('a', { opt: 'temporary' });
        tree.$.rows.replaceOne('a', { id: 'a', n: 1 });
      });
      await flush();
      tree.undo();
      expect(tree.$.rows.byIdOrFail('a')()).toStrictEqual({
        id: 'a',
        n: 1,
        opt: undefined,
      });
      tree.redo();
      expect(hasOwn(tree.$.rows.byIdOrFail('a')())).toBe(false);
    } finally {
      tree.destroy();
    }
  });

  it('keeps a presence-only coalesced transaction inspectable and reversible', async () => {
    const tree = make();
    try {
      tree.$.rows.addOne({ id: 'a', n: 1 });
      await flush();
      const pending = tree.transact(() => {
        tree.$.rows.updateOne('a', { opt: 'temporary' });
        tree.$.rows.updateOne('a', { opt: undefined });
      });
      expect(pending.inspect().changes).toEqual([
        expect.objectContaining({
          address: ['rows', 'opt'],
          status: 'current',
        }),
      ]);
      pending.rollback();
      expect(tree.$.rows.byIdOrFail('a')()).toStrictEqual({ id: 'a', n: 1 });
    } finally {
      tree.destroy();
    }
  });

  it('drops an absent-to-present-to-absent net effect without losing sibling work', async () => {
    const tree = make();
    try {
      tree.$.rows.addOne({ id: 'a', n: 1 });
      await flush();
      const pending = tree.transact(() => {
        tree.$.rows.updateOne('a', { opt: undefined });
        tree.$.rows.replaceOne('a', { id: 'a', n: 2 });
      });
      expect(pending.inspect().changes).toEqual([
        expect.objectContaining({ address: ['rows', 'n'], status: 'current' }),
      ]);
      pending.rollback();
      expect(tree.$.rows.byIdOrFail('a')()).toStrictEqual({ id: 'a', n: 1 });
      // Separate semantic turns; same-tick compensation/capture is recorded
      // independently under the upcoming scope-drain composition slice.
      await flush();
      undoable(() => {
        tree.$.rows.updateOne('a', { opt: undefined });
        tree.$.rows.replaceOne('a', { id: 'a', n: 2 });
      });
      await flush();
      tree.undo();
      expect(tree.$.rows.byIdOrFail('a')()).toStrictEqual({ id: 'a', n: 1 });
      tree.redo();
      expect(tree.$.rows.byIdOrFail('a')()).toStrictEqual({ id: 'a', n: 2 });
    } finally {
      tree.destroy();
    }
  });

  it.each([false, true])(
    'preserves queued external presence (ABA=%s) across atomic refusal and confirm',
    async (aba) => {
      const tree = make();
      try {
        tree.$.rows.addOne({ id: 'a', n: 1 });
        await flush();
        const pending = tree.transact(() =>
          tree.$.rows.updateOne('a', { n: 2, opt: undefined })
        );
        await flush();
        external(() => {
          tree.$.rows.replaceOne('a', { id: 'a', n: 2 });
          if (aba) tree.$.rows.updateOne('a', { opt: undefined });
        });
        // Inspect and settle before delivery: queued footprint remains authoritative
        // even when both the field value and membership returned to their start.
        expect(pending.inspect().changes).toEqual([
          expect.objectContaining({
            address: ['rows', 'n'],
            status: 'current',
          }),
          expect.objectContaining({
            address: ['rows', 'opt'],
            status: 'superseded',
          }),
        ]);
        expect(() => pending.rollback()).toThrow('later-confirmed-dependency');
        // Existing v16 dependency refusal is whole-turn: no sibling reversal.
        expect(tree.$.rows.byIdOrFail('a')().n).toBe(2);
        pending.confirm();
        expect(hasOwn(tree.$.rows.byIdOrFail('a')())).toBe(aba);
        await flush();
        expect(hasOwn(tree.$.rows.byIdOrFail('a')())).toBe(aba);
      } finally {
        tree.destroy();
      }
    }
  );
});
