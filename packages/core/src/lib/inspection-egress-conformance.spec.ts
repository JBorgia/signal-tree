import { afterEach, describe, expect, it } from 'vitest';

import {
  clearTreeErrorListenersForTesting,
  onTreeError,
  type TreeErrorEvent,
} from './internals/error-reporter';
import { link, type Link } from './link';
import { restoration } from '../enhancers/restoration/restoration';
import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';
import { undoable } from './undoable';
import { withWriteContext } from './write-context';

/**
 * INSPECTION EGRESS CONFORMANCE — scalar and branch sources.
 *
 * THE INVARIANT:
 *
 *   An inspection write may change observable in-process state for diagnostic
 *   viewing, but must not acquire external causal authority or produce an
 *   external/durable consequence.
 *
 * Keyed on `participation: 'inspection'`, never on `origin: 'devtools'`.
 * Provenance says where a write came from; participation says which causal
 * mechanisms it may take part in. The origin-only control below is what keeps
 * those axes from being recoupled.
 *
 * FOUR DISTINCT CONCEPTS, which the incumbent compressed into "current state":
 *
 *   observable state   what the tree holds, including a devtools scrub
 *   participation      whether a write may advance external authority
 *   eligible           the latest value permitted to become external truth
 *   knownY             what the endpoint has acknowledged
 *
 * ⚠️ SCOPE. `EntitySignal -> Row[]` sources are NOT covered here. Rekey proved
 * a collection projection has a different identity basis — SubjectId, not key
 * and not path — so it is built separately rather than folded into the branch
 * reducer. Until then this file's claims are scalar and branch only.
 */

type S = { theme: string; density: number };
const INITIAL: S = { theme: 'light', density: 1 };
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
  clearTreeErrorListenersForTesting();
});

const makeTree = () =>
  signalTree({ s: { ...INITIAL } }, { enhancers: [transactions(), restoration()] });
const makeScalar = () =>
  signalTree({ n: 0 }, { enhancers: [transactions(), restoration()] });

/** Records every value the endpoint is actually asked to make durable. */
function recorder() {
  const got: S[] = [];
  return {
    got,
    themes: () => got.map((v) => v.theme),
    endpoint: {
      set: (v: S): Promise<void> => {
        got.push({ ...v });
        return Promise.resolve();
      },
    },
  };
}

