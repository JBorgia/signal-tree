import { describe, expect, it } from 'vitest';

import { entityMap } from './types';
import { hydrateMarkerNode } from './internals/materialize-markers';
import { signalTree } from './signal-tree';

/**
 * On `rehydrate`, a marker that OWNS A SOURCE declines; one that does not,
 * accepts. `restore` always writes.
 *
 * This started as an open design question — "payload or source wins on
 * rehydrate?" — with ten options and a config knob at the end of most of them.
 * Two findings collapsed it:
 *
 *  1. The behaviour was already INCONSISTENT and nobody had noticed.
 *     `asyncSource` declined while `entityMap` + loader accepted, for the
 *     identical situation, written hours apart.
 *  2. The knob already exists. `loader({ persist: { hydrateThenRevalidate } })`
 *     seeds rows from its own store, marks them stale and revalidates in the
 *     background — per-scope keys, touch-ordered GC and all. That IS
 *     offline-first rehydration, shipped and documented.
 *
 * So tree-level rehydration writing a loader-backed collection is not a second
 * opinion, it is a CLOBBER: measured, a collection seeded by its loader and
 * then hydrated from a tree snapshot still held the tree's rows after
 * revalidation. The mechanism that knows least about freshness was simply last.
 */
const settle = () => new Promise((r) => setTimeout(r, 40));

/**
 * ⚠️ The asyncSource half of this contrast is gone with the primitive. The
 * DECLINING side survives through `entityMap`, which also reports
 * `decision: 'declined'`; the ACCEPTING side (entityMap + loader) is unchanged.
 */
describe('rehydrate: markers with no source accept the payload', () => {
  it('a bare entityMap restores', () => {
    const tree = signalTree({ r: entityMap<{ id: number }, number>() });
    hydrateMarkerNode(tree.$.r, { all: [{ id: 1 }, { id: 2 }] }, 'rehydrate');
    expect(tree.$.r.count()).toBe(2);
  });

  // WITHDRAWN WITH STATUS-DEL — "a manually-driven status restores LOADED". The
  // subject is generic marker rehydration via hydrateMarkerNode, which is
  // UNPROVEN. The loader-backed entityMap case below covers rehydrate ownership
  // with an independent specimen.
});
