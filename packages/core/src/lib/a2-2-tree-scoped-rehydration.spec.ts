import { describe, expect, it } from 'vitest';

import { getPathNotifier } from './path-notifier';
import { persistence } from '../enhancers/serialization/serialization';
import { restoration } from '../enhancers/restoration/restoration';
import { signalTree } from './signal-tree';

import type { StorageAdapter } from '../enhancers/serialization/storage-adapters';

/**
 * A2-2 — WRITE-THROUGH AND REHYDRATION CLASSIFICATION, on the TREE-SCOPED
 * surface rather than on the marker.
 *
 * PER-B P2 settled what a durable re-read means causally:
 *
 * > `reload()` is a REALIZATION of external truth — `origin: 'external'`,
 * > `participation: 'realized'` — not authored work. Measured BEFORE that fix it
 * > reported `{ origin: null, participation: null }`, i.e. AUTHORED, and P4
 * > showed the consequence: an authored reload contributed to a transaction and
 * > was rolled back with it.
 *
 * A2-3.1 established that the surviving placement is the tree-scoped enhancer,
 * and that `persistence()` already ships. So the question A2-2 must ask is
 * whether the SAME rule holds one level up: `persistence().load()` is the
 * tree-scoped analogue of `stored().reload()` — durable truth read back into a
 * live tree, after construction, on the causal path.
 *
 * The observer is PER-B's, verbatim, so the two results are directly comparable.
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

const fakeStorage = (seed: Record<string, string> = {}) => {
  const map = new Map<string, string>(Object.entries(seed));
  const adapter: StorageAdapter = {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
  return { map, adapter };
};

/**
 * ⚠️ Distinct leaf paths per test, deliberately. The path notifier coalesces by
 * PATH STRING within a flush with no tree qualification (NOTIFIER-SCOPE-0), so
 * a shared name would let one tree's event mask another's and produce a zero
 * for the wrong reason.
 */
describe('A2-2: what does a TREE-SCOPED durable re-read claim causally?', () => {
  it('persistence().load() — the analogue of PER-B P2', async () => {
    const { adapter, map } = fakeStorage();

    // Produce the payload with the enhancer's OWN serializer rather than
    // hand-writing an envelope shape — a guessed shape would make `load()` a
    // no-op and the classification question vacuous.
    const writer = signalTree(
      { alpha: 'durable' },
      {
        enhancers: [
          persistence({
            key: 'a2-2-load',
            storage: adapter,
            autoSave: false,
            autoLoad: false,
          }),
        ],
      }
    ) as unknown as { save(): Promise<void> };
    await writer.save();
    expect(map.get('a2-2-load')).toBeDefined();

    const tree = signalTree(
      { alpha: 'initial' },
      {
        enhancers: [
          restoration(),
          persistence({
            key: 'a2-2-load',
            storage: adapter,
            autoSave: false,
            autoLoad: false,
          }),
        ],
      }
    ) as unknown as {
      $: { alpha: { (): string; set(v: string): void } };
      load(): Promise<void>;
    };
    await flush();

    const { seen, off } = observe();
    await tree.load();
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
  });

  it('CONTROL — an ordinary authored write on the same tree stays AUTHORED', async () => {
    const { adapter } = fakeStorage();
    const tree = signalTree(
      { beta: 'initial' },
      {
        enhancers: [
          restoration(),
          persistence({
            key: 'a2-2-authored',
            storage: adapter,
            autoSave: false,
            autoLoad: false,
          }),
        ],
      }
    ) as unknown as { $: { beta: { (): string; set(v: string): void } } };
    await flush();

    const { seen, off } = observe();
    tree.$.beta.set('by hand');
    await flush();
    off();

    // Without this arm, "load is external" could be produced by a tree that
    // classifies EVERY write as external.
    expect(classifications(seen)).toEqual([
      { origin: null, participation: null },
    ]);
  });

});

/**
 * ## A2-2 RESULT
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
