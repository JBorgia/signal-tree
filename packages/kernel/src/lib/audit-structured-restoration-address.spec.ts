import { describe, expect, it } from 'vitest';
import {
  entityMap,
  restoration,
  signalTree,
  transactions,
  undoable,
} from '../index';

const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
type Row = { id: string; value: number; 'a.b': number; a: { b: number } };
const seed = (id: string): Row => ({ id, value: 0, 'a.b': 0, a: { b: 0 } });

describe('lossless restoration addressing', () => {
  it.each(['plain', 'a.b'])('undo/redo a field on entity id %s', async (id) => {
    const tree = signalTree(
      { rows: entityMap<Row, string>() },
      { enhancers: [restoration()] }
    );
    try {
      tree.$.rows.addOne(seed(id));
      await flush();
      undoable(() => tree.$.rows.updateOne(id, { value: 7 }));
      await flush();
      expect(() => tree.undo()).not.toThrow();
      expect(tree.$.rows.byIdOrFail(id)().value).toBe(0);
      tree.redo();
      expect(tree.$.rows.byIdOrFail(id)().value).toBe(7);
    } finally {
      tree.destroy();
    }
  });

  it.each(['plain', 'a.b'])('rollback a field on entity id %s', async (id) => {
    const tree = signalTree(
      { rows: entityMap<Row, string>() },
      { enhancers: [transactions()] }
    );
    try {
      tree.$.rows.addOne(seed(id));
      await flush();
      const pending = tree.transact(() =>
        tree.$.rows.updateOne(id, { value: 7 })
      );
      await flush();
      expect(() => pending.rollback()).not.toThrow();
      expect(tree.$.rows.byIdOrFail(id)().value).toBe(0);
    } finally {
      tree.destroy();
    }
  });

  it('undo entity literal field a.b without changing nested a.b', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>() },
      { enhancers: [restoration()] }
    );
    try {
      tree.$.rows.addOne(seed('plain'));
      await flush();
      undoable(() => tree.$.rows.updateOne('plain', { 'a.b': 7 }));
      await flush();
      expect(() => tree.undo()).not.toThrow();
      expect(tree.$.rows.byIdOrFail('plain')()).toEqual(seed('plain'));
    } finally {
      tree.destroy();
    }
  });

  it('rollback distinguishes literal entity field from nested field in one turn', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>() },
      { enhancers: [transactions()] }
    );
    try {
      tree.$.rows.addOne(seed('plain'));
      await flush();
      const pending = tree.transact(() =>
        tree.$.rows.updateOne('plain', { 'a.b': 7, a: { b: 9 } })
      );
      await flush();
      expect(() => pending.rollback()).not.toThrow();
      expect(tree.$.rows.byIdOrFail('plain')()).toEqual(seed('plain'));
    } finally {
      tree.destroy();
    }
  });

  it('undo ordinary literal and nested leaves independently', async () => {
    const tree = signalTree(
      { 'a.b': 0, a: { b: 0 } },
      { enhancers: [restoration()] }
    );
    try {
      undoable(() => tree.$['a.b'](7));
      await flush();
      undoable(() => tree.$.a.b(9));
      await flush();
      tree.undo();
      expect(tree.$()).toEqual({ 'a.b': 7, a: { b: 0 } });
      tree.undo();
      expect(tree.$()).toEqual({ 'a.b': 0, a: { b: 0 } });
    } finally {
      tree.destroy();
    }
  });
});
