import { describe, expect, it } from 'vitest';
import { signalTree } from '../../lib/signal-tree';
import { observeWrites } from '../../internals';
import { transactions, peekInternalTransactionRuntime } from './transactions';
import { getTreeRealizationPort } from '../../lib/internals/causal-runtime/tree-realization-adapter';
import { getTransactionLifecycleChannel } from '../../lib/internals/causal-runtime/transaction-lifecycle';
import {
  transactionLifecycleReader,
  type TransactionLifecycleObservation,
} from '../../lib/internals/transaction-lifecycle-view';

// Carried from v15 012fd11d (v16 integration slice 6): `.transaction(` ->
// `.transact(`. Five expectations encode v15-only semantics that conflict with
// v16 destination contract 2 (recoverable refusal) and are adapted in place,
// each marked "v16 (slice 6, class b)":
//   - v16 has no `later-pending-dependency` refusal kind; later PENDING overlap
//     is reported by the owner as `later-confirmed-dependency` (slice-4 open
//     item 1). The reader reports the owner's kind; it never refines it.
//   - v16 keeps the commit scope open on a refusal until real settlement
//     (rollback-refusal-scope.spec.ts), so `consequencesReleased` is false.
//   - the donor's "automatic abort refusal" is, on v16, a failed contribution
//     superseded by a later write: it retires as rolled back with no refusal
//     (reentrant-order-v16-controls.spec.ts). The refused-and-retained case is
//     covered by transaction-lifecycle-view-v16-controls.spec.ts.
//   - a destroyed tree refuses settlement ("Cannot settle a destroyed tree").
const make = () => signalTree({ x: 0 }, { enhancers: [transactions()] });
describe('transaction lifecycle observation authority', () => {
  it('distinguishes unavailable from available empty without installing capability', () => {
    const bare = signalTree({ x: 0 });
    const tree = make();
    try {
      expect(transactionLifecycleReader(bare)).toBeUndefined();
      expect(peekInternalTransactionRuntime(bare)).toBeUndefined();
      expect(transactionLifecycleReader(tree)?.snapshot()).toMatchObject({
        sequence: 0,
        pending: [],
      });
    } finally {
      bare.destroy();
      tree.destroy();
    }
  });
  it('attaches during a callback and after staging, including an empty pending handle', () => {
    const tree = make();
    const events: TransactionLifecycleObservation[] = [];
    try {
      const pending = tree.transact(() => {
        const reader = transactionLifecycleReader(tree)!;
        expect(reader.snapshot().pending).toEqual([
          { transactionId: 1, phase: 'opened', consequencesReleased: false },
        ]);
        reader.subscribe((event) => events.push(event));
      });
      expect(
        transactionLifecycleReader(tree)!.snapshot().pending[0].phase
      ).toBe('staged');
      expect(events.map((event) => event.kind)).toEqual(['staged']);
      pending.confirm();
      expect(events.map((event) => event.kind)).toEqual([
        'staged',
        'confirmed',
      ]);
      expect(events.at(-1)!.snapshot.pending).toEqual([]);
      expect(transactionLifecycleReader(tree)!.snapshot().pending).toEqual([]);
    } finally {
      tree.destroy();
    }
  });
  it('emits confirmation after the causal authority has committed', () => {
    const tree = make();
    const counts: number[] = [];
    try {
      transactionLifecycleReader(tree)!.subscribe((event) => {
        if (event.kind === 'confirmed')
          counts.push(
            peekInternalTransactionRuntime(tree)!.getPendingTurnCount()
          );
      });
      tree.transact(() => tree.$.x(1)).confirm();
      expect(counts).toEqual([0]);
    } finally {
      tree.destroy();
    }
  });
  it('reports refused pending authority and held consequences then retry and confirmation', () => {
    const tree = make();
    const events: TransactionLifecycleObservation[] = [];
    try {
      const reader = transactionLifecycleReader(tree)!;
      reader.subscribe((event) => events.push(event));
      const older = tree.transact(() => tree.$.x(1));
      const later = tree.transact(() => tree.$.x(2));
      // v16 (slice 6, class b): v15 `later-pending-dependency` and released
      // consequences. v16's owner reports `later-confirmed-dependency` and
      // keeps the scope open while authority stays pending.
      expect(() => older.rollback()).toThrow(/later-confirmed-dependency/);
      expect(events.at(-1)).toMatchObject({
        kind: 'refused',
        reason: 'later-confirmed-dependency',
        pendingRetained: true,
        consequencesReleased: false,
      });
      expect(reader.snapshot().pending[0]).toMatchObject({
        transactionId: 1,
        consequencesReleased: false,
      });
      later.rollback();
      older.rollback();
      expect(tree.$.x()).toBe(0);
      const first = tree.transact(() => tree.$.x(3));
      const second = tree.transact(() => tree.$.x(4));
      expect(() => first.rollback()).toThrow();
      first.confirm();
      second.confirm();
      expect(reader.snapshot().pending).toEqual([]);
    } finally {
      tree.destroy();
    }
  });
  it('reports a superseded failed contribution as rolled back, without pending authority or raw callback errors', () => {
    const tree = make();
    const events: TransactionLifecycleObservation[] = [];
    let armed = true;
    const off = observeWrites((frame) => {
      if (armed && frame.path === 'x' && frame.after === 1) {
        armed = false;
        tree.$.x(2);
      }
    });
    try {
      transactionLifecycleReader(tree)!.subscribe((event) =>
        events.push(event)
      );
      expect(() =>
        tree.transact(() => {
          tree.$.x(1);
          throw new Error('private callback');
        })
      ).toThrow();
      // v16 (slice 6, class b): v15 refused, recorded the writes as committed
      // and reported 'refused' (pendingRetained false) then 'confirmed'. On v16
      // the later replacing write supersedes the failed contribution, which
      // retires with nothing to compensate (L3/L4; reentrant-order-v16-controls).
      expect(events.map((event) => event.kind)).toEqual([
        'opened',
        'rolled-back',
      ]);
      expect(events.at(-1)!.snapshot.pending).toEqual([]);
      expect(tree.$.x()).toBe(2);
      expect(JSON.stringify(events)).not.toContain('private callback');
    } finally {
      off();
      tree.destroy();
    }
  });
  it('reports successful automatic rollback without retaining terminal state', () => {
    const tree = make();
    const events: TransactionLifecycleObservation[] = [];
    try {
      transactionLifecycleReader(tree)!.subscribe((event) =>
        events.push(event)
      );
      expect(() =>
        tree.transact(() => {
          tree.$.x(1);
          throw undefined;
        })
      ).toThrow();
      expect(events.map((event) => event.kind)).toEqual([
        'opened',
        'rolled-back',
      ]);
      expect(events.at(-1)!.snapshot.pending).toEqual([]);
    } finally {
      tree.destroy();
    }
  });
  it('orders reentrant emissions for every subscriber and captures emission snapshots', () => {
    const tree = make();
    const seen: TransactionLifecycleObservation[] = [];
    let armed = true;
    try {
      const reader = transactionLifecycleReader(tree)!;
      reader.subscribe((event) => {
        if (event.kind === 'opened' && armed) {
          armed = false;
          tree.transact(() => undefined).confirm();
        }
      });
      reader.subscribe((event) => seen.push(event));
      tree.transact(() => undefined).confirm();
      expect(seen.map((event) => event.sequence)).toEqual([1, 2, 3, 4, 5, 6]);
      expect(
        seen[0].snapshot.pending.map((item) => item.transactionId)
      ).toEqual([1]);
      expect(
        seen[1].snapshot.pending.map((item) => item.transactionId)
      ).toEqual([1, 2]);
    } finally {
      tree.destroy();
    }
  });
  it('does not replay queued events to a new subscription during delivery', () => {
    const tree = make();
    const seen: number[] = [];
    let armed = true;
    try {
      const reader = transactionLifecycleReader(tree)!;
      reader.subscribe(() => {
        if (!armed) return;
        armed = false;
        tree.transact(() => undefined).confirm();
        reader.subscribe((event) => seen.push(event.sequence));
      });
      tree.transact(() => undefined).confirm();
      expect(seen).toEqual([5, 6]);
    } finally {
      tree.destroy();
    }
  });
  it('contains listener throws and detaches each snapshot and audience delivery', () => {
    const tree = make();
    const seen: TransactionLifecycleObservation[] = [];
    try {
      const reader = transactionLifecycleReader(tree)!;
      reader.subscribe((event) => {
        (event.snapshot.pending as unknown[]).length = 0;
        throw new Error('observer');
      });
      reader.subscribe((event) => seen.push(event));
      const pending = tree.transact(() => tree.$.x(1));
      const snapshot = reader.snapshot();
      (snapshot.pending as unknown[]).length = 0;
      expect(reader.snapshot().pending).toHaveLength(1);
      expect(seen[0].snapshot.pending).toHaveLength(1);
      pending.rollback();
      expect(tree.$.x()).toBe(0);
    } finally {
      tree.destroy();
    }
  });
  it('separates trees with identical IDs and retains no terminal history during churn', () => {
    const a = make();
    const b = make();
    try {
      const ra = transactionLifecycleReader(a)!;
      const rb = transactionLifecycleReader(b)!;
      const pa = a.transact(() => undefined);
      const pb = b.transact(() => undefined);
      expect(ra.snapshot().treeId).not.toBe(rb.snapshot().treeId);
      expect(ra.snapshot().pending[0].transactionId).toBe(
        rb.snapshot().pending[0].transactionId
      );
      pa.confirm();
      pb.rollback();
      for (let i = 0; i < 40; i++) a.transact(() => a.$.x(i)).confirm();
      expect(ra.snapshot().pending).toEqual([]);
      expect(peekInternalTransactionRuntime(a)!.getConfirmedTurnCount()).toBe(
        0
      );
      const seen: unknown[] = [];
      const stop = ra.subscribe((event) => seen.push(event));
      expect(seen).toEqual([]);
      stop();
      stop();
    } finally {
      a.destroy();
      b.destroy();
    }
  });
  it('keeps engine delivery synchronous while public delivery is queued', () => {
    const tree = make();
    let engineStaged = false;
    try {
      getTransactionLifecycleChannel(tree).subscribe((event) => {
        if (event.kind === 'staged') engineStaged = true;
      });
      transactionLifecycleReader(tree)!.subscribe((event) => {
        if (event.kind === 'staged') expect(engineStaged).toBe(true);
      });
      tree.transact(() => undefined).confirm();
      expect(engineStaged).toBe(true);
    } finally {
      tree.destroy();
    }
  });
  it('clears queued deliveries and subscriptions if destroyed during terminal delivery', () => {
    const tree = make();
    const reader = transactionLifecycleReader(tree)!;
    const seen: string[] = [];
    reader.subscribe((event) => {
      if (event.kind === 'confirmed') {
        tree.transact(() => undefined).confirm();
        tree.destroy();
      }
    });
    const stop = reader.subscribe((event) => seen.push(event.kind));
    tree.transact(() => undefined).confirm();
    expect(seen).toEqual(['opened', 'staged']);
    expect(() => reader.snapshot()).toThrow(/destroyed/);
    expect(() => reader.subscribe(() => undefined)).toThrow(/destroyed/);
    stop();
    stop();
    tree.destroy();
  });
});

