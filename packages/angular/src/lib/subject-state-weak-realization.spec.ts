import { computed, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { transactions } from '@signal-tree/kernel';

import { entityMap, signalTree } from '../index';

type Row = { id: number; name: string; v: number };

/** Only the surface these tests drive. */
type RowNode = {
  (): Row | undefined;
  name: { (): string; set(value: string): void };
};
type EntityMapApi = {
  setAll(rows: Row[]): void;
  updateOne(id: number, patch: Partial<Row>): void;
  byId(id: number): RowNode | undefined;
};

/** Drain turn boundaries with a full mark-sweep between them. */
async function collect(): Promise<void> {
  const gc = (globalThis as { gc?: () => void }).gc;
  if (!gc) throw new Error('these tests require --expose-gc');
  for (let i = 0; i < 6; i++) {
    gc();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  gc();
}

function make() {
  const tree = signalTree({ rows: entityMap<Row>({}) });
  tree.$.rows.setAll([
    { id: 1, name: 'a', v: 1 },
    { id: 2, name: 'b', v: 2 },
  ]);
  const api = tree.$.rows as unknown as {
    __acquireEntityHandleForTesting: (k: number) => { subjectId: number };
    __inspectSubjectResources: (s: number) => { activationToken: boolean };
  };
  return { tree, api };
}

const subjectIdFor = (
  api: {
    __acquireEntityHandleForTesting: (k: number) => { subjectId: number };
  },
  key: number
): number => api.__acquireEntityHandleForTesting(key).subjectId;

describe('SUBJECT-STATE-SEMANTIC-0: weakly held activation carriers', () => {
  it('CONTROL: an unreferenced carrier is actually collected', async () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    const { tree, api } = make();
    const subjectId = subjectIdFor(api, 1);

    // Realize, then drop every reference to the node.
    (() => {
      const node = tree.$.rows.byId(1);
      void node?.();
    })();
    expect(api.__inspectSubjectResources(subjectId).activationToken).toBe(true);

    await collect();

    // If this is false, the carrier was reclaimed and every test below is
    // testing something real. If it stays true, they are all vacuous.
    expect(api.__inspectSubjectResources(subjectId).activationToken).toBe(
      false
    );
  });

  it('a held node keeps its carrier alive and still updates after GC', async () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    const { tree, api } = make();
    const subjectId = subjectIdFor(api, 1);

    const node = tree.$.rows.byId(1);
    expect(node?.()).toEqual({ id: 1, name: 'a', v: 1 });

    await collect();

    // The node closure is the strong retainer, so this must survive.
    expect(api.__inspectSubjectResources(subjectId).activationToken).toBe(true);

    tree.$.rows.updateOne(1, { name: 'after-gc' });
    expect(node?.()?.name).toBe('after-gc');
  });

  it('a held field carrier still updates after GC', async () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    const { tree } = make();

    const field = tree.$.rows.byId(1)!.name;
    expect(field()).toBe('a');

    await collect();

    tree.$.rows.updateOne(1, { name: 'field-after-gc' });
    expect(field()).toBe('field-after-gc');

    tree.$.rows.setAll([
      { id: 1, name: 'via-setall', v: 9 },
      { id: 2, name: 'b', v: 2 },
    ]);
    expect(field()).toBe('via-setall');
  });

  it('a live reactive observer prevents collection and never goes stale', async () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    const { tree, api } = make();
    const subjectId = subjectIdFor(api, 1);

    // The ONLY surviving reference is the computed's dependency on the
    // carrier. The node itself is dropped inside this scope.
    const view = ((): (() => string | undefined) => {
      const node = tree.$.rows.byId(1);
      return computed(() => node?.()?.name);
    })();
    expect(view()).toBe('a');

    await collect();

    // This is the stale-realization trap. If the carrier were reclaimed while
    // a consumer still depended on it, the registry would mint a replacement,
    // bumps would go to the replacement, and `view` would never update again.
    expect(api.__inspectSubjectResources(subjectId).activationToken).toBe(true);

    tree.$.rows.updateOne(1, { name: 'observed-after-gc' });
    expect(view()).toBe('observed-after-gc');
  });

  it('a re-added key does not retarget a reference held across GC', async () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    const { tree } = make();

    const stale = tree.$.rows.byId(1);
    expect(stale?.()).toEqual({ id: 1, name: 'a', v: 1 });

    tree.$.rows.removeOne(1);
    await collect();
    tree.$.rows.addOne({ id: 1, name: 'new-occupant', v: 99 });
    await collect();

    // Subject lifetime, not key identity: the old reference belongs to the
    // removed subject and must not follow the new occupant. This is the
    // guarantee v14 does not make.
    expect(stale?.()).toBeUndefined();
    expect(tree.$.rows.byId(1)?.()).toEqual({
      id: 1,
      name: 'new-occupant',
      v: 99,
    });
  });

  it('direct field.set still authors through a carrier recreated after GC', async () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    const { tree, api } = make();
    const subjectId = subjectIdFor(api, 1);

    // Realize and release, so the carrier is genuinely reclaimed first.
    (() => void tree.$.rows.byId(1)?.())();
    await collect();
    expect(api.__inspectSubjectResources(subjectId).activationToken).toBe(
      false
    );

    const field = tree.$.rows.byId(1)!.name;
    field.set('set-after-reclaim');
    expect(field()).toBe('set-after-reclaim');
    expect(tree.$.rows.byId(1)?.()?.name).toBe('set-after-reclaim');
  });

  it('reclaiming and re-realizing the same subject yields current truth', async () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    const { tree, api } = make();
    const subjectId = subjectIdFor(api, 1);

    (() => void tree.$.rows.byId(1)?.())();
    await collect();
    expect(api.__inspectSubjectResources(subjectId).activationToken).toBe(
      false
    );

    // Mutations while NOTHING is realized must still be visible afterwards --
    // the carrier is a realization, the durable truth is the store.
    tree.$.rows.updateOne(1, { name: 'changed-while-unrealized' });
    tree.$.rows.updateOne(1, { v: 42 });

    const revived = tree.$.rows.byId(1);
    expect(revived?.()).toEqual({
      id: 1,
      name: 'changed-while-unrealized',
      v: 42,
    });
    expect(api.__inspectSubjectResources(subjectId).subjectId).toBe(subjectId);
  });
});

