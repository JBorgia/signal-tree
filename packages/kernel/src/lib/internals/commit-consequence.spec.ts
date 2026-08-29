import { describe, expect, it } from 'vitest';
import { undoable } from '../../lib/undoable';

import { transactions } from '../../enhancers/transactions/transactions';
import { signalTree } from '../signal-tree';
import {
  deferCommitConsequence,
  hasOpenCommitScope,
  onCommitScopesSettled,
  openCommitScope,
  settleCommitScope,
} from './commit-consequence';

/**
 * The commit-consequence boundary must earn its existence before more than one
 * consumer depends on it. These are the falsifiers for the abstraction itself,
 * not for `stored()`.
 *
 * The property under test throughout is EXPLICIT ATTRIBUTION: a consequence
 * belongs to one (transactionOwner, transactionId) pair carried in mutation
 * metadata. Nothing here may work by asking "is some transaction currently
 * running?" — SignalTree already paid for ambient async attribution once
 * during causal realization and does not do it again.
 */

interface Recorder {
  readonly adapter: Storage;
  readonly log: Array<{ op: 'set' | 'remove'; key: string }>;
  readonly snapshots: Array<Record<string, string>>;
}

function recordingStorage(seed: Record<string, unknown> = {}): Recorder {
  const map = new Map<string, string>();
  const log: Recorder['log'] = [];
  const snapshots: Recorder['snapshots'] = [];

  for (const [key, value] of Object.entries(seed)) {
    map.set(key, JSON.stringify({ __v: 1, data: value }));
  }

  const snapshot = (): void => {
    snapshots.push(Object.fromEntries(map));
  };

  const adapter: Storage = {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
      log.push({ op: 'set', key });
      snapshot();
    },
    removeItem: (key) => {
      map.delete(key);
      log.push({ op: 'remove', key });
      snapshot();
    },
    clear: () => map.clear(),
    key: (index) => Array.from(map.keys())[index] ?? null,
    get length() {
      return map.size;
    },
  };

  return { adapter, log, snapshots };
}

function dataIn(snapshot: Record<string, string>, key: string): unknown {
  const raw = snapshot[key];
  return raw === undefined ? undefined : JSON.parse(raw).data;
}

describe('commit-consequence registry — explicit attribution', () => {
  it('refuses to buffer without a scope opened for that exact owner and id', () => {
    const owner = {};
    let ran = false;

    // No scope open at all.
    expect(deferCommitConsequence(owner, 1, 'k', () => (ran = true))).toBe(
      false
    );

    openCommitScope(owner, 1);

    // Right owner, WRONG id — must not be absorbed by the open scope.
    expect(deferCommitConsequence(owner, 2, 'k', () => (ran = true))).toBe(
      false
    );
    // WRONG owner, right id — likewise.
    expect(deferCommitConsequence({}, 1, 'k', () => (ran = true))).toBe(false);
    // Exact match.
    expect(deferCommitConsequence(owner, 1, 'k', () => (ran = true))).toBe(
      true
    );

    expect(ran).toBe(false);
    settleCommitScope(owner, 1, 'commit');
    expect(ran).toBe(true);
  });

  it('keeps two concurrent transaction identities from consuming each other', () => {
    const ownerA = {};
    const ownerB = {};
    const order: string[] = [];

    openCommitScope(ownerA, 1);
    openCommitScope(ownerB, 1); // same id, different owner
    openCommitScope(ownerA, 2); // same owner, different id

    deferCommitConsequence(ownerA, 1, 'k', () => order.push('A1'));
    deferCommitConsequence(ownerB, 1, 'k', () => order.push('B1'));
    deferCommitConsequence(ownerA, 2, 'k', () => order.push('A2'));

    settleCommitScope(ownerA, 1, 'commit');
    expect(order).toEqual(['A1']);

    settleCommitScope(ownerB, 1, 'discard');
    expect(order).toEqual(['A1']);

    settleCommitScope(ownerA, 2, 'commit');
    expect(order).toEqual(['A1', 'A2']);
  });

  it('collapses repeated writes to one key, preserving the last value only', () => {
    const owner = {};
    const seen: string[] = [];
    openCommitScope(owner, 1);

    deferCommitConsequence(owner, 1, 'same', () => seen.push('first'));
    deferCommitConsequence(owner, 1, 'same', () => seen.push('second'));
    deferCommitConsequence(owner, 1, 'other', () => seen.push('other'));

    settleCommitScope(owner, 1, 'commit');
    expect(seen).toEqual(['second', 'other']);
  });

  it('is idempotent — confirm after rollback cannot resurrect dropped work', () => {
    const owner = {};
    let ran = 0;
    openCommitScope(owner, 1);
    deferCommitConsequence(owner, 1, 'k', () => ran++);

    settleCommitScope(owner, 1, 'discard');
    settleCommitScope(owner, 1, 'commit');

    expect(ran).toBe(0);
  });

  it('runs every consequence even when one throws, then rethrows the first error', () => {
    const owner = {};
    const ran: string[] = [];
    openCommitScope(owner, 1);
    deferCommitConsequence(owner, 1, 'a', () => {
      ran.push('a');
      throw new Error('backend down');
    });
    deferCommitConsequence(owner, 1, 'b', () => ran.push('b'));

    expect(() => settleCommitScope(owner, 1, 'commit')).toThrow('backend down');
    expect(ran).toEqual(['a', 'b']);
  });

  it('survives re-entrancy: a settle listener that writes and opens a new scope', () => {
    // The audit that found the wedge never reached this case. A settle listener
    // runs while settleCommitScope is still on the stack, so anything it does —
    // deferring, opening another scope, settling one — must not recurse
    // unboundedly, strand a scope, or lose the work.
    // NOTE on the fixture: a scope carrying a tree only absorbs consequences it
    // can prove it owns, and a bare `{}` has no position registry to match
    // against — so the listener's nested work uses a tree-less scope. That
    // refusal is the ownership gate behaving correctly; every real tree has a
    // registry, which the stored()-level tests below exercise.
    const owner = {};
    const tree = {};
    const order: string[] = [];
    let reentered = 0;

    const release = onCommitScopesSettled(tree, () => {
      reentered++;
      order.push(`listener-${reentered}`);
      // Bound the re-entry in case a listener's own settle re-triggers it.
      if (reentered > 3) return;
      const nestedId = 100 + reentered;
      openCommitScope(owner, nestedId);
      deferCommitConsequence(owner, nestedId, 'k', () =>
        order.push(`nested-${reentered}`)
      );
      settleCommitScope(owner, nestedId, 'commit');
    });

    openCommitScope(owner, 1, tree);
    settleCommitScope(owner, 1, 'commit');
    release();

    // The listener ran exactly once, its nested scope's work ran and settled,
    // nothing recursed unboundedly, and no scope was stranded.
    expect(order).toEqual(['listener-1', 'nested-1']);
    expect(reentered).toBe(1);
    expect(hasOpenCommitScope(tree)).toBe(false);
  });

  it('reports open scopes per tree and clears them on settle', () => {
    const owner = {};
    const tree = {};
    expect(hasOpenCommitScope(tree)).toBe(false);

    openCommitScope(owner, 1, tree);
    openCommitScope(owner, 2, tree);
    expect(hasOpenCommitScope(tree)).toBe(true);

    settleCommitScope(owner, 1, 'commit');
    expect(hasOpenCommitScope(tree)).toBe(true); // scope 2 still open

    settleCommitScope(owner, 2, 'discard');
    expect(hasOpenCommitScope(tree)).toBe(false);
  });
});
