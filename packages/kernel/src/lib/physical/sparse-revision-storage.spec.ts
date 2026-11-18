import { expect, it, vi } from 'vitest';
import { entityMap, signalTree } from '../../index';
import { StructuralStore } from './structural-store';
import { prepareStructuralTarget } from './prepare-structural-target';

it('keeps zero implicit through real handles and prepared targets while retaining nonzero survivors', () => {
  const store = new StructuralStore<string>();
  store.createSubject(1, 'A'); store.createSubject(2, 'B'); store.createSubject(3, 'C');
  const held = store.acquireSubjectHandleForKey('B');
  expect(held).toBeDefined();
  expect(held?.acquiredRevision).toBe(0);
  expect(store['subjectRevisions'].size).toBe(0);
  store.installPreparedTarget(store.prepareTarget([
    { subjectId: 1, key: 'A' }, { subjectId: 2, key: 'B' }, { subjectId: 3, key: 'C' },
  ], [1, 2, 3], {}, prepareStructuralTarget));
  expect(store['subjectRevisions'].size).toBe(0);
  store.bumpSubjectRevision(2); store.bumpSubjectRevision(2);
  const target = store.prepareTarget([
    { subjectId: 1, key: 'A' }, { subjectId: 2, key: 'X' },
  ], [2, 1], {}, prepareStructuralTarget);
  expect(store.subjectRevision(2)).toBe(2);
  store.installPreparedTarget(target);
  expect(store.resolveSubjectHandle(held!)).toMatchObject({ key: 'X', revision: 3 });
  expect(store.subjectRevision(1)).toBe(0);
  expect([...store['subjectRevisions']]).toEqual([[2, 3], [3, 1]]);
  store.forgetSubject(3);
  expect([...store['subjectRevisions']]).toEqual([[2, 3]]);
  expect(store.activeKeysSnapshot()).toEqual(['X', 'A']);
  store.tombstoneSubject(2, 'X', true);
  store.createSubject(2, 'B');
  expect(store.acquireSubjectHandleForKey('B')?.acquiredRevision).toBe(0);
  expect(store.subjectRevision(2)).toBe(0);
  expect(store['subjectRevisions'].size).toBe(0);
  expect(store.activeKeysSnapshot()).toEqual(['A', 'B']);
});

it('public retirement removes revision entries without clearing a live nonzero survivor', () => {
  const stores = new Set<StructuralStore<string | number>>();
  const create = StructuralStore.prototype.createSubject;
  const capture = vi.spyOn(StructuralStore.prototype, 'createSubject').mockImplementation(function (
    this: StructuralStore<string | number>, subjectId: number, key: string | number
  ) {
    stores.add(this);
    return create.call(this, subjectId, key);
  });
  const tree = signalTree({
    rows: entityMap<{ id: string; name: string }, string>({ selectId: row => row.id }),
  });
  try {
    const rows = tree.$.rows;
    rows.setAll([{ id: 'A', name: 'Alpha' }, { id: 'B', name: 'Beta' }]);
    expect(stores.size).toBe(1);
    const store = [...stores][0];
    const subjectA = store.acquireSubjectHandleForKey('A')!.subjectId;
    const subjectB = store.acquireSubjectHandleForKey('B')!.subjectId;
    const heldA = rows.byIdOrFail('A'), heldB = rows.byIdOrFail('B');
    rows.changeId('B', 'B2'); rows.changeId('B2', 'B3');
    expect(store.subjectRevision(subjectB)).toBe(2);
    expect(store['subjectRevisions'].get(subjectB)).toBe(2);
    rows.removeOne('A');
    expect(heldA()).toBeUndefined();
    expect(heldB().name).toBe('Beta');
    expect(store['subjectRevisions'].has(subjectA)).toBe(false);
    expect([...store['subjectRevisions']]).toEqual([[subjectB, 2]]);
    rows.removeOne('B3');
    expect(heldB()).toBeUndefined();
    expect(store['subjectRevisions'].size).toBe(0);
  } finally {
    tree.destroy();
    capture.mockRestore();
  }
});
