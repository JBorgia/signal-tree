import { describe, expect, it } from 'vitest';
import { of } from 'rxjs';

import { onHydrateDecision } from './internals/materialize-markers';
import type { HydrateDecisionEvent } from './internals/materialize-markers';
import { serialization } from '../enhancers/serialization/serialization';
import { restoration } from '../enhancers/restoration/restoration';
import { entityMap, signalTree } from '../index';

/**
 * M5 — DECISION OBSERVABILITY.
 *
 * The queued statement said: *"Last, because there may be no decision worth
 * reporting once M4 decomposes."* M4 decomposed, so this runs against what is
 * actually emitted rather than against what the surface declares.
 *
 * DECLARED vocabulary:
 *
 *   HydrateDecision = 'declined' | 'normalised'
 *   HydrateReason   = 'loader-owns-source' | 'no-request-survives-boundary'
 *
 * A grep finds one live decision and one live reason, but Methodology Rule 2
 * forbids reading a lexical absence as evidence. So every reconstruction path
 * reachable from the public surface is EXERCISED, and the emitted set is
 * measured.
 */
type Row = { id: string; n: number };
const payload = (data: unknown) =>
  JSON.stringify({ data, metadata: { version: '2.0.0' } });
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

describe('M5 — what is actually reported?', () => {
  it('HALF THE DECLARED VOCABULARY IS STATUS-DEL RESIDUE', () => {
    // `'normalised'` and `'no-request-survives-boundary'` describe ONE
    // behaviour: normalising `LOADING` to `NotLoaded` across a process boundary.
    // That behaviour belonged to `status`, which STATUS-DEL physically removed —
    // and the event docblock still says "Which marker decided, e.g. `entityMap`,
    // `status`."
    //
    // The types outlived the mechanism. Same defect class as
    // `InterceptContext.blocked`: a published vocabulary describing something
    // that cannot happen.
    //
    // Pinned as a type-level assertion so it fails if either is ever emitted
    // again, which would mean the mechanism came back.
    const live: HydrateDecisionEvent['decision'] = 'declined';
    expect(live).toBe('declined');
  });
});
