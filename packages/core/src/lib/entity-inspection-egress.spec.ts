import { afterEach, describe, expect, it } from 'vitest';

import { entityMap } from './types';
import { link, type Link } from './link';
import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';
import { withWriteContext } from './write-context';

/**
 * INSPECTION EGRESS — ENTITY COLLECTIONS.
 *
 * The scalar/branch contract lives in `inspection-egress-conformance.spec.ts`.
 * A collection adds what value-shaped state never had: inspection can change
 * WHICH LIFETIMES EXIST, at WHICH ADDRESSES, in WHAT ORDER. So local and
 * eligible topology can diverge, and these are the rules for that divergence.
 *
 *   TRAVERSE, DON'T PROMOTE
 *     Adopting a subject that only inspection created finds its position by
 *     projecting LOCAL order onto the eligible set. Subjects stepped over on
 *     the way are positional intermediates, never adopted.
 *
 *   STRUCTURAL REFERENCE IS NOT CAUSAL DEPENDENCY
 *     A neighbour descriptor says how an operation related to topology at the
 *     time. It does not make the neighbour authoritative.
 *
 *   ADOPTION IS SEMANTIC-MINIMUM, NOT ANY-TOUCH
 *     An authored UPDATE of an inspection-created subject adopts it, because
 *     the update cannot be represented otherwise. An authored REMOVE of one
 *     does not, because "still absent" already represents it.
 */

type Ent = { id: number; name: string };
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
const INSPECTION = {
  intent: 'system',
  origin: 'devtools',
  participation: 'inspection',
} as const;
const ins = (fn: () => void) => withWriteContext(INSPECTION, fn);

const live: Link[] = [];
const track = (l: Link): Link => (live.push(l), l);
afterEach(() => {
  for (const l of live.splice(0)) l.dispose();
});

const make = () =>
  signalTree(
    { rows: entityMap<Ent, number>({ selectId: (e) => e.id }) },
    { enhancers: [transactions()] }
  );

/** Records every complete `Row[]` the endpoint is asked to publish. */
function recorder() {
  const sends: Ent[][] = [];
  return {
    sends,
    last: () => sends[sends.length - 1],
    names: () => (sends[sends.length - 1] ?? []).map((r) => r.name),
    endpoint: {
      set: (v: readonly Ent[]): Promise<void> => {
        sends.push(v.map((r) => ({ ...r })));
        return Promise.resolve();
      },
    },
  };
}

async function setup(seed: Ent[]) {
  const tree = make();
  tree.$.rows.setAll(seed);
  await flush();
  const r = recorder();
  const l = track(link(tree.$.rows, r.endpoint as never));
  return { tree, r, l };
}

const A = { id: 1, name: 'A' };
const B = { id: 2, name: 'B' };
const C = { id: 3, name: 'C' };

