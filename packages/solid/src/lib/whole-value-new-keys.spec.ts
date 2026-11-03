import { createComputed, createMemo, createRoot } from 'solid-js';
import {  expect, it } from 'vitest';

import { signalTree, transactions } from '../index';

// Test-local shape: b is explicitly installed before either acquisition.
// This does not restore the public unchecked Record index promise.
type InstalledRow = { (): { n: number } | undefined; n: { (): number; set(value: number): void } };

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
      const held = rows['b'] as InstalledRow;
      held.n.set(3);
    });
    const held = rows['b'] as InstalledRow;
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

it.each([false, true])(
  'keeps failed transaction observations coherent (seeded=%s)',
  async (seeded) => {
    let dispose = () => undefined as void;
    const done = createRoot((release) => {
      dispose = release;
      return checkFailedTransaction(seeded);
    });
    try {
      await done;
    } finally {
      dispose();
    }
  }
);

async function checkFailedTransaction(seeded: boolean) {
  const initial: { trigger: { x: number }[]; fresh?: number } = {
    trigger: [{ x: 0 }],
  };
  if (seeded) initial.fresh = 0;
  const tree = signalTree(initial, { enhancers: [transactions()] });
  const failure = new Error('later equality failure');
  const seen: { snapshot: typeof initial; direct: number | undefined }[] = [];
  const read = () => {
    const snapshot = tree.$();
    const direct = tree.$.fresh?.();
    const frame = { snapshot, direct };
    seen.push(frame);
    return JSON.stringify(snapshot);
  };
  const view = createMemo(() => JSON.stringify(tree.$()));
  createComputed(read);
  const settle = flush;
  try {
    expect(view()).toBe(JSON.stringify(initial));
    expect(seen.length).toBeGreaterThan(0);
    const fail = () => {
      expect(() =>
        tree.transact(() =>
          tree.$({
            fresh: 123,
            trigger: [
              {
                get x(): number {
                  throw failure;
                },
              },
            ],
          })
        )
      ).toThrow(failure);
      expect(tree.$()).toEqual(initial);
      expect(Object.prototype.hasOwnProperty.call(tree.$(), 'fresh')).toBe(
        seeded
      );
    };
    fail();
    await settle();
    // Framework computed/render timing is only required after delivery.
    expect(view()).toBe(JSON.stringify(initial));
    const beforeControl = seen.length;
    tree.$({ trigger: [{ x: 1 }], fresh: 7 });
    await settle();
    expect(seen.length).toBeGreaterThan(beforeControl);
    expect(view()).toBe('{"trigger":[{"x":1}],"fresh":7}');
    for (const frame of seen) {
      expect(frame.snapshot.fresh).toBe(frame.direct);
      expect(
        Object.prototype.hasOwnProperty.call(frame.snapshot, 'fresh')
      ).toBe(frame.direct !== undefined);
    }
  } finally {
    tree.destroy();
  }
}
