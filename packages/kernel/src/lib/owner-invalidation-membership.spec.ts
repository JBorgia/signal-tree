import { describe, expect, it } from 'vitest';

import { observeOwnerInvalidation } from '../adapter';
import { restoration } from '../enhancers/restoration/restoration';
import { transactions } from '../enhancers/transactions/transactions';
import { signalTree } from './signal-tree';

/**
 * OWNER INVALIDATION — PLAIN-BRANCH MEMBERSHIP CARRIER.
 *
 *     A MEMBERSHIP TRANSITION CHANGES THE OWNER'S READABLE TRUTH, SO IT
 *     INVALIDATES THE OWNER — WHICHEVER CARRIER WAKES THE DEPENDENCY GRAPH.
 *
 * Defect this pins (reproduced on 15.4.2): a whole-branch write that only
 * removed a scalar member (`p({ name: 'a' })` over `{ name: 'a', age: 1 }`)
 * invalidated the owner with no enhancers and did NOT with `transactions()` or
 * `restoration()`, although `tree.$()` already read `{ p: { name: 'a' } }`. An
 * adapter on `observeOwnerInvalidation` (React's external store) stayed stale.
 *
 * Mechanism, measured with an instrumented probe: `republishMembers` in
 * `signal-tree.ts` reached owner invalidation only through
 * `publishMembershipChange`, and calls that only when some changed member has
 * no scalar slot. Without `position-topology` a leaf has no slot-registered
 * PositionId, so the tokenless branch ran — and invalidated — by accident. The
 * enhancers resolve `position-topology`, every scalar member resolves its slot,
 * and only the per-slot token publication ran.
 *
 * Each case also asserts EXACTLY the invalidations the no-enhancer path
 * produces, so a repair cannot pass by over-invalidating.
 */

const flush = async () => {
  for (let index = 0; index < 8; index++) await Promise.resolve();
};

type Person = { name: string; age?: number; nick?: string };

interface PendingTransaction {
  confirm(): void;
  rollback(): void;
}

interface TransactionalOwner {
  transact(fn: () => void): PendingTransaction;
}

interface Configuration {
  readonly label: string;
  readonly options: () => object;
  readonly transactional: boolean;
}

const CONFIGURATIONS: readonly Configuration[] = [
  { label: 'no enhancers', options: () => ({}), transactional: false },
  {
    // The root-cause discriminator: the capability the enhancers resolve,
    // with no enhancer and therefore no path observer installed by this tree.
    label: 'position-topology capability, no enhancer',
    options: () => ({ capabilities: ['causal-runtime', 'position-topology'] }),
    transactional: false,
  },
  {
    label: 'transactions()',
    options: () => ({ enhancers: [transactions()] }),
    transactional: true,
  },
  {
    label: 'restoration()',
    options: () => ({ enhancers: [restoration()] }),
    transactional: false,
  },
  {
    label: 'transactions() + restoration()',
    options: () => ({ enhancers: [transactions(), restoration()] }),
    transactional: true,
  },
  {
    label: 'restoration() + transactions()',
    options: () => ({ enhancers: [restoration(), transactions()] }),
    transactional: true,
  },
];

function build<T extends object>(state: T, configuration: Configuration) {
  return signalTree(state, configuration.options() as never);
}

/** Every invalidation records the canonical truth readable when it fired. */
function observe(tree: { readonly $: () => unknown } & object) {
  const seen: string[] = [];
  const stop = observeOwnerInvalidation(tree as never, () => {
    seen.push(JSON.stringify(tree.$()));
  });
  return { seen, stop };
}

