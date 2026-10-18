import { createMemo, createRoot } from 'solid-js';
import { describe, expect, it } from 'vitest';

import { signalTree, transactions } from '../index';

const flush = async () => {
  for (let index = 0; index < 8; index++) await Promise.resolve();
};

it('publishes newly supplied ordinary keys through the solid facade', async () => {
  let dispose = () => undefined as void;
  const done = createRoot((release) => {
    dispose = release;
    return run();
  });
  try {
    await done;
  } finally {
    dispose();
  }
});

async function run() {
  const tree = signalTree(
    { rows: {} as Record<string, { n: number }> },
    { enhancers: [transactions()] }
  );
  const rows = tree.$.rows;
  const view = createMemo(() => [
    JSON.stringify(tree.$()),
    JSON.stringify(rows()),
  ]);
  try {
    expect(view()).toEqual(['{"rows":{}}', '{}']);
    const pending = tree.transact(() => {
      rows({ b: { n: 2 } });
      const held = rows['b']!;
      held.n.set(3);
    });
    const held = rows['b']!;
    await flush();
    // Native consumers are checked after delivery, not inside the group.
    expect(tree.$()).toEqual({ rows: { b: { n: 3 } } });
    expect(rows()).toEqual({ b: { n: 3 } });
    expect(held.n()).toBe(3);
    expect(view()).toEqual(['{"rows":{"b":{"n":3}}}', '{"b":{"n":3}}']);
    pending.rollback();
    await flush();
    expect(tree.$()).toEqual({ rows: {} });
    expect(rows()).toEqual({});
    expect(held()).toBeUndefined();
    expect(view()).toEqual(['{"rows":{}}', '{}']);
    const confirmed = tree.transact(() => rows({ b: { n: 4 } }));
    confirmed.confirm();
    await flush();
    expect(rows['b']).toBe(held);
    expect(held.n()).toBe(4);
    expect(view()).toEqual(['{"rows":{"b":{"n":4}}}', '{"b":{"n":4}}']);
  } finally {
    tree.destroy();
  }
}
