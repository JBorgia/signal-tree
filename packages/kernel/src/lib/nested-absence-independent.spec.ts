import { describe, expect, it } from 'vitest';

import { signalTree } from './signal-tree';

/**
 * INDEPENDENT qualification of the nested-ancestor absence claim.
 *
 * Handoff item 2 asserts: "Held descendants read old storage after an ancestor
 * is omitted; writes remain hidden; updaters receive retained value rather than
 * semantic undefined", and that stale held reads already violate an existing
 * law.
 *
 * This file does NOT inherit that conclusion. It measures the behaviour from
 * the public surface and records what is actually observed. The comparison
 * that makes it a law question rather than a preference is the ENTITY control
 * below: entity-signal.ts documents that a held reference to a retired subject
 * keeps reading `undefined` because the map entry is gone and nothing can ever
 * write to it again. If an ordinary nested branch behaves differently from a
 * retired entity subject, the kernel has two incompatible absence semantics.
 *
 * Written against the dirty main tree; additive and untracked. First reds are
 * preserved rather than tuned away.
 */

type Nested = { parent: { child: number; sibling: number }; other: number };

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('nested-absence / held descendant after ancestor omission', () => {
  it('records what a held descendant reads once its ancestor omits it', async () => {
    const tree = signalTree<Nested>({
      parent: { child: 1, sibling: 2 },
      other: 0,
    });

    const held = tree.$.parent.child;
    expect(held()).toBe(1);

    // Replace the ancestor with a value that OMITS `child`.
    (tree.$.parent as unknown as (v: unknown) => void)({ sibling: 2 });
    await flush();

    const observed = held();
    const wholeParent = tree.$.parent();

    // MEASURED, not asserted-as-correct. Recorded so the disposition is
    // explicit either way.
    console.log(
      `[nested-absence] held child after omission = ${JSON.stringify(
        observed
      )}; parent snapshot = ${JSON.stringify(wholeParent)}`
    );

    // The law question: semantic absence should read undefined, not stale 1.
    expect(observed).toBeUndefined();
  });

  it('records whether a write through a held, now-absent descendant is hidden', async () => {
    const tree = signalTree<Nested>({
      parent: { child: 1, sibling: 2 },
      other: 0,
    });

    const held = tree.$.parent.child as unknown as {
      (): unknown;
      (v: unknown): void;
    };
    (tree.$.parent as unknown as (v: unknown) => void)({ sibling: 2 });
    await flush();

    held(99);
    await flush();

    const afterWrite = tree.$.parent() as Record<string, unknown>;
    console.log(
      `[nested-absence] after write through absent descendant, parent = ${JSON.stringify(
        afterWrite
      )}`
    );

    // A write must not vanish silently. Either it reaches the tree, or it
    // refuses. A hidden write that changes nothing and reports nothing is the
    // failure mode under test.
    const reached = Object.prototype.hasOwnProperty.call(afterWrite, 'child');
    expect(reached).toBe(true);
  });

  it('CONTROL: a retired ENTITY subject reads undefined, per documented law', async () => {
    const { entityMap } = await import('./markers/entity-map');
    type Row = { id: string; name: string };
    const tree = signalTree({
      rows: entityMap<Row, string>({ selectId: (r) => r.id }),
    });

    tree.$.rows.addOne({ id: 'A', name: 'Original' });
    await flush();
    const heldRow = tree.$.rows.byId('A');
    expect(heldRow?.()?.name).toBe('Original');

    tree.$.rows.removeOne('A');
    await flush();

    // entity-signal.ts states this explicitly: the held reference keeps
    // reading undefined because the key->subject mapping is gone.
    console.log(
      `[nested-absence] CONTROL retired entity read = ${JSON.stringify(
        heldRow?.()
      )}`
    );
    expect(heldRow?.()).toBeUndefined();
  });
});
