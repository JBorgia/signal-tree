import {
  hasOpenCommitScope,
  scheduleDurableConsequence,
} from '../../lib/internals/commit-consequence';
import { afterEach, describe, expect, it } from 'vitest';
import { signalTree } from '../../lib/signal-tree';
import { entityMap } from '../../lib/markers/entity-map';
import { external } from '../../lib/external';
import { getPathNotifier } from '../../lib/path-notifier';
import { transactions, peekInternalTransactionRuntime } from './transactions';
const trees: Array<{ destroy(): void }> = [];
const make = () => {
  const t = signalTree(
    {
      x: 0,
      y: 0,
      z: 0,
      rows: entityMap<{ id: string; v: number }, string>({
        selectId: (r) => r.id,
      }),
    },
    { enhancers: [transactions()] }
  );
  trees.push(t);
  return t;
};
const flush = () => getPathNotifier()?.flushSync();
afterEach(() => {
  for (const t of trees.splice(0)) t.destroy();
  flush();
});
describe('transaction settlement safety', () => {
  it('does not confuse a literal dotted entity field with a nested field', () => {
    const tree = signalTree(
      { rows: entityMap<{ id: string; 'a.b': number; a: { b: number } }>() },
      { enhancers: [transactions()] }
    );
    trees.push(tree);
    tree.$.rows.addOne({ id: 'key.with.dot', 'a.b': 0, a: { b: 0 } });
    flush();
    const p = tree.transact(() =>
      tree.$.rows.updateOne('key.with.dot', { 'a.b': 1 })
    );
    const q = tree.transact(() =>
      tree.$.rows.updateOne('key.with.dot', { a: { b: 2 } })
    );
    p.rollback();
    expect(tree.$.rows.byIdOrFail('key.with.dot')()).toMatchObject({
      'a.b': 0,
      a: { b: 2 },
    });
    q.rollback();
    expect(tree.$.rows.byIdOrFail('key.with.dot')()).toMatchObject({
      'a.b': 0,
      a: { b: 0 },
    });
  });

  it('failed structural rollback retains authority and can retry after conflict removal', () => {
    const t = make();
    t.$.rows.addOne({ id: 'A', v: 0 });
    flush();
    const p = t.transact(() => {
      t.$.x(1);
      t.$.rows.removeOne('A');
    });
    external(() => t.$.rows.addOne({ id: 'A', v: 2 }));
    flush();
    const r = peekInternalTransactionRuntime(t)!;
    const count = r.getConfirmedTurnCount();
    expect(() => p.rollback()).toThrow();
    expect(t.$.x()).toBe(1);
    expect(t.$.rows.byIdOrFail('A')().v).toBe(2);
    expect(r.getPendingTurnCount()).toBe(1);
    expect(r.getConfirmedTurnCount()).toBe(count);
    expect(() => p.rollback()).toThrow();
    expect(r.getPendingTurnCount()).toBe(1);
    external(() => t.$.rows.removeOne('A'));
    flush();
    p.rollback();
    expect(t.$.x()).toBe(0);
    expect(t.$.rows.byIdOrFail('A')().v).toBe(0);
    expect(r.getPendingTurnCount()).toBe(0);
  });
  it('older overlapping rollback refuses atomically; newer-first rollback remains possible', () => {
    const t = make();
    const p = t.transact(() => {
      t.$.x(1);
      t.$.y(1);
    });
    const q = t.transact(() => {
      t.$.y(2);
      t.$.z(2);
    });
    expect(() => p.rollback()).toThrow();
    expect([t.$.x(), t.$.y(), t.$.z()]).toEqual([1, 2, 2]);
    expect(peekInternalTransactionRuntime(t)?.getPendingTurnCount()).toBe(2);
    q.rollback();
    p.rollback();
    expect([t.$.x(), t.$.y(), t.$.z()]).toEqual([0, 0, 0]);
  });
  for (const externalWrite of [false, true])
    for (const aba of [false, true]) {
      it(`preserves same-tick ${externalWrite ? 'external' : 'ordinary'} write${
        aba ? ' with ABA' : ''
      }`, () => {
        const t = make();
        const p = t.transact(() => t.$.x(1));
        const write = () => {
          t.$.x(2);
          if (aba) t.$.x(1);
        };
        if (externalWrite) external(write);
        else write();
        let refused = false;
        try {
          p.rollback();
        } catch {
          refused = true;
        }
        expect(t.$.x()).toBe(aba ? 1 : 2);
        if (refused)
          expect(peekInternalTransactionRuntime(t)?.getPendingTurnCount()).toBe(
            1
          );
      });
    }
  it('rejecting older after newer confirmation preserves the newer fields', () => {
    const t = make();
    const p = t.transact(() => {
      t.$.x(1);
      t.$.y(1);
    });
    const q = t.transact(() => {
      t.$.y(2);
      t.$.z(2);
    });
    q.confirm();
    p.rollback();
    expect([t.$.x(), t.$.y(), t.$.z()]).toEqual([0, 2, 2]);
  });
  it('disjoint pending transactions settle independently', () => {
    const t = make();
    const p = t.transact(() => t.$.x(1));
    const q = t.transact(() => t.$.y(2));
    p.rollback();
    q.confirm();
    expect([t.$.x(), t.$.y()]).toEqual([0, 2]);
  });
  it('held handle cannot mutate destroyed tree', () => {
    const t = make();
    const p = t.transact(() => t.$.x(1));
    t.destroy();
    expect(() => p.rollback()).toThrow();
    expect(peekInternalTransactionRuntime(t)?.getPendingTurnCount()).toBe(0);
  });
  it('throw undefined is still a thrown callback', () => {
    const t = make();
    let caught = false;
    try {
      t.transact(() => {
        t.$.x(1);
        throw undefined;
      });
    } catch {
      caught = true;
    }
    expect(caught).toBe(true);
    expect(t.$.x()).toBe(0);
  });
});

