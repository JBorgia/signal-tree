import { it, expect } from 'vitest';
import { entityMap, signalTree, transactions } from '../index';
import { getNativeOwnershipPublicExperiment } from '../enhancers/transactions/native-ownership-public-experiment';
import { selectNativeOwnershipTransactions } from './internals/native-ownership-public-selection';
const make = () =>
  signalTree(
    { rows: entityMap<{ id: string; n: number; extra?: number }, string>() },
    { enhancers: [selectNativeOwnershipTransactions(transactions())] }
  );
const controls = (tree: ReturnType<typeof make>) => {
  const value = getNativeOwnershipPublicExperiment(tree);
  if (!value) throw new Error('B authority unavailable');
  return value;
};
it('review hidden field rollback remains rolled back after row restoration', () => {
  const t = make();
  try {
    t.$.rows.addOne({ id: 'a', n: 0 });
    const field = t.transact(() => t.$.rows.updateOne('a', { n: 1 }));
    const removal = t.transact(() => t.$.rows.removeOne('a'));
    field.rollback();
    removal.rollback();
    expect(t.$.rows.byIdOrFail('a')()).toEqual({ id: 'a', n: 0 });
  } finally {
    t.destroy();
  }
});
it('review removed append anchor followed by later surviving append', () => {
  const t = make();
  try {
    t.$.rows.addMany(['a', 'b', 'c'].map((id) => ({ id, n: 0 })));
    const p = t.transact(() => {
      t.$.rows.addOne({ id: 'x', n: 0 });
      t.$.rows.removeOne('c');
    });
    t.$.rows.addOne({ id: 'd', n: 0 });
    p.rollback();
    expect(t.$.rows.ids()).toEqual(['a', 'b', 'c', 'd']);
  } finally {
    t.destroy();
  }
});

it('review confirmed field dependency on pending creation survives creation rejection', () => {
  const t = make();
  try {
    const creation = t.transact(() => t.$.rows.addOne({ id: 'a', n: 0 }));
    const field = t.transact(() => t.$.rows.updateOne('a', { extra: 9 }));
    field.confirm();
    expect(() => creation.rollback()).toThrow();
    expect(controls(t).stats().pending).toBe(1);
    expect(t.$.rows.byIdOrFail('a')()).toEqual({ id: 'a', n: 0, extra: 9 });
    creation.confirm();
    expect(t.$.rows.byIdOrFail('a')()).toEqual({ id: 'a', n: 0, extra: 9 });
    expect(controls(t).stats()).toEqual({ pending: 0, ledgers: 0 });
  } finally {
    t.destroy();
  }
});
it('review already absent pending successor resolves to surviving tail', () => {
  const t = make();
  try {
    t.$.rows.addMany(['a', 'b', 'c', 'd'].map((id) => ({ id, n: 0 })));
    const b = t.transact(() => t.$.rows.removeOne('b'));
    const c = t.transact(() => t.$.rows.removeOne('c'));
    b.rollback();
    expect(t.$.rows.ids()).toEqual(['a', 'b', 'd']);
    c.rollback();
    expect(t.$.rows.ids()).toEqual(['a', 'b', 'c', 'd']);
  } finally {
    t.destroy();
  }
});
it('review pending field remains after creation confirmation then retracts', () => {
  const t = make();
  try {
    const creation = t.transact(() => t.$.rows.addOne({ id: 'a', n: 0 }));
    const field = t.transact(() => t.$.rows.updateOne('a', { extra: 9 }));
    creation.confirm();
    expect(t.$.rows.byIdOrFail('a')()).toEqual({ id: 'a', n: 0, extra: 9 });
    field.rollback();
    expect(t.$.rows.byIdOrFail('a')()).toEqual({ id: 'a', n: 0 });
    expect(controls(t).stats()).toEqual({ pending: 0, ledgers: 0 });
  } finally {
    t.destroy();
  }
});
