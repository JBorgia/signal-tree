import { describe, expect, it } from 'vitest';

import { external } from '../../lib/external';
import { plainBranchMembershipChange } from '../../lib/internals/plain-branch-membership';
import { getPathNotifier } from '../../lib/path-notifier';
import { signalTree } from '../../lib/signal-tree';
import { transactions } from './transactions';

describe('membership preserves v16 queued evidence', () => {
  it.each([false, true])(
    'keeps queued membership ABA superseded after delivery=%s',
    (deliver) => {
      const tree = signalTree(
        { 'a.b': { age: undefined } as { age?: number } },
        { enhancers: [transactions()] }
      );
      let stop = () => {
        /* no subscription yet */
      };
      try {
        const pending = tree.transact(() => tree.$['a.b']({}));
        expect(pending.inspect().changes).toEqual([
          { path: 'a.b.age', address: ['a.b', 'age'], status: 'current' },
        ]);
        let deliveries = 0;
        stop = getPathNotifier().subscribe('**', () => {
          deliveries++;
        });
        external(() => {
          tree.$['a.b']({ age: undefined });
          tree.$['a.b']({});
        });
        expect(pending.inspect().changes).toEqual([
          { path: 'a.b.age', address: ['a.b', 'age'], status: 'superseded' },
        ]);
        expect(deliveries).toBe(0);
        if (deliver) {
          getPathNotifier().flushSync();
          expect(deliveries).toBeGreaterThan(0);
        }
        expect(pending.inspect().changes[0].status).toBe('superseded');
        pending.confirm();
        expect(tree.$['a.b']()).toStrictEqual({});
      } finally {
        stop();
        tree.destroy();
      }
    }
  );

  it('does not supersede a literal dotted owner with a nested owner sharing its path', () => {
    const tree = signalTree(
      {
        'a.b': { age: 1 } as { age?: number },
        a: { b: { age: 2 } as { age?: number } },
      },
      { enhancers: [transactions()] }
    );
    try {
      const pending = tree.transact(() => tree.$['a.b']({}));
      external(() => tree.$.a.b({}));
      expect(pending.inspect().changes).toEqual([
        { path: 'a.b.age', address: ['a.b', 'age'], status: 'current' },
      ]);
      pending.rollback();
      expect(tree.$['a.b']()).toStrictEqual({ age: 1 });
      expect(tree.$.a.b()).toStrictEqual({});
    } finally {
      tree.destroy();
    }
  });

  it('readPending includes value frames on both sides of membership barriers without delivery', () => {
    const tree = signalTree(
      { profile: { age: 1 } as { age?: number } },
      { enhancers: [transactions()] }
    );
    const notifier = getPathNotifier();
    notifier.flushSync();
    let deliveries = 0;
    const stop = notifier.subscribe('**', () => {
      deliveries++;
    });
    try {
      tree.$.profile.age?.(2);
      tree.$.profile({});
      tree.$.profile({ age: 3 });
      const entries = notifier.readPending();
      expect(
        entries.map((entry) => {
          const membership = plainBranchMembershipChange(entry.meta);
          return membership
            ? membership.members[0].after.present
              ? 'add'
              : 'remove'
            : entry.newValue;
        })
      ).toEqual([2, 'remove', 3, 'add']);
      expect(deliveries).toBe(0);
      notifier.flushSync();
      expect(deliveries).toBe(4);
    } finally {
      stop();
      tree.destroy();
    }
  });
});
