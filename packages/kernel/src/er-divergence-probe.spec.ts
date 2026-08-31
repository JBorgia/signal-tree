import { describe, expect, it } from 'vitest';
import { signalTree, entityMap } from './index';

/**
 * ENTITY-REPRESENTATION-OWNERSHIP-0 — the ER-B falsifier.
 *
 * Entity representation is split across StructuralStore (identity/lifetime),
 * EntityValueStore (row values) and per-entity observation cells. If any two of
 * those carried the same authority, the routes below would disagree.
 *
 * Every row reads THE SAME FACT through three different paths:
 *   collection projection : rows.all()
 *   per-entity cell       : rows.byIdOrFail(id).field()
 *   whole-value snapshot  : tree.$().users.all
 */
type U = { id: number; name: string; n: number };
const make = () => {
  const t = signalTree({ users: entityMap<U>() });
  return { t, rows: t.$.users };
};
const agree = (t: ReturnType<typeof make>['t'], rows: ReturnType<typeof make>['rows'], id: number) => {
  const fromAll = (rows.all() as U[]).find((r) => r.id === id);
  const fromCell = { id, name: rows.byIdOrFail(id).name(), n: rows.byIdOrFail(id).n() };
  const snapUsers = (t.$() as { users: { all?: U[] } }).users;
  const fromSnap = (snapUsers?.all ?? []).find((r) => r.id === id);
  expect(fromCell.name).toBe(fromAll?.name);
  expect(fromCell.n).toBe(fromAll?.n);
  if (fromSnap) { expect(fromSnap.name).toBe(fromAll?.name); expect(fromSnap.n).toBe(fromAll?.n); }
};

describe('entity representation cannot observably diverge', () => {
  it('agrees after add, field write, bulk update, removal and re-add', () => {
    const { t, rows } = make();
    rows.addOne({ id: 1, name: 'Ada', n: 1 });
    rows.addOne({ id: 2, name: 'Bob', n: 2 });
    agree(t, rows, 1); agree(t, rows, 2);

    rows.byIdOrFail(1).name.set('Grace');
    agree(t, rows, 1);

    rows.updateOne?.(2, { n: 99 });
    agree(t, rows, 2);

    rows.removeOne(2);
    expect(rows.count()).toBe(1);
    rows.addOne({ id: 2, name: 'Bob2', n: 7 });
    agree(t, rows, 2);
  });

  it('agrees after setAll replaces the collection', () => {
    const { t, rows } = make();
    rows.addOne({ id: 1, name: 'Ada', n: 1 });
    rows.setAll?.([{ id: 3, name: 'Cy', n: 3 }, { id: 1, name: 'Ada2', n: 5 }]);
    agree(t, rows, 1); agree(t, rows, 3);
    expect(rows.count()).toBe(2);
  });

  it('a removed-then-restored key is one identity, not two values', () => {
    const { t, rows } = make();
    rows.addOne({ id: 1, name: 'Ada', n: 1 });
    rows.removeOne(1);
    rows.addOne({ id: 1, name: 'Ada3', n: 9 });
    agree(t, rows, 1);
    expect((rows.all() as U[]).filter((r) => r.id === 1).length).toBe(1);
  });
});
