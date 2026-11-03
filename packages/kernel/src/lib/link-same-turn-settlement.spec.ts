// Carried from v15 cf98697a (identical at 4ceb24a2, 012fd11d and d63166c9) in
// v16 integration slice 7. Only change: `.transaction(` -> `.transact(`. All
// three cases already passed on f23fe37e: v16's own in-flight repair (d2218eb0)
// re-checks chain identity after each drain and asks for permission per send.
// See link-reactive-settlement.spec.ts for the v16 controls of this class.
import { describe, expect, it } from 'vitest';

import { link } from './link';
import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';

const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('Link settlement includes work queued by the preceding write', () => {
  it('waits for a slow endpoint when called immediately after a bare write', async () => {
    const tree = signalTree({ value: 0 });
    const send = deferred();
    const received: number[] = [];
    const connection = link(tree.$.value, { set: async (value) => {
      received.push(value);
      await send.promise;
    } });
    let settled = false;
    try {
      tree.$.value(1);
      const done = connection.settled().then(() => { settled = true; });
      await nextTask();
      expect(received).toEqual([1]);
      expect(settled).toBe(false);
      send.resolve();
      await done;
      expect(settled).toBe(true);
    } finally { send.resolve(); connection.dispose(); tree.destroy(); }
  });

  it('waits through a pending transaction and its asynchronous endpoint', async () => {
    const tree = signalTree({ value: 0 }, { enhancers: [transactions()] });
    const send = deferred();
    const received: number[] = [];
    const connection = link(tree.$.value, { set: async (value) => {
      received.push(value);
      await send.promise;
    } });
    try {
      const pending = tree.transact(() => tree.$.value(1));
      let settled = false;
      const done = connection.settled().then(() => { settled = true; });
      await nextTask();
      expect(received).toEqual([]);
      expect(settled).toBe(false);
      pending.confirm();
      await nextTask();
      expect(received).toEqual([1]);
      expect(settled).toBe(false);
      send.resolve();
      await done;
    } finally { send.resolve(); connection.dispose(); tree.destroy(); }
  });

  it('drains a newer write arriving while an endpoint is in flight', async () => {
    const tree = signalTree({ value: 0 });
    const first = deferred();
    const second = deferred();
    const received: number[] = [];
    const connection = link(tree.$.value, { set: async (value) => {
      received.push(value);
      await (value === 1 ? first : second).promise;
    } });
    try {
      tree.$.value(1);
      let settled = false;
      const done = connection.settled().then(() => { settled = true; });
      await nextTask();
      tree.$.value(2);
      first.resolve();
      await nextTask();
      expect(received).toEqual([1, 2]);
      expect(settled).toBe(false);
      second.resolve();
      await done;
      expect(received).toEqual([1, 2]);
    } finally { first.resolve(); second.resolve(); connection.dispose(); tree.destroy(); }
  });
});
