import { describe, expect, it } from 'vitest';
import {
  entityMap,
  restoration,
  signalTree,
  transactions,
  undoable,
} from '../../index';
import { withWriteContext } from '../../lib/write-context';

const settle = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
type Row = { id: string; 'a.b': number; a: { b: number } };
const row = (): Row => ({ id: 'row.with.dot', 'a.b': 0, a: { b: 0 } });
const make = () =>
  signalTree(
    { rows: entityMap<Row, string>() },
    { enhancers: [transactions(), restoration()] }
  );

describe('structured entity restoration authority', () => {
  it('retains literal and nested effects independently within one undoable turn', async () => {
    const tree = make();
    try {
      tree.$.rows.addOne(row());
      await settle();
      undoable(() =>
        tree.$.rows.updateOne(row().id, { 'a.b': 1, a: { b: 2 } })
      );
      await settle();
      tree.undo();
      expect(tree.$.rows.byIdOrFail(row().id)()).toEqual(row());
      tree.redo();
      expect(tree.$.rows.byIdOrFail(row().id)()).toEqual({
        ...row(),
        'a.b': 1,
        a: { b: 2 },
      });
    } finally {
      tree.destroy();
    }
  });

  for (const externalField of ['literal', 'nested'] as const) {
    it(`keeps ${externalField} external authority separate from the other field`, async () => {
      const tree = make();
      try {
        tree.$.rows.addOne(row());
        await settle();
        undoable(() => tree.$.rows.updateOne(row().id, { 'a.b': 1 }));
        await settle();
        withWriteContext({ intent: 'system', participation: 'realized' }, () =>
          tree.$.rows.updateOne(
            row().id,
            externalField === 'literal' ? { 'a.b': 2 } : { a: { b: 2 } }
          )
        );
        await settle();
        if (externalField === 'literal') {
          expect(() => tree.undo()).toThrow(/ST1034/);
          expect(tree.$.rows.byIdOrFail(row().id)()['a.b']).toBe(2);
        } else {
          tree.undo();
          expect(tree.$.rows.byIdOrFail(row().id)()).toEqual({
            ...row(),
            a: { b: 2 },
          });
        }
      } finally {
        tree.destroy();
      }
    });
  }

  it('restores literal-field external authority after compensation', async () => {
    const tree = make();
    try {
      tree.$.rows.addOne(row());
      await settle();
      undoable(() => tree.$.rows.updateOne(row().id, { 'a.b': 1 }));
      await settle();
      withWriteContext({ intent: 'system', participation: 'realized' }, () =>
        tree.$.rows.updateOne(row().id, { 'a.b': 2 })
      );
      await settle();
      const pending = tree.transact(() =>
        tree.$.rows.updateOne(row().id, { 'a.b': 3 })
      );
      pending.rollback();
      await settle();
      expect(tree.$.rows.byIdOrFail(row().id)()).toEqual({
        ...row(),
        'a.b': 2,
      });
      expect(() => tree.undo()).toThrow(/ST1034/);
      expect(tree.$.rows.byIdOrFail(row().id)().a.b).toBe(0);
    } finally {
      tree.destroy();
    }
  });

  it('allows literal field undo while the nested field remains pending', async () => {
    const tree = make();
    try {
      tree.$.rows.addOne(row());
      await settle();
      undoable(() => tree.$.rows.updateOne(row().id, { 'a.b': 1 }));
      await settle();
      const pending = tree.transact(() =>
        tree.$.rows.updateOne(row().id, { a: { b: 2 } })
      );
      tree.undo();
      expect(tree.$.rows.byIdOrFail(row().id)()).toEqual({
        ...row(),
        a: { b: 2 },
      });
      pending.confirm();
    } finally {
      tree.destroy();
    }
  });
});
