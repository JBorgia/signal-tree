// v16 controls for entity batches larger than V8's call-argument limit.
//
// v16 integration slice 5. The v15 donor (entity-large-batches.spec.ts) found
// `target.push(...items)` throwing "Maximum call stack size exceeded" past
// ~1.2e5 items. Its membership case needs the slice-6 reader; these controls
// drive the v16 call sites that survive without it, through public APIs only:
// ungated notifier delivery and a transaction rollback (structural target
// order, and pending rollback planning over every effect).
// Restoration's directed transition and claim release are covered by
// enhancers/restoration/large-batch-restoration-v16-controls.spec.ts (its own
// worker: a 130k-row tree is not reclaimed before the next case allocates).
import { describe, expect, it } from 'vitest';
import { rollbackPendingTurnAt } from './internals/causal-runtime/pending-rollback';
import { TurnStore } from './internals/causal-runtime/turn-store';
import { AppliedTurnProjection } from './internals/causal-runtime/applied-turn-projection';
import { createRealizationContextSource } from './internals/causal-runtime/realization-context';
import { createPositionRegistry } from './internals/position-registry';
import type { ReversalEffect } from './internals/causal-runtime/causal-types';
import { getEntityPublicationBinding } from './internals/entity-publication';
import { createEntityEgressProjection } from './internals/entity-egress-projection';
import { signalTree } from './signal-tree';
import { entityMap } from './markers/entity-map';
import { getPathNotifier } from './path-notifier';
import { restoration } from '../enhancers/restoration/restoration';
import { transactions } from '../enhancers/transactions/transactions';

type Row = { id: number; n: number };
const rows = (count: number, offset = 0): Row[] =>
  Array.from({ length: count }, (_, i) => ({ id: i + offset, n: i }));
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const LARGE = 130_000;

describe('v16 entity batches larger than the argument limit', () => {
  it('setAll, replace and clear with a notifier subscriber', () => {
    const notifier = getPathNotifier();
    const tree = signalTree({ rows: entityMap<Row, number>() });
    let seen = 0;
    const stop = notifier.subscribe('rows.*', () => {
      seen += 1;
    });
    try {
      tree.$.rows.setAll(rows(LARGE));
      tree.$.rows.setAll(rows(LARGE, LARGE));
      tree.$.rows.setAll([]);
      notifier.flushSync();
      expect(tree.$.rows.count()).toBe(0);
      expect(seen).toBeGreaterThan(0);
    } finally {
      stop();
      tree.destroy();
    }
  }, 120_000);

  // Reusing a removed key is a key handoff, which sends the rollback through
  // the declarative whole-collection target; no survivor anchors it, so its
  // order is derived from the restored rows' own anchors in one batch.
  it.each([
    ['transactions', () => [transactions()]],
    ['transactions, restoration', () => [transactions(), restoration()]],
  ] as const)(
    'rolls back a transaction that replaced every row and reused a key (%s)',
    async (_name, enhancers) => {
      const tree = signalTree(
        { rows: entityMap<Row, number>() },
        { enhancers: enhancers() }
      );
      try {
        tree.$.rows.setAll(rows(LARGE));
        await flush();
        const pending = tree.transact(() => {
          tree.$.rows.setAll(rows(LARGE, LARGE));
          tree.$.rows.addOne({ id: 0, n: -1 });
        });
        expect(tree.$.rows.count()).toBe(LARGE + 1);
        pending.rollback();
        const ids = tree.$.rows.ids();
        expect(ids.length).toBe(LARGE);
        expect(ids[0]).toBe(0);
        expect(ids[LARGE - 1]).toBe(LARGE - 1);
        expect(tree.$.rows.byId(0)?.()?.n).toBe(0);
      } finally {
        tree.destroy();
      }
    },
    120_000
  );
});

// Historical purpose (the direct legacy helper is now guarded separately):
// v16 addition, same mechanism class as the donor's findIndex guard: rolling
// back a pending turn chose each effect's dominant structural effect with a
// scan of every structural effect in the turn (pending-rollback.ts), so a
// replacement's rollback visited m(m+1)/2 candidates for m structural effects.
// v15 has the same scan. This counts predicate visits, not time; it does not
// prove the whole rollback linear. Fixtures are built before counting.
function findVisits(action: () => void): number {
  const original = Array.prototype.find;
  let visits = 0;
  Array.prototype.find = function <T>(
    this: T[],
    predicate: (value: T, index: number, array: T[]) => unknown,
    thisArg?: unknown
  ): T | undefined {
    return original.call(this, (value: T, index: number, array: T[]) => {
      visits += 1;
      return predicate.call(thisArg, value, index, array);
    });
  } as typeof original;
  try {
    action();
    return visits;
  } finally {
    Array.prototype.find = original;
  }
}

