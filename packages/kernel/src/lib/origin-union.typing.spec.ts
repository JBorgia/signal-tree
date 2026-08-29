import { describe, expect, it } from 'vitest';

import { signalTree } from './signal-tree';
import { withWriteContext } from './write-context';

/**
 * SEMANTICS-NAMES-1 — the origin union, enforced at the TYPE level.
 *
 * `WriteMetadata.origin` is provenance, and a positive value exists only where
 * provenance carries semantic information. Three spellings were withdrawn in
 * 15.0 because they named no owner:
 *
 *   'system'         fabricated provenance — the realization adapter's
 *                    `?? 'system'` fallback, seven sites, deleted. Nothing ever
 *                    read it.
 *   'user'           duplicated the meaningful ABSENCE of an origin, which is
 *                    already how ordinary application work is represented.
 *   'serialization'  claimed a provenance nothing stamped.
 *
 * A runtime check cannot see any of this — the values were only ever spellings.
 * This file proves the contract instead, so a withdrawn category cannot return
 * the way it arrived: by a union quietly admitting a word again.
 */

describe('origin union: only owners survive', () => {
  it('accepts the three origins that have an owner', () => {
    const tree = signalTree({ n: 0 });

    withWriteContext({ origin: 'restoration' }, () => tree.$.n.set(1));
    withWriteContext({ origin: 'devtools' }, () => tree.$.n.set(2));
    withWriteContext({ origin: 'external' }, () => tree.$.n.set(3));
    // Added by DIAG-JOURNAL-1.1, under the same rule the others live by: a
    // compensation write is a realization whose reason to exist is a withdrawn
    // transaction, and a diagnostic reader could not tell it from external truth.
    withWriteContext({ origin: 'transaction-rollback' }, () => tree.$.n.set(4));

    expect(tree.$.n()).toBe(4);
  });

  it('absence is a legitimate value, not a missing one', () => {
    const tree = signalTree({ n: 0 });

    // Ordinary authored application work records no origin at all, and this is
    // the represention — not an omission to be filled in later with
    // `'application'`. A1-N.
    withWriteContext({ intent: 'user' }, () => tree.$.n.set(1));

    expect(tree.$.n()).toBe(1);
  });

  it('rejects the three withdrawn spellings', () => {
    const tree = signalTree({ n: 0 });

    // @ts-expect-error 'system' was fabricated provenance; absence is the truthful value
    withWriteContext({ origin: 'system' }, () => tree.$.n.set(1));
    // @ts-expect-error 'user' duplicated the meaningful absence of an origin
    withWriteContext({ origin: 'user' }, () => tree.$.n.set(2));
    // @ts-expect-error 'serialization' claimed a provenance nothing stamps
    withWriteContext({ origin: 'serialization' }, () => tree.$.n.set(3));

    expect(tree.$.n()).toBe(3);
  });
});
