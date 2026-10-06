import { describe, expect, it, vi } from 'vitest';

import { observeWrites } from '../../internals';
import { hasOpenCommitScope } from '../../lib/internals/commit-consequence';
import { getTransactionLifecycleChannel } from '../../lib/internals/causal-runtime/transaction-lifecycle';
import { MUTATION_CAPTURE_RUNTIME } from '../../lib/internals/mutation-capture-runtime';
import {
  transactionLifecycleReader,
  type TransactionLifecycleObservation,
} from '../../lib/internals/transaction-lifecycle-view';
import { entityMap } from '../../lib/markers/entity-map';
import { getPathNotifier } from '../../lib/path-notifier';
import { signalTree } from '../../lib/signal-tree';
import { peekInternalTransactionRuntime, transactions } from './transactions';

/**
 * v16 controls for the lifecycle reader (v15 → v16 integration, slice 6).
 *
 * The carried v15 fixture cannot express v16's recoverable refusal (contract
 * 2): v15 records a refused automatic compensation as committed and retires
 * it. These pin what the reader must report on v16 instead — the transaction
 * the owner actually retained, its real phase and commit-scope state — and
 * that each transition is recorded where it happens, before the engine
 * announcement runs other owners' callbacks.
 */

type Recovery = {
  transaction: { confirm(): void; rollback(): void };
  callbackFailed: boolean;
};
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
const kinds = (events: readonly TransactionLifecycleObservation[]) =>
  events.map((event) => `${event.kind}:${event.transactionId}`);

