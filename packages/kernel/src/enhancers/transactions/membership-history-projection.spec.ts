import { expect, it, vi } from 'vitest';
import { plainBranchMembershipChange } from '../../lib/internals/plain-branch-membership';
import type { WriteMetadata } from '../../lib/types';
import { getPhysicalCommitClock } from '../../lib/internals/physical-commit-clock';
import { getPathNotifier } from '../../lib/path-notifier';
import { unwrapBranchForWriteCapture } from '../../lib/utils';

import { confirmedTurnReader } from '../../internals';
import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { transactions } from './transactions';
import { restoration } from '../restoration/restoration';
import { undoable } from '../../lib/undoable';

it.each([42, undefined])(
  'confirmed membership history exposes values without internal addresses (%s)',
  (age) => {
    const tree = signalTree(
      { profile: { name: 'Ada', age } as { name: string; age?: number } },
      { enhancers: [transactions({ history: { retain: 10 } })] }
    );
    try {
      tree.transact(() => tree.$.profile({ name: 'Ada' })).confirm();
      const effects =
        confirmedTurnReader(tree)
          ?.readConfirmedTurns()
          .turns.flatMap((turn) => turn.effects) ?? [];
      expect(effects).toHaveLength(1);
      expect(effects[0].before).toBe(age);
      expect(effects[0].after).toBeUndefined();
      expect(effects[0].plainBranchMembership).toEqual({
        before: true,
        after: false,
      });
      expect(Reflect.ownKeys(effects[0]).sort()).toEqual([
        'after',
        'before',
        'kind',
        'ownerPath',
        'path',
        'plainBranchMembership',
        'position',
        'subjectId',
      ]);
    } finally {
      tree.destroy();
    }
  }
);

it.each([42, undefined])(
  'rollback reverses reactivation without materializing an absent member (%s)',
  async (age) => {
    const tree = signalTree(
      { profile: { name: 'Ada', age: 1 } as { name: string; age?: number } },
      { enhancers: [transactions()] }
    );
    try {
      tree.$.profile({ name: 'Ada' });
      for (let i = 0; i < 4; i++) await Promise.resolve();
      const pending = tree.transact(() => tree.$.profile({ name: 'Ada', age }));
      expect(tree.$.profile()).toStrictEqual({ name: 'Ada', age });
      pending.rollback();
      expect(tree.$.profile()).toStrictEqual({ name: 'Ada' });
    } finally {
      tree.destroy();
    }
  }
);

it('rolls back branch presence together with a declarative collection replacement', async () => {
  const tree = signalTree(
    {
      rows: entityMap<{ id: string; value: number }, string>({
        selectId: (row) => row.id,
      }),
      profile: { age: 42, city: 'Denver' } as { age?: number; city?: string },
    },
    { enhancers: [transactions()] }
  );
  try {
    const rows = [
      { id: 'a', value: 1 },
      { id: 'b', value: 2 },
    ];
    tree.$.rows.setAll(rows);
    for (let i = 0; i < 4; i++) await Promise.resolve();
    const pending = tree.transact(() => {
      tree.$.rows.setAll([{ id: 'c', value: 3 }]);
      tree.$.profile({});
    });
    expect(tree.$.profile()).toStrictEqual({});
    pending.rollback();
    expect(tree.$.rows.all()).toEqual(rows);
    expect(tree.$.profile()).toStrictEqual({ age: 42, city: 'Denver' });
  } finally {
    tree.destroy();
  }
});

it('keeps an absent member absent when rollback restores an entity key handoff', async () => {
  const tree = signalTree(
    {
      rows: entityMap<{ id: string; value: number }, string>({
        selectId: (row) => row.id,
      }),
      profile: { age: 42 } as { age?: number },
    },
    { enhancers: [transactions()] }
  );
  try {
    tree.$.rows.addOne({ id: 'a', value: 1 });
    tree.$.profile({});
    for (let i = 0; i < 4; i++) await Promise.resolve();
    const pending = tree.transact(() => {
      tree.$.rows.removeOne('a');
      tree.$.rows.addOne({ id: 'a', value: 3 });
      tree.$.profile({ age: undefined });
    });
    expect(tree.$.profile()).toStrictEqual({ age: undefined });
    pending.rollback();
    expect(tree.$.rows.all()).toEqual([{ id: 'a', value: 1 }]);
    expect(tree.$.profile()).toStrictEqual({});
  } finally {
    tree.destroy();
  }
});

it.each([false, true])(
  'installs every member before replay publication (declarative=%s)',
  async (declarative) => {
    const tree = signalTree(
      {
        rows: entityMap<{ id: string; value: number }, string>({
          selectId: (row) => row.id,
        }),
        profile: { age: 42, city: 'Denver' } as { age?: number; city?: string },
      },
      { enhancers: [transactions()] }
    );
    try {
      tree.$.rows.addOne({ id: 'a', value: 1 });
      for (let i = 0; i < 4; i++) await Promise.resolve();
      const pending = tree.transact(() => {
        if (declarative) {
          tree.$.rows.removeOne('a');
          tree.$.rows.addOne({ id: 'a', value: 3 });
        }
        tree.$.profile({});
      });
      const seen: unknown[] = [];
      const provenance: WriteMetadata[] = [];
      const notifier = getPathNotifier();
      const notify = notifier.notify.bind(notifier);
      const spy = vi.spyOn(notifier, 'notify').mockImplementation((...args) => {
        seen.push(unwrapBranchForWriteCapture(tree.$.profile));
        if (plainBranchMembershipChange(args[6])) provenance.push(args[6]!);
        notify(...args);
      });
      try {
        pending.rollback();
        expect(seen.length).toBeGreaterThan(0);
        expect(provenance.length).toBeGreaterThan(0);
        for (const meta of provenance)
          expect(meta).toMatchObject({
            origin: 'transaction-rollback',
            transactionId: 1,
            participation: 'realized',
          });
        for (const value of seen)
          expect(value).toStrictEqual({ age: 42, city: 'Denver' });
        expect(tree.$.profile()).toStrictEqual({ age: 42, city: 'Denver' });
      } finally {
        spy.mockRestore();
      }
    } finally {
      tree.destroy();
    }
  }
);

it('advances physical revision for a membership-only replay', async () => {
  const tree = signalTree(
    { profile: { age: 42 } as { age?: number } },
    { enhancers: [transactions()] }
  );
  try {
    const pending = tree.transact(() => tree.$.profile({}));
    const clock = getPhysicalCommitClock(tree.$)!;
    const before = clock.revision();
    pending.rollback();
    expect(clock.revision()).toBeGreaterThan(before);
  } finally {
    tree.destroy();
  }
});

it('replays a restored branch and its later child write in authored order', async () => {
  const tree = signalTree(
    { profile: { detail: { n: 0 } } as { detail?: { n: number } } },
    { enhancers: [transactions(), restoration()] }
  );
  try {
    const detail = tree.$.profile.detail!;
    tree.$.profile({});
    for (let i = 0; i < 4; i++) await Promise.resolve();
    undoable(() => {
      tree.$.profile({ detail: { n: 1 } });
      detail({ n: 2 });
    });
    for (let i = 0; i < 4; i++) await Promise.resolve();
    expect(tree.$.profile()).toStrictEqual({ detail: { n: 2 } });
    tree.undo();
    expect(tree.$.profile()).toStrictEqual({});
    tree.redo();
    expect(tree.$.profile()).toStrictEqual({ detail: { n: 2 } });
  } finally {
    tree.destroy();
  }
});
