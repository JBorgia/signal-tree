import { describe, expect, it } from 'vitest';
import { entityMap, signalTree, transactions } from '../../index';
import { withWriteContext } from '../../lib/write-context';
import {
  clearProductionSubstrateStatsForTesting,
  installProductionSubstrateStatsForTesting,
  resetProductionSubstrateStatsForTesting,
} from '../../lib/internals/production-substrate-stats';
import { createPositionRegistry } from '../../lib/internals/position-registry';
import { TurnStore } from '../../lib/internals/causal-runtime/turn-store';
import { AppliedTurnProjection } from '../../lib/internals/causal-runtime/applied-turn-projection';
import { createRealizationContextSource } from '../../lib/internals/causal-runtime/realization-context';
import { rollbackPendingTurnAt } from '../../lib/internals/causal-runtime/pending-rollback';
import type { ReversalEffect } from '../../lib/internals/causal-runtime/causal-types';

const tick = async () => {
  for (let i = 0; i < 40; i++) await Promise.resolve();
};
const foreign = (work: () => void) =>
  withWriteContext({ intent: 'system', participation: 'realized' }, work);

describe('selected native compensation compilation', () => {
  for (const size of [16, 1024])
    for (const aba of [false, true]) {
      it(`reverses ${
        aba ? 'ABA' : 'continuous'
      } segmented rekeys without enumerating ${size} unrelated members`, async () => {
        const tree = signalTree(
          { rows: entityMap<{ id: string; n: number }, string>() },
          { enhancers: [transactions()] }
        );
        try {
          const rows = tree.$.rows;
          rows.setAll([
            { id: 'a', n: 7 },
            ...Array.from({ length: size }, (_, i) => ({
              id: `other${i}`,
              n: 0,
            })),
          ]);
          await tick();
          const a = rows.byIdOrFail('a');
          const stats = installProductionSubstrateStatsForTesting();
          const pending = tree.transact(() => {
            rows.changeId('a', 'b');
            foreign(() => a.n(123));
            if (aba) {
              rows.changeId('b', 'a');
              foreign(() => a.n(124));
              rows.changeId('a', 'b');
            } else rows.changeId('b', 'c');
          });
          expect(stats.structuralActiveKeyEntriesVisited).toBe(0);
          resetProductionSubstrateStatsForTesting(stats);
          pending.rollback();
          expect(a.n()).toBe(aba ? 124 : 123);
          expect(rows.byIdOrFail('a')).toBe(a);
          expect(rows.byId('b')).toBeUndefined();
          expect(rows.byId('c')).toBeUndefined();
          expect(stats.structuralActiveKeyEntriesVisited).toBe(0);
        } finally {
          clearProductionSubstrateStatsForTesting();
          tree.destroy();
        }
      });
    }

  it('reverses independent fields at multiple addresses under one owner and carries the foreign field', async () => {
    const tree = signalTree(
      {
        count: 0,
        rows: entityMap<{ id: string; n: number; m: number }, string>(),
      },
      { enhancers: [transactions()] }
    );
    try {
      const rows = tree.$.rows;
      rows.setAll([
        { id: 'a', n: 7, m: 1 },
        { id: 'd', n: 8, m: 2 },
      ]);
      await tick();
      const a = rows.byIdOrFail('a'),
        d = rows.byIdOrFail('d');
      const pending = tree.transact(() => {
        a.m(99);
        d.m(88);
        tree.$.count(4);
        rows.changeId('a', 'b');
        foreign(() => a.n(123));
        rows.changeId('b', 'c');
      });
      pending.rollback();
      expect(rows.ids()).toEqual(['a', 'd']);
      expect(a.n()).toBe(123);
      expect(a.m()).toBe(1);
      expect(d.m()).toBe(2);
      expect(tree.$.count()).toBe(0);
    } finally {
      tree.destroy();
    }
  });

  it('revives a removed row before its selected field reversal while carrying an earlier foreign field', async () => {
    const tree = signalTree(
      { rows: entityMap<{ id: string; n: number; m: number }, string>() },
      { enhancers: [transactions()] }
    );
    try {
      const rows = tree.$.rows;
      rows.addOne({ id: 'a', n: 7, m: 1 });
      await tick();
      const a = rows.byIdOrFail('a');
      const pending = tree.transact(() => {
        a.m(99);
        foreign(() => a.n(123));
        rows.removeOne('a');
      });
      pending.rollback();
      expect(rows.byIdOrFail('a')).toBe(a);
      expect(a.m()).toBe(1);
      expect(a.n()).toBe(123);
    } finally {
      tree.destroy();
    }
  });

  it('preserves repeated selected same-address inverses through one sparse validation and installation', () => {
    const topology = createPositionRegistry(),
      root = topology.allocate(),
      owner = topology.allocate(root);
    const store = new TurnStore(),
      appliedTurns = new AppliedTurnProjection(store);
    const first = {
      owner,
      subjectId: 1,
      structural: 'rekey' as const,
      path: 'rows.a',
      ownerPath: 'rows',
      before: 'a',
      after: 'b',
    };
    store.admitPending({
      id: 1,
      effects: [first, { ...first, before: 'b', after: 'c' }],
    });
    const selected: ReversalEffect[] = [
      { ...first, before: 'c', after: 'b' },
      { ...first, before: 'b', after: 'a' },
    ];
    let key = 'c',
      validations = 0,
      installations = 0;
    const result = rollbackPendingTurnAt({
      authority: root,
      turnId: 1,
      store,
      topology,
      realizationContext: createRealizationContextSource({
        store,
        appliedTurns,
      }),
      selectedCompensation: selected,
      port: {
        validateEffects(effects) {
          validations++;
          expect(effects).toEqual(selected);
          expect(key).toBe('c');
          return undefined;
        },
        applyAtomically(effects) {
          installations++;
          for (const effect of effects) {
            expect(key).toBe(effect.before);
            key = String(effect.after);
          }
        },
      },
    });
    expect(result).toEqual({ ok: true, turnId: 1 });
    expect(key).toBe('a');
    expect(validations).toBe(1);
    expect(installations).toBe(1);
    expect(store.hasPendingTurn(1)).toBe(false);
  });
});
