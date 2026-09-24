import { describe, expect, it } from 'vitest';
import { signalTree } from '../../lib/signal-tree';
import { entityMap } from '../../lib/markers/entity-map';
import { undoable } from '../../lib/undoable';
import { withWriteContext } from '../../lib/write-context';
import { getPathNotifier } from '../../lib/path-notifier';
import { transactions } from '../transactions/transactions';
import { restoration } from './restoration';

const flush = () => getPathNotifier().flushSync();
const realized = (write: () => void) => {
  withWriteContext({ intent: 'system', participation: 'realized' }, write);
  flush();
};
const make = () =>
  signalTree({ x: 0, y: 0 }, { enhancers: [transactions(), restoration()] });

describe('restoration audit regressions', () => {
  for (const other of [false, true]) {
    it(`preserves displaced scalar authority after rollback, unrelated confirmation=${other}`, () => {
      const tree = make();
      try {
        undoable(() => tree.$.x(1));
        flush();
        realized(() => tree.$.x(2));
        const pending = tree.transact(() => tree.$.x(3));
        if (other) tree.transact(() => tree.$.y(1)).confirm();
        pending.rollback();
        flush();
        expect(tree.$.x()).toBe(2);
        expect(() => tree.undo()).toThrow(/ST1034/);
        expect(tree.$.x()).toBe(2);
        expect(tree.canUndo()).toBe(true);
      } finally {
        tree.destroy();
      }
    });
  }

  for (const rollback of [false, true]) {
    it(`preserves external entity field authority, compensation=${rollback}`, () => {
      const tree = signalTree(
        { rows: entityMap<{ id: string; v: number; other: number }>() },
        { enhancers: [transactions(), restoration()] }
      );
      try {
        tree.$.rows.addOne({ id: 'a', v: 0, other: 0 });
        flush();
        undoable(() => tree.$.rows.updateOne('a', { v: 1 }));
        flush();
        realized(() => tree.$.rows.updateOne('a', { v: 2 }));
        if (rollback) {
          tree.transact(() => tree.$.rows.updateOne('a', { v: 3 })).rollback();
          flush();
        }
        expect(tree.$.rows.byIdOrFail('a')().v).toBe(2);
        expect(() => tree.undo()).toThrow(/ST1034/);
        expect(tree.$.rows.byIdOrFail('a')().v).toBe(2);
      } finally {
        tree.destroy();
      }
    });
  }

  it('restores entity authority after speculative removal and resurrection', () => {
    const tree = signalTree(
      { rows: entityMap<{ id: string; v: number }>() },
      { enhancers: [transactions(), restoration()] }
    );
    try {
      tree.$.rows.addOne({ id: 'a', v: 0 });
      flush();
      undoable(() => tree.$.rows.updateOne('a', { v: 1 }));
      flush();
      realized(() => tree.$.rows.updateOne('a', { v: 2 }));
      tree.transact(() => tree.$.rows.removeOne('a')).rollback();
      flush();
      expect(tree.$.rows.byIdOrFail('a')().v).toBe(2);
      expect(() => tree.undo()).toThrow(/ST1034/);
    } finally {
      tree.destroy();
    }
  });

  for (const pendingField of ['v', 'other'] as const) {
    it(`protects pending entity fields without blocking siblings: ${pendingField}`, () => {
      const tree = signalTree(
        { rows: entityMap<{ id: string; v: number; other: number }>() },
        { enhancers: [transactions(), restoration()] }
      );
      try {
        tree.$.rows.addOne({ id: 'a', v: 0, other: 0 });
        flush();
        undoable(() => tree.$.rows.updateOne('a', { v: 1 }));
        flush();
        const pending = tree.transact(() =>
          tree.$.rows.updateOne('a', { [pendingField]: 2 })
        );
        if (pendingField === 'v') {
          expect(() => tree.undo()).toThrow(/ST1034/);
          expect(tree.$.rows.byIdOrFail('a')().v).toBe(2);
        } else {
          tree.undo();
          expect(tree.$.rows.byIdOrFail('a')()).toEqual({
            id: 'a',
            v: 0,
            other: 2,
          });
        }
        pending.confirm();
      } finally {
        tree.destroy();
      }
    });
  }

  it('materializes confirmed history after an ordinary write replaces redo', () => {
    const tree = make();
    try {
      undoable(() => tree.$.x(1));
      flush();
      tree.undo();
      flush();
      undoable(() => tree.$.x(2));
      flush();
      expect(tree.getRestorationHistory()).toHaveLength(1);
      expect(tree.canRedo()).toBe(false);
      tree.undo();
      expect(tree.$.x()).toBe(0);
    } finally {
      tree.destroy();
    }
  });

  for (const designated of [false, true]) {
    for (const settlement of ['confirm', 'rollback'] as const) {
      it(`refuses undo over ${
        designated ? 'designated' : 'ordinary'
      } pending work before ${settlement}`, () => {
        const tree = make();
        try {
          undoable(() => tree.$.x(1));
          flush();
          const open = () => tree.transact(() => tree.$.x(2));
          const pending = designated ? undoable(open) : open();
          // No added notification flush before refusal.
          expect(() => tree.undo()).toThrow(/ST1034/);
          expect(tree.$.x()).toBe(2);
          expect(tree.canUndo()).toBe(true);
          expect(tree.canRedo()).toBe(false);
          pending[settlement]();
          expect(tree.$.x()).toBe(settlement === 'confirm' ? 2 : 1);
        } finally {
          tree.destroy();
        }
      });
    }
  }

  it('allows undo on a disjoint position while another transaction remains pending', () => {
    const tree = make();
    try {
      undoable(() => tree.$.x(1));
      flush();
      const pending = tree.transact(() => tree.$.y(2));
      tree.undo();
      expect(tree.$()).toEqual({ x: 0, y: 2 });
      pending.rollback();
      expect(tree.$()).toEqual({ x: 0, y: 0 });
    } finally {
      tree.destroy();
    }
  });

  for (const settlement of ['confirm', 'rollback'] as const) {
    it(`retains redo while pending and resolves it only on ${settlement}`, () => {
      const tree = make();
      try {
        undoable(() => tree.$.x(1));
        flush();
        tree.undo();
        flush();
        const pending = undoable(() => tree.transact(() => tree.$.x(2)));
        expect(tree.canRedo()).toBe(true);
        expect(tree.getRestorationHistory()).toHaveLength(1);
        pending[settlement]();
        flush();
        if (settlement === 'rollback') {
          expect(tree.canRedo()).toBe(true);
          tree.redo();
          expect(tree.$.x()).toBe(1);
        } else {
          expect(tree.canRedo()).toBe(false);
          expect(tree.getRestorationHistory()).toHaveLength(1);
          expect(tree.$.x()).toBe(2);
        }
      } finally {
        tree.destroy();
      }
    });
  }
});
