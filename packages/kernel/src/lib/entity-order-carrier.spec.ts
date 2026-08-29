import { describe, expect, it } from 'vitest';
import { entityMap } from './types';
import { getEntityProjectionSeed } from './internals/entity-projection-seed';
import { getPathNotifier, resetPathNotifier } from './path-notifier';
import { signalTree } from './signal-tree';

type Ent = { id: number; name: string };
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const make = () => signalTree({ rows: entityMap<Ent, number>({ selectId: (e) => e.id }) });

async function probe(label: string, seed: Ent[], run: (t: ReturnType<typeof make>) => void) {
  resetPathNotifier();
  const effects: unknown[] = [];
  const off = getPathNotifier().subscribe('**', (_v, _p, _path, _o, _or, _s, _pos, meta) => {
    const se = (meta as Record<string, unknown> | undefined)?.['structuralEffect'];
    if (se) effects.push(se);
  });
  const tree = make();
  tree.$.rows.setAll(seed);
  await flush();
  const before = getEntityProjectionSeed(tree.$.rows)!.map((e) => e.subjectId);
  effects.length = 0;
  run(tree);
  await flush();
  off();
  const after = getEntityProjectionSeed(tree.$.rows)!.map((e) => e.subjectId);
  console.info(`\n### ${label}`);
  console.info('    subjects before:', JSON.stringify(before));
  console.info('    effects        :', JSON.stringify(effects));
  console.info('    subjects after :', JSON.stringify(after));
  console.info('    ids after      :', JSON.stringify(tree.$.rows.ids()));
  return { before, effects, after };
}

const A = { id: 1, name: 'a' };
const B = { id: 2, name: 'b' };
const C = { id: 3, name: 'c' };

/**
 * THE ORDERING CARRIER VOCABULARY.
 *
 * `beforeSubject` and `afterSubject` are NEIGHBOUR DESCRIPTORS, not insertion
 * directives:
 *
 *   beforeSubject   the subject immediately BEFORE this one (its PREDECESSOR)
 *   afterSubject    the subject immediately AFTER this one  (its SUCCESSOR)
 *
 * Absent means there is no neighbour on that side — the subject is at that end
 * of the collection, or the collection was empty.
 *
 * ⚠️ THIS FILE EXISTS BECAUSE THE NAMES WERE MISREAD. `beforeSubject: 3` on an
 * append was interpreted as "insert before subject 3", which would have built
 * the eligible order backwards in every append. The measured local order
 * disproved it immediately. Any consumer reconstructing collection order from
 * structural effects must read these as neighbours:
 *
 *   add:    insert AFTER `beforeSubject`; else BEFORE `afterSubject`;
 *           else the collection was empty.
 *   remove: both neighbours are reported where they exist, which is what makes
 *           a restore able to put the subject back in place.
 */
describe('ORDER CARRIER — beforeSubject/afterSubject are NEIGHBOURS', () => {
  it('addOne onto [A,B,C] (appends)', async () => {
    const r = await probe('addOne D', [A, B, C], (t) => t.$.rows.addOne({ id: 4, name: 'd' }));
    // PREDECESSOR, not an insert-before target: 4 lands AFTER 3.
    expect(r.effects).toEqual([
      { kind: 'add', subject: 4, key: 4, value: { id: 4, name: 'd' }, beforeSubject: 3 },
    ]);
    expect(r.after).toEqual([1, 2, 3, 4]);
  });
  it('prependOne onto [A,B,C]', async () => {
    const r = await probe('prependOne D', [A, B, C], (t) =>
      t.$.rows.prependOne({ id: 4, name: 'd' })
    );
    // SUCCESSOR: 4 lands BEFORE 1.
    expect(r.effects).toEqual([
      { kind: 'add', subject: 4, key: 4, value: { id: 4, name: 'd' }, afterSubject: 1 },
    ]);
    expect(r.after).toEqual([4, 1, 2, 3]);
  });
  it('remove FIRST — only a successor exists', async () => {
    const r = await probe('removeOne(1) first', [A, B, C], (t) => t.$.rows.removeOne(1));
    expect(r.effects[0]).toMatchObject({ kind: 'remove', subject: 1, afterSubject: 2 });
    // ⚠️ The KEY is present and undefined — `JSON.stringify` omits it, which is
    // not the same as absence. Assert the value, never the key's absence.
    expect((r.effects[0] as Record<string, unknown>)['beforeSubject']).toBeUndefined();
    expect(r.after).toEqual([2, 3]);
  });
  it('remove MIDDLE — BOTH neighbours are reported', async () => {
    const r = await probe('removeOne(2) middle', [A, B, C], (t) => t.$.rows.removeOne(2));
    expect(r.effects[0]).toMatchObject({
      kind: 'remove', subject: 2, beforeSubject: 1, afterSubject: 3,
    });
    expect(r.after).toEqual([1, 3]);
  });
  it('remove LAST — only a predecessor exists', async () => {
    const r = await probe('removeOne(3) last', [A, B, C], (t) => t.$.rows.removeOne(3));
    expect(r.effects[0]).toMatchObject({ kind: 'remove', subject: 3, beforeSubject: 2 });
    expect((r.effects[0] as Record<string, unknown>)['afterSubject']).toBeUndefined();
    expect(r.after).toEqual([1, 2]);
  });
  it('add into an EMPTY collection — NEITHER neighbour', async () => {
    const r = await probe('addOne into empty', [], (t) => t.$.rows.addOne(A));
    const e = r.effects[0] as Record<string, unknown>;
    expect(e['beforeSubject']).toBeUndefined();
    expect(e['afterSubject']).toBeUndefined();
    expect(r.after).toEqual([1]);
  });
});