describe('settlement evidence and terminal ownership', () => {
  it('reads queued ABA evidence without callbacks and retains it across retry and flush', () => {
    const t = make();
    const p = t.transact(() => t.$.x(1));
    const calls: string[] = [];
    const off = getPathNotifier().subscribe('**', () => {
      calls.push('delivered');
      t.$.z(9);
    });
    external(() => {
      t.$.x(2);
      t.$.x(1);
    });
    try {
      expect(() => p.rollback()).toThrow();
      expect(calls).toEqual([]);
      expect(t.$.z()).toBe(0);
      expect(() => p.rollback()).toThrow();
      expect(t.$.x()).toBe(1);
      flush();
      expect(() => p.rollback()).toThrow();
      expect(t.$.x()).toBe(1);
    } finally {
      off();
    }
  });
  it('queued evidence for an older pending does not become later evidence for a new pending', () => {
    const t = make();
    const first = t.transact(() => t.$.x(1));
    external(() => t.$.x(2));
    expect(() => first.rollback()).toThrow();
    expect(() => first.rollback()).toThrow();
    const second = t.transact(() => t.$.x(3));
    second.rollback();
    expect(t.$.x()).toBe(2);
  });
  it('does not confuse transaction ids with turn ids', () => {
    const t = make();
    t.$.y(1);
    flush();
    t.$.y(2);
    flush();
    const p = t.transact(() => t.$.x(1));
    const q = t.transact(() => t.$.x(2));
    expect(() => p.rollback()).toThrow();
    q.rollback();
    flush();
    p.rollback();
    expect(t.$.x()).toBe(0);
  });
  for (const queued of [false, true])
    it(`refused plan keeps scoped and tree-held durable work closed (${
      queued ? 'queued' : 'delivered'
    })`, () => {
      const t = make();
      const runs: string[] = [];
      const p = t.transact(() => {
        t.$.x(1);
        t.$.rows.addOne({ id: 'A', v: 0 });
        scheduleDurableConsequence({
          claimant: t,
          key: 'scope',
          run: () => runs.push('scope'),
        });
      });
      external(() => t.$.rows.updateOne('A', { v: 2 }));
      if (!queued) flush();
      scheduleDurableConsequence({
        claimant: t,
        key: 'held',
        run: () => runs.push('held'),
      });
      expect(() => p.rollback()).toThrow();
      expect(runs).toEqual([]);
      expect(hasOpenCommitScope(t)).toBe(true);
      expect(peekInternalTransactionRuntime(t)?.getPendingTurnCount()).toBe(1);
      t.destroy();
      expect(runs).toEqual([]);
      expect(hasOpenCommitScope(t)).toBe(false);
      expect(() => p.confirm()).toThrow();
      expect(() => t.transact(() => t.$.x(9))).toThrow();
    });
  it('observer throw after physical compensation retires the pending exactly once', () => {
    const t = make();
    const p = t.transact(() => {
      t.$.x(1);
      t.$.y(2);
    });
    const failure = new Error('observer');
    const notifier = getPathNotifier();
    notifier.setBatchingEnabled(false);
    const off = notifier.subscribe('**', (_n, _p, _path, _owner, origin) => {
      if (origin === 'transaction-rollback') throw failure;
    });
    try {
      expect(() => p.rollback()).toThrow(failure);
      expect([t.$.x(), t.$.y()]).toEqual([0, 0]);
      expect(peekInternalTransactionRuntime(t)?.getPendingTurnCount()).toBe(0);
      expect(hasOpenCommitScope(t)).toBe(false);
      expect(() => p.rollback()).not.toThrow();
      expect(() => p.confirm()).toThrow();
    } finally {
      off();
      notifier.setBatchingEnabled(true);
    }
  });
  it('synchronous notifier throw after a mixed installation is not a validation refusal', () => {
    const t = make();
    const p = t.transact(() => {
      t.$.x(1);
      t.$.rows.addOne({ id: 'A', v: 0 });
    });
    const failure = new Error('publication');
    const notifier = getPathNotifier();
    notifier.setBatchingEnabled(false);
    const off = notifier.subscribe('**', (_n, _p, _path, _owner, origin) => {
      if (origin === 'transaction-rollback') throw failure;
    });
    try {
      expect(() => p.rollback()).toThrow(failure);
      expect(t.$.x()).toBe(0);
      expect(t.$.rows.ids()).toEqual([]);
      expect(peekInternalTransactionRuntime(t)?.getPendingTurnCount()).toBe(0);
      expect(hasOpenCommitScope(t)).toBe(false);
      expect(() => p.rollback()).not.toThrow();
    } finally {
      off();
      notifier.setBatchingEnabled(true);
    }
  });
  it('callback refusal retains pending ownership and durable hold until terminal destruction', () => {
    const t = make();
    const runs: string[] = [];
    t.$.rows.addOne({ id: 'A', v: 0 });
    flush();
    expect(() =>
      t.transact(() => {
        t.$.x(1);
        t.$.rows.removeOne('A');
        external(() => t.$.rows.addOne({ id: 'A', v: 2 }));
        scheduleDurableConsequence({
          claimant: t,
          key: 'callback',
          run: () => runs.push('scope'),
        });
        throw undefined;
      })
    ).toThrow();
    expect(t.$.x()).toBe(1);
    expect(t.$.rows.byIdOrFail('A')().v).toBe(2);
    expect(peekInternalTransactionRuntime(t)?.getPendingTurnCount()).toBe(1);
    expect(hasOpenCommitScope(t)).toBe(true);
    expect(runs).toEqual([]);
    t.destroy();
    expect(runs).toEqual([]);
    expect(hasOpenCommitScope(t)).toBe(false);
  });
});