describe.each(CONFIGURATIONS)(
  'OWNER INVALIDATION — plain-branch membership ($label)',
  (configuration) => {
    it('a membership-only removal outside any transaction invalidates exactly once', async () => {
      const tree = build({ p: { name: 'a', age: 1 } as Person }, configuration);
      try {
        await flush();
        const observer = observe(tree);

        tree.$.p({ name: 'a' });
        await flush();

        expect(tree.$()).toEqual({ p: { name: 'a' } });
        expect(observer.seen).toEqual(['{"p":{"name":"a"}}']);
        observer.stop();
      } finally {
        tree.destroy();
      }
    });

    it('removing several scalar members in one write invalidates exactly once', async () => {
      const tree = build(
        { p: { name: 'a', age: 1, nick: 'n' } as Person },
        configuration
      );
      try {
        await flush();
        const observer = observe(tree);

        tree.$.p({ name: 'a' });
        await flush();

        expect(observer.seen).toEqual(['{"p":{"name":"a"}}']);
        observer.stop();
      } finally {
        tree.destroy();
      }
    });

    it.each([
      ['the retained value', 1, '{"p":{"name":"a","age":1}}'],
      ['a new value', 2, '{"p":{"name":"a","age":2}}'],
    ] as const)(
      're-adding the removed field with %s invalidates exactly once',
      async (_, age, expected) => {
        const tree = build(
          { p: { name: 'a', age: 1 } as Person },
          configuration
        );
        try {
          tree.$.p({ name: 'a' });
          await flush();
          const observer = observe(tree);

          tree.$.p({ name: 'a', age });
          await flush();

          expect(observer.seen).toEqual([expected]);
          observer.stop();
        } finally {
          tree.destroy();
        }
      }
    );

    it('a removal combined with a value change still invalidates exactly once', async () => {
      const tree = build({ p: { name: 'a', age: 1 } as Person }, configuration);
      try {
        await flush();
        const observer = observe(tree);

        tree.$.p({ name: 'b' });
        await flush();

        expect(observer.seen).toEqual(['{"p":{"name":"b"}}']);
        observer.stop();
      } finally {
        tree.destroy();
      }
    });

    it('an identical whole-branch write does not invalidate', async () => {
      const tree = build({ p: { name: 'a', age: 1 } as Person }, configuration);
      try {
        await flush();
        const observer = observe(tree);

        tree.$.p({ name: 'a', age: 1 });
        await flush();

        expect(observer.seen).toEqual([]);
        observer.stop();
      } finally {
        tree.destroy();
      }
    });

    it('an entity-free plain branch two levels deep invalidates exactly once (inner write)', async () => {
      const tree = build(
        { a: { b: { name: 'x', age: 1 } as Person } },
        configuration
      );
      try {
        await flush();
        const observer = observe(tree);

        tree.$.a.b({ name: 'x' });
        await flush();

        expect(observer.seen).toEqual(['{"a":{"b":{"name":"x"}}}']);
        observer.stop();
      } finally {
        tree.destroy();
      }
    });

    it('an entity-free plain branch two levels deep invalidates exactly once (outer write descending)', async () => {
      const tree = build(
        { a: { b: { name: 'x', age: 1 } as Person } },
        configuration
      );
      try {
        await flush();
        const observer = observe(tree);

        tree.$.a({ b: { name: 'x' } });
        await flush();

        expect(observer.seen).toEqual(['{"a":{"b":{"name":"x"}}}']);
        observer.stop();
      } finally {
        tree.destroy();
      }
    });

    /**
     * A pending membership-only write must be observed on EXACTLY the schedule
     * a pending value write on the same line is observed — never later.
     *
     * The schedule itself is the line's owner-invalidation law and is asserted
     * by parity with a value-write control rather than restated here. On 15.x
     * the law defers both to settlement (`owner-invalidation.spec.ts`, "does
     * not invalidate a deferred transaction before final settlement"); 16.x
     * superseded that with CURRENT-TRUTH-OBSERVATION-0 (429c7fff), where both
     * fire while pending. Before the repair the membership write was observed
     * on neither schedule: 0 while pending AND 0 after confirm.
     */
    // Registered only where a transaction exists: a skipped case in a green run
    // would read as evidence.
    if (!configuration.transactional) return;
    it.each(['confirm', 'rollback'] as const)(
      'a membership-only write in a pending transaction is observed exactly like a value write (%s)',
      async (settle) => {
        const control = build(
          { p: { name: 'a', age: 1 } as Person },
          configuration
        );
        const subject = build(
          { p: { name: 'a', age: 1 } as Person },
          configuration
        );
        try {
          await flush();
          const controlObserver = observe(control);
          const subjectObserver = observe(subject);

          const controlTurn = (
            control as unknown as TransactionalOwner
          ).transact(() => control.$.p.name('b'));
          const subjectTurn = (
            subject as unknown as TransactionalOwner
          ).transact(() => subject.$.p({ name: 'a' }));
          await flush();

          // Current truth has already moved, independent of settlement.
          expect(subject.$()).toEqual({ p: { name: 'a' } });
          expect(subjectObserver.seen.length).toBe(controlObserver.seen.length);

          controlTurn[settle]();
          subjectTurn[settle]();
          await flush();

          const settled =
            settle === 'confirm'
              ? '{"p":{"name":"a"}}'
              : '{"p":{"name":"a","age":1}}';
          expect(subject.$()).toEqual(JSON.parse(settled));
          expect(controlObserver.seen.length).toBeGreaterThan(0);
          expect(subjectObserver.seen.length).toBe(controlObserver.seen.length);
          expect(subjectObserver.seen.at(-1)).toBe(settled);
          controlObserver.stop();
          subjectObserver.stop();
        } finally {
          control.destroy();
          subject.destroy();
        }
      }
    );
  }
);