it('keeps public opened observer writes before the original callback contribution', () => {
  const tree = make();
  let predecessor: ReturnType<typeof tree.transact> | undefined;
  let armed = true;
  try {
    transactionLifecycleReader(tree)!.subscribe((event) => {
      if (event.kind !== 'opened' || !armed) return;
      armed = false;
      predecessor = tree.transact(() => tree.$.x(2));
    });
    const later = tree.transact(() => tree.$.x(1));
    // v16 (slice 6, class b): the owner's kind for later pending overlap.
    expect(() => predecessor!.rollback()).toThrow(/later-confirmed-dependency/);
    expect(tree.$.x()).toBe(1);
    later.rollback();
    predecessor!.rollback();
    expect(tree.$.x()).toBe(0);
  } finally {
    tree.destroy();
  }
});

it('reports realization refusal with retained authority and permits confirmation', () => {
  const tree = make();
  const events: TransactionLifecycleObservation[] = [];
  const port = getTreeRealizationPort(tree.$)!;
  const validate = port.validateEffects;
  try {
    const reader = transactionLifecycleReader(tree)!;
    reader.subscribe((event) => events.push(event));
    const pending = tree.transact(() => tree.$.x(1));
    port.validateEffects = () => ({ kind: 'structural-drift' });
    expect(() => pending.rollback()).toThrow(/structural-drift/);
    // v16 (slice 6, class b): the scope stays open until real settlement, and
    // a validation refusal is the owner's `effect-validation-failed`.
    expect(events.at(-1)).toMatchObject({
      kind: 'refused',
      reason: 'effect-validation-failed',
      pendingRetained: true,
      consequencesReleased: false,
    });
    expect(reader.snapshot().pending).toHaveLength(1);
    pending.confirm();
    expect(events.at(-1)!.kind).toBe('confirmed');
    expect(reader.snapshot().pending).toEqual([]);
  } finally {
    port.validateEffects = validate;
    tree.destroy();
  }
});

