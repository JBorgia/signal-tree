import { expect, it } from 'vitest';
import { signalTree, transactions, link } from '../index';
// eslint-disable-next-line @nx/enforce-module-boundaries -- White-box regression exercises private kernel/realization coordination.
import { realizeAs as withWriteContext } from '../../../kernel/src/transaction-realization-contract';
const drain = async () => {
  for (let i = 0; i < 120; i++) await Promise.resolve();
};
it('scalar frame rejected branch adoption preserves ordinary payload (vue)', async () => {
  const tree = signalTree(
      { profile: { name: 'Ada', age: 42 } as { name: string; age?: number } },
      { enhancers: [transactions()] }
    ),
    sent: unknown[] = [];
  const c = link(tree.$.profile, {
    set: (v) => {
      sent.push(v);
    },
  });
  try {
    withWriteContext({ participation: 'inspection' }, () => {
      tree.$.profile.name.value = 'Inspected';
    });
    const p = tree.transact(() => tree.$.profile({ name: 'Inspected' }));
    await drain();
    expect(sent).toEqual([]);
    p.rollback();
    await drain();
    expect(tree.$.profile()).toEqual({ name: 'Ada', age: 42 });
    expect(sent.some((v) => JSON.stringify(v).includes('Inspected'))).toBe(
      false
    );
    tree.$.profile({ name: 'Grace', age: 43 });
    await drain();
    expect(sent.at(-1)).toEqual({ name: 'Grace', age: 43 });
  } finally {
    c.dispose();
    tree.destroy();
  }
});
it('same-turn scalar membership omission does not replay stale covered age (vue)', async () => {
  const tree = signalTree({
      profile: { name: 'Ada', age: 42 } as { name: string; age?: number },
    }),
    sent: unknown[] = [];
  const c = link(tree.$.profile, {
    set: (v) => {
      sent.push(v);
    },
  });
  try {
    tree.$.profile({ name: 'Ada' });
    tree.$.profile({ name: 'Ada', age: 8 });
    tree.$.profile({ name: 'Ada' });
    await drain();
    expect(tree.$.profile()).toEqual({ name: 'Ada' });
    expect(sent.at(-1)).toEqual({ name: 'Ada' });
  } finally {
    c.dispose();
    tree.destroy();
  }
});
