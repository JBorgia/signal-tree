import { afterEach, describe, expect, it, vi } from 'vitest';

import { entityMap } from './types';
import {
  hydrateMarkerNode,
  onHydrateDecision,
  type HydrateDecisionEvent,
} from './internals/materialize-markers';
import { signalTree } from './signal-tree';

/**
 * §5.5 — `hydrate` now makes real decisions, so it has to be possible to SEE
 * them.
 *
 * Two are silent by nature and neither existed before 14.0.0:
 *
 *   - a loader-backed marker DECLINES a `rehydrate` payload, because its own
 *     loader is the authority on that data;
 *   - `status()` NORMALISES `LOADING` to `NotLoaded`, because no request
 *     survives a process boundary.
 *
 * Both are correct, which is exactly why they must not be warnings. Warning on
 * correct behaviour trains people to ignore the channel — and an ignored
 * channel is how the four bugs behind this release stayed invisible for so
 * long. This is an observation seam, the same shape as `getPathNotifier`.
 *
 * Worth stating why this shipped WITH the rule rather than after it: every
 * other silence 14.0.0 fixed was inherited. The loader-declines rule is silence
 * this release INTRODUCES. Shipping a brand-new silent decision inside the
 * release whose thesis is "make the silence loud" is the one internal
 * inconsistency a careful reader would find.
 */
const settle = () => new Promise((r) => setTimeout(r, 40));

const collect = () => {
  const events: HydrateDecisionEvent[] = [];
  const off = onHydrateDecision((e) => events.push(e));
  return { events, off };
};

afterEach(() => vi.restoreAllMocks());

// WITHDRAWN WITH STATUS-DEL — two status cases on hydrate-decision reporting.
// The asyncSource cases are deliberately LEFT for ASYNC-DEL: cleaning them here
// would blur the commit boundary and weaken that residue measurement.
/**
 * ⚠️ THE asyncSource CASES ARE GONE — this file's own comment reserved them for
 * "ASYNC-DEL", and ASYNC-SOURCE-RETIRE-1 is that phase.
 *
 * The generic invariant — "a declined rehydrate is OBSERVABLE" — keeps a
 * surviving subject: `entity-map.ts` also reports `decision: 'declined'` through
 * `reportHydrateDecision`, and the loader-backed entityMap case below exercises
 * it. No coverage was lost.
 */
describe('what is NOT reported — silence has to stay meaningful', () => {
  it('an accepted payload reports nothing', () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const tree = signalTree({ r: entityMap<{ id: number }, number>() });

    const { events, off } = collect();
    hydrateMarkerNode(tree.$.r, { all: [{ id: 1 }] }, 'rehydrate');
    off();

    expect(events).toEqual([]);
    expect(tree.$.r.count()).toBe(1);
  });

});

/**
 * RFC 0014 — the same two markers under `transfer`.
 *
 * `rehydrate` and `transfer` both cross a process boundary. They differ in
 * whether the payload is OLDER or NEWER than whatever this process can produce,
 * and a marker that owns a live source has to answer them differently. These
 * are the accept-side counterparts of the declines above.
 */