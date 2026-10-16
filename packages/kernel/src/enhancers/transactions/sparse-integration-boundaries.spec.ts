import { afterEach, describe, expect, it, vi } from 'vitest';
import { entityMap, restoration, signalTree, transactions, undoable } from '../../index';
import { entityMembershipReader } from '../../internals';
import { getOwnedSubjectIds } from '../../lib/internals/owned-metadata';
import { StructuralStore } from '../../lib/physical/structural-store';

type Row = { id: string; n: number };
const owned: Array<{ destroy(): void }> = [];
afterEach(() => { vi.restoreAllMocks(); for (const tree of owned.splice(0)) tree.destroy(); });
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
const make = (size = 1) => {
  const tree = signalTree({ x: 0, y: 0, z: 0, rows: entityMap<Row, string>({ selectId: row => row.id }) }, { enhancers: [transactions()] });
  owned.push(tree);
  tree.$.rows.addMany(Array.from({ length: size }, (_, i) => ({ id: `K${i}`, n: 0 })));
  return tree;
};

describe('sparse integration through public transactions', () => {
  // Deliberate capability gain. The historical R8 containment test that expects
  // refusal remains unchanged and must be reported separately if this succeeds.
  it('rejects an older scalar contribution while preserving a newer pending contribution', async () => {
    const tree = make();
    const older = tree.transact(() => { tree.$.x(1); tree.$.y(1); }); await flush();
    const newer = tree.transact(() => { tree.$.y(2); tree.$.z(2); }); await flush();
    older.rollback();
    expect([tree.$.x(), tree.$.y(), tree.$.z()]).toEqual([0, 2, 2]);
    newer.rollback();
    expect([tree.$.x(), tree.$.y(), tree.$.z()]).toEqual([0, 0, 0]);
    older.rollback(); newer.rollback();
    expect([tree.$.x(), tree.$.y(), tree.$.z()]).toEqual([0, 0, 0]);
  });

  it('settles overlapping scalar and entity contributions without losing either later intent or original state', async () => {
    const tree = make(); const held = tree.$.rows.byIdOrFail('K0');
    const older = tree.transact(() => { tree.$.x(1); tree.$.rows.updateOne('K0', { n: 1 }); }); await flush();
    const newer = tree.transact(() => { tree.$.y(2); tree.$.rows.updateOne('K0', { n: 2 }); }); await flush();
    older.rollback();
    expect([tree.$.x(), tree.$.y(), held().n]).toEqual([0, 2, 2]);
    newer.rollback();
    expect([tree.$.x(), tree.$.y(), held().n]).toEqual([0, 0, 0]);
    expect(tree.$.rows.byIdOrFail('K0')).toBe(held);
  });

  it('delivers membership only after scalar and lifetime settlement, then preserves listener-authored writes', async () => {
    const tree = make(); const reader = entityMembershipReader(tree);
    expect(reader).toBeDefined(); if (!reader) throw new Error('Membership reader unavailable');
    reader.snapshot();
    const pending = tree.transact(() => { tree.$.x(1); tree.$.rows.prependOne({ id: 'C', n: 1 }); }); await flush();
    const snapshots: Array<{ x: number; ids: readonly string[] }> = [];
    const stop = reader.subscribe(event => {
      if (!event.changes.some(change => change.kind === 'remove' && change.key === 'C')) return;
      snapshots.push({ x: tree.$.x(), ids: [...tree.$.rows.ids()] });
      tree.$.y(2);
    });
    try {
      pending.rollback(); await flush();
      expect(snapshots).toEqual([{ x: 0, ids: ['K0'] }]);
      expect(tree.$.y()).toBe(2);
      pending.rollback();
      expect(tree.$.y()).toBe(2);
    } finally { stop(); }
  });

  it.each([32, 1024])('point field rejection with active membership tooling does not scan %i rows', async size => {
    const tree = make(size); const reader = entityMembershipReader(tree);
    expect(reader).toBeDefined(); if (!reader) throw new Error('Membership reader unavailable');
    reader.snapshot(); const events: unknown[] = []; const stop = reader.subscribe(event => events.push(event));
    const pending = tree.transact(() => tree.$.rows.updateOne('K0', { n: 1 })); await flush();
    const order = vi.spyOn(StructuralStore.prototype, 'snapshotActiveOrder');
    const keys = vi.spyOn(StructuralStore.prototype, 'activeKeysSnapshot');
    try {
      pending.rollback(); await flush();
      expect(tree.$.rows.byIdOrFail('K0')().n).toBe(0);
      expect(events).toEqual([]);
      expect(order).not.toHaveBeenCalled();
      expect(keys).not.toHaveBeenCalled();
    } finally { stop(); }
  });

  it('restores a pending removal to the held lifetime and never retargets it after confirmed removal and key reuse', async () => {
    const tree = make(); const held = tree.$.rows.byIdOrFail('K0'); const field = held.n;
    const removed = tree.transact(() => tree.$.rows.removeOne('K0')); await flush();
    expect(held()).toBeUndefined(); expect(field()).toBeUndefined();
    removed.rollback();
    expect(tree.$.rows.byIdOrFail('K0')).toBe(held); expect(field()).toBe(0);
    const terminal = tree.transact(() => tree.$.rows.removeOne('K0')); await flush(); terminal.confirm();
    for (let i = 0; i < 32; i++) {
      tree.$.rows.addOne({ id: 'K0', n: i + 1 });
      expect(tree.$.rows.byIdOrFail('K0')).not.toBe(held);
      expect(held()).toBeUndefined(); expect(field()).toBeUndefined();
      tree.$.rows.removeOne('K0');
    }
    expect(tree.$.rows.count()).toBe(0);
  });
});