describe('refused automatic compensation reports the retained transaction', () => {
  it('a throwing callback whose compensation is refused stays pending, opened and unreleased until recovery settles it', async () => {
    const tree = signalTree(
      { rows: entityMap<{ id: string; value: number }, string>() },
      { enhancers: [transactions()] }
    );
    tree.$.rows.addOne({ id: 'a', value: 0 });
    await flush();
    const reader = transactionLifecycleReader(tree)!;
    const events: TransactionLifecycleObservation[] = [];
    reader.subscribe((event) => events.push(event));
    let armed = true;
    const off = observeWrites((frame) => {
      if (!armed || !frame.path.startsWith('rows')) return;
      armed = false;
      tree.$.rows.updateOne('a', { value: 2 });
    });
    try {
      let thrown: unknown;
      try {
        tree.transact(() => {
          tree.$.rows.updateOne('a', { value: 1 });
          throw new Error('callback failed');
        });
      } catch (error) {
        thrown = error;
      }
      const recovery = (thrown as { recovery?: Recovery }).recovery;
      expect(recovery?.callbackFailed).toBe(true);
      expect(kinds(events)).toEqual(['opened:1', 'refused:1']);
      expect(events[1]).toMatchObject({
        reason: 'later-confirmed-dependency',
        pendingRetained: true,
        consequencesReleased: false,
      });
      // The callback threw, so the owner never staged it.
      const retained = [
        { transactionId: 1, phase: 'opened', consequencesReleased: false },
      ];
      expect(events[1].snapshot.pending).toEqual(retained);
      expect(reader.snapshot().pending).toEqual(retained);
      expect(peekInternalTransactionRuntime(tree)!.getPendingTurnCount()).toBe(
        1
      );
      expect(hasOpenCommitScope(tree as object)).toBe(true);

      recovery!.transaction.confirm();
      expect(kinds(events)).toEqual(['opened:1', 'refused:1', 'confirmed:1']);
      expect(reader.snapshot().pending).toEqual([]);
      expect(hasOpenCommitScope(tree as object)).toBe(false);
    } finally {
      off();
      tree.destroy();
    }
  });

  it('a post-callback failure whose compensation is refused stays pending and staged', () => {
    const tree = signalTree({ a: 0, b: 0 }, { enhancers: [transactions()] });
    const reader = transactionLifecycleReader(tree)!;
    const events: TransactionLifecycleObservation[] = [];
    reader.subscribe((event) => events.push(event));
    const host = tree as unknown as Record<symbol, unknown>;
    const previous = host[MUTATION_CAPTURE_RUNTIME];
    host[MUTATION_CAPTURE_RUNTIME] = {
      isCaptureActive: () => false,
      activateCapture: () => () => {
        throw new Error('capture release failed');
      },
    };
    const off = observeWrites((frame) => {
      if (frame.path === 'a' && tree.$.b() !== 10) tree.$.b(10);
    });
    let thrown: unknown;
    try {
      tree.transact(() => {
        tree.$.a(1);
        tree.$.b(1);
      });
    } catch (error) {
      thrown = error;
    } finally {
      host[MUTATION_CAPTURE_RUNTIME] = previous;
      off();
    }
    try {
      expect(String(thrown)).toContain('written again');
      expect(kinds(events)).toEqual(['opened:1', 'staged:1', 'refused:1']);
      expect(events[2]).toMatchObject({
        reason: 'effect-validation-failed',
        pendingRetained: true,
        consequencesReleased: false,
      });
      expect(reader.snapshot().pending).toEqual([
        { transactionId: 1, phase: 'staged', consequencesReleased: false },
      ]);
      (thrown as { recovery: Recovery }).recovery.transaction.confirm();
      expect(reader.snapshot().pending).toEqual([]);
      expect(events.at(-1)?.kind).toBe('confirmed');
    } finally {
      tree.destroy();
    }
  });

  it('an abandoned reservation leaves no phantom pending transaction, under a new sequence', () => {
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const reader = transactionLifecycleReader(tree)!;
    const events: TransactionLifecycleObservation[] = [];
    reader.subscribe((event) => events.push(event));
    const notifier = getPathNotifier();
    const flushSync = notifier.flushSync.bind(notifier);
    let armed = false;
    const failure = new Error('flush failed');
    const spy = vi.spyOn(notifier, 'flushSync').mockImplementation(() => {
      if (armed) {
        armed = false;
        throw failure;
      }
      flushSync();
    });
    try {
      expect(() =>
        tree.transact(() => {
          tree.$.x(1);
          armed = true;
        })
      ).toThrow(failure);
      expect(peekInternalTransactionRuntime(tree)!.getPendingTurnCount()).toBe(
        0
      );
      // 'staged' was recorded (and delivered) with the transaction pending;
      // it then leaves the snapshot under the next sequence, with no invented
      // terminal event (the engine announces none on this path).
      expect(kinds(events)).toEqual(['opened:1', 'staged:1']);
      expect(events[1].snapshot.pending).toHaveLength(1);
      expect(reader.snapshot()).toMatchObject({ sequence: 3, pending: [] });
    } finally {
      spy.mockRestore();
      tree.destroy();
    }
  });

  it('a throw before the reservation leaves no phantom pending transaction', () => {
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const reader = transactionLifecycleReader(tree)!;
    const notifier = getPathNotifier();
    const flushSync = notifier.flushSync.bind(notifier);
    let armed = false;
    const failure = new Error('drain failed');
    // Armed by the 'opened' announcement: the next flush is the drain of
    // 'opened'-listener writes, before the turn is reserved.
    const stop = getTransactionLifecycleChannel(tree).subscribe((event) => {
      if (event.kind === 'opened') armed = true;
    });
    const spy = vi.spyOn(notifier, 'flushSync').mockImplementation(() => {
      if (armed) {
        armed = false;
        throw failure;
      }
      flushSync();
    });
    try {
      expect(() => tree.transact(() => tree.$.x(1))).toThrow(failure);
      expect(tree.$.x()).toBe(0);
      expect(reader.snapshot()).toMatchObject({ sequence: 2, pending: [] });
    } finally {
      spy.mockRestore();
      stop();
      tree.destroy();
    }
  });
});

describe('a reader attached late', () => {
  it("reports the tree's transition count and current pending state, with no history", () => {
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    try {
      tree.transact(() => tree.$.x(1)).confirm();
      const pending = tree.transact(() => tree.$.x(2));
      // Five transitions happened before any reader existed.
      const reader = transactionLifecycleReader(tree)!;
      expect(reader.snapshot()).toMatchObject({
        sequence: 5,
        pending: [
          { transactionId: 2, phase: 'staged', consequencesReleased: false },
        ],
      });
      const events: TransactionLifecycleObservation[] = [];
      reader.subscribe((event) => events.push(event));
      expect(events).toEqual([]);
      pending.confirm();
      expect(events.map((event) => event.sequence)).toEqual([6]);
    } finally {
      tree.destroy();
    }
  });
});