/**
 * The trap this architecture is most likely to fall into: a replacement carrier
 * minted while something still observes the old one. Bumps go to the
 * replacement, the live observer never fires, and the staleness only appears
 * after a GC — the failure mode that makes naive weak realization unsafe.
 *
 * Observation must reach the carrier WITHOUT retaining the node, or the node
 * keeps its own cached carrier and there is nothing to discriminate. Hence a
 * computed that re-resolves through `byId` on each evaluation.
 *
 * The activation carrier gates STRUCTURAL resolution — `currentKey` — so the
 * discriminating mutation is a removal, not a value edit. A value edit also
 * invalidates the entity value cell, which would mask the defect.
 */
describe('SUBJECT-STATE-SEMANTIC-0: replacement must not orphan an observer', () => {
  it('a re-realization reuses the carrier a live observer depends on', async () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    const { tree, api } = make();
    const subjectId = subjectIdFor(api, 1);

    const view = computed(() => tree.$.rows.byId(1)?.()?.name);
    expect(view()).toBe('a');

    await collect();

    // Second realization while the first carrier is still observed by `view`.
    const second = tree.$.rows.byId(1);
    void second?.();
    expect(api.__inspectSubjectResources(subjectId).activationToken).toBe(true);

    tree.$.rows.removeOne(1);

    expect(view()).toBeUndefined();
    expect(tree.$.rows.byId(1)).toBeUndefined();
  });
});

/**
 * Optimistic transactions are the hardest case for weak realization: a write is
 * visible BEFORE it commits, and a rollback compensates by writing again. Both
 * halves have to land on whatever carrier the caller is still holding, and a
 * collection in between must not split them apart.
 */
describe('SUBJECT-STATE-SEMANTIC-0: transactions across a collection', () => {
  const txTree = () => {
    const tree = signalTree(
      { rows: entityMap<Row>({}) },
      { enhancers: [transactions()] }
    ) as unknown as {
      $: {
        rows: EntityMapApi;
      };
      transaction(fn: () => void): { confirm(): void; rollback(): void };
    };
    tree.$.rows.setAll([
      { id: 1, name: 'a', v: 1 },
      { id: 2, name: 'b', v: 2 },
    ]);
    return tree;
  };

  it('keeps speculative state visible through a held node across GC', async () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    const tree = txTree();
    const node = tree.$.rows.byId(1);
    expect(node?.()?.name).toBe('a');

    const tx = tree.transaction(() => {
      tree.$.rows.updateOne(1, { name: 'speculative' });
    });

    // Optimistic visibility is deliberate product semantics, not an accident.
    expect(node?.()?.name).toBe('speculative');
    await collect();
    expect(node?.()?.name).toBe('speculative');

    tx.confirm();
    expect(node?.()?.name).toBe('speculative');
  });

  it('rolls back through the same held carrier after a collection', async () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    const tree = txTree();
    const node = tree.$.rows.byId(1);
    const field = node!.name;

    const tx = tree.transaction(() => {
      tree.$.rows.updateOne(1, { name: 'speculative' });
    });
    expect(field()).toBe('speculative');

    await collect();

    // The compensating write must reach the carrier the caller still holds.
    tx.rollback();
    expect(field()).toBe('a');
    expect(node?.()?.name).toBe('a');
  });
});