it('does not deliver old queued events to a replacement subscription using the same function', () => {
  const tree = make();
  const seen: number[] = [];
  const listener = (event: TransactionLifecycleObservation) =>
    seen.push(event.sequence);
  let armed = true;
  let stop: () => void = () => undefined;
  try {
    const reader = transactionLifecycleReader(tree)!;
    reader.subscribe(() => {
      if (!armed) return;
      armed = false;
      tree.transact(() => undefined).confirm();
      stop();
      reader.subscribe(listener);
    });
    stop = reader.subscribe(listener);
    tree.transact(() => undefined).confirm();
    expect(seen).toEqual([5, 6]);
  } finally {
    tree.destroy();
  }
});

it('a pending handle cannot recreate the public feed after destruction', () => {
  const tree = make();
  const reader = transactionLifecycleReader(tree)!;
  const seen: TransactionLifecycleObservation[] = [];
  reader.subscribe((event) => seen.push(event));
  const pending = tree.transact(() => undefined);
  tree.destroy();
  const count = seen.length;
  // v16 (slice 6, class b): a destroyed tree refuses settlement outright.
  expect(() => pending.confirm()).toThrow(/destroyed/);
  expect(seen).toHaveLength(count);
  expect(() => reader.snapshot()).toThrow(/destroyed/);
  tree.destroy();
});

it('snapshots reflect materialization and confirmation before runtime observers run', () => {
  const tree = make();
  const runtime = peekInternalTransactionRuntime(tree)!;
  const reader = transactionLifecycleReader(tree)!;
  const snapshots: ReturnType<typeof reader.snapshot>[] = [];
  runtime.onPendingCreated(() => snapshots.push(reader.snapshot()));
  runtime.onPendingConfirmed(() => snapshots.push(reader.snapshot()));
  try {
    tree.transact(() => tree.$.x(1)).confirm();
    expect(snapshots[0].pending).toEqual([
      { transactionId: 1, phase: 'staged', consequencesReleased: false },
    ]);
    expect(snapshots[1].pending).toEqual([]);
  } finally {
    tree.destroy();
  }
});
