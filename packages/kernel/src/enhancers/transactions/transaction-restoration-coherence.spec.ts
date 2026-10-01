import { describe, expect, it } from 'vitest';
import { signalTree } from '../../lib/signal-tree';
import { undoable } from '../../lib/undoable';
import { restorationReader } from '../../lib/internals/restoration-reader';
import { transactionLifecycleReader } from '../../lib/internals/transaction-lifecycle-view';
import { restoration } from '../restoration/restoration';
import { peekInternalTransactionRuntime, transactions } from './transactions';

// Promoted unchanged from the independent observation audit
// (/private/tmp/signaltree-observation-audit/observation-audit.spec.ts, 8/4).
// Restoration announces history from inside the engine lifecycle channel, so a
// tooling reader that reads the transaction reader there must see the same
// transition the restoration owner just acted on.
const make = () =>
  signalTree({ x: 0, y: 0 }, { enhancers: [transactions(), restoration()] });

describe('independent producer-boundary audit', () => {
  it('confirmed restoration history never exposes the same transaction as pending', () => {
    const tree = make();
    const tx = transactionLifecycleReader(tree)!;
    const rr = restorationReader(tree)!;
    const seen: unknown[] = [];
    rr.subscribe((event, snapshot) => {
      if (event.kind === 'history-changed' && snapshot.entries.length) {
        seen.push({
          entries: snapshot.entries,
          pending: tx.snapshot().pending,
        });
      }
    });
    try {
      tree.transaction(() => undoable(() => tree.$.x(1))).confirm();
      expect(seen).toHaveLength(1);
      expect((seen[0] as { pending: unknown[] }).pending).toEqual([]);
    } finally {
      tree.destroy();
    }
  });
  it('pending restoration announcement sees staged rather than opened phase after callback return', () => {
    const tree = make();
    const tx = transactionLifecycleReader(tree)!;
    const rr = restorationReader(tree)!;
    const seen: unknown[] = [];
    let callbackComplete = false;
    rr.subscribe((event, snapshot) => {
      if (event.kind === 'history-changed' && !snapshot.entries.length)
        seen.push({ callbackComplete, pending: tx.snapshot().pending });
    });
    try {
      const pending = tree.transaction(() => {
        undoable(() => tree.$.x(1));
        callbackComplete = true;
      });
      expect(seen).toHaveLength(1);
      expect(seen[0]).toMatchObject({
        callbackComplete: true,
        pending: [{ phase: 'staged' }],
      });
      pending.confirm();
    } finally {
      tree.destroy();
    }
  });
});

