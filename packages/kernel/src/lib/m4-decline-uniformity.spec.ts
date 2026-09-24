import { describe, expect, it } from 'vitest';

import { entityMap, link, signalTree } from '../index';

/**
 * M4 — CLOSING THE OWNERSHIP HALF.
 *
 * M4 established that `hydrate`'s surviving content is not representational: a
 * position may DECLINE reconstruction when another authority owns its content,
 * and the decision depends on the MODE. That survives a uniform-rule null of the
 * shape "set the position to the payload".
 *
 * But the two implementers' predicates are, in full:
 *
 *   asyncSource   mode === 'rehydrate'
 *   entityMap     mode === 'rehydrate' && typeof node.load === 'function'
 *
 * Both are the SAME RULE over ONE DECLARED PROPERTY — "this position owns a live
 * source" — which `asyncSource` satisfies by construction and `entityMap`
 * satisfies per instance. Neither reads the payload, and neither expresses
 * anything specific to its declaration kind.
 *
 * If that is right, the decline is a UNIFORM RULE and needs no per-kind hook —
 * the same result M3 reached for the publish side, arrived at from the other
 * direction.
 */
type Row = { id: string; n: number };

describe('M4 — is the decline a uniform rule?', () => {
  it('THE PROPERTY DECIDES, NOT THE KIND — a loaderless collection ACCEPTS rehydrate', async () => {
    const tree = signalTree({
      rows: entityMap<Row, string>({ selectId: (r) => r.id }),
    });
    tree.$.rows.addOne({ id: 'live', n: 1 });

    // Same declaration kind, same mode, no live source -> the payload applies.
    const connection = link(tree.$.rows, {
      get: () => [{ id: 'stored', n: 2 }],
    });
    try {
      await connection.retrieve();

      expect(tree.$.rows.ids()).toEqual(['stored']);
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });
});