describe('each transition is recorded before the engine announcement', () => {
  it('owners reading the reader inside their own announcement see that transition already recorded', () => {
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const reader = transactionLifecycleReader(tree)!;
    const seen: unknown[] = [];
    const stop = getTransactionLifecycleChannel(tree).subscribe((event) => {
      const { sequence, pending } = reader.snapshot();
      seen.push({ kind: event.kind, id: event.id, sequence, pending });
    });
    try {
      tree.transact(() => tree.$.x(1)).confirm();
      tree.transact(() => tree.$.x(2)).rollback();
      expect(seen).toEqual([
        {
          kind: 'opened',
          id: 1,
          sequence: 1,
          pending: [
            { transactionId: 1, phase: 'opened', consequencesReleased: false },
          ],
        },
        {
          kind: 'staged',
          id: 1,
          sequence: 2,
          pending: [
            { transactionId: 1, phase: 'staged', consequencesReleased: false },
          ],
        },
        { kind: 'confirmed', id: 1, sequence: 3, pending: [] },
        {
          kind: 'opened',
          id: 2,
          sequence: 4,
          pending: [
            { transactionId: 2, phase: 'opened', consequencesReleased: false },
          ],
        },
        {
          kind: 'staged',
          id: 2,
          sequence: 5,
          pending: [
            { transactionId: 2, phase: 'staged', consequencesReleased: false },
          ],
        },
        { kind: 'rolled-back', id: 2, sequence: 6, pending: [] },
      ]);
    } finally {
      stop();
      tree.destroy();
    }
  });

  it('a transaction an owner opens inside an announcement is sequenced after the transition that announced it', () => {
    const tree = signalTree({ x: 0, y: 0 }, { enhancers: [transactions()] });
    const reader = transactionLifecycleReader(tree)!;
    const events: TransactionLifecycleObservation[] = [];
    reader.subscribe((event) => events.push(event));
    let armed = true;
    const stop = getTransactionLifecycleChannel(tree).subscribe((event) => {
      if (event.kind !== 'opened' || !armed) return;
      armed = false;
      tree.transact(() => tree.$.y(1)).confirm();
    });
    try {
      tree.transact(() => tree.$.x(1)).confirm();
      expect(kinds(events)).toEqual([
        'opened:1',
        'opened:2',
        'staged:2',
        'confirmed:2',
        'staged:1',
        'confirmed:1',
      ]);
      expect(events.map((event) => event.sequence)).toEqual([1, 2, 3, 4, 5, 6]);
      expect(events[1].snapshot.pending.map((p) => p.transactionId)).toEqual([
        1, 2,
      ]);
    } finally {
      stop();
      tree.destroy();
    }
  });

  it('public delivery of staged follows the engine announcement and materialization', () => {
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const reader = transactionLifecycleReader(tree)!;
    const runtime = peekInternalTransactionRuntime(tree)!;
    let engineStaged = false;
    const atPublicStaged: unknown[] = [];
    const stop = getTransactionLifecycleChannel(tree).subscribe((event) => {
      if (event.kind === 'staged') engineStaged = true;
    });
    // Asserted outside the listener: reader listeners are isolated, so an
    // expectation thrown inside one could never fail this test.
    reader.subscribe((event) => {
      if (event.kind === 'staged')
        atPublicStaged.push({
          engineStaged,
          pendingTurns: runtime.getPendingTurnCount(),
        });
    });
    try {
      tree.transact(() => tree.$.x(1)).confirm();
      expect(atPublicStaged).toEqual([{ engineStaged: true, pendingTurns: 1 }]);
    } finally {
      stop();
      tree.destroy();
    }
  });

  it('public delivery of a confirmation follows its released consequences', () => {
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const reader = transactionLifecycleReader(tree)!;
    const scopeOpenAtDelivery: boolean[] = [];
    reader.subscribe((event) => {
      if (event.kind === 'confirmed' || event.kind === 'rolled-back')
        scopeOpenAtDelivery.push(hasOpenCommitScope(tree as object));
    });
    try {
      tree.transact(() => tree.$.x(1)).confirm();
      tree.transact(() => tree.$.x(2)).rollback();
      expect(scopeOpenAtDelivery).toEqual([false, false]);
    } finally {
      tree.destroy();
    }
  });
});
