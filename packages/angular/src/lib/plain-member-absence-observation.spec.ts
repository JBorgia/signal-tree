import { computed } from '@angular/core';

import { signalTree, transactions } from '../index';

/**
 * PLAIN-MEMBER ABSENCE OBSERVATION — Angular realization.
 *
 *     PHYSICAL RETENTION MUST NOT CREATE A SECOND OBSERVABLE STATE.
 *
 * Kernel carrier: `packages/kernel/src/lib/plain-member-absence-observation.spec.ts`.
 * Here the native carrier caches: without `position-topology` the removed
 * leaf's token was never published, so even a DIRECT read stayed at the
 * retained value, and re-adding that same value left a branch consumer without
 * the member (nothing it depended on changed). The position-topology and
 * `transactions()` configurations are the reference.
 */

type Person = { name: string; age?: number };

const CONFIGURATIONS = [
  ['no enhancers', () => ({})],
  [
    'position-topology capability',
    () => ({ capabilities: ['position-topology'] }),
  ],
  ['transactions()', () => ({ enhancers: [transactions()] })],
] as const;

describe.each(CONFIGURATIONS)(
  'plain-member absence observation — Angular (%s)',
  (_, options) => {
    const build = () =>
      signalTree({ p: { name: 'a', age: 1 } as Person }, options() as never);
    type Tree = ReturnType<typeof build>;
    // `age` is optional in the state type, so the facade types its location as
    // possibly absent; the location itself always exists.
    const ageOf = (tree: Tree) =>
      tree.$.p.age as NonNullable<Tree['$']['p']['age']>;

    function observe(tree: ReturnType<typeof build>) {
      let runs = 0;
      const age = computed(() => {
        runs++;
        return ageOf(tree)();
      });
      const branch = computed(() => JSON.stringify(tree.$.p()));
      expect(age()).toBe(1);
      expect(ageOf(tree)()).toBe(1);
      expect(branch()).toBe('{"name":"a","age":1}');
      return { age, branch, runs: () => runs };
    }

    it('a membership-only removal is absent to direct, computed and branch readers', () => {
      const tree = build();
      const unread = build();
      try {
        const observed = observe(tree);

        tree.$.p({ name: 'a' });
        unread.$.p({ name: 'a' });

        expect(ageOf(tree)()).toBeUndefined();
        expect(ageOf(unread)()).toBeUndefined();
        expect(observed.age()).toBeUndefined();
        expect(observed.runs()).toBe(2);
        expect(observed.branch()).toBe('{"name":"a"}');
      } finally {
        tree.destroy();
        unread.destroy();
      }
    });

    it.each([
      ['the retained value', 1, '{"name":"a","age":1}'],
      ['a new value', 2, '{"name":"a","age":2}'],
    ] as const)(
      're-adding with %s is present to every reader',
      (__, age, expected) => {
        const tree = build();
        try {
          const observed = observe(tree);
          tree.$.p({ name: 'a' });
          expect(observed.age()).toBeUndefined();

          tree.$.p({ name: 'a', age });

          expect(ageOf(tree)()).toBe(age);
          expect(observed.age()).toBe(age);
          expect(observed.branch()).toBe(expected);
        } finally {
          tree.destroy();
        }
      }
    );

    it('an identical whole-branch write does not rerun a consumer', () => {
      const tree = build();
      try {
        const observed = observe(tree);

        tree.$.p({ name: 'a', age: 1 });

        expect(observed.age()).toBe(1);
        expect(observed.runs()).toBe(1);
      } finally {
        tree.destroy();
      }
    });

    it('a removal two levels deep is absent to every reader (outer write)', () => {
      const tree = signalTree(
        { a: { b: { name: 'x', age: 1 } as Person } },
        options() as never
      );
      const leaf = tree.$.a.b.age as NonNullable<typeof tree.$.a.b.age>;
      try {
        const age = computed(() => leaf());
        expect(age()).toBe(1);

        tree.$.a({ b: { name: 'x' } });

        expect(leaf()).toBeUndefined();
        expect(age()).toBeUndefined();
        expect(tree.$()).toEqual({ a: { b: { name: 'x' } } });
      } finally {
        tree.destroy();
      }
    });
  }
);