/** Existing native inventory is a test observation seam, never a new API. */
const inventory = (rows: object) => rows as {
  __listSubjectReclamationCandidates(): readonly number[];
  __inspectSubjectResources(id: number): unknown;
};
const subjectOf = (node: object) => {
  const id = getOwnedSubjectIds(node)?.[0];
  if (id === undefined) throw new Error('Held field has no native lifetime');
  return id;
};

describe('sparse integration preserves real reclamation obligations', () => {
  it.each([0, 32, 1024])('transactions-only ordinary churn reclaims native records after %i unowned lifetimes', async count => {
    const tree = make();
    tree.$.rows.addOne({ id: 'temp', n: -1 });
    const held = tree.$.rows.byIdOrFail('temp'); const field = held.n; const id = subjectOf(field);
    tree.$.rows.removeOne('temp');
    for (let i = 0; i < count; i++) {
      tree.$.rows.addOne({ id: 'temp', n: i }); tree.$.rows.removeOne('temp');
    }
    await flush();
    expect(tree.$.rows.ids()).toEqual(['K0']);
    expect(held()).toBeUndefined(); expect(field()).toBeUndefined();
    expect(inventory(tree.$.rows).__listSubjectReclamationCandidates()).toEqual([]);
    expect(inventory(tree.$.rows).__inspectSubjectResources(id)).toBeUndefined();
  });

  it('pending removal keeps native recovery backing through unrelated churn until rollback restores the same lifetime', async () => {
    const tree = make(); const held = tree.$.rows.byIdOrFail('K0'); const id = subjectOf(held.n);
    const pending = tree.transact(() => tree.$.rows.removeOne('K0')); await flush();
    for (let i = 0; i < 32; i++) { tree.$.rows.addOne({ id: 'temp', n: i }); tree.$.rows.removeOne('temp'); }
    await flush();
    expect(inventory(tree.$.rows).__listSubjectReclamationCandidates()).toContain(id);
    expect(inventory(tree.$.rows).__inspectSubjectResources(id)).toBeDefined();
    pending.rollback();
    expect(tree.$.rows.byIdOrFail('K0')).toBe(held); expect(held()).toEqual({ id: 'K0', n: 0 });
  });

  it('restoration history keeps an absent lifetime restorable even without any pending transaction', async () => {
    const tree = signalTree({ rows: entityMap<Row, string>({ selectId: row => row.id }) },
      { enhancers: [transactions(), restoration({ maxHistorySize: 10 })] }); owned.push(tree);
    tree.$.rows.addOne({ id: 'K0', n: 0 }); await flush();
    const held = tree.$.rows.byIdOrFail('K0'); const field = held.n; const id = subjectOf(field);
    undoable(() => tree.$.rows.removeOne('K0')); await flush();
    for (let i = 0; i < 32; i++) { tree.$.rows.addOne({ id: 'temp', n: i }); tree.$.rows.removeOne('temp'); }
    await flush();
    expect(held()).toBeUndefined(); expect(field()).toBeUndefined();
    expect(inventory(tree.$.rows).__listSubjectReclamationCandidates()).toContain(id);
    expect(inventory(tree.$.rows).__inspectSubjectResources(id)).toBeDefined();
    tree.undo(); await flush();
    expect(tree.$.rows.byIdOrFail('K0')).toBe(held); expect(field()).toBe(0);
    tree.redo(); await flush(); expect(held()).toBeUndefined();
  });
});