// ═══════════════════════════════════════════════════════════════════════════
describe('entity inspection does not hitchhike', () => {
  it('H1 an inspection REMOVE does not ride out on an unrelated authored update', async () => {
    const { tree, r, l } = await setup([A, B]);
    ins(() => tree.$.rows.removeOne(1));
    await flush();
    tree.$.rows.updateOne(2, { name: 'B-AUTHORED' });
    await flush();
    await l.settled();

    expect(r.names()).toEqual(['A', 'B-AUTHORED']);
    // CONTROL — locally the row really is gone.
    expect(tree.$.rows.ids()).toEqual([2]);
  });

  it('H2 an inspection ADD does not ride out on an unrelated authored update', async () => {
    const { tree, r, l } = await setup([A]);
    ins(() => tree.$.rows.addOne(B));
    await flush();
    tree.$.rows.updateOne(1, { name: 'A-AUTHORED' });
    await flush();
    await l.settled();

    // This is what kills any `entity.all()` fallback in reconciliation.
    expect(r.names()).toEqual(['A-AUTHORED']);
    expect(tree.$.rows.ids()).toEqual([1, 2]);
  });

  it('inspection alone publishes nothing', async () => {
    const { tree, r, l } = await setup([A, B]);
    tree.$.rows.updateOne(1, { name: 'A-AUTHORED' });
    await flush();
    await l.settled();
    const baseline = r.sends.length;

    ins(() => {
      tree.$.rows.removeOne(2);
      tree.$.rows.addOne(C);
      tree.$.rows.updateOne(1, { name: 'SCRUBBED' });
    });
    await flush();
    await l.settled();

    expect(r.sends.length).toBe(baseline);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('causal dependency adoption', () => {
  it('A1 authored UPDATE of an inspection-created subject adopts it', async () => {
    const { tree, r, l } = await setup([A]);
    ins(() => tree.$.rows.addOne(B));
    await flush();
    tree.$.rows.updateOne(2, { name: 'B-AUTHORED' });
    await flush();
    await l.settled();

    expect(r.names()).toEqual(['A', 'B-AUTHORED']);
  });

  it('⚠️ C2 TRAVERSE, DON’T PROMOTE — the intermediate stays excluded', async () => {
    const { tree, r, l } = await setup([A]);
    ins(() => {
      tree.$.rows.addOne(B); // anchored to eligible A
      tree.$.rows.addOne(C); // anchored to LATENT B
    });
    await flush();
    tree.$.rows.updateOne(3, { name: 'C-AUTHORED' });
    await flush();
    await l.settled();

    // C is placed by stepping OVER B to reach eligible A. B is never published.
    expect(r.names()).toEqual(['A', 'C-AUTHORED']);
    expect(tree.$.rows.ids()).toEqual([1, 2, 3]);
  });

  it('C3 MINIMALITY — authoring the shallow subject leaves the deeper one out', async () => {
    const { tree, r, l } = await setup([A]);
    ins(() => {
      tree.$.rows.addOne(B);
      tree.$.rows.addOne(C);
    });
    await flush();
    tree.$.rows.updateOne(2, { name: 'B-AUTHORED' });
    await flush();
    await l.settled();

    expect(r.names()).toEqual(['A', 'B-AUTHORED']);
  });

  it('C6 the SUCCESSOR direction traverses too', async () => {
    const { tree, r, l } = await setup([C]);
    ins(() => {
      tree.$.rows.prependOne(B);
      tree.$.rows.prependOne(A);
    });
    await flush();
    tree.$.rows.updateOne(1, { name: 'A-AUTHORED' });
    await flush();
    await l.settled();

    expect(r.names()).toEqual(['A-AUTHORED', 'C']);
  });

  it('A2 authored ADD adopts the vacancy it needs, and stays a NEW lifetime', async () => {
    const { tree, r, l } = await setup([A, B]);
    ins(() => tree.$.rows.removeOne(1));
    await flush();
    tree.$.rows.addOne({ id: 1, name: 'REAUTHORED' });
    await flush();
    await l.settled();

    // Exactly one row at key 1 — never the old lifetime beside the new one.
    const last = r.last();
    expect(last.filter((x) => x.id === 1)).toHaveLength(1);
    expect(last.map((x) => x.name)).toEqual(['B', 'REAUTHORED']);
  });

  it('A3 adoption stays minimal when unrelated inspection work is present', async () => {
    const { tree, r, l } = await setup([A, B]);
    ins(() => {
      tree.$.rows.removeOne(1); // unrelated vacancy
      tree.$.rows.addOne(C); // unrelated creation
    });
    await flush();
    tree.$.rows.updateOne(2, { name: 'B-AUTHORED' });
    await flush();
    await l.settled();

    expect(r.names()).toEqual(['A', 'B-AUTHORED']);
  });

  it('⚠️ an authored REMOVE of an inspection-created subject is value-neutral', async () => {
    // Adoption is semantic-minimum, not "any authored touch promotes".
    const { tree, r, l } = await setup([A]);
    tree.$.rows.updateOne(1, { name: 'A-AUTHORED' });
    await flush();
    await l.settled();
    const baseline = r.sends.length;

    ins(() => tree.$.rows.addOne(B));
    await flush();
    tree.$.rows.removeOne(2);
    await flush();
    await l.settled();

    // "Still absent" already represents the removal externally.
    expect(r.sends.length).toBe(baseline);
    expect(r.names()).toEqual(['A-AUTHORED']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('identity survives address changes', () => {
  it('R1 inspection rekey then authored update hits the SAME lifetime', async () => {
    const { tree, r, l } = await setup([A, B]);
    ins(() => tree.$.rows.changeId(1, 88));
    await flush();
    tree.$.rows.updateOne(88, { name: 'A-AUTHORED' });
    await flush();
    await l.settled();

    // One lifetime updated in place — not a remove plus a new subject.
    expect(r.names()).toEqual(['A-AUTHORED', 'B']);
    expect(r.last()).toHaveLength(2);
  });

  it('an AUTHORED rekey does not change the published Row[]', async () => {
    const { tree, r, l } = await setup([A, B]);
    tree.$.rows.updateOne(1, { name: 'A-AUTHORED' });
    await flush();
    await l.settled();
    const before = r.sends.length;

    tree.$.rows.changeId(1, 77);
    await flush();
    await l.settled();

    // The address moved; the value did not. A key is not part of `Row[]`.
    if (r.sends.length > before) expect(r.names()).toEqual(['A-AUTHORED', 'B']);
    expect(tree.$.rows.ids()).toEqual([77, 2]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('ordinary authored collection work still publishes', () => {
  it('CONTROL add / update / remove / setAll all reach the endpoint in order', async () => {
    const { tree, r, l } = await setup([A]);
    tree.$.rows.addOne(B);
    await flush();
    tree.$.rows.updateOne(1, { name: 'A2' });
    await flush();
    tree.$.rows.removeOne(2);
    await flush();
    await l.settled();
    expect(r.names()).toEqual(['A2']);

    tree.$.rows.setAll([C, A]);
    await flush();
    await l.settled();
    expect(r.names()).toEqual(['C', 'A']);
    expect(r.last().map((x) => x.id)).toEqual(tree.$.rows.ids());
  });

  it('prependOne publishes in the prepended position', async () => {
    const { tree, r, l } = await setup([B]);
    tree.$.rows.prependOne(A);
    await flush();
    await l.settled();
    expect(r.names()).toEqual(['A', 'B']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('races and inbound authority', () => {
  it('inspection during an in-flight send never reaches the endpoint', async () => {
    const tree = make();
    tree.$.rows.setAll([A]);
    await flush();
    const sends: Ent[][] = [];
    let release!: () => void;
    let opened!: () => void;
    const inFlight = new Promise<void>((r) => (opened = r));
    const l = track(
      link(tree.$.rows, {
        set: (v: readonly Ent[]): Promise<void> => {
          sends.push(v.map((x) => ({ ...x })));
          if (sends.length === 1) {
            opened();
            return new Promise<void>((r) => (release = r));
          }
          return Promise.resolve();
        },
      } as never)
    );

    tree.$.rows.updateOne(1, { name: 'A-AUTHORED' });
    await flush();
    await inFlight;
    expect(sends).toHaveLength(1); // CONTROL

    ins(() => tree.$.rows.addOne(B));
    await flush();
    release();
    await l.settled();

    for (const s of sends) expect(s.map((x) => x.name)).not.toContain('B');
  });

  it('⚠️ ENTITY-I4 inbound truth equal to the inspected view is still adopted', async () => {
    // The collection analogue of I4: applying inbound truth that already
    // matches what is displayed emits no mutation, yet authority changed.
    const tree = make();
    tree.$.rows.setAll([A]);
    await flush();
    const r = recorder();
    let push!: (v: readonly Ent[]) => void;
    const l = track(
      link(tree.$.rows, {
        ...(r.endpoint as never),
        subscribe: (next: (v: readonly Ent[]) => void) => {
          push = next;
          return () => undefined;
        },
      } as never)
    );

    ins(() => tree.$.rows.addOne(B));
    await flush();
    // Inbound agrees with the scrubbed view exactly.
    push([A, B]);
    await flush();
    await l.settled();

    r.sends.length = 0;
    tree.$.rows.updateOne(1, { name: 'A-AUTHORED' });
    await flush();
    await l.settled();

    // B is now authoritative because the ENDPOINT said so, not because a
    // developer was looking at it.
    expect(r.names()).toEqual(['A-AUTHORED', 'B']);
  });
});