describe('callback failure cannot reverse other authority', () => {
  for (const batching of [true, false])
    it(`retains external ABA written inside a failed callback (batching=${batching})`, () => {
      const t = make();
      getPathNotifier().setBatchingEnabled(batching);
      try {
        expect(() =>
          t.transact(() => {
            t.$.x(1);
            external(() => {
              t.$.x(2);
              t.$.x(1);
            });
            throw new Error('callback');
          })
        ).toThrow();
        expect(t.$.x()).toBe(1);
        expect(peekInternalTransactionRuntime(t)?.getPendingTurnCount()).toBe(
          1
        );
        expect(hasOpenCommitScope(t)).toBe(true);
      } finally {
        getPathNotifier().setBatchingEnabled(true);
      }
    });
});

it('retains queued third-party evidence even when a later pending blocks the first attempt', () => {
  const t = make();
  const p = t.transact(() => {
    t.$.x(1);
    t.$.y(1);
  });
  const q = t.transact(() => t.$.x(2));
  external(() => {
    t.$.y(2);
    t.$.y(1);
  });
  expect(() => p.rollback()).toThrow();
  q.rollback();
  flush();
  expect(() => p.rollback()).toThrow();
  expect([t.$.x(), t.$.y()]).toEqual([1, 1]);
});

it('opening an unrelated pending cannot erase queued ABA evidence for an older one', () => {
  const t = make();
  const p = t.transact(() => t.$.x(1));
  external(() => {
    t.$.x(2);
    t.$.x(1);
  });
  const q = t.transact(() => t.$.y(2));
  expect(() => p.rollback()).toThrow();
  q.rollback();
  expect(t.$.x()).toBe(1);
});
