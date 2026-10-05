import { computed, watchEffect } from 'vue';
import { describe, expect, it } from 'vitest';

import { signalTree, transactions } from '../index';

/**
 * PLAIN-MEMBER ABSENCE OBSERVATION — Vue realization.
 *
 *     PHYSICAL RETENTION MUST NOT CREATE A SECOND OBSERVABLE STATE.
 *
 * Kernel carrier: `packages/kernel/src/lib/plain-member-absence-observation.spec.ts`.
 * Vue's writable cell holds the last published value, so without
 * `position-topology` the removed leaf — whose token was never published —
 * read the retained value through `.value` even when nothing had read it
 * before. The position-topology and `transactions()` configurations are the
 * reference.
 */

type Person = { name: string; age?: number };

const CONFIGURATIONS = [
  ['no enhancers', () => ({})],
  ['position-topology capability', () => ({ capabilities: ['position-topology'] })],
  ['transactions()', () => ({ enhancers: [transactions()] })],
] as const;

describe.each(CONFIGURATIONS)(
  'plain-member absence observation — Vue (%s)',
  (_, options) => {
    const build = () =>
      signalTree({ p: { name: 'a', age: 1 } as Person }, options() as never);
    type Tree = ReturnType<typeof build>;
    // `age` is optional in the state type, so the facade types its location as
    // possibly absent; the location itself always exists.
    const ageOf = (tree: Tree) =>
      tree.$.p.age as NonNullable<Tree['$']['p']['age']>;

    it('a membership-only removal is absent to ref, computed and branch readers, once', () => {
      const tree = build();
      const unread = build();
      const seen: Array<number | undefined> = [];
      const stop = watchEffect(() => seen.push(ageOf(tree).value), {
        flush: 'sync',
      });
      try {
        const age = computed(() => ageOf(tree).value);
        const branch = computed(() => JSON.stringify(tree.$.p()));
        expect(age.value).toBe(1);
        expect(branch.value).toBe('{"name":"a","age":1}');

        tree.$.p({ name: 'a' });
        unread.$.p({ name: 'a' });

        expect(ageOf(tree).value).toBeUndefined();
        expect(ageOf(unread).value).toBeUndefined();
        expect(age.value).toBeUndefined();
        expect(branch.value).toBe('{"name":"a"}');
        expect(seen).toEqual([1, undefined]);
      } finally {
        stop();
        tree.destroy();
        unread.destroy();
      }
    });

    it.each([
      ['the retained value', 1, '{"name":"a","age":1}'],
      ['a new value', 2, '{"name":"a","age":2}'],
    ] as const)('re-adding with %s is present to every reader, once', (__, age, expected) => {
      const tree = build();
      const seen: Array<number | undefined> = [];
      const stop = watchEffect(() => seen.push(ageOf(tree).value), {
        flush: 'sync',
      });
      try {
        const branch = computed(() => JSON.stringify(tree.$.p()));
        expect(branch.value).toBe('{"name":"a","age":1}');
        tree.$.p({ name: 'a' });

        tree.$.p({ name: 'a', age });

        expect(ageOf(tree).value).toBe(age);
        expect(branch.value).toBe(expected);
        expect(seen).toEqual([1, undefined, age]);
      } finally {
        stop();
        tree.destroy();
      }
    });

    it('an identical whole-branch write does not rerun a consumer', () => {
      const tree = build();
      const seen: Array<number | undefined> = [];
      const stop = watchEffect(() => seen.push(ageOf(tree).value), {
        flush: 'sync',
      });
      try {
        tree.$.p({ name: 'a', age: 1 });
        expect(seen).toEqual([1]);
      } finally {
        stop();
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
        const age = computed(() => leaf.value);
        expect(age.value).toBe(1);

        tree.$.a({ b: { name: 'x' } });

        expect(leaf.value).toBeUndefined();
        expect(age.value).toBeUndefined();
        expect(tree.$()).toEqual({ a: { b: { name: 'x' } } });
      } finally {
        tree.destroy();
      }
    });
  }
);
