import { describe, expect, it } from 'vitest';
import { getEntityProjectionSeed } from './internals/entity-projection-seed';
import { entityMap } from './types';
import { signalTree } from './signal-tree';

type Ent = { id: number; name: string };
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

/**
 * THE ENTITY PROJECTION SEED.
 *
 * An external-consequence consumer maintaining an egress-eligible projection of
 * an `EntitySignal` needs a starting point when the relationship is created.
 * `Row[]` cannot be that starting point: it carries no identity, and after a
 * rekey it does not even carry the address.
 *
 * These are the three facts the seed must keep separate, and each test below
 * exists because conflating two of them is silently wrong rather than loudly
 * wrong.
 */
describe('entity projection seed', () => {
  it('⚠️ key cannot be recovered from the row payload', async () => {
    const tree = signalTree({ rows: entityMap<Ent, number>({ selectId: (e) => e.id }) });
    tree.$.rows.setAll([{ id: 1, name: 'a' }, { id: 2, name: 'b' }]);
    await flush();
    tree.$.rows.changeId(1, 77); // the REAL rekey, before any consumer exists
    await flush();

    const seed = getEntityProjectionSeed(tree.$.rows);
    expect(seed).toBeDefined();
    const first = seed![0] as { subjectId: number; key: number; row: Ent };
    expect(first.key).toBe(77);
    expect(first.row.id).toBe(1);
    // THE POINT: address and payload disagree, and only the seed knows the address.
    expect(first.key).not.toBe(first.row.id);
  });

  it('seed rows equal all() by construction, in order', async () => {
    const tree = signalTree({ rows: entityMap<Ent, number>({ selectId: (e) => e.id }) });
    tree.$.rows.setAll([{ id: 1, name: 'a' }, { id: 2, name: 'b' }, { id: 3, name: 'c' }]);
    await flush();
    tree.$.rows.removeOne(2);
    tree.$.rows.addOne({ id: 4, name: 'd' });
    tree.$.rows.changeId(1, 90);
    await flush();

    const seed = getEntityProjectionSeed(tree.$.rows)!;
    expect(seed.map((e) => e.row)).toEqual(tree.$.rows.all());
    expect(seed.map((e) => e.key)).toEqual(tree.$.rows.ids());
  });

  it('remove then re-add the same key yields a NEW subject in the seed', async () => {
    const tree = signalTree({ rows: entityMap<Ent, number>({ selectId: (e) => e.id }) });
    tree.$.rows.setAll([{ id: 1, name: 'a' }]);
    await flush();
    const before = getEntityProjectionSeed(tree.$.rows)![0].subjectId;
    tree.$.rows.removeOne(1);
    tree.$.rows.addOne({ id: 1, name: 'reused' });
    await flush();
    const after = getEntityProjectionSeed(tree.$.rows)![0].subjectId;
    expect(after).not.toBe(before);
  });

  it('CONTROL — a non-entity node has no seed', () => {
    const tree = signalTree({ n: 1 });
    expect(getEntityProjectionSeed(tree.$.n)).toBeUndefined();
  });
});
