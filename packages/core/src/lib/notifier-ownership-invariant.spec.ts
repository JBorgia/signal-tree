import { describe, expect, it } from 'vitest';

import { entityMap } from './types';
import { getOwnedPositionIds } from './internals/owned-metadata';
import { getPathNotifier } from './path-notifier';
import { restoration } from '../enhancers/restoration/restoration';
import { getPositionRegistry } from './internals/position-registry';
import { signalTree } from './signal-tree';

/**
 * THE NOTIFIER OWNERSHIP INVARIANT — permanent, and free of `transactions()`.
 *
 * > **Every notification that participates in a GLOBAL SignalTree mechanism —
 * > batching, coalescing, delivery, attribution or authority — names its owning
 * > tree, WHETHER OR NOT IT CARRIES A VALUE.**
 *
 * This is the third widening of the ownership invariant, and each was forced by
 * measurement rather than chosen:
 *
 * ```text
 * NOTIFIER-SCOPE-0    ordinary mutations name their tree
 * OWNER-REPLAY-2      every VALUE-CARRYING mutation does
 * OWNER-PING-0        every notification does, value-carrying or not
 * ```
 *
 * The last one came from REALIZATION-NAMESPACE-0, where a VALUE-LESS collection
 * ping changed causal state indirectly — it claimed a descriptor's derived
 * address before the structural event could.
 *
 * ⚠️ AND LOCAL POSITION IDS DELIBERATELY COLLIDE. Two trees of the same shape
 * give their collections the SAME local position number, and that is legal:
 * identity is `(registry, local position)`, never the local number alone.
 * Making position ids globally unique would make this test pass vacuously and
 * would have hidden every bug in this class. Collision is the falsifier.
 */

const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

type Row = { id: string; n: number };
const em = () => entityMap<Row, string>({ selectId: (r) => r.id });

/**
 * ⚠️ `restoration()` ONLY — and the reason is a measured finding, not a
 * preference. A tree with NO enhancers resolves no `PositionRegistry` and emits
 * NO notifications at all: position topology and mutation capture are
 * enabler-gated, so there is nothing for an ownership invariant to be about.
 *
 * So this is as close to "free of transactions and restoration" as the invariant
 * can be stated: no `transactions()`, and restoration present only because it is
 * what turns the notifier on.
 */
const make = () =>
  signalTree({ data: { rows: em() }, scalar: 0 }, { enhancers: [restoration()] });

describe('notifier ownership invariant', () => {
  it('two trees give their collections the SAME local position id', async () => {
    const a = make();
    const b = make();
    await flush();

    // The precondition the whole invariant exists for.
    expect(getOwnedPositionIds(a.$.data.rows)).toEqual(
      getOwnedPositionIds(b.$.data.rows)
    );
    expect(getPositionRegistry(a.$)).not.toBe(getPositionRegistry(b.$));
  });

  it('⚠️ alternating structural writes stay owner-distinguishable', async () => {
    const a = make();
    const b = make();
    await flush();
    const idA = getPositionRegistry(a.$)?.id;
    const idB = getPositionRegistry(b.$)?.id;

    const seen: Array<{ owner: unknown; path: string; valued: boolean }> = [];
    const off = getPathNotifier().subscribe(
      '**',
      (v, prev, path, _o, _origin, _s, _pos, meta) => {
        seen.push({
          owner: (meta as { ownerId?: number } | undefined)?.ownerId,
          path,
          valued: !(v === undefined && prev === undefined),
        });
      }
    );

    a.$.data.rows.addOne({ id: 'a1', n: 1 });
    await flush();
    b.$.data.rows.addOne({ id: 'b1', n: 1 });
    await flush();
    a.$.data.rows.addOne({ id: 'a2', n: 2 });
    await flush();
    b.$.data.rows.removeOne('b1');
    await flush();
    off();

    expect(seen.length).toBeGreaterThan(0);

    // ⚠️ THE INVARIANT. Not "the valued ones" — EVERY delivered notification.
    for (const s of seen) {
      expect(s.owner, `unowned notification at ${s.path}`).toBeDefined();
      expect([idA, idB]).toContain(s.owner);
    }

    // And both trees are represented, so the loop is not passing because one
    // tree produced nothing.
    const owners = new Set(seen.map((s) => s.owner));
    expect(owners).toEqual(new Set([idA, idB]));

    // Including the VALUE-LESS ones, which is the case OWNER-PING-0 fixed and
    // which every earlier version of this invariant excluded.
    const valueless = seen.filter((s) => !s.valued);
    expect(valueless.length).toBeGreaterThan(0);
    for (const s of valueless) {
      expect(s.owner).toBeDefined();
    }
  });

  it('a scalar write is owner-qualified too', async () => {
    const a = make();
    const b = make();
    await flush();
    const idA = getPositionRegistry(a.$)?.id;

    const owners: unknown[] = [];
    const off = getPathNotifier().subscribe(
      '**',
      (_v, _p, _path, _o, _origin, _s, _pos, meta) => {
        owners.push((meta as { ownerId?: number } | undefined)?.ownerId);
      }
    );
    a.$.scalar.set(1);
    await flush();
    off();
    void b;

    expect(owners.length).toBeGreaterThan(0);
    for (const o of owners) expect(o).toBe(idA);
  });
});
