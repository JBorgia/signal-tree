import { describe, expect, it } from 'vitest';

import { link, signalTree } from '../index';
import { treeRuntimeId } from '../internals';
import {
  plainBranchMembershipChange,
  type PlainBranchMembershipChange,
} from './internals/plain-branch-membership';
import { getPathNotifier } from './path-notifier';

type Profile = { name: string; age?: number };

describe('notifier retains plain branch membership frames', () => {
  it('flushSync drains membership-only work including reentrant membership', () => {
    const tree = signalTree({
      profile: { name: 'Ada', age: undefined } as Profile,
    });
    const notifier = getPathNotifier();
    notifier.flushSync();
    const present: boolean[] = [];
    const off = notifier.subscribe(
      'profile',
      (_v, _p, _path, _owner, _origin, _subjects, _positions, meta) => {
        const membership = plainBranchMembershipChange(meta);
        if (membership?.branch !== tree.$.profile) return;
        present.push(membership.members[0].after.present);
        if (present.length === 1)
          tree.$.profile({ name: 'Ada', age: undefined });
      }
    );
    try {
      tree.$.profile({ name: 'Ada' });
      expect(notifier.hasPending()).toBe(true);
      expect(present).toEqual([]);
      notifier.flushSync();
      expect(present).toEqual([false, true]);
      expect(notifier.hasPending()).toBe(false);
    } finally {
      off();
      tree.destroy();
    }
  });

  it.each([false, true])(
    'delivers values chronologically across membership barriers (priorValue=%s)',
    async (priorValue) => {
      const tree = signalTree({ profile: { name: 'Ada', age: 42 } as Profile });
      const sent: Profile[] = [];
      const relation = link(tree.$.profile, {
        set: (value) => {
          sent.push(value);
        },
      });
      const events: string[] = [];
      const off = getPathNotifier().subscribe(
        '**',
        (value, _p, path, _owner, _origin, _subjects, _positions, meta) => {
          const membership = plainBranchMembershipChange(meta);
          if (membership?.branch === tree.$.profile) {
            events.push(membership.members[0].after.present ? 'add' : 'remove');
          } else if (path === 'profile.age') {
            events.push(`value:${String(value)}`);
          }
        }
      );
      try {
        if (priorValue) tree.$.profile.age?.(7);
        tree.$.profile({ name: 'Ada' });
        tree.$.profile({ name: 'Ada', age: 8 });
        tree.$.profile({ name: 'Ada' });
        for (let i = 0; i < 8; i++) await Promise.resolve();
        await relation.settled();
        expect(events).toEqual([
          ...(priorValue ? ['value:7'] : []),
          'remove',
          'value:8',
          'add',
          'remove',
        ]);
        expect(sent).toStrictEqual([{ name: 'Ada' }]);
      } finally {
        off();
        relation.dispose();
        tree.destroy();
      }
    }
  );

  it.each([false, true])(
    'does not merge membership with a neighboring value (membershipFirst=%s)',
    async (membershipFirst) => {
      const tree = signalTree({
        profile: { name: 'Ada', age: undefined } as Profile,
      });
      const seen: unknown[] = [];
      const notifier = getPathNotifier();
      const off = notifier.subscribe(
        'profile',
        (value, _p, _path, _owner, _origin, _subjects, _positions, meta) => {
          const change = plainBranchMembershipChange(meta);
          seen.push(change ? change.branch : value);
        }
      );
      try {
        const membership = () => tree.$.profile({ name: 'Ada' });
        const value = () =>
          notifier.notify(
            'profile',
            'next',
            'previous',
            'profile',
            undefined,
            undefined,
            {},
            treeRuntimeId(tree)
          );
        if (membershipFirst) {
          membership();
          value();
        } else {
          value();
          membership();
        }
        await Promise.resolve();
        expect(seen).toEqual(
          membershipFirst ? [tree.$.profile, 'next'] : ['next', tree.$.profile]
        );
      } finally {
        off();
        tree.destroy();
      }
    }
  );

  it.each([false, true])(
    'keeps same-tick remove/add/remove events in order (causal=%s)',
    async (causal) => {
      const tree = signalTree(
        { profile: { name: 'Ada', age: undefined } as Profile },
        { capabilities: causal ? ['causal-runtime'] : [] }
      );
      const changes: PlainBranchMembershipChange[] = [];
      const off = getPathNotifier().subscribe(
        '**',
        (_v, _p, _path, _owner, _origin, _subjects, _positions, meta) => {
          const change = plainBranchMembershipChange(meta);
          if (change?.branch === tree.$.profile) changes.push(change);
        }
      );
      try {
        tree.$.profile({ name: 'Ada' });
        tree.$.profile({ name: 'Ada', age: undefined });
        tree.$.profile({ name: 'Ada' });
        await Promise.resolve();
        expect(changes.map((change) => change.members)).toEqual([
          [
            expect.objectContaining({
              key: 'age',
              before: { present: true, value: undefined },
              after: { present: false },
            }),
          ],
          [
            expect.objectContaining({
              key: 'age',
              before: { present: false },
              after: { present: true, value: undefined },
            }),
          ],
          [
            expect.objectContaining({
              key: 'age',
              before: { present: true, value: undefined },
              after: { present: false },
            }),
          ],
        ]);
      } finally {
        off();
        tree.destroy();
      }
    }
  );

  it('keeps different bare branches with identical diagnostic paths distinct', async () => {
    const tree = signalTree({
      'a.b': { name: 'Ada', age: undefined } as Profile,
      a: { b: { name: 'Grace', age: undefined } as Profile },
    });
    const changes: PlainBranchMembershipChange[] = [];
    const off = getPathNotifier().subscribe(
      '**',
      (_v, _p, _path, _owner, _origin, _subjects, _positions, meta) => {
        const change = plainBranchMembershipChange(meta);
        if (change) changes.push(change);
      }
    );
    try {
      tree.$['a.b']({ name: 'Ada' });
      tree.$.a.b({ name: 'Grace' });
      await Promise.resolve();
      expect(changes.map((change) => change.branch)).toEqual([
        tree.$['a.b'],
        tree.$.a.b,
      ]);
    } finally {
      off();
      tree.destroy();
    }
  });
});
