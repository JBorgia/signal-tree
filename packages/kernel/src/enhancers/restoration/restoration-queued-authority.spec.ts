import { describe, expect, it, vi } from 'vitest';
import { entityMap, restoration, signalTree, undoable } from '../../index';
import { getOwnedPositionIds } from '../../lib/internals/owned-metadata';
import { getEntityLocationBinding } from '../../lib/internals/entity-projection-seed';
import { getPositionRegistry } from '../../lib/internals/position-registry';
import { getPathNotifier } from '../../lib/path-notifier';
import { withWriteContext } from '../../lib/write-context';

const settle = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const external = (write: () => void) =>
  withWriteContext({ intent: 'system', participation: 'realized' }, write);

describe('restoration queued external authority', () => {
  for (const aba of [false, true]) {
    it(`refuses same-tick scalar undo without notifying observers, ABA=${aba}`, async () => {
      const tree = signalTree({ x: 0 }, { enhancers: [restoration()] });
      let off = () => undefined as void;
      try {
        undoable(() => tree.$.x(1));
        await settle();
        const notify = vi.fn();
        off = getPathNotifier().subscribe('**', notify);
        external(() => {
          tree.$.x(2);
          if (aba) tree.$.x(1);
        });
        expect(() => tree.undo()).toThrow(/ST1034/);
        expect(notify).not.toHaveBeenCalled();
        expect(tree.$.x()).toBe(aba ? 1 : 2);
        expect(tree.canUndo()).toBe(true);
        await settle();
        expect(() => tree.undo()).toThrow(/ST1034/);
      } finally {
        off();
        tree.destroy();
      }
    });
    it(`refuses same-tick entity undo and retains refusal after delivery, ABA=${aba}`, async () => {
      const tree = signalTree(
        { rows: entityMap<{ id: string; v: number }>() },
        { enhancers: [restoration()] }
      );
      let off = () => undefined as void;
      try {
        tree.$.rows.addOne({ id: 'a.b', v: 0 });
        await settle();
        undoable(() => tree.$.rows.updateOne('a.b', { v: 1 }));
        await settle();
        const notify = vi.fn();
        off = getPathNotifier().subscribe('**', notify);
        external(() => {
          tree.$.rows.updateOne('a.b', { v: 2 });
          if (aba) tree.$.rows.updateOne('a.b', { v: 1 });
        });
        expect(() => tree.undo()).toThrow(/ST1034/);
        expect(notify).not.toHaveBeenCalled();
        expect(tree.$.rows.byIdOrFail('a.b')().v).toBe(aba ? 1 : 2);
        expect(tree.canUndo()).toBe(true);
        await settle();
        expect(() => tree.undo()).toThrow(/ST1034/);
      } finally {
        off();
        tree.destroy();
      }
    });
  }

  it('allows queued authored supersession of external scalar authority', async () => {
    const tree = signalTree({ x: 0 }, { enhancers: [restoration()] });
    try {
      undoable(() => tree.$.x(1));
      await settle();
      external(() => tree.$.x(2));
      expect(() => tree.undo()).toThrow(/ST1034/);
      tree.$.x(3);
      tree.undo();
      expect(tree.$.x()).toBe(0);
    } finally {
      tree.destroy();
    }
  });

  it('does not block undo for a distinct field in a queued row update', async () => {
    const tree = signalTree(
      { rows: entityMap<{ id: string; 'a.b': number; a: { b: number } }>() },
      { enhancers: [restoration()] }
    );
    try {
      tree.$.rows.addOne({ id: 'a.b', 'a.b': 0, a: { b: 0 } });
      await settle();
      undoable(() => tree.$.rows.updateOne('a.b', { 'a.b': 1 }));
      await settle();
      external(() => tree.$.rows.updateOne('a.b', { a: { b: 2 } }));
      tree.undo();
      expect(tree.$.rows.byIdOrFail('a.b')()).toEqual({
        id: 'a.b',
        'a.b': 0,
        a: { b: 2 },
      });
    } finally {
      tree.destroy();
    }
  });

  it.each([false, true])(
    'allows sibling undo during queued external entity ABA, mixed=%s',
    async (mixed) => {
      const tree = signalTree(
        {
          rows: entityMap<{
            id: string;
            'a.b': number;
            a: { b: number };
            other: number;
          }>(),
        },
        { enhancers: [restoration()] }
      );
      let off = () => undefined as void;
      try {
        tree.$.rows.addOne({ id: 'a.b', 'a.b': 0, a: { b: 0 }, other: 0 });
        await settle();
        undoable(() => tree.$.rows.updateOne('a.b', { 'a.b': 1 }));
        await settle();
        const notify = vi.fn();
        off = getPathNotifier().subscribe('**', notify);
        external(() => {
          tree.$.rows.updateOne('a.b', { a: { b: 2 } });
          tree.$.rows.updateOne('a.b', { a: { b: 0 } });
          if (mixed) tree.$.rows.updateOne('a.b', { other: 2 });
        });
        tree.undo();
        expect(notify).not.toHaveBeenCalled();
        expect(tree.$.rows.byIdOrFail('a.b')()).toEqual({
          id: 'a.b',
          'a.b': 0,
          a: { b: 0 },
          other: mixed ? 2 : 0,
        });
      } finally {
        off();
        tree.destroy();
      }
    }
  );

  it('retains an ABA field when another queued field has a net change', async () => {
    const tree = signalTree(
      { rows: entityMap<{ id: string; v: number; other: number }>() },
      { enhancers: [restoration()] }
    );
    try {
      tree.$.rows.addOne({ id: 'a', v: 0, other: 0 });
      await settle();
      undoable(() => tree.$.rows.updateOne('a', { v: 1 }));
      await settle();
      external(() => {
        tree.$.rows.updateOne('a', { v: 2 });
        tree.$.rows.updateOne('a', { v: 1, other: 2 });
      });
      expect(() => tree.undo()).toThrow(/ST1034/);
    } finally {
      tree.destroy();
    }
  });

  it('treats a known empty queued footprint as no field authority', async () => {
    const tree = signalTree(
      { rows: entityMap<{ id: string; v: number }>() },
      { enhancers: [restoration()] }
    );
    let off = () => undefined as void;
    try {
      tree.$.rows.addOne({ id: 'a', v: 0 });
      await settle();
      undoable(() => tree.$.rows.updateOne('a', { v: 1 }));
      await settle();
      const row = tree.$.rows.byIdOrFail('a');
      const value = row();
      const notifier = getPathNotifier();
      const notified = vi.fn();
      off = notifier.subscribe('**', notified);
      notifier.notify(
        'rows.a',
        value,
        value,
        'rows',
        [getEntityLocationBinding(row)!.subjectId],
        getOwnedPositionIds(tree.$.rows),
        { intent: 'system', participation: 'realized' },
        getPositionRegistry(tree.$)!.id
      );
      expect(
        notifier.readPending().find((entry) => entry.path === 'rows.a')
          ?.subjectFieldKeys
      ).toEqual([]);
      tree.undo();
      expect(row().v).toBe(0);
      expect(notified).not.toHaveBeenCalled();
    } finally {
      off();
      tree.destroy();
    }
  });

  it('does not confuse queued external writes on another tree with this owner', async () => {
    const tree = signalTree({ x: 0 }, { enhancers: [restoration()] });
    const other = signalTree({ x: 0 }, { enhancers: [restoration()] });
    try {
      undoable(() => tree.$.x(1));
      await settle();
      external(() => other.$.x(2));
      tree.undo();
      expect(tree.$.x()).toBe(0);
      expect(other.$.x()).toBe(2);
    } finally {
      tree.destroy();
      other.destroy();
    }
  });
});