describe('pending rollback dominant structural effect search work', () => {
  it('counts predicate visits and restores instrumentation even on failure', () => {
    const original = Array.prototype.find;
    const error = new Error('instrumented predicate failed');
    expect(findVisits(() => [1, 2, 3].find((value) => value === 2))).toBe(2);
    expect(() =>
      findVisits(() => {
        [1].find(() => {
          throw error;
        });
      })
    ).toThrow(error);
    expect(Array.prototype.find).toBe(original);
  });

  describe.each([
    ['transactions', () => [transactions()]],
    ['transactions, restoration', () => [transactions(), restoration()]],
    ['restoration, transactions', () => [restoration(), transactions()]],
  ] as const)('%s', (_name, enhancers) => {
    it.each([
      ['replacing every id', 256],
      ['replacing every id', 1_024],
      ['clearing with setAll([])', 256],
      ['clearing with setAll([])', 1_024],
    ] as const)('%s (%i rows)', (mode, count) => {
      const tree = signalTree(
        { rows: entityMap<Row, number>() },
        { enhancers: enhancers() }
      );
      try {
        tree.$.rows.setAll(rows(count));
        const projection = createEntityEgressProjection(
          rows(count).map((row) => ({
            key: row.id,
            row,
            subjectId: getEntityPublicationBinding(
              tree.$.rows.byIdOrFail(row.id)
            )!.subject!,
          }))
        );
        const stop = getEntityPublicationBinding(tree.$.rows)!.source.subscribe(
          {
            prepare(packet) {
              return {
                record: projection.prepare(packet).record,
                completion: {},
              };
            },
            complete() {
              /* The prepared egress record already adopted ordinary truth. */
            },
          }
        );
        const replacement =
          mode === 'replacing every id' ? rows(count, count) : [];
        const pending = tree.transact(() => tree.$.rows.setAll(replacement));
        expect(tree.$.rows.all()).toEqual(replacement);
        expect(projection.value()).toEqual(replacement);
        const visits = findVisits(() => pending.rollback());
        try {
          // Assert physical and ordinary values/order before the work guard, so
          // a search-cost mutant cannot hide a semantically incorrect restore.
          expect(tree.$.rows.ids()).toEqual(rows(count).map(({ id }) => id));
          expect(tree.$.rows.all()).toEqual(rows(count));
          expect(projection.value()).toEqual(rows(count));
          // Current authority-selected compensation bypasses legacy dominance.
          // For this contiguous chain: physical head search N, ordinary head
          // search N, final-adjacency replay head 1. This is a partial find-work
          // contract, not total planner linearity or a release-size budget.
          // A repeated whole-domain placement search must still fail this guard.
          expect(
            visits,
            'find predicate visits during rollback'
          ).toBeLessThanOrEqual(2 * count + 1);
        } finally {
          stop();
        }
      } finally {
        tree.destroy();
      }
    });
  });
});

describe('legacy pending rollback dominant structural search work', () => {
  it.each([256, 1024])(
    'keeps direct unselected compensation indexed (%i rows)',
    (count) => {
      const topology = createPositionRegistry();
      const authority = topology.allocate(),
        owner = topology.allocate(authority);
      const store = new TurnStore(),
        appliedTurns = new AppliedTurnProjection(store);
      const initial = rows(count);
      const pending = store.admitPending({
        id: 1,
        effects: initial.map((row) => ({
          path: `rows.${row.id}`,
          ownerPath: 'rows',
          owner,
          subjectId: row.id,
          structural: 'remove' as const,
          before: row,
          after: undefined,
        })),
      });
      let applied: readonly ReversalEffect[] | undefined;
      let result: ReturnType<typeof rollbackPendingTurnAt> | undefined;
      const visits = findVisits(() => {
        // Deliberately omit selectedCompensation: exercise the supported legacy
        // helper route that public authority-selected rollback now bypasses.
        result = rollbackPendingTurnAt({
          authority,
          turnId: pending.id,
          store,
          topology,
          realizationContext: createRealizationContextSource({
            store,
            appliedTurns,
          }),
          port: {
            applyAtomically(effects) {
              applied = effects;
            },
          },
        });
      });
      expect(result).toEqual({ ok: true, turnId: pending.id });
      expect(
        applied?.map((effect) => ({
          subject: effect.subjectId,
          kind: effect.structural,
          value: effect.after,
        }))
      ).toEqual(
        initial.map((row) => ({ subject: row.id, kind: 'add', value: row }))
      );
      expect(store.getPendingTurn(pending.id)).toBeUndefined();
      expect(
        visits,
        'direct legacy dominant search visits'
      ).toBeLessThanOrEqual(count);
    }
  );
});
