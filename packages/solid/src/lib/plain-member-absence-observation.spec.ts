import { createMemo, createRoot } from 'solid-js';
import { describe, expect, it } from 'vitest';

import { signalTree, transactions } from '../index';

/**
 * PLAIN-MEMBER ABSENCE OBSERVATION — Solid realization.
 *
 *     PHYSICAL RETENTION MUST NOT CREATE A SECOND OBSERVABLE STATE.
 *
 * Kernel carrier: `packages/kernel/src/lib/plain-member-absence-observation.spec.ts`.
 * Solid's writable cell holds the last published value, so without
 * `position-topology` the removed leaf — whose token was never published —
 * read the retained value even when nothing had read it before. The
 * position-topology and `transactions()` configurations are the reference.
 */

type Person = { name: string; age?: number };

const CONFIGURATIONS = [
  ['no enhancers', () => ({})],
  ['position-topology capability', () => ({ capabilities: ['position-topology'] })],
  ['transactions()', () => ({ enhancers: [transactions()] })],
] as const;

describe.each(CONFIGURATIONS)(
  'plain-member absence observation — Solid (%s)',
  (_, options) => {
    const build = () =>
      signalTree({ p: { name: 'a', age: 1 } as Person }, options() as never);
    type Tree = ReturnType<typeof build>;
    // `age` is optional in the state type, so the facade types its location as
    // possibly absent; the location itself always exists.
    const ageOf = (tree: Tree) =>
      tree.$.p.age as NonNullable<Tree['$']['p']['age']>;

    it('a membership-only removal is absent to accessor, memo and branch readers, once', () => {
      createRoot((dispose) => {
        const tree = build();
        const unread = build();
        try {
          const seen: Array<number | undefined> = [];
          const age = createMemo(() => {
            const value = ageOf(tree)();
            seen.push(value);
            return value;
          });
          const branch = createMemo(() => JSON.stringify(tree.$.p()));
          expect(age()).toBe(1);
          expect(branch()).toBe('{"name":"a","age":1}');

          tree.$.p({ name: 'a' });
          unread.$.p({ name: 'a' });

          expect(ageOf(tree)()).toBeUndefined();
          expect(ageOf(unread)()).toBeUndefined();
          expect(age()).toBeUndefined();
          expect(branch()).toBe('{"name":"a"}');
          expect(seen).toEqual([1, undefined]);
        } finally {
          tree.destroy();
          unread.destroy();
          dispose();
        }
      });
    });

    it.each([
      ['the retained value', 1, '{"name":"a","age":1}'],
      ['a new value', 2, '{"name":"a","age":2}'],
    ] as const)('re-adding with %s is present to every reader, once', (__, age, expected) => {
      createRoot((dispose) => {
        const tree = build();
        try {
          const seen: Array<number | undefined> = [];
          const memo = createMemo(() => {
            const value = ageOf(tree)();
            seen.push(value);
            return value;
          });
          const branch = createMemo(() => JSON.stringify(tree.$.p()));
          expect(memo()).toBe(1);
          tree.$.p({ name: 'a' });

          tree.$.p({ name: 'a', age });

          expect(ageOf(tree)()).toBe(age);
          expect(memo()).toBe(age);
          expect(branch()).toBe(expected);
          expect(seen).toEqual([1, undefined, age]);
        } finally {
          tree.destroy();
          dispose();
        }
      });
    });

    it('an identical whole-branch write does not rerun a consumer', () => {
      createRoot((dispose) => {
        const tree = build();
        try {
          let runs = 0;
          const memo = createMemo(() => {
            runs++;
            return ageOf(tree)();
          });
          expect(memo()).toBe(1);

          tree.$.p({ name: 'a', age: 1 });

          expect(memo()).toBe(1);
          expect(runs).toBe(1);
        } finally {
          tree.destroy();
          dispose();
        }
      });
    });

    it('a removal two levels deep is absent to every reader (outer write)', () => {
      createRoot((dispose) => {
        const tree = signalTree(
          { a: { b: { name: 'x', age: 1 } as Person } },
          options() as never
        );
        const leaf = tree.$.a.b.age as NonNullable<typeof tree.$.a.b.age>;
        try {
          const age = createMemo(() => leaf());
          expect(age()).toBe(1);

          tree.$.a({ b: { name: 'x' } });

          expect(leaf()).toBeUndefined();
          expect(age()).toBeUndefined();
          expect(tree.$()).toEqual({ a: { b: { name: 'x' } } });
        } finally {
          tree.destroy();
          dispose();
        }
      });
    });
  }
);
