import { describe, expect, it } from 'vitest';

import { getPathNotifier } from './path-notifier';
import { link } from '../index';
import { restoration } from '../enhancers/restoration/restoration';
import { signalTree } from './signal-tree';

/**
 * A2-2 shared rehydration classification, migrated from the retired serializer.
 * The observer and authored-write control remain: public Link.retrieve() must
 * stamp external/realized authority. Historical enhancer and marker evidence
 * remains in git; this test makes no claim that those old APIs still ship.
 */

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

type Observed = { origin: unknown; participation: unknown; path: string };

const observe = () => {
  const seen: Observed[] = [];
  const off = getPathNotifier().subscribe(
    '**',
    (_n, _p, path, _owner, origin, _s, _pos, meta) => {
      const m = (meta ?? {}) as Record<string, unknown>;
      seen.push({
        path,
        origin: origin ?? m['origin'] ?? null,
        participation: m['participation'] ?? null,
      });
    }
  );
  return { seen, off };
};

const classifications = (seen: Observed[]) =>
  seen.map((f) => ({ origin: f.origin, participation: f.participation }));

/**
 * ⚠️ Distinct leaf paths per test, deliberately. The path notifier coalesces by
 * PATH STRING within a flush with no tree qualification (NOTIFIER-SCOPE-0), so
 * a shared name would let one tree's event mask another's and produce a zero
 * for the wrong reason.
 */
describe('A2-2: what does a TREE-SCOPED durable re-read claim causally?', () => {
  it('Link.retrieve() — the analogue of PER-B P2', async () => {
    const writer = signalTree({ alpha: 'durable' });
    const payload = JSON.stringify(writer.$());
    expect(payload).toBeDefined();
    const tree = signalTree(
      { alpha: 'initial' },
      { enhancers: [restoration()] }
    );
    const connection = link(tree.$, {
      get: () => JSON.parse(payload) as { alpha: string },
    });
    try {
      await flush();

      const { seen, off } = observe();
      await connection.retrieve();
      await flush();
      off();

      expect(tree.$.alpha()).toBe('durable');
      // Whatever it emits, it must emit SOMETHING — a silent rehydration would
      // make the classification question vacuous and this assertion is what stops
      // a zero being read as a pass.
      expect(seen.length).toBeGreaterThan(0);
      // ⚠️ DEFECT, FOUND HERE AND FIXED. Measured before the fix: exactly one
      // write, `{ origin: null, participation: null }` — AUTHORED. The tree-scoped
      // surface carried the marker's pre-PER-B-P2 defect, unfixed, which by P4's
      // reasoning means an enclosing transaction could roll a durable read back.
      expect(classifications(seen)).toEqual(
        seen.map(() => ({ origin: 'external', participation: 'realized' }))
      );
    } finally {
      connection.dispose();
      tree.destroy();
      writer.destroy();
    }
  });

  it('CONTROL — an ordinary authored write on the same tree stays AUTHORED', async () => {
    const tree = signalTree(
      { beta: 'initial' },
      { enhancers: [restoration()] }
    );
    const connection = link(tree.$, { get: () => ({ beta: 'external' }) });
    try {
      await flush();

      const { seen, off } = observe();
      tree.$.beta('by hand');
      await flush();
      off();

      // Without this arm, "load is external" could be produced by a tree that
      // classifies EVERY write as external.
      expect(classifications(seen)).toEqual([
        { origin: null, participation: null },
      ]);
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });
});

/**
 * ## Historical A2-2 result (retired enhancer; original evidence retained)
 *
 * ```text
 * persistence().load()   AUTHORED  ->  external / realized   DEFECT, FIXED
 * ordinary write         AUTHORED                            unchanged
 * stored().reload()      external / realized                 unchanged
 * ```
 *
 * The rule PER-B settled for the marker holds one level up, and the tree-scoped
 * surface did not implement it. That is the second defect A2-REOPEN has found in
 * `persistence()`'s neighbourhood after A2-3.1's drain finding, and both were
 * invisible while A2 was arguing about placement instead of measuring the
 * surface that already ships.
 */
