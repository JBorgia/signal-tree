import { describe, expect, it } from 'vitest';

import {
  entityMap,
  external,
  restoration,
  signalTree,
  transactions,
  undoable,
} from '../../index';

type Row = {
  id: number;
  stable: string;
  nested: { changed: number; stable: number; optional?: undefined };
  optional?: undefined;
  server: number;
};
const initial = (): Row => ({
  id: 1,
  stable: 'unchanged',
  nested: { changed: 0, stable: 7 },
  server: 0,
});
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
const hasOwn = (value: object, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);

describe.each([
  ['transactions first', () => [transactions(), restoration()]],
  ['restoration first', () => [restoration(), transactions()]],
] as const)('unchanged child capture: %s', (_order, enhancers) => {
  const make = () =>
    signalTree(
      { rows: entityMap<Row, number>(), marker: 0 },
      { enhancers: enhancers() }
    );

  it('reverses nested changes among equal children in a new row object', async () => {
    const tree = make();
    const before = initial();
    const after = { ...before, nested: { ...before.nested, changed: 1 } };
    try {
      tree.$.rows.addOne(before);
      await flush();
      undoable(() => tree.$.rows.replaceOne(1, after));
      await flush();
      expect(tree.getRestorationHistory()).toHaveLength(1);
      expect(tree.$.rows.byIdOrFail(1)()).toEqual(after);
      tree.undo();
      expect(tree.$.rows.byIdOrFail(1)()).toEqual(before);
      tree.redo();
      expect(tree.$.rows.byIdOrFail(1)()).toEqual(after);
    } finally {
      tree.destroy();
    }
  });

  it.each([false, true])(
    'retains absent versus own undefined at root and nested fields (initially present=%s)',
    async (present) => {
      const tree = make();
      const absent = initial();
      const withUndefined: Row = {
        ...absent,
        optional: undefined,
        nested: { ...absent.nested, optional: undefined },
      };
      const before = present ? withUndefined : absent;
      const after = present ? absent : withUndefined;
      const assertPresence = (expected: boolean) => {
        const value = tree.$.rows.byIdOrFail(1)();
        expect(hasOwn(value, 'optional')).toBe(expected);
        expect(hasOwn(value.nested, 'optional')).toBe(expected);
        expect(value.optional).toBeUndefined();
        expect(value.nested.optional).toBeUndefined();
      };
      try {
        tree.$.rows.addOne(before);
        await flush();
        undoable(() => tree.$.rows.replaceOne(1, after));
        await flush();
        assertPresence(!present);
        tree.undo();
        assertPresence(present);
        tree.redo();
        assertPresence(!present);
      } finally {
        tree.destroy();
      }
    }
  );

  it('promotes earlier ordinary nested changes with a later designated write', async () => {
    const tree = make();
    const before = initial();
    const after = { ...before, nested: { ...before.nested, changed: 1 } };
    try {
      tree.$.rows.addOne(before);
      await flush();
      tree.$.rows.replaceOne(1, after);
      undoable(() => tree.$.marker(1));
      await flush();
      expect(tree.getRestorationHistory()).toHaveLength(1);
      tree.undo();
      expect(tree.$.rows.byIdOrFail(1)()).toEqual(before);
      expect(tree.$.marker()).toBe(0);
      tree.redo();
      expect(tree.$.rows.byIdOrFail(1)()).toEqual(after);
      expect(tree.$.marker()).toBe(1);
    } finally {
      tree.destroy();
    }
  });

  it('preserves later external sibling truth through undo and redo', async () => {
    const tree = make();
    const before = initial();
    const after = { ...before, nested: { ...before.nested, changed: 1 } };
    try {
      tree.$.rows.addOne(before);
      await flush();
      undoable(() => tree.$.rows.replaceOne(1, after));
      await flush();
      external(() => tree.$.rows.updateOne(1, { server: 9 }));
      await flush();
      tree.undo();
      expect(tree.$.rows.byIdOrFail(1)()).toEqual({ ...before, server: 9 });
      tree.redo();
      expect(tree.$.rows.byIdOrFail(1)()).toEqual({ ...after, server: 9 });
    } finally {
      tree.destroy();
    }
  });

  it('refuses the whole turn when external truth replaces a changed field', async () => {
    const tree = make();
    const before = initial();
    const after = { ...before, nested: { ...before.nested, changed: 1 } };
    const realized = { ...after, nested: { ...after.nested, changed: 9 } };
    try {
      tree.$.rows.addOne(before);
      await flush();
      undoable(() => {
        tree.$.rows.replaceOne(1, after);
        tree.$.marker(1);
      });
      await flush();
      external(() => tree.$.rows.replaceOne(1, realized));
      await flush();
      const history = tree.getRestorationHistory();
      expect(() => tree.undo()).toThrow(/ST1034/);
      expect(tree.$.rows.byIdOrFail(1)()).toEqual(realized);
      expect(tree.$.marker()).toBe(1);
      expect(tree.getRestorationHistory()).toEqual(history);
      expect(tree.canUndo()).toBe(true);
      expect(tree.canRedo()).toBe(false);
    } finally {
      tree.destroy();
    }
  });
});
