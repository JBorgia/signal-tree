import { computed, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { transactions } from '@signal-tree/kernel';
import { describe, expect, it } from 'vitest';

import { entityMap, signalTree } from '../index';

/**
 * Narrows away `undefined` without a non-null assertion, and fails loudly
 * rather than silently reading through a row that was reclaimed -- which is
 * exactly the condition these tests exist to detect.
 */
function requireNode<T>(node: T | undefined): T {
  if (node === undefined) throw new Error('expected the row to be present');
  return node;
}

type Row = { id: number; name: string; v: number };

/**
 * `SUBJECT-EPOCH-0`. The regression class this architecture exists to prevent.
 *
 * `computed(() => rows.byId(k)?.()?.x)` is ordinary Angular code, and it is the
 * shape that broke when entity carriers were held weakly: it is a live observer
 * that does NOT retain the node, so across a forced GC its carrier was
 * collected, a replacement was minted, writes landed in the replacement, and
 * the computed silently froze at the value it had cached. See
 * `ENTITY-SIGNAL-SEMANTIC-0`.
 *
 * The epoch fixes it by retention rather than by hope: the per-subject
 * invalidation anchor is small enough to keep strongly, so a non-retaining
 * observer always has something reachable to be invalidated through, while the
 * VALUE it reads comes from `EntityValueStore` and no copy is kept.
 *
 * Every test here therefore: builds a computed that never captures the node,
 * forces a collection, mutates, and requires the computed to see it.
 */
async function collect(): Promise<void> {
  const gc = (globalThis as { gc?: () => void }).gc;
  if (!gc) throw new Error('these tests require --expose-gc');
  for (let i = 0; i < 6; i++) {
    gc();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  gc();
}

type Api = {
  setAll(rows: Row[]): void;
  addOne(row: Row): void;
  updateOne(id: number, patch: Partial<Row>): void;
  replaceOne(id: number, row: Row): void;
  removeOne(id: number): void;
  byId(id: number):
    | ({ (): Row | undefined } & {
        name: { (): string; set(v: string): void };
      })
    | undefined;
  __acquireEntityHandleForTesting(k: number): { subjectId: number };
  __inspectSubjectResources(s: number): {
    nodeFacadeMaterialized: boolean;
    state: string;
  };
  __restoreOne(
    key: number,
    entity: Row,
    subjectId: number,
    beforeSubject?: number,
    afterSubject?: number
  ): void;
};

function make(withTransactions = false) {
  // Two concrete calls rather than a `config | undefined` argument: the
  // overloads distinguish an enhanced tree from a bare one, and a union of
  // the two matches neither.
  const tree = (withTransactions
    ? signalTree({ rows: entityMap<Row>({}) }, { enhancers: [transactions()] })
    : signalTree({ rows: entityMap<Row>({}) })) as unknown as {
    $: { rows: Api };
    transaction(fn: () => void): { confirm(): void; rollback(): void };
  };
  tree.$.rows.setAll([
    { id: 1, name: 'a', v: 1 },
    { id: 2, name: 'b', v: 2 },
  ]);
  return tree;
}

/** Never captures the node — that is the entire point. */
const watch = (tree: { $: { rows: Api } }, id: number) =>
  computed(() => tree.$.rows.byId(id)?.()?.name);

beforeEach(() => {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection()],
  });
});

