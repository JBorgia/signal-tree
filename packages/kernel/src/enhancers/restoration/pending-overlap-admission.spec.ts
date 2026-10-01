import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { getPathNotifier } from '../../lib/path-notifier';
import { signalTree } from '../../lib/signal-tree';
import { undoable } from '../../lib/undoable';
import { withWriteContext } from '../../lib/write-context';
import { transactions } from '../transactions/transactions';
import { restoration } from './restoration';

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

describe('pending restoration admission uses identity and has no delivery effects', () => {
  it('distinguishes a literal dotted property from a nested property', async () => {
    const tree = signalTree(
      { 'a.b': 0, a: { b: 0 } },
      { enhancers: [restoration(), transactions()] }
    );
    try {
      undoable(() => tree.$.a.b(1));
      await flush();
      const pending = tree.transaction(() => tree.$['a.b'](2));
      expect(() => tree.undo()).not.toThrow();
      expect(tree.$()).toEqual({ 'a.b': 2, a: { b: 0 } });
      pending.confirm();
    } finally {
      tree.destroy();
    }
  });

  it.each(['literal', 'nested'] as const)(
    'distinguishes same-subject fields when undoing the %s field',
    async (target) => {
      type Row = { id: string; 'a.b': number; a: { b: number } };
      const tree = signalTree(
        { rows: entityMap<Row, string>({ selectId: (row) => row.id }) },
        { enhancers: [restoration(), transactions()] }
      );
      try {
        tree.$.rows.addOne({
          id: 'row.with.punctuation',
          'a.b': 0,
          a: { b: 0 },
        });
        await flush();
        undoable(() =>
          tree.$.rows.updateOne(
            'row.with.punctuation',
            target === 'literal' ? { 'a.b': 1 } : { a: { b: 1 } }
          )
        );
        await flush();
        const pending = tree.transaction(() =>
          tree.$.rows.updateOne(
            'row.with.punctuation',
            target === 'literal' ? { a: { b: 2 } } : { 'a.b': 2 }
          )
        );
        expect(() => tree.undo()).not.toThrow();
        expect(tree.$.rows.all()).toEqual([
          {
            id: 'row.with.punctuation',
            'a.b': target === 'literal' ? 0 : 2,
            a: { b: target === 'literal' ? 2 : 0 },
          },
        ]);
        pending.confirm();
      } finally {
        tree.destroy();
      }
    }
  );

  it('does not deliver another tree while refusing restoration inside a callback', async () => {
    const tree = signalTree(
      { x: 0 },
      { enhancers: [restoration(), transactions()] }
    );
    const other = signalTree({ sideEffect: 0 }, { enhancers: [restoration()] });
    let delivered = 0;
    const off = getPathNotifier().subscribe('sideEffect', () => {
      delivered++;
    });
    try {
      undoable(() => tree.$.x(1));
      await flush();
      let admissionError: unknown;
      let deliveredDuringAdmission = 0;
      let valueAfterAdmission: number | undefined;
      const pending = tree.transaction(() => {
        tree.$.x(2);
        other.$.sideEffect(1);
        const before = delivered;
        try {
          tree.undo();
        } catch (error) {
          admissionError = error;
        }
        deliveredDuringAdmission = delivered - before;
        valueAfterAdmission = tree.$.x();
      });
      expect(String(admissionError)).toMatch(/ST1034/);
      expect(deliveredDuringAdmission).toBe(0);
      expect(valueAfterAdmission).toBe(2);
      pending.rollback();
    } finally {
      off();
      tree.destroy();
      other.destroy();
    }
  });

  it.each(['row', 'row.with.punctuation'])(
    'control: literal entity field restoration without pending work, id=%s',
    async (id) => {
      type Row = { id: string; 'a.b': number; a: { b: number } };
      const tree = signalTree(
        { rows: entityMap<Row, string>({ selectId: (row) => row.id }) },
        { enhancers: [restoration(), transactions()] }
      );
      try {
        tree.$.rows.addOne({ id, 'a.b': 0, a: { b: 0 } });
        await flush();
        undoable(() => tree.$.rows.updateOne(id, { 'a.b': 1 }));
        await flush();
        tree.undo();
        expect(tree.$.rows.all()).toEqual([{ id, 'a.b': 0, a: { b: 0 } }]);
      } finally {
        tree.destroy();
      }
    }
  );

  it('cannot re-enter undo during admission before the pending write is captured', async () => {
    let reenter: (() => void) | undefined;
    const off = getPathNotifier().subscribe('x', (value) => {
      if (value === 2) reenter?.();
    });
    const tree = signalTree(
      { x: 0 },
      { enhancers: [restoration(), transactions()] }
    );
    try {
      undoable(() => tree.$.x(1));
      await flush();
      const index = tree.getCurrentIndex();
      const canUndo = tree.canUndo();
      const canRedo = tree.canRedo();
      const failures: unknown[] = [];
      reenter = () => {
        try {
          tree.undo();
        } catch (error) {
          failures.push(error);
        }
      };
      let admissionError: unknown;
      let after:
        | { value: number; index: number; canUndo: boolean; canRedo: boolean }
        | undefined;
      const pending = tree.transaction(() => {
        tree.$.x(2);
        try {
          tree.undo();
        } catch (error) {
          admissionError = error;
        }
        after = {
          value: tree.$.x(),
          index: tree.getCurrentIndex(),
          canUndo: tree.canUndo(),
          canRedo: tree.canRedo(),
        };
      });
      expect(String(admissionError)).toMatch(/ST1034/);
      expect(after).toEqual({
        value: 2,
        index,
        canUndo,
        canRedo,
      });
      expect(failures.every((error) => String(error).includes('ST1034'))).toBe(
        true
      );
      reenter = undefined;
      pending.rollback();
    } finally {
      off();
      tree.destroy();
    }
  });
  it.each(['literal', 'nested'] as const)(
    'redo preserves the disjoint pending entity %s field',
    async (pendingField) => {
      type Row = { id: string; 'a.b': number; a: { b: number } };
      const id = 'row.with.punctuation';
      const tree = signalTree(
        { rows: entityMap<Row, string>({ selectId: (row) => row.id }) },
        { enhancers: [restoration(), transactions()] }
      );
      try {
        tree.$.rows.addOne({ id, 'a.b': 0, a: { b: 0 } });
        await flush();
        undoable(() =>
          tree.$.rows.updateOne(
            id,
            pendingField === 'literal' ? { a: { b: 1 } } : { 'a.b': 1 }
          )
        );
        await flush();
        tree.undo();
        const pending = tree.transaction(() =>
          tree.$.rows.updateOne(
            id,
            pendingField === 'literal' ? { 'a.b': 2 } : { a: { b: 2 } }
          )
        );
        tree.redo();
        expect(tree.$.rows.all()).toEqual([
          {
            id,
            'a.b': pendingField === 'literal' ? 2 : 1,
            a: { b: pendingField === 'literal' ? 1 : 2 },
          },
        ]);
        pending.confirm();
      } finally {
        tree.destroy();
      }
    }
  );

  it.each(['same', 'disjoint'] as const)(
    'checks external authority on the %s punctuation field without moving the cursor on refusal',
    async (field) => {
      type Row = { id: string; 'a.b': number; a: { b: number } };
      const id = 'row.with.punctuation';
      const tree = signalTree(
        { rows: entityMap<Row, string>({ selectId: (row) => row.id }) },
        { enhancers: [restoration(), transactions()] }
      );
      try {
        tree.$.rows.addOne({ id, 'a.b': 0, a: { b: 0 } });
        await flush();
        undoable(() => tree.$.rows.updateOne(id, { 'a.b': 1 }));
        await flush();
        const index = tree.getCurrentIndex();
        withWriteContext({ intent: 'system', participation: 'realized' }, () =>
          tree.$.rows.updateOne(
            id,
            field === 'same' ? { 'a.b': 9 } : { a: { b: 9 } }
          )
        );
        await flush();
        if (field === 'same') {
          expect(() => tree.undo()).toThrow(/ST1034/);
          expect(tree.getCurrentIndex()).toBe(index);
          expect(tree.canUndo()).toBe(true);
          expect(tree.canRedo()).toBe(false);
        } else {
          tree.undo();
        }
        expect(tree.$.rows.all()).toEqual([
          {
            id,
            'a.b': field === 'same' ? 9 : 0,
            a: { b: field === 'same' ? 0 : 9 },
          },
        ]);
      } finally {
        tree.destroy();
      }
    }
  );

  it('retains both punctuation fields written in one turn for undo, redo and historical states', async () => {
    type Row = { id: string; 'a.b': number; a: { b: number } };
    const id = 'row.with.punctuation';
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (row) => row.id }) },
      { enhancers: [restoration(), transactions()] }
    );
    try {
      tree.$.rows.addOne({ id, 'a.b': 0, a: { b: 0 } });
      await flush();
      undoable(() => tree.$.rows.updateOne(id, { 'a.b': 1, a: { b: 2 } }));
      await flush();
      const expected = [{ id, 'a.b': 1, a: { b: 2 } }];
      expect(tree.getRestorationHistory()[0].state).toMatchObject({
        rows: { all: expected },
      });
      tree.undo();
      expect(tree.$.rows.all()).toEqual([{ id, 'a.b': 0, a: { b: 0 } }]);
      tree.redo();
      expect(tree.$.rows.all()).toEqual(expected);
    } finally {
      tree.destroy();
    }
  });
});
