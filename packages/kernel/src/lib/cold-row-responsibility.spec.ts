import { appendFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { entityMap, link, restoration, signalTree, transactions, undoable } from '../index';
import type { EntitySubjectPhysicalInventory } from './entity-signal';
import type { AcquiredSubjectHandle } from './physical/structural-store';
import { getOwnedPositionIds, getOwnedSubjectIds } from './internals/owned-metadata';

type Row = { id: string; n: number };
type PrivateRows = {
  __acquireEntityHandleForTesting(key: string): AcquiredSubjectHandle | undefined;
  __inspectSubjectResources(subject: number): EntitySubjectPhysicalInventory<string> | undefined;
};
const drain = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const old: Row[] = [{ id: 'a', n: 1 }, { id: 'b', n: 2 }];
const replacement: Row[] = [{ id: 'c', n: 3 }, { id: 'd', n: 4 }];
function record(name: string, value: unknown) {
  const path = process.env['ST_COLD_OUTPUT'];
  if (!path) return;
  appendFileSync(path, JSON.stringify({ name, value }) + '\n');
}
function expectNoRetainedFacades(
  inventories: readonly (EntitySubjectPhysicalInventory<string> | undefined)[]
): void {
  for (const inventory of inventories) {
    if (inventory === undefined) continue;
    expect(inventory.nodeFacadeMaterialized).toBe(false);
    expect(inventory.fieldFacadesMaterialized).toEqual([]);
  }
}
function watch(tree: ReturnType<typeof make>) {
  const rows = tree.$.rows;
  const internal = rows as unknown as PrivateRows;
  // Inventory invokes getPositionIds: establish the shared collection owner
  // explicitly so the observer cannot silently be its first initializer.
  const owner = getOwnedPositionIds(rows);
  expect(owner?.length).toBe(1);
  const handle = (key: string) => {
    const acquired = internal.__acquireEntityHandleForTesting(key);
    if (!acquired) throw Error('Expected active lifetime ' + key);
    return acquired;
  };
  const inventory = (h: AcquiredSubjectHandle) => internal.__inspectSubjectResources(h.subjectId);
  const calls: unknown[] = [];
  let phase = 'setup';
  const original = rows.byIdOrFail;
  const spy = vi.spyOn(rows, 'byIdOrFail').mockImplementation(function (key) {
    const h = handle(key), before = inventory(h);
    const result = original.call(rows, key);
    const fields = Object.keys(result).map(key => {
      const field = Reflect.get(result, key);
      return { key, positions: getOwnedPositionIds(field), subjects: getOwnedSubjectIds(field) };
    });
    calls.push({ phase, key, before, after: inventory(h), fields, stack: new Error().stack });
    // A transparent observation only: never replace, suppress, or prewarm a read.
    return result;
  });
  return { owner, handle, inventory, calls, setPhase: (p: string) => { phase = p; }, close: () => spy.mockRestore() };
}
const make = () => signalTree({ rows: entityMap<Row, string>() }, { enhancers: [restoration(), transactions()] });
describe('cold row responsibility baseline', () => {
  it('cold disjoint replacement captures useful undo/redo without test-acquired row facades', async () => {
    const tree = make(), h = watch(tree); let connection: ReturnType<typeof link> | undefined;
    try {
      tree.$.rows.setAll(old); const originalHandles = old.map(row => h.handle(row.id));
      expect(originalHandles.map(x => h.inventory(x)?.nodeFacadeMaterialized)).toEqual([false, false]);
      const sent: Row[][] = [];
      connection = link(tree.$.rows, { set: value => { sent.push(value.map(row => ({ ...row }))); } });
      await drain(); sent.length = 0;
      undoable(() => tree.$.rows.setAll(replacement)); await drain();
      const currentHandles = replacement.map(row => h.handle(row.id));
      const before = currentHandles.map(h.inventory);
      expect(before.map(x => x?.nodeFacadeMaterialized)).toEqual([false, false]);
      expect(before.map(x => x?.fieldFacadesMaterialized)).toEqual([[], []]);
      h.setPhase('undo'); tree.undo(); h.setPhase('off');
      const afterUndo = currentHandles.map(h.inventory);
      expectNoRetainedFacades(afterUndo);
      await drain();
      expect(tree.$.rows.all()).toEqual(old); expect(sent.at(-1)).toEqual(old);
      expect(old.map(row => h.handle(row.id).subjectId)).toEqual(originalHandles.map(x => x.subjectId));
      h.setPhase('redo'); tree.redo(); h.setPhase('off');
      const afterRedo = currentHandles.map(h.inventory);
      expectNoRetainedFacades(afterRedo);
      await drain();
      expect(tree.$.rows.all()).toEqual(replacement); expect(sent.at(-1)).toEqual(replacement);
      tree.$.rows.updateOne('c', { n: 8 }); await drain();
      expect(sent).toEqual([replacement, old, replacement, [{ id: 'c', n: 8 }, replacement[1]]]);
      h.setPhase('late-field'); const field = tree.$.rows.byIdOrFail('c').n;
      expect(getOwnedPositionIds(field)).toEqual(h.owner);
      expect(getOwnedSubjectIds(field)).toEqual([currentHandles[0].subjectId]);
      const fieldSent: unknown[] = []; const fieldLink = link(field, { set: value => { fieldSent.push(value); } });
      try { await drain(); fieldSent.length = 0; undoable(() => field(10)); await drain(); tree.undo(); await drain(); expect(field()).toBe(8); expect(fieldSent).toEqual([10, 8]); }
      finally { fieldLink.dispose(); }
      record('cold-restoration', { owner: h.owner, before, afterUndo, afterRedo, calls: h.calls, sent, fieldSent });
    } finally { connection?.dispose(); h.close(); tree.destroy(); }
  });
  it('cold collection transaction has populated inspection and rolls back useful state/output', async () => {
    const tree = make(), h = watch(tree); let connection: ReturnType<typeof link> | undefined;
    let pending: ReturnType<typeof tree.transact> | undefined; let settled = false;
    try {
      tree.$.rows.setAll(old); const originalHandles = old.map(row => h.handle(row.id));
      const sent: Row[][] = [];
      connection = link(tree.$.rows, { set: value => { sent.push(value.map(row => ({ ...row }))); } });
      await drain(); record('transaction-initial-settled', { sent: [...sent] }); sent.length = 0;
      expect(originalHandles.map(x => h.inventory(x)?.nodeFacadeMaterialized)).toEqual([false, false]);
      pending = tree.transact(() => tree.$.rows.setAll(replacement));
      const currentHandles = replacement.map(row => h.handle(row.id));
      const before = currentHandles.map(h.inventory);
      expect(before.map(x => x?.nodeFacadeMaterialized)).toEqual([false, false]);
      h.setPhase('inspection'); const inspection = pending.inspect(); h.setPhase('off');
      expect(inspection.changes.length).toBeGreaterThan(0);
      expect(inspection.changes.some(change => change.address?.[0] === 'rows')).toBe(true);
      const afterInspection = currentHandles.map(h.inventory);
      expectNoRetainedFacades(afterInspection);
      await drain(); record('transaction-pending', { sent: [...sent] }); expect(sent).toEqual([]); expect(tree.$.rows.all()).toEqual(replacement);
      h.setPhase('rollback'); pending.rollback(); settled = true; h.setPhase('off');
      const afterRollback = currentHandles.map(h.inventory);
      expectNoRetainedFacades(afterRollback);
      await drain();
      record('transaction-rolled-back', { sent: [...sent] }); expect(tree.$.rows.all()).toEqual(old); expect(sent).toEqual([old]);
      expect(old.map(row => h.handle(row.id).subjectId)).toEqual(originalHandles.map(x => x.subjectId));
      tree.$.rows.updateOne('a', { n: 9 }); await drain();
      expect(sent).toEqual([old, [{ id: 'a', n: 9 }, old[1]]]);
      record('cold-transaction', { owner: h.owner, before, inspection, afterInspection, afterRollback, calls: h.calls, sent });
    } finally { if (pending && !settled) pending.confirm(); connection?.dispose(); h.close(); tree.destroy(); }
  });
});
