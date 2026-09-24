import { describe, expect, it, vi } from 'vitest';
import { entityMap, signalTree, transactions } from '../index';
import { link } from './link';
import { getPathNotifier } from './path-notifier';
import { withWriteContext } from './write-context';
import { getMutationCaptureRuntime } from './internals/mutation-capture-runtime';

const flush = async () => {
  getPathNotifier().flushSync();
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
const rows = [
  { id: 1, n: 'a' },
  { id: 2, n: 'b' },
  { id: 3, n: 'c' },
];
const inspection = {
  intent: 'system',
  origin: 'devtools',
  participation: 'inspection',
} as const;

describe('link collection order audit controls', () => {
  it('keeps added rows when reorder precedes the first notification flush', async () => {
    const tree = signalTree({
      rows: entityMap<(typeof rows)[number], number>(),
    });
    const send = vi.fn();
    const connection = link(tree.$.rows, { set: send });
    try {
      tree.$.rows.setAll(rows);
      tree.$.rows.setAll([rows[2], rows[0], rows[1]]);
      await flush();
      await connection.settled();
      expect(send.mock.calls.at(-1)).toEqual([[rows[2], rows[0], rows[1]]]);
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });

  it('does not publish an inspection reorder through a later row edit', async () => {
    const tree = signalTree({
      rows: entityMap<(typeof rows)[number], number>(),
    });
    tree.$.rows.setAll(rows);
    await flush();
    const send = vi.fn();
    const connection = link(tree.$.rows, { set: send });
    try {
      withWriteContext(inspection, () =>
        tree.$.rows.setAll([rows[2], rows[0], rows[1]])
      );
      await flush();
      expect(send).not.toHaveBeenCalled();
      tree.$.rows.updateOne(2, { n: 'edited' });
      await flush();
      await connection.settled();
      expect(send.mock.calls).toEqual([
        [[rows[0], { id: 2, n: 'edited' }, rows[2]]],
      ]);
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });

  it('holds reordered output behind a pending transaction', async () => {
    const tree = signalTree(
      { n: 0, rows: entityMap<(typeof rows)[number], number>() },
      { enhancers: [transactions()] }
    );
    tree.$.rows.setAll(rows);
    await flush();
    const send = vi.fn();
    const connection = link(tree.$.rows, { set: send });
    const pending = tree.transact(() => tree.$.n(1));
    try {
      tree.$.rows.setAll([rows[2], rows[0], rows[1]]);
      await flush();
      expect(send).not.toHaveBeenCalled();
      pending.confirm();
      await flush();
      await connection.settled();
      expect(send.mock.calls).toEqual([[[rows[2], rows[0], rows[1]]]]);
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });

  it('updates a nested collection projection through the internal branch path', async () => {
    const tree = signalTree({
      nested: { rows: entityMap<(typeof rows)[number], number>() },
    });
    tree.$.nested.rows.setAll(rows);
    await flush();
    const send = vi.fn();
    // Same internal branch admission as link-nested-collection.spec.ts.
    const connection = link(tree.$.nested as never, { set: send } as never);
    try {
      tree.$.nested.rows.setAll([rows[2], rows[0], rows[1]]);
      await flush();
      await connection.settled();
      expect(send.mock.calls).toEqual([
        [{ rows: { all: [rows[2], rows[0], rows[1]] } }],
      ]);
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });

  it('releases capture after disposal or subscribe failure, cancelling queued order output', async () => {
    const tree = signalTree({
      rows: entityMap<(typeof rows)[number], number>(),
    });
    tree.$.rows.setAll(rows);
    await flush();
    const runtime = getMutationCaptureRuntime(tree.$.rows);
    const send = vi.fn();
    const connection = link(tree.$.rows, { set: send });
    try {
      expect(runtime?.isCaptureActive()).toBe(true);
      tree.$.rows.setAll([rows[2], rows[0], rows[1]]);
      connection.dispose();
      expect(runtime?.isCaptureActive()).toBe(false);
      await flush();
      expect(send).not.toHaveBeenCalled();
      expect(() =>
        link(tree.$.rows, {
          set: send,
          subscribe: () => {
            throw new Error('subscribe');
          },
        })
      ).toThrow('subscribe');
      expect(runtime?.isCaptureActive()).toBe(false);
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });
  it('settled waits for an order-only asynchronous endpoint acknowledgement', async () => {
    const tree = signalTree({
      rows: entityMap<(typeof rows)[number], number>(),
    });
    tree.$.rows.setAll(rows);
    await flush();
    let acknowledge!: () => void;
    const acknowledgement = new Promise<void>((resolve) => {
      acknowledge = resolve;
    });
    const send = vi.fn(() => acknowledgement);
    const connection = link(tree.$.rows, { set: send });
    try {
      tree.$.rows.setAll([rows[2], rows[0], rows[1]]);
      const done = vi.fn();
      const settled = connection.settled().then(done);
      await flush();
      expect(send).toHaveBeenCalledOnce();
      expect(done).not.toHaveBeenCalled();
      acknowledge();
      await settled;
      expect(done).toHaveBeenCalledOnce();
    } finally {
      acknowledge();
      connection.dispose();
      tree.destroy();
    }
  });
});
