import {
  materializeMember,
  ordinaryBranch,
  registerMarkerProcessor,
} from './internals/materialize-markers';
import { getTransactionLifecycleChannel } from './internals/causal-runtime/transaction-lifecycle';
import { hasOpenCommitScope } from './internals/commit-consequence';
import { peekInternalTransactionRuntime } from '../enhancers/transactions/transactions';
import {
  createReactiveTestRealization,
  observeReactiveTestValue,
} from '../reactive-test-realization';
import { createSignalTreeFactory } from './signal-tree';
import { scheduleDurableConsequence } from './internals/commit-consequence';
import { describe, expect, it } from 'vitest';
import {
  signalTree,
  transactions,
  restoration,
  undoable,
  SignalTreeRollbackError,
} from '../index';
import { selectNativeOwnershipTransactions } from './internals/native-ownership-public-selection';
import { getNativeOwnershipPublicExperiment } from '../enhancers/transactions/native-ownership-public-experiment';
import { transactionLifecycleReader } from '../internals';
import { getPathNotifier } from './path-notifier';
const marker = Symbol('public-b-dynamic');
registerMarkerProcessor(
  (value: unknown): value is { [marker]: true } =>
    typeof value === 'object' && value !== null && marker in value,
  () => ordinaryBranch({ seed: 0 }, { keyedLookup: true })
);
const make = () =>
  signalTree(
    { x: 0, y: 0, box: { a: 1, b: 2 } as { a: number; b?: number } },
    {
      enhancers: [
        restoration(),
        selectNativeOwnershipTransactions(transactions()),
      ],
    }
  );
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
describe('selected native public transaction lifecycle', () => {
  it('selects one native authority and usefully settles overlapping public contributions', () => {
    const t = make();
    try {
      expect(getNativeOwnershipPublicExperiment(t)?.authority).toBe(
        'native-pending'
      );
      expect(peekInternalTransactionRuntime(t)).toBeUndefined();
      const p = t.transact(() => t.$.x(1));
      const q = t.transact(() => t.$.x(2));
      expect(p.inspect().changes).toEqual([
        { path: 'x', address: ['x'], subject: undefined, status: 'superseded' },
      ]);
      p.rollback();
      expect(t.$.x()).toBe(2);
      q.rollback();
      expect(t.$.x()).toBe(0);
      expect(getNativeOwnershipPublicExperiment(t)?.stats()).toEqual({
        pending: 0,
        ledgers: 0,
      });
    } finally {
      t.destroy();
    }
  });
  it('same terminal repeats are idempotent and cross terminal calls throw', () => {
    const t = make();
    try {
      const p = t.transact(() => t.$.x(1));
      p.confirm();
      p.confirm();
      expect(() => p.rollback()).toThrow();
      const q = t.transact(() => t.$.x(2));
      q.rollback();
      q.rollback();
      expect(() => q.confirm()).toThrow();
      expect(t.$.x()).toBe(1);
    } finally {
      t.destroy();
    }
  });
  it('inspection stays live after refusal and freezes before terminal settlement', () => {
    const t = make();
    try {
      const p = t.transact(() => t.$.x(1));
      getNativeOwnershipPublicExperiment(t)!.failPreparation(
        new Error('refuse')
      );
      expect(() => p.rollback()).toThrow(SignalTreeRollbackError);
      expect(p.inspect().changes[0].status).toBe('current');
      t.$.x(7);
      expect(p.inspect().changes[0].status).toBe('superseded');
      p.rollback();
      t.$.x(8);
      expect(p.inspect().changes[0].status).toBe('superseded');
      expect(t.$.x()).toBe(8);
    } finally {
      t.destroy();
    }
  });
  it.each([undefined, null, 0, 'callback', Object.freeze(new Error('frozen'))])(
    'successful abort rethrows callback value exactly %s',
    (original) => {
      const t = make();
      try {
        let caught: unknown;
        let thrown = false;
        try {
          t.transact(() => {
            t.$.x(1);
            throw original;
          });
        } catch (error) {
          thrown = true;
          caught = error;
        }
        expect(thrown).toBe(true);
        expect(caught).toBe(original);
        expect(t.$.x()).toBe(0);
      } finally {
        t.destroy();
      }
    }
  );
  it('failed abort exposes useful public recovery and immutable callback identity', () => {
    const t = make();
    const original = Object.freeze(new Error('callback'));
    try {
      let caught: unknown;
      try {
        t.transact(() => {
          t.$.x(1);
          getNativeOwnershipPublicExperiment(t)!.failPreparation('abort');
          throw original;
        });
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(SignalTreeRollbackError);
      const recovery = (caught as SignalTreeRollbackError).recovery!;
      expect(recovery.callbackError).toBe(original);
      expect(recovery.callbackFailed).toBe(true);
      expect(recovery.transaction.inspect().changes).toHaveLength(1);
      recovery.transaction.rollback();
      recovery.transaction.rollback();
      expect(() => recovery.transaction.confirm()).toThrow();
      expect(t.$.x()).toBe(0);
    } finally {
      t.destroy();
    }
  });
  it('nested transaction refusal aborts outer admitted writes', () => {
    const t = make();
    try {
      expect(() =>
        t.transact(() => {
          t.$.x(1);
          t.transact(() => t.$.y(2));
        })
      ).toThrow('Nested transaction');
      expect(t.$()).toMatchObject({ x: 0, y: 0 });
      expect(getNativeOwnershipPublicExperiment(t)?.stats().pending).toBe(0);
    } finally {
      t.destroy();
    }
  });
  it('member omission and public scalar settlement publish coherently', async () => {
    const t = make();
    const seen: unknown[] = [];
    const off = getPathNotifier().subscribe(
      '**',
      (_v, _p, _path, _owner, _origin, _s, _pos, meta) => {
        if (meta?.participation === 'realized')
          seen.push([
            t.$.x(),
            t.$.box(),
            transactionLifecycleReader(t)?.snapshot().pending.length,
          ]);
      }
    );
    try {
      const p = t.transact(() => {
        t.$.x(1);
        t.$.box({ a: 3 });
      });
      await flush();
      p.rollback();
      await flush();
      expect(seen.length).toBeGreaterThan(0);
      for (const x of seen) expect(x).toEqual([0, { a: 1, b: 2 }, 0]);
    } finally {
      off();
      t.destroy();
    }
  });
  it('inspection failure does not prevent useful settlement', () => {
    const t = make();
    try {
      const p = t.transact(() => t.$.x(1));
      getNativeOwnershipPublicExperiment(t)!.failInspection(
        new Error('inspection')
      );
      expect(() => p.inspect()).toThrow('inspection');
      p.rollback();
      expect(t.$.x()).toBe(0);
      expect(() => p.inspect()).toThrow('inspection');
    } finally {
      t.destroy();
    }
  });
  it('restoration undo followed by real pending write rolls back to native current truth', async () => {
    const t = make();
    try {
      t.$.x(1);
      await flush();
      undoable(() => t.$.x(2));
      await flush();
      t.undo();
      expect(t.$.x()).toBe(1);
      const p = t.transact(() => t.$.x(3));
      p.rollback();
      expect(t.$.x()).toBe(1);
    } finally {
      t.destroy();
    }
  });
  it('destruction retires pending authority and blocks retained handles', () => {
    const t = make();
    const p = t.transact(() => t.$.x(1));
    t.destroy();
    expect(getNativeOwnershipPublicExperiment(t)?.stats()).toEqual({
      pending: 0,
      ledgers: 0,
    });
    expect(() => p.rollback()).toThrow('destroyed');
    expect(() => p.confirm()).toThrow('destroyed');
  });
  it('terminal inspection is already frozen during synchronous native delivery', () => {
    const t = createSignalTreeFactory(createReactiveTestRealization())(
      { x: 0 },
      { enhancers: [selectNativeOwnershipTransactions(transactions())] }
    );
    const p = t.transact(() => t.$.x(1));
    const before = p.inspect();
    let seen: unknown;
    let armed = false;
    observeReactiveTestValue(
      () => t.$.x(),
      () => {
        if (armed) {
          armed = false;
          seen = p.inspect();
        }
      }
    );
    try {
      armed = true;
      p.rollback();
      expect(seen).toEqual(before);
      expect(p.inspect()).toEqual(before);
    } finally {
      t.destroy();
    }
  });
  it('commit scopes distinguish owned discard, held truth and cross-tree consequences', () => {
    const t = make(),
      other = make();
    const seen: string[] = [];
    const schedule = (claimant: unknown, key: string) =>
      scheduleDurableConsequence({ claimant, key, run: () => seen.push(key) });
    try {
      const p = t.transact(() => {
        t.$.x(1);
        schedule(t, 'discard');
        schedule(other, 'other');
      });
      const q = t.transact(() => {
        t.$.y(2);
        schedule(t, 'commit');
      });
      schedule(t, 'held');
      expect(seen).toEqual(['other']);
      p.rollback();
      expect(seen).toEqual(['other']);
      q.confirm();
      expect(seen).toEqual(['other', 'commit', 'held']);
    } finally {
      t.destroy();
      other.destroy();
    }
  });
  it('failed abort recovery may refuse repeatedly then confirm usefully', () => {
    const t = make();
    let caught: unknown;
    try {
      try {
        t.transact(() => {
          t.$.x(3);
          getNativeOwnershipPublicExperiment(t)!.failPreparation('abort');
          throw 7;
        });
      } catch (error) {
        caught = error;
      }
      const recovery = (caught as SignalTreeRollbackError).recovery!;
      getNativeOwnershipPublicExperiment(t)!.failPreparation('retry');
      expect(() => recovery.transaction.rollback()).toThrow(
        SignalTreeRollbackError
      );
      expect(t.$.x()).toBe(3);
      expect(recovery.transaction.inspect().changes).toHaveLength(1);
      recovery.transaction.confirm();
      expect(t.$.x()).toBe(3);
      expect(getNativeOwnershipPublicExperiment(t)!.stats().pending).toBe(0);
    } finally {
      t.destroy();
    }
  });
  it('engine lifecycle precedes public opened and staged delivery', () => {
    const t = make();
    const engine: string[] = [],
      seen: unknown[] = [];
    const off = getTransactionLifecycleChannel(t).subscribe((e) =>
      engine.push(e.kind)
    );
    const offReader = transactionLifecycleReader(t)!.subscribe((e) =>
      seen.push([e.kind, [...engine]])
    );
    try {
      const p = t.transact(() => {
        /* Deliberately inert test callback. */
      });
      expect(seen.slice(0, 2)).toEqual([
        ['opened', ['opened']],
        ['staged', ['opened', 'staged']],
      ]);
      p.rollback();
    } finally {
      off();
      offReader();
      t.destroy();
    }
  });
  it('opened observer destruction cannot strand a commit scope or execute callback', () => {
    const t = make();
    let called = false;
    transactionLifecycleReader(t)!.subscribe((e) => {
      if (e.kind === 'opened') t.destroy();
    });
    expect(() =>
      t.transact(() => {
        called = true;
      })
    ).toThrow();
    expect(called).toBe(false);
    expect(hasOpenCommitScope(t)).toBe(false);
  });
  it('destroy clears bounded confirmed diagnostic history', () => {
    const t = signalTree(
      { x: 0 },
      {
        enhancers: [
          selectNativeOwnershipTransactions(
            transactions({ history: { retain: 2 } })
          ),
        ],
      }
    );
    t.transact(() => t.$.x(1)).confirm();
    t.destroy();
    expect(
      (
        t as unknown as { __transactions: { getConfirmedTurnCount(): number } }
      ).__transactions.getConfirmedTurnCount()
    ).toBe(0);
  });
  it('preserves first terminal consequence failure when native delivery also throws', () => {
    const t = createSignalTreeFactory(createReactiveTestRealization())(
      { x: 0 },
      { enhancers: [selectNativeOwnershipTransactions(transactions())] }
    );
    const first = new Error('consequence'),
      second = new Error('native');
    let armed = false;
    observeReactiveTestValue(
      () => t.$.x(),
      () => {
        if (armed) throw second;
      }
    );
    try {
      const p = t.transact(() => t.$.x(1));
      scheduleDurableConsequence({
        claimant: t,
        key: 'held',
        run: () => {
          throw first;
        },
      });
      armed = true;
      let caught: unknown;
      try {
        p.rollback();
      } catch (e) {
        caught = e;
      }
      expect(caught).toBe(first);
      expect(t.$.x()).toBe(0);
      expect(getNativeOwnershipPublicExperiment(t)!.stats().pending).toBe(0);
      p.rollback();
    } finally {
      t.destroy();
    }
  });
  it('public callback captures supported dynamic creation before installation and retries', () => {
    const t = signalTree(
      { members: { [marker]: true as const } },
      { enhancers: [selectNativeOwnershipTransactions(transactions())] }
    );
    const members = t.$.members as unknown as () => Record<string, unknown>;
    void members();
    try {
      getNativeOwnershipPublicExperiment(t)!.failPreparation(
        new Error('creation')
      );
      expect(() =>
        t.transact(() => materializeMember(members, 'new', { x: 1 }))
      ).toThrow('creation');
      expect(Object.prototype.hasOwnProperty.call(members, 'new')).toBe(false);
      expect(getNativeOwnershipPublicExperiment(t)!.stats().pending).toBe(0);
      const p = t.transact(() => materializeMember(members, 'new', { x: 1 }));
      expect(members()).toMatchObject({ new: { x: 1 } });
      expect(p.inspect().changes.length).toBeGreaterThan(0);
      p.rollback();
      expect(Object.keys(members())).not.toContain('new');
    } finally {
      t.destroy();
    }
  });
  it('public abort preserves exact callback value after terminal native delivery error', () => {
    const t = createSignalTreeFactory(createReactiveTestRealization())(
      { x: 0 },
      { enhancers: [selectNativeOwnershipTransactions(transactions())] }
    );
    const original = Object.freeze({ callback: true });
    let armed = false;
    observeReactiveTestValue(
      () => t.$.x(),
      (v) => {
        if (armed && v === 0) throw new Error('delivery');
      }
    );
    try {
      let caught: unknown;
      try {
        t.transact(() => {
          t.$.x(1);
          armed = true;
          throw original;
        });
      } catch (error) {
        caught = error;
      }
      expect(caught).toBe(original);
      expect(t.$.x()).toBe(0);
      expect(getNativeOwnershipPublicExperiment(t)!.stats().pending).toBe(0);
    } finally {
      t.destroy();
    }
  });
  it('opened listener consequences remain ordinary before callback scope', () => {
    const t = make();
    const seen: string[] = [];
    transactionLifecycleReader(t)!.subscribe((e) => {
      if (e.kind === 'opened')
        scheduleDurableConsequence({
          claimant: t,
          key: 'opened',
          run: () => seen.push('opened'),
        });
    });
    try {
      const p = t.transact(() => {
        expect(seen).toEqual(['opened']);
        scheduleDurableConsequence({
          claimant: t,
          key: 'callback',
          run: () => seen.push('callback'),
        });
      });
      p.rollback();
      expect(seen).toEqual(['opened']);
    } finally {
      t.destroy();
    }
  });
  it.each([false, true])(
    'terminal native delivery can author a new public transaction (B=%s)',
    (selected) => {
      const enhancer = transactions();
      const t = createSignalTreeFactory(createReactiveTestRealization())(
        { x: 0, y: 0 },
        {
          enhancers: [
            selected ? selectNativeOwnershipTransactions(enhancer) : enhancer,
          ],
        }
      );
      let armed = false;
      let calls = 0;
      const errors: unknown[] = [];
      observeReactiveTestValue(
        () => t.$.x(),
        (value) => {
          if (armed && value === 0) {
            armed = false;
            calls++;
            try {
              const nested = t.transact(() => t.$.y(9));
              nested.confirm();
            } catch (error) {
              errors.push(error);
            }
          }
        }
      );
      try {
        const p = t.transact(() => t.$.x(1));
        armed = true;
        p.rollback();
        expect(calls).toBe(1);
        expect(errors).toEqual([]);
        expect(t.$.y()).toBe(9);
      } finally {
        t.destroy();
      }
    }
  );
  it.each([false, true])(
    'terminal durable consequence can author a new public transaction (B=%s)',
    (selected) => {
      const enhancer = transactions();
      const t = signalTree(
        { x: 0, y: 0 },
        {
          enhancers: [
            selected ? selectNativeOwnershipTransactions(enhancer) : enhancer,
          ],
        }
      );
      const errors: unknown[] = [];
      let calls = 0;
      try {
        const p = t.transact(() => {
          t.$.x(1);
          scheduleDurableConsequence({
            claimant: t,
            key: 'nested',
            run: () => {
              calls++;
              try {
                t.transact(() => t.$.y(9)).confirm();
              } catch (error) {
                errors.push(error);
              }
            },
          });
        });
        p.confirm();
        expect(calls).toBe(1);
        expect(errors).toEqual([]);
        expect(t.$.y()).toBe(9);
      } finally {
        t.destroy();
      }
    }
  );
  it('post-callback delivery failure exposes usable recovery without inventing callback failure', () => {
    const t = createSignalTreeFactory(createReactiveTestRealization())(
      { x: 0 },
      { enhancers: [selectNativeOwnershipTransactions(transactions())] }
    );
    const cleanup = new Error('post-callback delivery');
    let armed = true;
    observeReactiveTestValue(
      () => t.$.x(),
      (value) => {
        if (armed && value === 1) {
          armed = false;
          getNativeOwnershipPublicExperiment(t)!.failPreparation('abort');
          throw cleanup;
        }
      }
    );
    try {
      let failure: unknown;
      try {
        t.transact(() => t.$.x(1));
      } catch (e) {
        failure = e;
      }
      expect(failure).toBeInstanceOf(SignalTreeRollbackError);
      const recovery = (failure as SignalTreeRollbackError).recovery!;
      expect(recovery.callbackFailed).toBe(false);
      expect(recovery.callbackError).toBeUndefined();
      expect(recovery.transaction.inspect().changes.length).toBeGreaterThan(0);
      expect(t.$.x()).toBe(1);
      recovery.transaction.rollback();
      expect(t.$.x()).toBe(0);
      expect(getNativeOwnershipPublicExperiment(t)!.stats().pending).toBe(0);
    } finally {
      t.destroy();
    }
  });
  it.each([false, true])(
    'destruction during a callback cannot recreate pending lifecycle records (throw=%s)',
    (throws) => {
      const t = make();
      const original = Object.freeze({ destroyed: true });
      let failure: unknown;
      try {
        try {
          t.transact(() => {
            t.$.x(1);
            t.destroy();
            if (throws) throw original;
          });
        } catch (e) {
          failure = e;
        }
        expect(
          (
            t as unknown as {
              __transactions: { getPendingTurnCount(): number };
            }
          ).__transactions.getPendingTurnCount()
        ).toBe(0);
        expect(getNativeOwnershipPublicExperiment(t)!.stats()).toEqual({
          pending: 0,
          ledgers: 0,
        });
        if (throws) {
          expect(failure).toBeInstanceOf(Error);
          expect(String(failure)).toContain('Cannot settle a destroyed tree');
          expect((failure as SignalTreeRollbackError).recovery).toBeUndefined();
        }
      } finally {
        t.destroy();
      }
    }
  );
  it.each([false, true])(
    'incumbent destruction control clears pending records (throw=%s)',
    (throws) => {
      const t = signalTree({ x: 0 }, { enhancers: [transactions()] });
      const original = Object.freeze({ destroyed: true });
      let failure: unknown;
      try {
        try {
          t.transact(() => {
            t.$.x(1);
            t.destroy();
            if (throws) throw original;
          });
        } catch (e) {
          failure = e;
        }
        expect(
          (
            t as unknown as {
              __transactions: { getPendingTurnCount(): number };
            }
          ).__transactions.getPendingTurnCount()
        ).toBe(0);
        if (throws) {
          expect(failure).toBeInstanceOf(Error);
          expect(String(failure)).toContain('Cannot settle a destroyed tree');
          expect((failure as SignalTreeRollbackError).recovery).toBeUndefined();
        }
      } finally {
        t.destroy();
      }
    }
  );
});
