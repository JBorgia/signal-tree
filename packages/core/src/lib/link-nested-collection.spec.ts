import { afterEach, describe, expect, it } from 'vitest';

import { entityMap } from './types';
import { link, type Link } from './link';
import { signalTree } from './signal-tree';
import { withWriteContext } from './write-context';

/**
 * A COLLECTION NESTED INSIDE A BRANCH SOURCE.
 *
 * ⚠️ REGRESSION CARRIER. `48ad4e4a` introduced the eligible projection for
 * scalar and branch sources and patched branch values purely BY PATH. A
 * collection mutation publishes at `dashboard.rows.<key>`, which a branch Link
 * accepts by path prefix, so the snapshot gained `rows["<key>"]` while the
 * collection's own `all` went stale. Before that commit the same case published
 * correctly; the branch accessor's own read was never wrong.
 *
 * The repair gives each nested collection its own projection instance — the
 * same algorithm a direct collection source uses, with separate state.
 *
 * ⚠️ AND THE OBVIOUS REPAIR IS THE WRONG ONE. "A collection changed, so re-read
 * the branch" yields the right SHAPE while destroying the reason the projection
 * exists: current state may hold an inspection-only change that a later eligible
 * write would then carry outward. `R7` is what makes that distinction
 * observable, and shape assertions alone would not catch it.
 */

type Ent = { id: number; n: string };
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
const INSPECTION = {
  intent: 'system',
  origin: 'devtools',
  participation: 'inspection',
} as const;

const live: Link[] = [];
const track = (l: Link): Link => (live.push(l), l);
afterEach(() => {
  for (const l of live.splice(0)) l.dispose();
});

const em = () => entityMap<Ent, number>({ selectId: (e) => e.id });

async function branchLink() {
  const tree = signalTree({ dashboard: { title: 'x', rows: em() } });
  await flush();
  const got: unknown[] = [];
  const l = track(
    link(tree.$.dashboard, { set: (v: unknown) => void got.push(v) } as never)
  );
  return { tree, got, l, last: () => got[got.length - 1] };
}

