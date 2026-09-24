import { describe, expect, it } from 'vitest';
import { link, signalTree, type Link } from '../index';

const flush = async () => {
  for (let pass = 0; pass < 8; pass++) await Promise.resolve();
};

// A2-5's surviving laws: pending publication stops at relationship disposal,
// and a released owner no longer keeps application payloads alive. The endpoint
// deliberately retains no payload, so it cannot confound the GC measurement.
describe('Link lifetime: pending publication', () => {
  it('CONTROL: an armed write reaches a live endpoint', async () => {
    const tree = signalTree({ value: 0 });
    const sent: number[] = [];
    const connection = link(tree.$.value, {
      set: (value) => {
        sent.push(value);
      },
    });
    try {
      tree.$.value(1);
      await flush();
      await connection.settled();
      expect(sent).toEqual([1]);
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });

  it('disposal cancels an armed write before endpoint invocation', async () => {
    const tree = signalTree({ value: 0 });
    const sent: number[] = [];
    const connection = link(tree.$.value, {
      set: (value) => {
        sent.push(value);
      },
    });
    try {
      tree.$.value(1);
      connection.dispose();
      await flush();
      await connection.settled();
      expect(sent).toEqual([]);
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });
});

const pressure = async () => {
  const gc = (globalThis as { gc?: () => void }).gc;
  expect(typeof gc).toBe('function');
  for (let round = 0; round < 6; round++) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    for (let pass = 0; pass < 6; pass++) gc?.();
  }
};

async function probe(mode: 'none' | 'live' | 'disposed') {
  let tree: ReturnType<typeof signalTree<{ payload: Date | null }>> | null =
    signalTree({ payload: null as Date | null });
  const treeReference = new WeakRef(tree);
  let connection: Link | null =
    mode === 'none' ? null : link(tree.$.payload, { set: () => undefined });
  let payload: Date | null = new Date(1234);
  const reference = new WeakRef(payload);
  tree.$.payload(payload);
  payload = null;
  await flush();
  await connection?.settled();
  // Mutation anchor: bypassing disposal must retain the payload through Link's
  // notifier subscription even after all local strong references are dropped.
  if (mode === 'disposed') connection?.dispose();
  if (mode !== 'live') tree.destroy();
  tree = null;
  if (mode !== 'live') connection = null;
  return {
    reference,
    cleanup: () => {
      connection?.dispose();
      connection = null;
      treeReference.deref()?.destroy();
    },
  };
}

describe('Link lifetime: payload GC', () => {
  for (const mode of ['none', 'live', 'disposed'] as const) {
    it(`${mode}: payload ${
      mode === 'live' ? 'is retained by a live relationship' : 'is collectible'
    }`, async () => {
      const { reference, cleanup } = await probe(mode);
      try {
        await pressure();
        if (mode === 'live') expect(reference.deref()).toBeDefined();
        else expect(reference.deref()).toBeUndefined();
      } finally {
        cleanup();
      }
    });
  }
});