describe('SUBJECT-EPOCH-0: a non-retaining computed survives collection', () => {
  it('CONTROL: the node facade really is collected', async () => {
    const tree = make();
    const api = tree.$.rows;
    const subjectId = api.__acquireEntityHandleForTesting(1).subjectId;

    const view = watch(tree, 1);
    expect(view()).toBe('a');
    expect(
      api.__inspectSubjectResources(subjectId).nodeFacadeMaterialized
    ).toBe(true);

    await collect();

    // If the facade survived, every test below would be exercising a retained
    // realization and proving nothing.
    expect(
      api.__inspectSubjectResources(subjectId).nodeFacadeMaterialized
    ).toBe(false);
  });

  it('sees updateOne', async () => {
    const tree = make();
    const view = watch(tree, 1);
    expect(view()).toBe('a');
    await collect();
    tree.$.rows.updateOne(1, { name: 'updated' });
    expect(view()).toBe('updated');
  });

  it('sees a direct field.set', async () => {
    const tree = make();
    const view = watch(tree, 1);
    expect(view()).toBe('a');
    await collect();
    requireNode(tree.$.rows.byId(1)).name.set('field-set');
    expect(view()).toBe('field-set');
  });

  it('sees replaceOne', async () => {
    const tree = make();
    const view = watch(tree, 1);
    expect(view()).toBe('a');
    await collect();
    tree.$.rows.replaceOne(1, { id: 1, name: 'replaced', v: 7 });
    expect(view()).toBe('replaced');
  });

  it('sees setAll', async () => {
    const tree = make();
    const view = watch(tree, 1);
    expect(view()).toBe('a');
    await collect();
    tree.$.rows.setAll([
      { id: 1, name: 'via-setall', v: 5 },
      { id: 2, name: 'b', v: 2 },
    ]);
    expect(view()).toBe('via-setall');
  });

  it('sees removeOne', async () => {
    const tree = make();
    const view = watch(tree, 1);
    expect(view()).toBe('a');
    await collect();
    tree.$.rows.removeOne(1);
    expect(view()).toBeUndefined();
  });

  it('sees remove then same-key re-add, without retargeting', async () => {
    const tree = make();
    const view = watch(tree, 1);
    expect(view()).toBe('a');

    const stale = tree.$.rows.byId(1);
    await collect();

    tree.$.rows.removeOne(1);
    expect(view()).toBeUndefined();

    tree.$.rows.addOne({ id: 1, name: 'new-occupant', v: 99 });
    await collect();

    // The watcher resolves by key and sees the new occupant...
    expect(view()).toBe('new-occupant');
    // ...while a reference to the OLD subject does not follow it.
    expect(stale?.()).toBeUndefined();
  });

  it('sees speculative transaction state, and its rollback', async () => {
    const tree = make(true);
    const view = watch(tree, 1);
    expect(view()).toBe('a');
    await collect();

    const tx = tree.transact(() => {
      tree.$.rows.updateOne(1, { name: 'speculative' });
    });
    expect(view()).toBe('speculative');

    await collect();
    tx.rollback();
    expect(view()).toBe('a');
  });

  it('sees a confirmed transaction', async () => {
    const tree = make(true);
    const view = watch(tree, 1);
    await collect();
    tree
      .transact(() => {
        tree.$.rows.updateOne(1, { name: 'committed' });
      })
      .confirm();
    expect(view()).toBe('committed');
  });

  it('keeps a held node and a held field working across collection', async () => {
    const tree = make();
    const node = tree.$.rows.byId(1);
    const field = requireNode(node).name;

    await collect();

    tree.$.rows.updateOne(1, { name: 'held-after-gc' });
    expect(node?.()?.name).toBe('held-after-gc');
    expect(field()).toBe('held-after-gc');
  });

  /**
   * Restore is the operation the epoch most has to get right: the subject is
   * tombstoned, its realizations are reclaimed, and then the SAME SubjectId
   * comes back. An observer that never held the node must still see it.
   *
   * Note what `removeOne` actually does: `reclaimRetiredSubjectsWithoutOwner`
   * forgets the subject immediately, so `__inspectSubjectResources` returns
   * `undefined` afterwards. That is structural ownership, not JS reachability —
   * holding the node does NOT keep the record alive. Restore still revives the
   * same SubjectId, which is the behaviour under test; asserting on the
   * inventory in between would only be asserting a wrong model of reclamation.
   *
   * Driven through `__restoreOne` because the collection exposes no public
   * restore. Testing the mechanism does not require shipping it.
   */
  it('sees a restore of the same SubjectId after collection', async () => {
    const tree = make();
    const api = tree.$.rows;
    const subjectId = api.__acquireEntityHandleForTesting(1).subjectId;

    const view = watch(tree, 1);
    expect(view()).toBe('a');

    tree.$.rows.removeOne(1);
    expect(view()).toBeUndefined();

    await collect();

    api.__restoreOne(1, { id: 1, name: 'restored', v: 3 }, subjectId);

    expect(view()).toBe('restored');
    expect(api.__acquireEntityHandleForTesting(1).subjectId).toBe(subjectId);
  });

  it('revives a reference held across the remove/restore cycle', async () => {
    const tree = make();
    const api = tree.$.rows;
    const subjectId = api.__acquireEntityHandleForTesting(1).subjectId;

    const held = tree.$.rows.byId(1);
    expect(held?.()).toEqual({ id: 1, name: 'a', v: 1 });

    tree.$.rows.removeOne(1);
    await collect();
    expect(held?.()).toBeUndefined();

    api.__restoreOne(1, { id: 1, name: 'revived', v: 4 }, subjectId);

    // Same subject lifetime, so the old reference is valid again — the
    // guarantee that distinguishes this from v14 key identity.
    expect(held?.()?.name).toBe('revived');
  });
});
