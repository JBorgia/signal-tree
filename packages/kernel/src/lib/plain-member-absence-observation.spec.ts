import { describe, expect, it } from 'vitest';

import { batching } from '../enhancers/batching/batching';
import { restoration } from '../enhancers/restoration/restoration';
import { transactions } from '../enhancers/transactions/transactions';
import { createReactiveTestRealization } from '../reactive-test-realization';
import { createSignalTreeFactory, signalTree } from './signal-tree';

/**
 * PLAIN-MEMBER ABSENCE OBSERVATION — every reader agrees a removed member is
 * absent, on every configuration.
 *
 *     PHYSICAL RETENTION MUST NOT CREATE A SECOND OBSERVABLE STATE.
 *     (member-membership.ts)
 *
 * Defect this pins (reproduced on 15.4.2): without `position-topology`, a
 * membership-only removal — `p({ name: 'a' })` over `{ name: 'a', age: 1 }` —
 * left every consumer that had already read `p.age` at the retained `1`: a
 * derived location, a `subscribe` listener (never called), the tree's own
 * `derived` option. The branch snapshot and an uncached direct read said
 * `undefined`. `transactions()` and `restoration()` were correct because they
 * resolve `position-topology`.
 *
 * Mechanism: `republishMembers` found a removed leaf's publication only through
 * its PositionId. Since 5efeb7f5 every tree has scalar slots, but a slot is
 * PositionId-addressable only under `position-topology`, so a default tree's
 * removed leaf was treated as tokenless and its own token was never published.
 *
 * The position-topology configurations are the reference: every expectation
 * below, including the exact publication counts, is what they already produce.
 */

const reactiveRealization = createReactiveTestRealization();
const computed = reactiveRealization.locations.createDerived;

type Person = { name: string; age?: number };

interface Configuration {
  readonly label: string;
  readonly options: () => Record<string, unknown>;
}

const CONFIGURATIONS: readonly Configuration[] = [
  { label: 'no enhancers', options: () => ({}) },
  {
    label: 'mutation-capture capability',
    options: () => ({ capabilities: ['mutation-capture'] }),
  },
  { label: 'batching()', options: () => ({ enhancers: [batching()] }) },
  {
    label: 'position-topology capability',
    options: () => ({ capabilities: ['position-topology'] }),
  },
  { label: 'transactions()', options: () => ({ enhancers: [transactions()] }) },
  { label: 'restoration()', options: () => ({ enhancers: [restoration()] }) },
];

const FACTORIES = [
  { label: 'neutral realization', create: signalTree },
  {
    label: 'reactive realization',
    create: createSignalTreeFactory(reactiveRealization),
  },
] as const;

const CASES = FACTORIES.flatMap((factory) =>
  CONFIGURATIONS.map((configuration) => ({
    label: `${factory.label}, ${configuration.label}`,
    create: factory.create,
    configuration,
  }))
);

