import { expect, it } from 'vitest';
import { entityMap, link, signalTree, transactions } from '../index';
// Existing kernel test support, as used by transaction-realization.spec.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { realizeAs as withWriteContext } from '../../../kernel/src/transaction-realization-contract';

// Private experiment capability check; this does not add a facade/API export.
type DeclaredConnection = ReturnType<typeof link> & {
  declare(input: unknown, work: () => unknown): { read(): { state: string } };
};
function declared(connection: ReturnType<typeof link>): DeclaredConnection {
  if (typeof Reflect.get(connection, 'declare') !== 'function')
    throw new Error('Experimental declaration path is unavailable');
  return connection as DeclaredConnection;
}
const drain = async () => {
  for (let i = 0; i < 120; i++) await Promise.resolve();
};

it('declared scalar independence progresses while two owners remain open; dependency waits', async () => {
  const tree = signalTree(
    { x: 0, y: 0, z: 0, other: 0 },
    { enhancers: [transactions()] }
  );
  const sent: unknown[] = [],
    dependent: unknown[] = [];
  const c = declared(
    link(tree.$.y, {
      set: (value) => {
        sent.push(value);
      },
    })
  );
  const d = declared(
    link(tree.$.z, {
      set: (value) => {
        dependent.push(value);
      },
    })
  );
  try {
    const p = tree.transact(() => {
      tree.$.x.value = 7;
    });
    const q = tree.transact(() => {
      tree.$.other.value = 3;
    });
    const receipt = c.declare({ kind: 'independent' }, () => {
      tree.$.y.value = 8;
    });
    const held = d.declare({ kind: 'dependent', owners: [p] }, () => {
      tree.$.z.value = tree.$.x.value;
    });
    await drain();
    expect(sent).toEqual([8]);
    expect(dependent).toEqual([]);
    expect(receipt.read().state).toBe('started');
    expect(held.read().state).toBe('held');
    p.confirm();
    await drain();
    expect(dependent).toEqual([7]);
    expect(held.read().state).toBe('started');
    expect(tree.$.other.value).toBe(3);
    q.rollback();
    expect(tree.$.other.value).toBe(0);
  } finally {
    c.dispose();
    d.dispose();
    tree.destroy();
  }
});

it('declared entity inspection adoption publishes ordinary authority through the facade', async () => {
  const tree = signalTree(
    { x: 0, rows: entityMap<{ id: string; n: number }, string>() },
    { enhancers: [transactions()] }
  );
  tree.$.rows.addOne({ id: 'a', n: 7 });
  await drain();
  const a = tree.$.rows.byIdOrFail('a');
  const sent: unknown[] = [];
  const c = declared(
    link(a.n, {
      set: (value) => {
        sent.push(value);
      },
    })
  );
  try {
    const p = tree.transact(() => {
      tree.$.x.value = 7;
    });
    withWriteContext({ participation: 'inspection' }, () => {
      a.n.value = 99;
    });
    await drain();
    expect(a.n.value).toBe(99);
    expect(sent).toEqual([]);
    const receipt = c.declare({ kind: 'independent' }, () => {
      a.n.value = 99;
    });
    await drain();
    expect(sent).toEqual([99]);
    expect(receipt.read().state).toBe('started');
    p.rollback();
    await drain();
    expect(a.n.value).toBe(99);
    expect(sent).toEqual([99]);
  } finally {
    c.dispose();
    tree.destroy();
  }
});

// Terminal-obligation regression: native supplied input is confirmed before
// capture. An unrelated open transaction must not become a publication gate.
it('confirmed scalar input permits declared progress through the facade', async () => {
  const source = signalTree({ x: 0 }, { enhancers: [transactions()] });
  const target = signalTree({ x: 0 }, { enhancers: [transactions()] });
  const late = signalTree({ x: 0 }, { enhancers: [transactions()] });
  const sent: unknown[] = [];
  const c = declared(link(target.$.x, { set: value => { sent.push(value); } }));
  try {
    const p = source.transact(() => { source.$.x.value = 7; }); p.confirm(); await drain();
    const q = late.transact(() => { late.$.x.value = 9; }); const pendingQ = q.inspect();
    const receipt = c.declare({ kind: 'independent' }, () => {
      source.updateAndReport(input => { target.$.x.value = input.x + 1; return {}; });
    });
    await drain(); expect(sent).toEqual([8]); expect(receipt.read().state).toBe('started');
    expect(q.inspect()).toEqual(pendingQ); await c.settled();
  } finally { c.dispose(); target.destroy(); source.destroy(); late.destroy(); }
});
