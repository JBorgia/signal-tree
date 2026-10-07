import { describe, expect, it } from 'vitest';
import { link, signalTree, transactions } from '../index';
import type { NodeAccessor, TreeNode } from './types';
import {
  materializeMember,
  ordinaryBranch,
  registerMarkerProcessor,
} from './internals/materialize-markers';
import { getOwnedPositionIds } from './internals/owned-metadata';
import {
  getNodeAddress,
  getPositionRegistry,
} from './internals/position-registry';

const DYNAMIC = Symbol('leaf-address-seeds.dynamic');
type DynamicMarker = { [DYNAMIC]: true; seed: object };
const dynamic = (seed: object): DynamicMarker => ({ [DYNAMIC]: true, seed });
registerMarkerProcessor(
  (value): value is DynamicMarker =>
    typeof value === 'object' && value !== null && DYNAMIC in value,
  (marker) => ordinaryBranch(marker.seed, { keyedLookup: true })
);
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
function expectPositionAddress(node: object, address: readonly string[]) {
  const positions = getOwnedPositionIds(node);
  expect(positions?.length).toBeGreaterThan(0);
  const registry = getPositionRegistry(node);
  expect(registry).toBeDefined();
  for (const position of positions ?? []) {
    expect(registry?.addressFor(position)).toEqual(address);
  }
}

describe('leaf address seeds are unnecessary for observation and construction', () => {
  it.each([false, true])(
    'keeps branch seeds and position addresses, without leaf seeds (transactions=%s)',
    (observed) => {
      const tree = signalTree(
        { data: { 'a.b': 0, a: { b: 10 } } },
        {
          enhancers: observed ? [transactions()] : [],
        }
      );
      try {
        expect(getNodeAddress(tree.$.data)).toEqual(['data']);
        expect(getNodeAddress(tree.$.data.a)).toEqual(['data', 'a']);
        if (observed) {
          expectPositionAddress(tree.$.data['a.b'], ['data', 'a.b']);
          expectPositionAddress(tree.$.data.a.b, ['data', 'a', 'b']);
        }
        expect(getNodeAddress(tree.$.data['a.b'])).toBeUndefined();
        expect(getNodeAddress(tree.$.data.a.b)).toBeUndefined();
      } finally {
        tree.destroy();
      }
    }
  );

  it.each([false, true])(
    'late leaf and branch Links distinguish literal-dot keys (transactions=%s)',
    async (observed) => {
      const tree = signalTree(
        { data: { 'a.b': 0, a: { b: 10 } } },
        {
          enhancers: observed ? [transactions()] : [],
        }
      );
      const dotted = tree.$.data['a.b'];
      const nested = tree.$.data.a.b;
      dotted(2);
      await flush();
      const leafValues: number[] = [];
      const branchValues: unknown[] = [];
      const leafLink = link(dotted, {
        set: (value) => {
          leafValues.push(value);
        },
      });
      const branchLink = link(tree.$.data, {
        set: (value) => {
          branchValues.push(value);
        },
      });
      try {
        dotted(3);
        await leafLink.settled();
        await branchLink.settled();
        nested(11);
        await leafLink.settled();
        await branchLink.settled();
        expect(leafValues).toEqual([3]);
        expect(branchValues).toEqual([
          { 'a.b': 3, a: { b: 10 } },
          { 'a.b': 3, a: { b: 11 } },
        ]);
      } finally {
        leafLink.dispose();
        branchLink.dispose();
        tree.destroy();
      }
    }
  );

  it('retains literal position addresses for rollback after ancestor omission', async () => {
    const tree = signalTree(
      { data: { 'a.b': 0, a: { b: 10 } }, keep: 0 },
      {
        enhancers: [transactions()],
      }
    );
    try {
      const pending = tree.transaction(() => {
        tree.$.data['a.b'](7);
        (tree.$ as unknown as (value: object) => void)({ keep: 0 });
      });
      expect(tree.$()).toEqual({ keep: 0 });
      pending.rollback();
      expect(tree.$.data['a.b']()).toBe(0);
      expect(tree.$.data.a.b()).toBe(10);
      expect(tree.$()).toEqual({ data: { 'a.b': 0, a: { b: 10 } }, keep: 0 });
    } finally {
      tree.destroy();
    }
  });

  it.each([false, true])(
    'constructs dynamic branches and nested markers with literal addresses (transactions=%s)',
    async (observed) => {
      const tree = signalTree(
        {
          'users.root': dynamic({}),
          'marker.one': { 'inner.branch': dynamic({}) },
        },
        {
          enhancers: observed ? [transactions()] : [],
        }
      );
      const users = tree.$['users.root'];
      type MemberState = { 'score.now': number; score: { now: number } };
      type Member = TreeNode<MemberState> & NodeAccessor<MemberState>;
      // This late construction consumes the dynamic owner's branch seed.
      const member = materializeMember(users, 'user.one', {
        'score.now': 1,
        score: { now: 10 },
      }) as Member;
      const markerMember = tree.$['marker.one'];
      // A marker-produced dynamic branch must retain its own construction seed.
      const nested = materializeMember(
        markerMember['inner.branch'],
        'child.two',
        {
          'score.now': 2,
          score: { now: 20 },
        }
      ) as Member;
      const sent: unknown[] = [];
      const nestedSent: unknown[] = [];
      const connection = link(member, {
        set: (value) => {
          sent.push(value);
        },
      });
      const nestedConnection = link(nested, {
        set: (value) => {
          nestedSent.push(value);
        },
      });
      try {
        expect(getNodeAddress(member)).toEqual(['users.root', 'user.one']);
        expect(getNodeAddress(markerMember['inner.branch'])).toEqual([
          'marker.one',
          'inner.branch',
        ]);
        expect(getNodeAddress(nested)).toEqual([
          'marker.one',
          'inner.branch',
          'child.two',
        ]);
        if (observed) {
          expectPositionAddress(member['score.now'], [
            'users.root',
            'user.one',
            'score.now',
          ]);
          expectPositionAddress(nested.score.now, [
            'marker.one',
            'inner.branch',
            'child.two',
            'score',
            'now',
          ]);
        }
        member['score.now'](3);
        nested.score.now(21);
        await connection.settled();
        await nestedConnection.settled();
        expect(sent).toEqual([{ 'score.now': 3, score: { now: 10 } }]);
        expect(nestedSent).toEqual([{ 'score.now': 2, score: { now: 21 } }]);
      } finally {
        connection.dispose();
        nestedConnection.dispose();
        tree.destroy();
      }
    }
  );
});