describe('a collection nested under a branch Link', () => {
  it('R1 an add publishes the CANONICAL collection value', async () => {
    const { tree, l, last } = await branchLink();
    tree.$.dashboard.rows.addOne({ id: 1, n: 'a' });
    await flush();
    await l.settled();
    expect(last()).toEqual({ title: 'x', rows: { all: [{ id: 1, n: 'a' }] } });
  });

  it('R2 an update publishes the updated canonical value', async () => {
    const { tree, l, last } = await branchLink();
    tree.$.dashboard.rows.addOne({ id: 1, n: 'a' });
    await flush();
    tree.$.dashboard.rows.updateOne(1, { n: 'b' });
    await flush();
    await l.settled();
    expect(last()).toEqual({ title: 'x', rows: { all: [{ id: 1, n: 'b' }] } });
  });

  it('R3 a remove leaves NO phantom address key', async () => {
    // Add-only repair could mask key creation rather than prevent it.
    const { tree, l, last } = await branchLink();
    tree.$.dashboard.rows.addOne({ id: 1, n: 'a' });
    await flush();
    tree.$.dashboard.rows.removeOne(1);
    await flush();
    await l.settled();
    expect(last()).toEqual({ title: 'x', rows: { all: [] } });
  });

  it('R4 an ordinary sibling still patches by path', async () => {
    // The adjacent preserved anchor.
    const { tree, l, last } = await branchLink();
    tree.$.dashboard.rows.addOne({ id: 1, n: 'a' });
    await flush();
    tree.$.dashboard.title.set('renamed');
    await flush();
    await l.settled();
    expect(last()).toEqual({
      title: 'renamed',
      rows: { all: [{ id: 1, n: 'a' }] },
    });
  });

  it('R5 a collection at DEEPER ordinary depth', async () => {
    // Guards against a one-level `rows` special case.
    const tree = signalTree({ dashboard: { panel: { rows: em() }, title: 't' } });
    await flush();
    const got: unknown[] = [];
    const l = track(
      link(tree.$.dashboard, { set: (v: unknown) => void got.push(v) } as never)
    );
    tree.$.dashboard.panel.rows.addOne({ id: 2, n: 'deep' });
    await flush();
    await l.settled();
    expect(got[got.length - 1]).toEqual({
      title: 't',
      panel: { rows: { all: [{ id: 2, n: 'deep' }] } },
    });
  });

  it('R6 a DIRECT collection source is unchanged', async () => {
    const tree = signalTree({ rows: em() });
    await flush();
    const got: unknown[] = [];
    const l = track(link(tree.$.rows, { set: (v: unknown) => void got.push(v) } as never));
    tree.$.rows.addOne({ id: 1, n: 'a' });
    await flush();
    await l.settled();
    expect(got[got.length - 1]).toEqual([{ id: 1, n: 'a' }]);
  });

  it('⚠️ R7 an inspection collection change does not advance, and does not hitchhike', async () => {
    // The load-bearing case. A re-read repair would pass every test above and
    // fail this one.
    const { tree, l, got, last } = await branchLink();
    tree.$.dashboard.rows.addOne({ id: 1, n: 'authored' });
    await flush();
    await l.settled();
    const beforeInspection = got.length;

    withWriteContext(INSPECTION, () =>
      tree.$.dashboard.rows.updateOne(1, { n: 'SCRUBBED' })
    );
    await flush();
    await l.settled();
    expect(got.length).toBe(beforeInspection); // inspection alone publishes nothing

    // A later UNRELATED authored write must not carry the scrub outward.
    tree.$.dashboard.title.set('renamed');
    await flush();
    await l.settled();
    expect(last()).toEqual({
      title: 'renamed',
      rows: { all: [{ id: 1, n: 'authored' }] },
    });
    // Local state DID change — inspection is not suppression of the write.
    expect(tree.$.dashboard.rows.all()).toEqual([{ id: 1, n: 'SCRUBBED' }]);
  });

  it('⚠️ R9 THE DISCRIMINATOR — an authored collection change must not carry an earlier scrub', async () => {
    // R7 was NOT strong enough: its later write was to a sibling, so a re-read
    // repair never fired and passed anyway. The hitchhike requires an authored
    // COLLECTION event AFTER an inspection collection event — that is when a
    // re-read of current state would sweep the scrubbed row outward.
    const { tree, l, last } = await branchLink();
    tree.$.dashboard.rows.addOne({ id: 1, n: 'authored' });
    await flush();
    await l.settled();

    withWriteContext(INSPECTION, () =>
      tree.$.dashboard.rows.updateOne(1, { n: 'SCRUBBED' })
    );
    await flush();

    // An authored change to a DIFFERENT row: eligible, and it must publish the
    // eligible collection — row 1 as authored, not as inspected.
    tree.$.dashboard.rows.addOne({ id: 2, n: 'second' });
    await flush();
    await l.settled();

    expect(last()).toEqual({
      title: 'x',
      rows: {
        all: [
          { id: 1, n: 'authored' },
          { id: 2, n: 'second' },
        ],
      },
    });
    expect(tree.$.dashboard.rows.all()).toEqual([
      { id: 1, n: 'SCRUBBED' },
      { id: 2, n: 'second' },
    ]);
  });

  it('R8 a realized collection change IS eligible', async () => {
    const { tree, l, last } = await branchLink();
    withWriteContext(
      { intent: 'system', origin: 'external', participation: 'realized' },
      () => tree.$.dashboard.rows.addOne({ id: 3, n: 'realized' })
    );
    await flush();
    await l.settled();
    expect(last()).toEqual({
      title: 'x',
      rows: { all: [{ id: 3, n: 'realized' }] },
    });
  });
});
