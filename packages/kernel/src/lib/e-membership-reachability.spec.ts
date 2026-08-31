import { describe, expect, it } from 'vitest';
import { undoable } from '../lib/undoable';

import { signalTree } from './signal-tree';

/**
 * DERIVATION E — is dynamic membership over a GRANULAR shape reachable at all?
 *
 * A record gives granular observation but its membership is fixed at
 * construction. Before concluding the conjunction is unreachable in ordinary
 * canonical state, exhaust the tree's own write paths: if ANY of them can add a
 * position to a record after construction, the gap closes.
 */
describe('E — can any tree API add a record key after construction?', () => {
  const seed = () =>
    signalTree({
      rows: { a: { n: 1 } } as Record<string, { n: number }>,
      other: 0,
    });

  it('nested accessor merge: NO', () => {
    const tree = seed();
    (tree.$.rows as unknown as (v: object) => void)({ b: { n: 2 } });
    expect((tree.$.rows() as Record<string, unknown>)['b']).toBeUndefined();
  });

  it('root callable merge: NO', () => {
    const tree = seed();
    tree.$({ rows: { b: { n: 2 } } } as never);
    expect((tree.$.rows() as Record<string, unknown>)['b']).toBeUndefined();
  });

  it('updater form through the root: NO', () => {
    const tree = seed();
    tree.$((current) => ({
      ...current,
      rows: { a: { n: 1 }, b: { n: 2 } },
    }));
    expect((tree.$.rows() as Record<string, unknown>)['b']).toBeUndefined();
  });

  it('a TOP-LEVEL record has the same constraint — it is not about nesting depth', () => {
    const tree = signalTree({ a: { n: 1 } } as Record<string, { n: number }>);
    tree.$({ b: { n: 2 } });
    expect((tree.$() as Record<string, unknown>)['b']).toBeUndefined();
  });

  it('the granular positions that DO exist keep working', () => {
    const tree = seed();
    undoable(() => tree.$.rows.a.n.set(9));
    expect(tree.$.rows.a.n()).toBe(9);
    expect(tree.$()).toEqual({ rows: { a: { n: 9 } }, other: 0 });
  });
});

/**
 * The completing check. The E5 fork established that an application CAN hold
 * independently created signals — but that they are not canonical truth: their
 * writes escape authored history. So the conjunction only names a real gap if
 * the thing providing it delivers it over CANONICAL truth.
 */
describe('E — is the conjunction delivered over canonical truth?', () => {
  it('an entity write is captured by undo', async () => {
    const { entityMap } = await import('./types');
    const { restoration } = await import('../enhancers/restoration/restoration');

    const tree = signalTree(
      {
        rows: entityMap<{ id: string; n: number }, string>({
          selectId: (r) => r.id,
        }),
      },
      { enhancers: [restoration()] }
    );

    undoable(() => tree.$.rows.addOne({ id: 'a', n: 1 }));
    await Promise.resolve();
    undoable(() => tree.$.rows.updateOne('a', { n: 2 }));
    await Promise.resolve();
    await Promise.resolve();
    expect(tree.$.rows.byIdOrFail('a').n()).toBe(2);

    tree.undo();
    await Promise.resolve();
    await Promise.resolve();

    // Canonical: the write became authored history and undo restored it.
    expect(tree.$.rows.byIdOrFail('a').n()).toBe(1);
  });
});