// Authority-level companions. Filtering the reader projection alone would pass
// the promoted cases while the settlement authority still disagreed.
describe.each([
  ['transactions, restoration', () => [transactions(), restoration()]],
  ['restoration, transactions', () => [restoration(), transactions()]],
] as const)('cross-reader coherence (%s)', (_order, enhancers) => {
  const build = () => signalTree({ x: 0, y: 0 }, { enhancers: enhancers() });

  it('restoration confirmation runs after the settlement authority confirmed', () => {
    const tree = build();
    const runtime = peekInternalTransactionRuntime(tree)!;
    const tx = transactionLifecycleReader(tree)!;
    const seen: unknown[] = [];
    restorationReader(tree)!.subscribe((event, snapshot) => {
      if (event.kind !== 'history-changed' || !snapshot.entries.length) return;
      const reading = tx.snapshot();
      seen.push({
        pendingTurns: runtime.getPendingTurnCount(),
        pending: reading.pending,
        sequence: reading.sequence,
        transactionIds: snapshot.entries.flatMap(
          (entry) => entry.transactionIds
        ),
      });
    });
    const events: { kind: string; sequence: number }[] = [];
    tx.subscribe(({ kind, sequence }) => events.push({ kind, sequence }));
    try {
      tree.transaction(() => undoable(() => tree.$.x(1))).confirm();
      const confirmed = events.find((event) => event.kind === 'confirmed')!;
      // The snapshot boundary names the confirmation it already reflects.
      expect(seen).toEqual([
        {
          pendingTurns: 0,
          pending: [],
          sequence: confirmed.sequence,
          transactionIds: [1],
        },
      ]);
      expect(events.map((event) => event.kind)).toEqual([
        'opened',
        'staged',
        'confirmed',
      ]);
    } finally {
      tree.destroy();
    }
  });

  it('restoration staging runs after the staged transition with its own sequence', () => {
    const tree = build();
    const runtime = peekInternalTransactionRuntime(tree)!;
    const tx = transactionLifecycleReader(tree)!;
    const seen: unknown[] = [];
    restorationReader(tree)!.subscribe((event, snapshot) => {
      if (event.kind !== 'history-changed' || snapshot.entries.length) return;
      const reading = tx.snapshot();
      seen.push({
        pendingTurns: runtime.getPendingTurnCount(),
        pending: reading.pending,
        sequence: reading.sequence,
      });
    });
    const events: { kind: string; sequence: number; phases: string[] }[] = [];
    tx.subscribe(({ kind, sequence, snapshot }) =>
      events.push({
        kind,
        sequence,
        phases: snapshot.pending.map((item) => item.phase),
      })
    );
    try {
      const pending = tree.transaction(() => undoable(() => tree.$.x(1)));
      const staged = events.find((event) => event.kind === 'staged')!;
      expect(seen).toEqual([
        {
          pendingTurns: 1,
          pending: [
            { transactionId: 1, phase: 'staged', consequencesReleased: false },
          ],
          sequence: staged.sequence,
        },
      ]);
      // One sequence names one state: 'opened' is not re-labelled staged.
      expect(events).toEqual([
        { kind: 'opened', sequence: 1, phases: ['opened'] },
        { kind: 'staged', sequence: 2, phases: ['staged'] },
      ]);
      pending.confirm();
    } finally {
      tree.destroy();
    }
  });

  it('restoration discard of a rolled-back turn sees the transaction retired', () => {
    const tree = build();
    const runtime = peekInternalTransactionRuntime(tree)!;
    const tx = transactionLifecycleReader(tree)!;
    const pending = tree.transaction(() => undoable(() => tree.$.x(1)));
    const seen: unknown[] = [];
    restorationReader(tree)!.subscribe(() => {
      seen.push({
        pendingTurns: runtime.getPendingTurnCount(),
        pending: tx.snapshot().pending,
      });
    });
    const events: string[] = [];
    tx.subscribe(({ kind }) => events.push(kind));
    try {
      pending.rollback();
      expect(tree.$.x()).toBe(0);
      for (const reading of seen)
        expect(reading).toEqual({ pendingTurns: 0, pending: [] });
      expect(events).toEqual(['rolled-back']);
      expect(tx.snapshot().pending).toEqual([]);
    } finally {
      tree.destroy();
    }
  });

  it('a reentrant transaction opened by a restoration callback is ordered after the transition it observed', () => {
    const tree = build();
    const tx = transactionLifecycleReader(tree)!;
    const events: { kind: string; id: number; sequence: number }[] = [];
    tx.subscribe(({ kind, transactionId, sequence }) =>
      events.push({ kind, id: transactionId, sequence })
    );
    let armed = true;
    restorationReader(tree)!.subscribe((event, snapshot) => {
      if (event.kind !== 'history-changed' || !snapshot.entries.length) return;
      if (!armed) return;
      armed = false;
      tree.transaction(() => tree.$.y(1)).confirm();
    });
    try {
      tree.transaction(() => undoable(() => tree.$.x(1))).confirm();
      expect(events).toEqual([
        { kind: 'opened', id: 1, sequence: 1 },
        { kind: 'staged', id: 1, sequence: 2 },
        { kind: 'confirmed', id: 1, sequence: 3 },
        { kind: 'opened', id: 2, sequence: 4 },
        { kind: 'staged', id: 2, sequence: 5 },
        { kind: 'confirmed', id: 2, sequence: 6 },
      ]);
      expect(tree.$.x()).toBe(1);
      expect(tree.$.y()).toBe(1);
      expect(tx.snapshot().pending).toEqual([]);
    } finally {
      tree.destroy();
    }
  });
});
