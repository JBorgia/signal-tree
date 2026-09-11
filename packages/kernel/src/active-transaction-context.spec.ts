import { afterEach, describe, expect, it } from 'vitest';

import { activeTransactionContext, confirmedTurnReader } from './internals';
import { signalTree, transactions } from './index';
import { withWriteContext } from './lib/write-context';

const cleanups: (() => void)[] = [];
const createTree = () => {
  const tree = signalTree({ count: 0 }, { enhancers: [transactions()] });
  cleanups.push(() => tree.destroy());
  return tree;
};
afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

describe('activeTransactionContext', () => {
  it('identifies synchronous scope before any write and clears while pending', () => {
    const tree = createTree();
    expect(activeTransactionContext()).toBeUndefined();
    let observed: ReturnType<typeof activeTransactionContext>;
    const pending = tree.transaction(() => {
      observed = activeTransactionContext();
      expect(observed?.owner).toEqual(expect.any(Object));
      expect(observed?.id).toBe(1);
      tree.$.count(1);
      expect(activeTransactionContext()).toEqual(observed);
    });
    expect(activeTransactionContext()).toBeUndefined();
    expect(confirmedTurnReader(tree)!.readConfirmedTurns().turns).toHaveLength(0);
    pending.confirm();
    expect(activeTransactionContext()).toBeUndefined();
    expect(confirmedTurnReader(tree)!.readConfirmedTurns().turns[0].id).toBe(observed!.id);
  });

  it('reports no-op callback scope without requiring an effect', () => {
    const tree = createTree();
    const pending = tree.transaction(() => {
      expect(activeTransactionContext()?.id).toBe(1);
    });
    expect(activeTransactionContext()).toBeUndefined();
    pending.confirm();
    expect(activeTransactionContext()).toBeUndefined();
  });

  it('does not confuse two owners whose local transaction IDs match', () => {
    const a = createTree(), b = createTree();
    const scopes: NonNullable<ReturnType<typeof activeTransactionContext>>[] = [];
    for (const tree of [a, b, a]) {
      tree.transaction(() => scopes.push(activeTransactionContext()!)).confirm();
    }
    expect(scopes.map(scope => scope.id)).toEqual([1, 1, 2]);
    expect(scopes[0].owner).not.toBe(scopes[1].owner);
    expect(scopes[0].owner).toBe(scopes[2].owner);
  });

  it('reports ambient owner even when another tree is written', () => {
    const a = createTree(), b = createTree();
    let owner: object | undefined;
    a.transaction(() => { owner = activeTransactionContext()?.owner; }).confirm();
    a.transaction(() => {
      b.$.count(2);
      expect(activeTransactionContext()?.owner).toBe(owner);
    }).confirm();
    expect(b.$.count()).toBe(2);
    expect(activeTransactionContext()).toBeUndefined();
  });

  it('clears scope after a thrown callback and its compensation', () => {
    const tree = createTree();
    expect(() => tree.transaction(() => {
      expect(activeTransactionContext()?.id).toBe(1);
      tree.$.count(1);
      throw new Error('failed callback');
    })).toThrow('failed callback');
    expect(tree.$.count()).toBe(0);
    expect(activeTransactionContext()).toBeUndefined();
  });

  it('does not reopen callback scope during rollback', () => {
    const tree = createTree();
    const pending = tree.transaction(() => tree.$.count(1));
    const scopes: ReturnType<typeof activeTransactionContext>[] = [];
    const unsubscribe = tree.$.count.subscribe(() => scopes.push(activeTransactionContext()));
    pending.rollback();
    unsubscribe();
    expect(tree.$.count()).toBe(0);
    expect(scopes.length).toBeGreaterThan(0);
    expect(scopes.every(scope => scope === undefined)).toBe(true);
    expect(activeTransactionContext()).toBeUndefined();
  });

  it('does not carry ambient identity into async continuations', async () => {
    const tree = createTree();
    let continuation: Promise<void> | undefined;
    const pending = tree.transaction(() => {
      expect(activeTransactionContext()?.id).toBe(1);
      continuation = (async () => {
        await Promise.resolve();
        expect(activeTransactionContext()).toBeUndefined();
      })();
    });
    await continuation;
    expect(activeTransactionContext()).toBeUndefined();
    pending.confirm();
  });

  it.each([
    {}, { transactionId: 1 }, { transactionOwner: {} },
    { transactionOwner: null, transactionId: 1 },
    { transactionOwner: 'owner', transactionId: 1 },
    { transactionOwner: {}, transactionId: -1 },
    { transactionOwner: {}, transactionId: 0.5 },
    { transactionOwner: {}, transactionId: Number.NaN },
    { transactionOwner: {}, transactionId: Number.POSITIVE_INFINITY },
    { transactionOwner: {}, transactionId: Number.MAX_SAFE_INTEGER + 1 },
  ])('refuses incomplete or invalid context %j', context => {
    withWriteContext(context, () => expect(activeTransactionContext()).toBeUndefined());
  });

  it('projects only owner and safe nonnegative ID', () => {
    const owner = {};
    withWriteContext({ transactionOwner: owner, transactionId: 0 }, () => {
      const result = activeTransactionContext();
      expect(result).toEqual({ owner, id: 0 });
      expect(result?.owner).toBe(owner);
    });
  });
});