/** An endpoint whose first `set` is held open until the test releases it. */
function gated() {
  const got: S[] = [];
  let release!: () => void;
  let opened!: () => void;
  const inFlight = new Promise<void>((r) => (opened = r));
  return {
    got,
    themes: () => got.map((v) => v.theme),
    inFlight,
    release: () => release(),
    endpoint: {
      set: (v: S): Promise<void> => {
        got.push({ ...v });
        if (got.length === 1) {
          opened();
          return new Promise<void>((r) => (release = r));
        }
        return Promise.resolve();
      },
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
describe('the axis: participation, not provenance', () => {
  it('authored egresses; inspection does not', async () => {
    const r = recorder();
    const tree = makeTree();
    await flush();
    const l = track(link(tree.$.s, r.endpoint));

    tree.$.s.theme.set('authored');
    await flush();
    await l.settled();
    expect(r.themes()).toEqual(['authored']); // CONTROL

    withWriteContext(INSPECTION, () => tree.$.s.theme.set('SCRUBBED'));
    await flush();
    await l.settled();

    expect(r.themes()).toEqual(['authored']);
    // Local state DID move — inspection is not suppression of the write.
    expect(tree.$.s.theme()).toBe('SCRUBBED');
  });

  it('⚠️ ORIGIN-ONLY CONTROL — devtools provenance without inspection DOES egress', async () => {
    // The guard that keeps the two axes separate. If this ever fails, someone
    // has recoupled policy to provenance.
    const r = recorder();
    const tree = makeTree();
    await flush();
    const l = track(link(tree.$.s, r.endpoint));

    withWriteContext({ intent: 'system', origin: 'devtools' }, () =>
      tree.$.s.theme.set('devtools-authored')
    );
    await flush();
    await l.settled();

    expect(r.themes()).toEqual(['devtools-authored']);
  });

  it('undo/restoration is causally eligible and DOES egress', async () => {
    const r = recorder();
    const tree = makeTree();
    await flush();
    const l = track(link(tree.$.s, r.endpoint));

    withWriteContext({ intent: 'system', origin: 'restoration' }, () => {
      undoable(() => tree.$.s.theme.set('undone'));
    });
    await flush();
    await l.settled();

    expect(r.themes()).toEqual(['undone']);
  });

  it('SCALAR source — the eligible value arrives complete', async () => {
    const got: number[] = [];
    const tree = makeScalar();
    await flush();
    const l = track(
      link(tree.$.n, { set: (v: number) => void got.push(v) })
    );

    tree.$.n.set(5);
    await flush();
    await l.settled();
    expect(got).toEqual([5]); // CONTROL

    withWriteContext(INSPECTION, () => tree.$.n.set(99));
    await flush();
    await l.settled();

    expect(got).toEqual([5]);
    expect(tree.$.n()).toBe(99);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('RELATIONSHIP-CREATION ADOPTION — the creation boundary', () => {
  it('BASE-1 inspection BEFORE the link exists is adopted as the baseline', async () => {
    // A relationship owns authority from the moment it EXISTS, never
    // retroactively. This does not reclassify the value's provenance — it stays
    // inspection-derived — it defines only what this relationship starts from.
    const r = recorder();
    const tree = makeTree();
    await flush();

    tree.$.s.theme.set('A');
    withWriteContext(INSPECTION, () => tree.$.s.theme.set('B-INSPECTION'));
    await flush();

    const l = track(link(tree.$.s, r.endpoint)); // ← the adoption boundary
    tree.$.s.density.set(9);
    await flush();
    await l.settled();

    expect(r.got).toEqual([{ theme: 'B-INSPECTION', density: 9 }]);
  });

  it('BASE-2 inspection AFTER creation can never advance the projection', async () => {
    const r = recorder();
    const tree = makeTree();
    await flush();
    const l = track(link(tree.$.s, r.endpoint)); // ← created FIRST

    tree.$.s.theme.set('A');
    withWriteContext(INSPECTION, () => tree.$.s.theme.set('B-INSPECTION'));
    await flush();
    tree.$.s.density.set(9);
    await flush();
    await l.settled();

    // The creation boundary is the ONLY difference from BASE-1.
    for (const v of r.got) expect(v.theme).not.toBe('B-INSPECTION');
    expect(r.got[r.got.length - 1]).toEqual({ theme: 'A', density: 9 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('ordering within one delivery batch', () => {
  it('authored A then inspection B — eligible is A', async () => {
    const r = recorder();
    const tree = makeTree();
    await flush();
    const l = track(link(tree.$.s, r.endpoint));

    tree.$.s.theme.set('A');
    withWriteContext(INSPECTION, () => tree.$.s.theme.set('B-INSPECTION'));
    await flush();
    await l.settled();

    expect(r.themes()).toEqual(['A']);
  });

  it('inspection B then authored C — eligible is C', async () => {
    const r = recorder();
    const tree = makeTree();
    await flush();
    const l = track(link(tree.$.s, r.endpoint));

    withWriteContext(INSPECTION, () => tree.$.s.theme.set('B-INSPECTION'));
    await flush();
    tree.$.s.theme.set('C');
    await flush();
    await l.settled();

    expect(r.themes()).toEqual(['C']);
  });

  it('⚠️ SAME-PATH TRIPLE authored A, inspection B, authored C — eligible is C', async () => {
    // Batching may group delivery by path. It may not collapse participation:
    // three events on one semantic location must still yield the final ELIGIBLE
    // truth, not merely the final value.
    const r = recorder();
    const tree = makeTree();
    await flush();
    const l = track(link(tree.$.s, r.endpoint));

    tree.$.s.theme.set('A');
    withWriteContext(INSPECTION, () => tree.$.s.theme.set('B-INSPECTION'));
    tree.$.s.theme.set('C');
    await flush();
    await l.settled();

    expect(r.themes()).toEqual(['C']);
  });

  it('⚠️ NO HITCHHIKING — inspection on one field, authored on another', async () => {
    // The load-bearing mixed-field case. An unrelated authored write does not
    // constitute adoption of a diagnostic scrub on a different field; otherwise
    // inspection acquires authority indirectly.
    const r = recorder();
    const tree = makeTree();
    await flush();
    const l = track(link(tree.$.s, r.endpoint));

    tree.$.s.theme.set('A');
    await flush();
    await l.settled();

    withWriteContext(INSPECTION, () => tree.$.s.theme.set('B-INSPECTION'));
    await flush();
    tree.$.s.density.set(9);
    await flush();
    await l.settled();

    expect(r.got[r.got.length - 1]).toEqual({ theme: 'A', density: 9 });
    for (const v of r.got) expect(v.theme).not.toBe('B-INSPECTION');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('the in-flight race', () => {
  it('inspection while a send is unresolved never reaches the endpoint', async () => {
    const g = gated();
    const tree = makeTree();
    await flush();
    const l = track(link(tree.$.s, g.endpoint));

    tree.$.s.theme.set('A');
    await flush();
    await g.inFlight;
    expect(g.themes()).toEqual(['A']); // CONTROL: A is genuinely in flight

    withWriteContext(INSPECTION, () => tree.$.s.theme.set('B-INSPECTION'));
    await flush();
    g.release();
    await l.settled();

    expect(g.themes()).toEqual(['A']);
  });

  it('an AUTHORED write during flight still reconciles — LINK-RACE-1 preserved', async () => {
    // The projection must not be mistaken for "stop reconciling". A write that
    // lands mid-flight is still picked up on the next lap.
    const g = gated();
    const tree = makeTree();
    await flush();
    const l = track(link(tree.$.s, g.endpoint));

    tree.$.s.theme.set('A');
    await flush();
    await g.inFlight;

    tree.$.s.theme.set('C');
    await flush();
    g.release();
    await l.settled();

    expect(g.themes()).toEqual(['A', 'C']);
  });

  it('inspection alone sends nothing and settles', async () => {
    const r = recorder();
    const tree = makeTree();
    await flush();
    const l = track(link(tree.$.s, r.endpoint));

    tree.$.s.theme.set('A');
    await flush();
    await l.settled();
    const baseline = r.got.length;

    withWriteContext(INSPECTION, () => tree.$.s.theme.set('B-INSPECTION'));
    await flush();
    const settled = await Promise.race([
      l.settled().then(() => true),
      new Promise<boolean>((res) => setTimeout(() => res(false), 200)),
    ]);

    expect(settled).toBe(true);
    expect(r.got.length).toBe(baseline);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('inbound external truth is authoritative', () => {
  it('I1 retrieve() sets the projection directly', async () => {
    const r = recorder();
    const tree = makeTree();
    await flush();
    const external: S = { theme: 'C-EXTERNAL', density: 4 };
    const l = track(
      link(tree.$.s, { ...r.endpoint, get: (): S => ({ ...external }) })
    );

    tree.$.s.theme.set('A');
    await flush();
    await l.settled();
    withWriteContext(INSPECTION, () => tree.$.s.theme.set('B-INSPECTION'));
    await flush();

    await l.retrieve();
    await flush();
    await l.settled();
    expect(tree.$.s()).toEqual(external);

    // A later unrelated authored write carries the INBOUND truth, not A or B.
    r.got.length = 0;
    tree.$.s.density.set(9);
    await flush();
    await l.settled();
    expect(r.got[r.got.length - 1]).toEqual({ theme: 'C-EXTERNAL', density: 9 });
  });

  it('I2 subscribe() sets the projection directly', async () => {
    const r = recorder();
    const tree = makeTree();
    await flush();
    let push!: (v: S) => void;
    const l = track(
      link(tree.$.s, {
        ...r.endpoint,
        subscribe: (next: (v: S) => void) => {
          push = next;
          return () => undefined;
        },
      })
    );

    withWriteContext(INSPECTION, () => tree.$.s.theme.set('B-INSPECTION'));
    await flush();
    push({ theme: 'C-EXTERNAL', density: 4 });
    await flush();
    await l.settled();

    r.got.length = 0;
    tree.$.s.density.set(9);
    await flush();
    await l.settled();
    expect(r.got[r.got.length - 1]).toEqual({ theme: 'C-EXTERNAL', density: 9 });
  });

  it('⚠️ I4 inbound truth that COINCIDES with an inspection value is still adopted', async () => {
    // The case that discriminates a DIRECT inbound assignment from reducing the
    // inbound write's own notifications. Found by a surviving mutation: I1-I3
    // all pass either way, because writing the inbound value normally emits
    // notifications that reconstruct it.
    //
    // Here the endpoint's truth for `theme` happens to EQUAL the current
    // inspection-contaminated local value. Applying it therefore emits NO
    // notification for `theme` — nothing changed locally — so a reduction-based
    // projection would keep the stale authored 'A'. But the endpoint has spoken:
    // external truth is authoritative for this relationship, and a value does
    // not stop being authoritative because it coincides with what a developer
    // happened to be viewing.
    const r = recorder();
    const tree = makeTree();
    await flush();
    let push!: (v: S) => void;
    const l = track(
      link(tree.$.s, {
        ...r.endpoint,
        subscribe: (next: (v: S) => void) => {
          push = next;
          return () => undefined;
        },
      })
    );

    tree.$.s.theme.set('A');
    await flush();
    await l.settled();
    withWriteContext(INSPECTION, () => tree.$.s.theme.set('B-INSPECTION'));
    await flush();

    // Inbound truth agrees with the scrubbed value on `theme`, differs on density.
    push({ theme: 'B-INSPECTION', density: 4 });
    await flush();
    await l.settled();

    r.got.length = 0;
    tree.$.s.density.set(9);
    await flush();
    await l.settled();

    // Adopted from the endpoint — NOT reverted to the stale authored 'A'.
    expect(r.got[r.got.length - 1]).toEqual({ theme: 'B-INSPECTION', density: 9 });
  });

  it('I3 inspection AFTER inbound does not advance the projection', async () => {
    const r = recorder();
    const tree = makeTree();
    await flush();
    let push!: (v: S) => void;
    const l = track(
      link(tree.$.s, {
        ...r.endpoint,
        subscribe: (next: (v: S) => void) => {
          push = next;
          return () => undefined;
        },
      })
    );

    push({ theme: 'C-EXTERNAL', density: 4 });
    await flush();
    await l.settled();

    withWriteContext(INSPECTION, () => tree.$.s.theme.set('B-INSPECTION'));
    await flush();
    r.got.length = 0;
    tree.$.s.density.set(9);
    await flush();
    await l.settled();

    expect(r.got[r.got.length - 1]).toEqual({ theme: 'C-EXTERNAL', density: 9 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('failure recovery participates correctly', () => {
  it('F1 a rejected send recovers with the authored value, never the inspection one', async () => {
    const seen: TreeErrorEvent[] = [];
    onTreeError((e) => void seen.push(e));

    const attempts: string[] = [];
    let failFirst = true;
    const tree = makeTree();
    await flush();
    const l = track(
      link(tree.$.s, {
        set: (v: S): Promise<void> => {
          attempts.push(v.theme);
          if (failFirst) {
            failFirst = false;
            return Promise.reject(new Error('disk full'));
          }
          return Promise.resolve();
        },
      })
    );

    tree.$.s.theme.set('A');
    await flush();
    await l.settled();

    withWriteContext(INSPECTION, () => tree.$.s.theme.set('B-INSPECTION'));
    await flush();
    tree.$.s.theme.set('C');
    await flush();
    await l.settled();

    expect(attempts).toEqual(['A', 'C']);
    expect(seen.filter((e) => e.operation === 'link:set')).toHaveLength(1);
  });

  it('F2 mixed-field recovery uses the eligible projection', async () => {
    const attempts: S[] = [];
    let failFirst = true;
    const tree = makeTree();
    await flush();
    const l = track(
      link(tree.$.s, {
        set: (v: S): Promise<void> => {
          attempts.push({ ...v });
          if (failFirst) {
            failFirst = false;
            return Promise.reject(new Error('disk full'));
          }
          return Promise.resolve();
        },
      })
    );

    tree.$.s.theme.set('A');
    await flush();
    await l.settled();

    withWriteContext(INSPECTION, () => tree.$.s.theme.set('B-INSPECTION'));
    await flush();
    tree.$.s.density.set(9);
    await flush();
    await l.settled();

    expect(attempts[attempts.length - 1]).toEqual({ theme: 'A', density: 9 });
    for (const v of attempts) expect(v.theme).not.toBe('B-INSPECTION');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('the boundary stays complete-value', () => {
  it('every eligible send is a COMPLETE branch value', async () => {
    // Internal projection maintenance is a patch; the public boundary is not.
    const r = recorder();
    const tree = makeTree();
    await flush();
    const l = track(link(tree.$.s, r.endpoint));

    tree.$.s.theme.set('A');
    await flush();
    withWriteContext(INSPECTION, () => tree.$.s.theme.set('B-INSPECTION'));
    await flush();
    tree.$.s.density.set(9);
    await flush();
    await l.settled();

    expect(r.got.length).toBeGreaterThan(0); // CONTROL
    for (const v of r.got) {
      expect(Object.keys(v).sort()).toEqual(['density', 'theme']);
    }
  });
});
