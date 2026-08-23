import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { timeTravel } from './time-travel';

/**
 * HIST-C2 derivation, first finding: `entityMap({ recordHistory: false })` is a
 * SHIPPED, PUBLIC, LOCATION-SCOPED history exclusion (RFC 0012) — it stamps
 * `HISTORY_EXCLUDED` on the collection node and `isHistoryExcludedCapture()`
 * drops those writes at capture time.
 *
 * That is HIST-B in miniature, and case 4 predicts what location scoping does to
 * an atomic causal turn: it filters PART of it. These cases test that prediction
 * against the shipped feature rather than against a prototype.
 */

type Row = { id: string; name: string };

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const makeTree = () =>
  signalTree(
    {
      document: { title: 'v1' },
      cache: entityMap<Row, string>({
        selectId: (r) => r.id,
        recordHistory: false,
      }),
    },
    { enhancers: [timeTravel({ maxHistorySize: 50 })] }
  );

describe('HIST-C2: recordHistory:false versus causal-turn atomicity', () => {
  it('control — an excluded collection alone creates no history entry', async () => {
    const tree = makeTree();
    await flush();
    const before = tree.getHistory().length;

    tree.$.cache.setAll([{ id: 'a', name: 'cached' }]);
    await flush();

    // The feature works as advertised in isolation.
    expect(tree.getHistory().length).toBe(before);
    expect(tree.$.cache.ids()).toEqual(['a']);
  });

  it('control — an ordinary leaf alone does create one', async () => {
    const tree = makeTree();
    await flush();
    const before = tree.getHistory().length;

    tree.$.document.title.set('edited');
    await flush();

    expect(tree.getHistory().length).toBe(before + 1);
  });

  it('THE COLLISION — both in ONE turn, then undo', async () => {
    const tree = makeTree();
    tree.$.cache.setAll([{ id: 'a', name: 'original' }]);
    await flush();
    const before = tree.getHistory().length;

    // One tick. Case 4 established this is ONE causal turn.
    tree.$.document.title.set('edited');
    tree.$.cache.updateOne('a', { name: 'changed' });
    await flush();

    expect(tree.getHistory().length).toBe(before + 1);
    expect(tree.$.document.title()).toBe('edited');
    expect(tree.$.cache.byId('a')?.()?.name).toBe('changed');

    tree.undo();
    await flush();

    // WHAT THIS MEASURES. The turn was atomic; the exclusion is per-location.
    // So undo reverses the document half and leaves the cache half standing:
    // an atomically authored operation is PARTIALLY reversed. That is exactly
    // the failure case 4 predicted for HIST-B, present in shipped public API.
    expect(tree.$.document.title()).toBe('v1');
    expect(tree.$.cache.byId('a')?.()?.name).toBe('changed');
  });

  it('and the turn still exists even when ONLY excluded state changed alongside', async () => {
    // The narrower worry: does an excluded write at least avoid *contributing*
    // to a turn it cannot be reversed from? It does — no entry above. The defect
    // is strictly the mixed case, which is the ordinary case in application code
    // (write a document field, refresh a cache, same handler).
    const tree = makeTree();
    tree.$.cache.setAll([{ id: 'a', name: 'original' }]);
    await flush();
    const before = tree.getHistory().length;

    tree.$.cache.updateOne('a', { name: 'x' });
    tree.$.cache.updateOne('a', { name: 'y' });
    await flush();

    expect(tree.getHistory().length).toBe(before);
  });
});
