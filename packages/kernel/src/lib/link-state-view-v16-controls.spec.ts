import { describe, expect, it } from 'vitest';
import { link, signalTree, transactions } from '../index';
import {
  linkStateReader,
  type LinkStateEvent,
} from './internals/link-state-view';

/**
 * v16 controls for the Link reader (v15 → v16 integration, slice 6).
 *
 * v16's Link asks the settlement authority for permission per send
 * (`sendEligible`), not only per flush as v15 did. A send that is waiting for
 * that permission is held work, never idle, and must not be reported as
 * sending before the endpoint is actually called.
 */
const tick = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const idle = (view: LinkStateEvent['link']) =>
  !view.dirty &&
  !view.held &&
  !view.queued &&
  !view.sending &&
  !view.retrieving &&
  !view.disposed;

describe('Link activity under v16 per-send settlement', () => {
  it('a send held behind a transaction opened after its flush is held, not idle and not sending', async () => {
    const tree = signalTree({ x: 0, y: 0 }, { enhancers: [transactions()] });
    const reader = linkStateReader(tree);
    const sends: number[] = [];
    const connection = link(tree.$.x, {
      set: (value) => {
        sends.push(value);
      },
    });
    let pending: { confirm(): void } | undefined;
    const events: LinkStateEvent[] = [];
    reader.subscribe((event) => {
      events.push(event);
      // Open an unrelated transaction as soon as the reconciliation job is
      // queued: the job's send must then wait for that scope to settle.
      if (!pending && event.link.queued > 0)
        pending = tree.transact(() => tree.$.y(1));
    });
    try {
      tree.$.x(1);
      await tick();
      expect(pending).toBeDefined();
      expect(sends).toEqual([]);
      const waiting = reader.snapshot().links[0];
      expect(waiting).toMatchObject({ held: true, sending: false, queued: 0 });
      expect(idle(waiting)).toBe(false);
      // Nothing claimed I/O before the endpoint was called.
      expect(events.some((event) => event.link.sending)).toBe(false);
      pending!.confirm();
      await connection.settled();
      expect(sends).toEqual([1]);
      expect(events.some((event) => event.link.sending)).toBe(true);
      expect(idle(reader.snapshot().links[0])).toBe(true);
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });

  it('a disposed relationship starts no retrieval', async () => {
    const tree = signalTree({ x: 0 });
    let calls = 0;
    const connection = link(tree.$.x, {
      get: () => {
        calls++;
        return 1;
      },
    });
    try {
      connection.dispose();
      await connection.retrieve();
      expect(calls).toBe(0);
      expect(tree.$.x()).toBe(0);
      expect(linkStateReader(tree).snapshot().links).toEqual([]);
    } finally {
      tree.destroy();
    }
  });
});
