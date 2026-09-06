import { describe, expect, it } from 'vitest';

import { entityMap } from './types';
import { getPathNotifier } from './path-notifier';
import { getPositionRegistry } from './internals/position-registry';
import { restoration } from '../enhancers/restoration/restoration';
import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';
import { undoable } from './undoable';
import { withWriteContext } from './write-context';

/**
 * OWNER-REPLAY-2 — closing the gap between the INVARIANT AS WRITTEN and the
 * INVARIANT AS VERIFIED.
 *
 * OWNER-REPLAY-1 claimed:
 *
 *     every mutation names its tree — authored, external, restoration,
 *     rollback, DevTools or structural replay alike
 *
 * but its permanent test exercised only authored, external, restoration and
 * rollback. ⚠️ The wording outran the evidence, and the inventory had already
 * flagged a separate direct DevTools path. This file measures the two that were
 * asserted without being shown.
 *
 * ## What it found
 *
 * ```text
 * structural AUTHORED (addOne/removeOne)   ownerId: undefined   ✗ FIXED HERE
 * structural REPLAY (restore/rollback)     ownerId: present     ✓ (REPLAY-1)
 * devtools inspection via write context    measured below
 * owner-only marker ping                   ownerId: undefined   ⚠️ RESIDUE
 * ```
 *
 * The structural defect was the same shape as OWNER-REPLAY-0 and worse in reach:
 * collections notify the path notifier DIRECTLY rather than through the
 * owned-write wrapper, so an authored `addOne` arrived unqualified while the
 * restoration and rollback replays of the SAME operation carried the namespace.
 * An owner-filtered observer was blind to every authored collection change.
 *
 * Fixed the same structural way — one `ambientMeta()` helper inside
 * `entity-signal.ts` that all NINE `getActiveWriteContext()` sites now route
 * through, so a new notification site cannot silently omit the namespace.
 */

const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

type Row = { id: string; n: number };

type Seen = {
  path: string;
  ownerId: unknown;
  origin: unknown;
  valued: boolean;
};

const record = () => {
  const seen: Seen[] = [];
  const off = getPathNotifier().subscribe(
    '**',
    (v, prev, path, _o, origin, _s, _pos, meta) => {
      const m = (meta ?? {}) as Record<string, unknown>;
      seen.push({
        path,
        ownerId: m['ownerId'],
        origin: origin ?? m['origin'],
        valued: !(v === undefined && prev === undefined),
      });
    }
  );
  return { seen, off };
};

/**
 * How this repo simulates a DevTools scrub — the same shape
 * `devtools-jump-0-1.spec.ts` uses, and the context `devTools()` establishes
 * before calling `applyState()`.
 */
const asDevtools = (fn: () => void) =>
  withWriteContext(
    { intent: 'system', origin: 'devtools', participation: 'inspection' },
    fn
  );

const collectionTree = () =>
  signalTree(
    { rows: entityMap<Row, string>({ selectId: (r) => r.id }), n: 0 },
    { enhancers: [restoration(), transactions()] }
  );

describe('OWNER-REPLAY-2: structural collection mutations', () => {
  it('⚠️ authored addOne now names its tree — it did not before', async () => {
    const tree = collectionTree();
    await flush();
    const owner = getPositionRegistry(tree.$)?.id;
    const { seen, off } = record();

    undoable(() => tree.$.rows.addOne({ id: 'a', n: 1 }));
    await flush();
    off();

    // Measured before the fix: `{ path: 'rows.a', ownerId: undefined }`.
    const add = seen.filter((s) => s.path === 'rows.a');
    expect(add.length).toBeGreaterThan(0);
    for (const s of add) expect(s.ownerId).toBe(owner);
  });

  it('authored and REPLAYED structural writes agree on the namespace', async () => {
    const tree = collectionTree();
    await flush();
    const owner = getPositionRegistry(tree.$)?.id;
    const { seen, off } = record();

    undoable(() => tree.$.rows.addOne({ id: 'a', n: 1 }));
    await flush();
    tree.undo(); // structural replay: a remove
    await flush();
    const p = tree.transaction(() => tree.$.rows.addOne({ id: 'c', n: 3 }));
    await flush();
    p.rollback(); // structural compensation
    await flush();
    off();

    // Every VALUE-CARRYING event, whatever produced it.
    const valued = seen.filter((s) => s.valued);
    expect(valued.length).toBeGreaterThanOrEqual(4);
    for (const s of valued) expect(s.ownerId).toBe(owner);

    const origins = valued.map((s) => s.origin);
    expect(origins).toContain('restoration');
    expect(origins).toContain('transaction-rollback');
  });

  it('two trees with the same collection path stay separate', async () => {
    const a = collectionTree();
    const b = collectionTree();
    await flush();
    const idA = getPositionRegistry(a.$)?.id;
    const idB = getPositionRegistry(b.$)?.id;
    const { seen, off } = record();

    undoable(() => a.$.rows.addOne({ id: 'x', n: 1 }));
    await flush();
    undoable(() => b.$.rows.addOne({ id: 'x', n: 2 }));
    await flush();
    off();

    const valued = seen.filter((s) => s.valued);
    expect(new Set(valued.map((s) => s.ownerId))).toEqual(new Set([idA, idB]));
  });
});

describe('OWNER-REPLAY-2: DevTools inspection', () => {
  it('an inspection write names its tree', async () => {
    const tree = collectionTree();
    await flush();
    const owner = getPositionRegistry(tree.$)?.id;
    const { seen, off } = record();

    asDevtools(() => tree.$.n(42));
    await flush();
    off();

    // An inspection travels the ORDINARY owned write path, so it inherits the
    // namespace from `emitOwnedMutation` rather than needing its own wrap.
    const hits = seen.filter((s) => s.path === 'n');
    expect(hits.length).toBeGreaterThan(0);
    for (const s of hits) expect(s.ownerId).toBe(owner);
    expect(tree.$.n()).toBe(42);
  });
});

/**
 * ## ⚠️ WHAT REMAINS UNVERIFIED — stated rather than assumed away
 *
 * ```text
 * 1  THE OWNER-ONLY MARKER PING
 *    A bare `{ path: 'rows' }` event accompanies each collection mutation with
 *    BOTH values undefined (`isOwnerOnlyMarkerSignal` in the notifier). It
 *    reaches delivery with no metaOverride at all, so it carries no namespace.
 *    It carries no VALUE either, so an observer learns nothing from it that the
 *    valued `rows.<id>` event does not already say — which is why the tests
 *    above assert over value-carrying events specifically rather than
 *    pretending the ping is covered.
 *
 * 2  `devtools-impl.ts:1817`
 *    `notifier.notify(path, next, prev, ownerPath)` — four arguments, NO meta,
 *    so it structurally cannot carry a namespace. It sits inside
 *    `interceptLeafSignals`, which A2-3.1 measured as REFUSED on any enhanced
 *    tree (leaves carry `__emitsMutations`), so it is likely unreachable for
 *    the trees this matters for. "Likely" is not "measured", and it is recorded
 *    as unverified rather than claimed.
 * ```
 *
 * So the invariant, narrowed to what is actually shown:
 *
 * > Every VALUE-CARRYING SignalTree mutation delivered through the notifier
 * > names its owning tree — authored, external, restoration, rollback,
 * > DevTools inspection and structural collection writes alike.
 */
