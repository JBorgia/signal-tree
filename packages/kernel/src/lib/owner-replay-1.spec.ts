import { describe, expect, it } from 'vitest';

import { external } from './external';
import { getPathNotifier } from './path-notifier';
import { getPositionRegistry } from './internals/position-registry';
import { restoration } from '../enhancers/restoration/restoration';
import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';
import { undoable } from './undoable';

/**
 * OWNER-REPLAY-1 — completing the ownership invariant.
 *
 * The ownership correction taught the OWNED WRITE PATH to carry its registry
 * namespace, and stopped there. EGRESS-1 found the consequence: an undo reaches
 * the notifier with `origin: 'restoration'` and `ownerId: undefined`, so an
 * owner-filtered observer is blind to it and a `link()` built on one would leave
 * the endpoint holding the pre-undo value forever.
 *
 * The invariant is therefore promoted from
 *
 *     ordinary mutations name their owning tree
 *
 * to
 *
 *     ⚠️ EVERY SignalTree-owned mutation delivered through the notifier names
 *        its owning tree — authored, external, restoration, rollback, DevTools
 *        or structural replay alike.
 *
 * ## Why this is TWO edits and not twenty-four
 *
 * The 24 `notifier.notify(...)` sites were a red herring. Measured meta shapes:
 *
 * ```text
 * authored   { mutationIntent, ownerId }        via emitOwnedMutation  ✓
 * replay     { intent: 'system', participation, positionIds }          ✗
 * ```
 *
 * Replay metas are built by spreading `getActiveWriteContext()`, and each replay
 * already runs inside ONE `withWriteContext` wrap. Stamping the namespace there
 * reaches every downstream site — including the realization adapter's seven
 * `intent: 'system'` builders — and a NEW replay site inherits it without anyone
 * remembering to. That is what "structurally unavoidable" buys over an
 * enumeration.
 *
 * ## Mutation check
 *
 * ```text
 * drop restoration's ownerId   3 of 3 fail
 * drop rollback's ownerId      1 of 3 fails
 * ```
 */

const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

type Seen = { path: string; ownerId: unknown; origin: unknown };

const record = () => {
  const seen: Seen[] = [];
  const off = getPathNotifier().subscribe(
    '**',
    (_v, _p, path, _o, origin, _s, _pos, meta) => {
      const m = (meta ?? {}) as Record<string, unknown>;
      seen.push({ path, ownerId: m['ownerId'], origin: origin ?? m['origin'] });
    }
  );
  return { seen, off };
};

const makeTree = () =>
  signalTree({ n: 1 }, { enhancers: [restoration(), transactions()] });

describe('OWNER-REPLAY-1: every delivered mutation names its owner', () => {
  it('authored, external, restoration and rollback ALL carry the namespace', async () => {
    const tree = makeTree();
    await flush();
    const owner = getPositionRegistry(tree.$)?.id;
    expect(owner).toBeDefined();

    const { seen, off } = record();

    undoable(() => tree.$.n(2)); // authored
    await flush();
    tree.undo(); // restoration replay
    await flush();
    // ⚠️ AFTER the undo, deliberately. An external acquisition BETWEEN the
    // authored turn and its reversal makes the undo refuse with ST1034 — P0-C
    // protecting acquired truth, exactly as LINK-0 measured. Sequencing it here
    // keeps this test on ITS question, which is namespace propagation.
    external(() => tree.$.n(3));
    await flush();
    const p = tree.transaction(() => tree.$.n(9));
    await flush();
    p.rollback(); // rollback compensation
    await flush();
    off();

    // ⚠️ THE LOAD-BEARING ASSERTION. Measured before OWNER-REPLAY-1: the
    // restoration and rollback entries carried `ownerId: undefined`.
    expect(seen.length).toBeGreaterThanOrEqual(4);
    for (const s of seen) {
      expect(s.ownerId).toBe(owner);
    }

    // And the causes really were exercised — without this the loop above is
    // satisfied by a run in which no replay happened.
    const origins = seen.map((s) => s.origin);
    expect(origins).toContain('restoration');
    expect(origins).toContain('transaction-rollback');
    expect(origins).toContain('external');
  });

  it('two trees never borrow each other namespace, across every cause', async () => {
    const a = makeTree();
    const b = makeTree();
    await flush();
    const idA = getPositionRegistry(a.$)?.id;
    const idB = getPositionRegistry(b.$)?.id;
    expect(idA).not.toBe(idB);

    const { seen, off } = record();
    undoable(() => a.$.n(2));
    await flush();
    a.undo();
    await flush();
    undoable(() => b.$.n(5));
    await flush();
    b.undo();
    await flush();
    off();

    // Same path (`n`), same local positionId, two trees — the NOTIFIER-SCOPE-0
    // collision, now reached through the REPLAY path as well as the authored one.
    const owners = new Set(seen.map((s) => s.ownerId));
    expect(owners).toEqual(new Set([idA, idB]));
    expect(seen.filter((s) => s.ownerId === idA).length).toBeGreaterThanOrEqual(2);
    expect(seen.filter((s) => s.ownerId === idB).length).toBeGreaterThanOrEqual(2);
  });

  it('⚠️ an owner-filtered observer now SEES a restoration', async () => {
    const a = makeTree();
    const b = makeTree();
    await flush();
    const idA = getPositionRegistry(a.$)?.id;

    // The shape `link()` would use: a standing observer scoped to ONE tree.
    const forA: unknown[] = [];
    const off = getPathNotifier().subscribe(
      '**',
      (v, _p, _path, _o, _origin, _s, _pos, meta) => {
        if ((meta as { ownerId?: number } | undefined)?.ownerId !== idA) return;
        forA.push(v);
      }
    );

    undoable(() => a.$.n(2));
    await flush();
    undoable(() => b.$.n(99)); // tree B's noise must not appear
    await flush();
    a.undo();
    await flush();
    off();

    // Before OWNER-REPLAY-1 this was `[2]` — the observer saw the authored write
    // and was blind to the reversal, while the tree really returned to 1.
    expect(forA).toEqual([2, 1]);
    expect(a.$.n()).toBe(1);
  });
});
