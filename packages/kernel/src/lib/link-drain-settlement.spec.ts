import { describe, expect, it } from 'vitest';
import { link, signalTree, transactions } from '../index';

const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

// Application endpoint policy: only values actually handed to set are drainable.
// This is not a new SignalTree drain API and never reads the tree to flush.
function fixture() {
  const tree = signalTree({ a: 'a0' }, { enhancers: [transactions()] });
  const payloads: Array<{ a: string }> = [];
  const queued: Array<() => void> = [];
  const connection = link(tree.$, {
    set: (value) =>
      new Promise<void>((resolve) => {
        queued.push(() => {
          payloads.push(value);
          resolve();
        });
      }),
  });
  return {
    tree,
    connection,
    payloads,
    drain: () => {
      for (const write of queued.splice(0)) write();
    },
    dispose: () => {
      connection.dispose();
      tree.destroy();
    },
  };
}

describe('A2-4.1 shared drain settlement law through public Link', () => {
  it('CONTROL: drains an ordinary admitted write', async () => {
    const f = fixture();
    try {
      f.tree.$.a('a1');
      await flush();
      expect(f.payloads).toEqual([]);
      f.drain();
      await f.connection.settled();
      expect(f.payloads.length).toBeGreaterThan(0);
      expect(f.payloads.at(-1)).toMatchObject({ a: 'a1' });
    } finally {
      f.dispose();
    }
  });
  it('a host drain cannot persist an unresolved or rolled-back value', async () => {
    const f = fixture();
    try {
      const pending = f.tree.transact(() => f.tree.$.a('doomed'));
      await flush();
      expect(f.payloads).toEqual([]);
      f.drain();
      expect(f.payloads).toEqual([]);
      pending.rollback();
      await flush();
      f.drain();
      await f.connection.settled();
      expect(f.tree.$.a()).toBe('a0');
      expect(f.payloads.every((p) => p.a !== 'doomed')).toBe(true);
    } finally {
      f.dispose();
    }
  });
});
