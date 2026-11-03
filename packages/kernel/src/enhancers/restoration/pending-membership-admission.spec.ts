import { describe, expect, it } from 'vitest';
import { signalTree } from '../../lib/signal-tree';
import { entityMap } from '../../lib/markers/entity-map';
import { undoable } from '../../lib/undoable';
import { withWriteContext } from '../../lib/write-context';
import { getPathNotifier } from '../../lib/path-notifier';
import { transactions } from '../transactions/transactions';
import { restoration } from './restoration';

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
const realized = (write: () => void) =>
  withWriteContext({ participation: 'realized', intent: 'system' }, write);
const profile = (): { name: string; age?: number } => ({ name: 'Ada', age: 0 });

describe('restoration admission preserves plain-member presence', () => {
  it('installs every member before synchronous restoration observers run', async () => {
    const notifier = getPathNotifier();
    const batching = notifier.isBatchingEnabled();
    const tree = signalTree(
      {
        profile: { a: 1, b: 2 } as { a?: number; b?: number },
        rows: entityMap<{ id: string }, string>({ selectId: (row) => row.id }),
      },
      { enhancers: [restoration()] }
    );
    let release: (() => void) | undefined;
    try {
      tree.$.rows.setAll([{ id: 'a' }, { id: 'b' }]);
      await flush();
      undoable(() => {
        tree.$.profile({});
        tree.$.rows.setAll([{ id: 'b' }, { id: 'a' }]);
      });
      await flush();
      const seen: unknown[] = [];
      release = notifier.subscribe('profile', () => {
        seen.push({
          keys: Object.keys(tree.$.profile).sort(),
          ids: tree.$.rows.ids(),
        });
      });
      notifier.setBatchingEnabled(false);
      tree.undo();
      expect(seen.length).toBeGreaterThan(0);
      for (const snapshot of seen) {
        expect(snapshot).toEqual({ keys: ['a', 'b'], ids: ['a', 'b'] });
      }
    } finally {
      release?.();
      notifier.setBatchingEnabled(batching);
      tree.destroy();
    }
  });

  it('protects a realized branch reactivation from an older omission redo', async () => {
    const tree = signalTree(
      { profile: { detail: { n: 0 } } as { detail?: { n: number } } },
      { enhancers: [restoration()] }
    );
    try {
      undoable(() => tree.$.profile({}));
      await flush();
      tree.undo();
      realized(() => tree.$.profile({}));
      await flush();
      realized(() => tree.$.profile({ detail: { n: 2 } }));
      await flush();
      const index = tree.getCurrentIndex();
      expect(() => tree.redo()).toThrow(/ST1034/);
      expect(tree.$.profile()).toStrictEqual({ detail: { n: 2 } });
      expect(tree.getCurrentIndex()).toBe(index);
      expect(tree.canRedo()).toBe(true);
    } finally {
      tree.destroy();
    }
  });

  it('refuses to overwrite a realized omission with an older scalar value', async () => {
    const tree = signalTree(
      { profile: profile() },
      { enhancers: [restoration()] }
    );
    try {
      undoable(() => tree.$.profile.age?.(1));
      await flush();
      realized(() => tree.$.profile({ name: 'Ada' }));
      await flush();
      const index = tree.getCurrentIndex();
      expect(() => tree.undo()).toThrow(/ST1034/);
      expect(tree.$.profile()).toStrictEqual({ name: 'Ada' });
      expect(tree.getCurrentIndex()).toBe(index);
    } finally {
      tree.destroy();
    }
  });

  it('distinguishes realized present undefined from absence during redo', async () => {
    const tree = signalTree(
      {
        profile: { name: 'Ada', age: undefined } as ReturnType<typeof profile>,
      },
      { enhancers: [restoration()] }
    );
    try {
      undoable(() => tree.$.profile({ name: 'Ada' }));
      await flush();
      tree.undo();
      realized(() => tree.$.profile({ name: 'Ada' }));
      await flush();
      realized(() => tree.$.profile({ name: 'Ada', age: undefined }));
      await flush();
      expect(() => tree.redo()).toThrow(/ST1034/);
      expect(tree.$.profile()).toStrictEqual({ name: 'Ada', age: undefined });
      expect(tree.canRedo()).toBe(true);
    } finally {
      tree.destroy();
    }
  });

  it('restores an omitted member alongside a disjoint realized sibling', async () => {
    const tree = signalTree(
      { profile: profile() },
      { enhancers: [restoration()] }
    );
    try {
      undoable(() => tree.$.profile({ name: 'Ada' }));
      await flush();
      realized(() => tree.$.profile.name('Server'));
      await flush();
      tree.undo();
      expect(tree.$.profile()).toStrictEqual({ name: 'Server', age: 0 });
    } finally {
      tree.destroy();
    }
  });

  it('retains external absence authority through pending reacquisition and rollback', async () => {
    const tree = signalTree(
      { profile: profile() },
      { enhancers: [restoration(), transactions()] }
    );
    try {
      undoable(() => tree.$.profile.age?.(1));
      await flush();
      realized(() => tree.$.profile({ name: 'Ada' }));
      await flush();
      const pending = tree.transact(() =>
        tree.$.profile({ name: 'Ada', age: 2 })
      );
      pending.rollback();
      await flush();
      expect(tree.$.profile()).toStrictEqual({ name: 'Ada' });
      expect(() => tree.undo()).toThrow(/ST1034/);
    } finally {
      tree.destroy();
    }
  });

  it('prepares mixed entity and member restoration without scalar endpoint wrappers', async () => {
    const tree = signalTree(
      {
        profile: profile(),
        rows: entityMap<{ id: string; n: number }, string>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()] }
    );
    try {
      tree.$.rows.setAll([
        { id: 'a', n: 1 },
        { id: 'b', n: 2 },
      ]);
      await flush();
      undoable(() => {
        tree.$.profile({ name: 'Ada' });
        tree.$.rows.setAll([
          { id: 'b', n: 2 },
          { id: 'a', n: 1 },
        ]);
      });
      await flush();
      tree.undo();
      expect(tree.$.profile()).toStrictEqual(profile());
      expect(tree.$.rows.ids()).toEqual(['a', 'b']);
      await flush();
      expect(tree.getRestorationHistory()).toHaveLength(1);
      tree.redo();
      expect(tree.$.profile()).toStrictEqual({ name: 'Ada' });
      expect(tree.$.rows.ids()).toEqual(['b', 'a']);
      await flush();
      expect(tree.getRestorationHistory()).toHaveLength(1);
      expect(tree.getRestorationHistory()[0].state.profile).toStrictEqual({
        name: 'Ada',
      });
    } finally {
      tree.destroy();
    }
  });
});