describe.each(CASES)(
  'plain-member absence observation ($label)',
  ({ create, configuration }) => {
    const build = <T extends object>(state: T, extra: object = {}) =>
      create(state, { ...configuration.options(), ...extra } as never);

    type PersonTree = ReturnType<typeof build<{ p: Person }>>;
    // `age` is optional in the state type, so the facade types its location as
    // possibly absent; the location itself always exists.
    const ageOf = (tree: PersonTree) =>
      tree.$.p.age as NonNullable<PersonTree['$']['p']['age']>;

    /** Consumers that have all read `p.age` BEFORE the transition. */
    function observePerson(tree: PersonTree) {
      const age = computed(() => ageOf(tree)());
      const branch = computed(() => JSON.stringify(tree.$.p()));
      let leafNotifications = 0;
      let branchNotifications = 0;
      let siblingNotifications = 0;
      const stopLeaf = ageOf(tree).subscribe(() => leafNotifications++);
      const stopBranch = branch.subscribe(() => branchNotifications++);
      // Guard: a transition of `age` never publishes the untouched sibling —
      // each semantic slot is published once, and only the changed one.
      const stopSibling = tree.$.p.name.subscribe(() => siblingNotifications++);
      expect(age()).toBe(1);
      expect(branch()).toBe('{"name":"a","age":1}');
      return {
        age,
        branch,
        notifications: () => ({
          leaf: leafNotifications,
          branch: branchNotifications,
          sibling: siblingNotifications,
        }),
        stop: () => {
          stopLeaf();
          stopBranch();
          stopSibling();
        },
      };
    }

    it('a membership-only removal is absent to every reader, published exactly once', () => {
      const tree = build({ p: { name: 'a', age: 1 } as Person });
      try {
        const observed = observePerson(tree);

        tree.$.p({ name: 'a' });

        expect(ageOf(tree)()).toBeUndefined();
        expect(observed.age()).toBeUndefined();
        expect(observed.branch()).toBe('{"name":"a"}');
        expect(tree.$()).toEqual({ p: { name: 'a' } });
        expect(observed.notifications()).toEqual({
          leaf: 1,
          branch: 1,
          sibling: 0,
        });
        observed.stop();
      } finally {
        tree.destroy();
      }
    });

    it('a leaf and a branch member removed together are absent, published exactly once', () => {
      type Boxed = Person & { box?: { v: number } };
      const tree = build({ p: { name: 'a', age: 1, box: { v: 1 } } as Boxed });
      try {
        const leaf = tree.$.p.age as NonNullable<typeof tree.$.p.age>;
        const age = computed(() => leaf());
        const branch = computed(() => JSON.stringify(tree.$.p()));
        let leafNotifications = 0;
        let branchNotifications = 0;
        const stopLeaf = leaf.subscribe(() => leafNotifications++);
        const stopBranch = branch.subscribe(() => branchNotifications++);
        expect(age()).toBe(1);
        expect(branch()).toBe('{"name":"a","age":1,"box":{"v":1}}');

        tree.$.p({ name: 'a' });

        expect(age()).toBeUndefined();
        expect(branch()).toBe('{"name":"a"}');
        expect({
          leaf: leafNotifications,
          branch: branchNotifications,
        }).toEqual({ leaf: 1, branch: 1 });
        stopLeaf();
        stopBranch();
      } finally {
        tree.destroy();
      }
    });

    it("the tree's derived option observes the removal", () => {
      const tree = build(
        { p: { name: 'a', age: 1 } as Person },
        {
          derived: ($: { p: { age: () => number | undefined } }) => ({
            ageView: () => $.p.age(),
          }),
        }
      );
      try {
        const view = (tree.$ as unknown as { ageView: () => unknown }).ageView;
        expect(view()).toBe(1);

        tree.$.p({ name: 'a' });

        expect(view()).toBeUndefined();
      } finally {
        tree.destroy();
      }
    });

    it.each([
      ['the retained value', 1, '{"name":"a","age":1}'],
      ['a new value', 2, '{"name":"a","age":2}'],
    ] as const)(
      're-adding the removed member with %s is present to every reader, published exactly once',
      (_, age, expected) => {
        const tree = build({ p: { name: 'a', age: 1 } as Person });
        try {
          const observed = observePerson(tree);
          tree.$.p({ name: 'a' });

          tree.$.p({ name: 'a', age });

          expect(ageOf(tree)()).toBe(age);
          expect(observed.age()).toBe(age);
          expect(observed.branch()).toBe(expected);
          expect(observed.notifications()).toEqual({
            leaf: 2,
            branch: 2,
            sibling: 0,
          });
          observed.stop();
        } finally {
          tree.destroy();
        }
      }
    );

    it('an identical whole-branch write publishes nothing', () => {
      const tree = build({ p: { name: 'a', age: 1 } as Person });
      try {
        const observed = observePerson(tree);

        tree.$.p({ name: 'a', age: 1 });

        expect(observed.age()).toBe(1);
        expect(observed.notifications()).toEqual({
          leaf: 0,
          branch: 0,
          sibling: 0,
        });
        observed.stop();
      } finally {
        tree.destroy();
      }
    });

    it('a direct write after removal reactivates the member for every reader', () => {
      const tree = build({ p: { name: 'a', age: 1 } as Person });
      try {
        const observed = observePerson(tree);
        tree.$.p({ name: 'a' });

        ageOf(tree)(7);

        expect(observed.age()).toBe(7);
        expect(observed.branch()).toBe('{"name":"a","age":7}');
        expect(observed.notifications()).toEqual({
          leaf: 2,
          branch: 2,
          sibling: 0,
        });
        observed.stop();
      } finally {
        tree.destroy();
      }
    });

    it('a removal with a sibling value change publishes each changed member once', () => {
      const tree = build({ p: { name: 'a', age: 1 } as Person });
      try {
        const observed = observePerson(tree);

        tree.$.p({ name: 'b' });

        expect(observed.age()).toBeUndefined();
        expect(observed.branch()).toBe('{"name":"b"}');
        expect(observed.notifications()).toEqual({
          leaf: 1,
          branch: 1,
          sibling: 1,
        });
        observed.stop();
      } finally {
        tree.destroy();
      }
    });

    it('two members removed in one write are each published once', () => {
      type Nicked = Person & { nick?: string };
      const tree = build({ p: { name: 'a', age: 1, nick: 'n' } as Nicked });
      try {
        const age = tree.$.p.age as NonNullable<typeof tree.$.p.age>;
        const nick = tree.$.p.nick as NonNullable<typeof tree.$.p.nick>;
        const branch = computed(() => JSON.stringify(tree.$.p()));
        const counts = { age: 0, nick: 0, branch: 0 };
        const stops = [
          age.subscribe(() => counts.age++),
          nick.subscribe(() => counts.nick++),
          branch.subscribe(() => counts.branch++),
        ];
        expect(branch()).toBe('{"name":"a","age":1,"nick":"n"}');

        tree.$.p({ name: 'a' });

        expect(age()).toBeUndefined();
        expect(nick()).toBeUndefined();
        expect(branch()).toBe('{"name":"a"}');
        expect(counts).toEqual({ age: 1, nick: 1, branch: 1 });
        for (const stop of stops) stop();
      } finally {
        tree.destroy();
      }
    });

    it('removals in two branches inside one batch publish like value writes do', () => {
      type Pair = { p: Person; q: Person };
      const initial = (): Pair => ({
        p: { name: 'a', age: 1 },
        q: { name: 'b', age: 2 },
      });
      const batchOf = (tree: object) =>
        (tree as { batch?: (fn: () => void) => void }).batch ??
        ((fn: () => void) => fn());
      // Control: two ordinary value writes in the same configuration. batch()
      // groups change detection, not subscriber delivery, so this is the
      // reference count rather than an assumed 1.
      const control = build(initial());
      const tree = build(initial());
      try {
        const controlRoot = computed(() => JSON.stringify(control.$()));
        let controlNotifications = 0;
        controlRoot();
        const stopControl = controlRoot.subscribe(() => controlNotifications++);
        batchOf(control)(() => {
          control.$.p.name('x');
          control.$.q.name('y');
        });
        stopControl();

        const pAge = tree.$.p.age as NonNullable<typeof tree.$.p.age>;
        const qAge = tree.$.q.age as NonNullable<typeof tree.$.q.age>;
        const root = computed(() => JSON.stringify(tree.$()));
        const counts = { p: 0, q: 0, root: 0 };
        expect(root()).toBe(
          '{"p":{"name":"a","age":1},"q":{"name":"b","age":2}}'
        );
        const stops = [
          pAge.subscribe(() => counts.p++),
          qAge.subscribe(() => counts.q++),
          root.subscribe(() => counts.root++),
        ];

        batchOf(tree)(() => {
          tree.$.p({ name: 'a' });
          tree.$.q({ name: 'b' });
        });

        expect(pAge()).toBeUndefined();
        expect(qAge()).toBeUndefined();
        expect(root()).toBe('{"p":{"name":"a"},"q":{"name":"b"}}');
        expect({ p: counts.p, q: counts.q }).toEqual({ p: 1, q: 1 });
        expect(counts.root).toBe(controlNotifications);
        for (const stop of stops) stop();
      } finally {
        control.destroy();
        tree.destroy();
      }
    });

    it.each(['inner', 'outer'] as const)(
      'a removal two levels deep is absent to every reader (%s write)',
      (site) => {
        const tree = build({ a: { b: { name: 'x', age: 1 } as Person } });
        const leaf = tree.$.a.b.age as NonNullable<typeof tree.$.a.b.age>;
        try {
          const age = computed(() => leaf());
          const root = computed(() => JSON.stringify(tree.$()));
          let leafNotifications = 0;
          let rootNotifications = 0;
          const stopLeaf = leaf.subscribe(() => leafNotifications++);
          const stopRoot = root.subscribe(() => rootNotifications++);
          expect(age()).toBe(1);
          expect(root()).toBe('{"a":{"b":{"name":"x","age":1}}}');

          if (site === 'inner') tree.$.a.b({ name: 'x' });
          else tree.$.a({ b: { name: 'x' } });

          expect(leaf()).toBeUndefined();
          expect(age()).toBeUndefined();
          expect(root()).toBe('{"a":{"b":{"name":"x"}}}');
          // The outer write descends into `b`; it must not publish twice.
          expect({ leaf: leafNotifications, root: rootNotifications }).toEqual({
            leaf: 1,
            root: 1,
          });
          stopLeaf();
          stopRoot();
        } finally {
          tree.destroy();
        }
      }
    );
  }
);
