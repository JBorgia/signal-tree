import { describe, expect, it } from 'vitest';

import { deepEqual } from './utils';
import { entityMap } from './types';
import { external } from './external';
import { getPathNotifier } from './path-notifier';
import { getPositionRegistry } from './internals/position-registry';
import { restoration } from '../enhancers/restoration/restoration';
import { scheduleDurableConsequence } from './internals/commit-consequence';
import { link as productionLink } from './link';
import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';

/**
 * DEMARCATION-0 — THE SMALLEST PUBLIC BOUNDARY.
 *
 * ```text
 * NULL       a correct public `link(x, endpoint)` can be implemented on
 *            INTERNAL settlement-aware observation. No generic public
 *            `onCommitted()` or `afterCommit()` is required.
 * FALSIFIER  some behaviour link needs — or a demonstrated third-party use
 *            case — becomes impossible unless that authority is public.
 * ```
 *
 * ⚠️ THIS CORRECTS A DRIFT I WAS PART OF. AFTER-COMMIT-1 proved
 * `afterCommit(effect)` has a coherent contract, and I treated coherence as a
 * warrant for publishing it. The standing rule of this audit is that only a
 * DEMONSTRATED THIRD-PARTY AUTHORING NEED justifies a public primitive — applied
 * rigorously to `stored`, `persistence` and `loader`, and not applied to the
 * primitives I had just discovered. Both are reclassified:
 *
 * ```text
 * commit consequence            EARNED INTERNAL CAPABILITY
 * `afterCommit(effect)`         PUBLIC SURVIVAL UNPROVEN
 * committed-state observation   EARNED INTERNAL CAPABILITY
 * `onCommitted(x, cb)`          PUBLIC SURVIVAL UNPROVEN
 * ```
 *
 * The AFTER-COMMIT-0/1 tests stay: they prove the internal model, which is what
 * a link is built out of.
 *
 * ⚠️ ONE PRIOR RESULT CHANGES STATUS RATHER THAN VANISHING. EGRESS-0 showed a
 * USER-LAND link is implementable GIVEN A PUBLIC egress gate. With the gate
 * private that does not disappear — it inverts, and becomes the reason `link()`
 * must be core. Recorded as a conditional, not contradicted.
 *
 * The public story is one sentence:
 *
 *     `link(x, endpoint)` keeps SignalTree state X and external state Y
 *     synchronised correctly across SignalTree settlement semantics.
 *
 * Everything an application wants to DO because X changed stays application
 * code, written with ordinary Angular reactivity.
 *
 * ## Mutation check on the composition
 *
 * ```text
 * drop owner isolation            1 of 16 fails
 * drop the reconciliation loop    1 of 16 fails
 * drop the flush turn boundary    1 of 16 fails
 * drop the loop equality guard    HANGS — it is the loop's only termination
 *                                 condition
 * drop a separate echo check      nothing fails, because there ISN'T one:
 *                                 the loop's first iteration already does it
 * treat the value-less ping as a trigger   nothing fails — the ping never
 *                                 arrives alone, so the filter is defensive
 * ```
 *
 * The first draft of this file asserted owner isolation and reconciliation
 * without testing either; mutation caught that and both now have cases.
 */

const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

type Row = { id: string; n: number };

// ───────────────────────────────────────────────────────────────────────────
// THE INTERNAL OBSERVER — private. Nothing below is proposed for export.
// ───────────────────────────────────────────────────────────────────────────

function observeCommitted<T>(x: unknown, cb: (current: T) => void): () => void {
  const registry = getPositionRegistry(x);
  if (!registry) throw new Error('X must be an owned SignalTree location.');
  const ownerPath = (x as { __ownerPath?: string }).__ownerPath ?? '';
  const notifier = getPathNotifier();
  let off = false;
  let dirty = false;

  const unsubscribe = notifier.subscribe(
    '**',
    (v, prev, path, _o, _origin, _s, _pos, meta) => {
      if (off) return;
      const m = (meta ?? {}) as Record<string, unknown>;
      // Owner isolation — and the reason the unqualified collection ping is not
      // a trigger: it carries no namespace, so it is filtered here.
      if (m['ownerId'] !== registry.id) return;
      if (
        ownerPath !== '' &&
        path !== ownerPath &&
        !path.startsWith(`${ownerPath}.`)
      ) {
        return;
      }
      // ⚠️ DEFENSIVE FOR LINK, AND NOT HARMLESS IN GENERAL. Mutation shows
      // removing this line breaks no link test, because the unqualified
      // collection ping arrives in the same flush as its valued siblings.
      //
      // But REALIZATION-NAMESPACE-0 later found that same ping CORRUPTING
      // realization state: it carries no `structuralEffect`, so
      // `deriveCollectionPath` takes its non-structural branch and rewrites a
      // nested collection's descriptor path to the PARENT branch. "Harmless to
      // the consumer I was looking at" was not "harmless".
      if (v === undefined && prev === undefined) return;
      dirty = true;
    }
  );

  // ⚠️ THE TURN BOUNDARY, and it is REQUIRED rather than an optimisation.
  //
  // Scheduling per delivered event gives ONE observation for three writes to
  // the same leaf — but that is the NOTIFIER coalescing same-path entries, not
  // turn coalescing. Measured: `addMany` of three rows produced THREE
  // observations of the same final collection, because three distinct child
  // paths deliver three events, and with no open scope
  // `scheduleDurableConsequence` runs each immediately.
  //
  // For a link that means N identical outbound writes per turn — N serialised
  // network round-trips for one logical change. `onFlush` fires once after all
  // of a flush's entries, which is the same turn boundary the diagnostic
  // journal uses.
  const offFlush = notifier.onFlush?.(() => {
    if (off || !dirty) return;
    dirty = false;
    scheduleDurableConsequence({
      claimant: x as object,
      key: cb,
      run: () => {
        if (off) return;
        cb((x as () => unknown)() as T);
      },
    });
  });

  return () => {
    off = true;
    unsubscribe();
    offFlush?.();
  };
}

/** `rows` is nested so its PARENT BRANCH is a distinct, linkable location. */
const collectionTree = () =>
  signalTree(
    {
      data: { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
      theme: 'light',
    },
    { enhancers: [restoration(), transactions()] }
  );

// ───────────────────────────────────────────────────────────────────────────
// Q3 — is the owner-only collection ping actually harmless for link?
// ───────────────────────────────────────────────────────────────────────────

describe('DEMARCATION-0 Q3: every collection transition has a QUALIFIED trigger', () => {
  it('⚠️ the unqualified `rows` ping is never the ONLY event', async () => {
    const tree = collectionTree();
    await flush();
    const owner = getPositionRegistry(tree.$)?.id;

    const triggersFor = async (op: () => void) => {
      const qualified: string[] = [];
      const unqualified: string[] = [];
      const off = getPathNotifier().subscribe(
        '**',
        (v, prev, path, _o, _or, _s, _pos, meta) => {
          if (!path.startsWith('data.rows')) return;
          const m = (meta ?? {}) as Record<string, unknown>;
          const valued = !(v === undefined && prev === undefined);
          (valued && m['ownerId'] === owner ? qualified : unqualified).push(path);
        }
      );
      op();
      await flush();
      off();
      return { qualified, unqualified };
    };

    // Every mutator the collection surface offers.
    for (const [label, op] of [
      ['addOne', () => tree.$.data.rows.addOne({ id: 'a', n: 1 })],
      ['addMany', () => tree.$.data.rows.addMany([{ id: 'b', n: 2 }, { id: 'c', n: 3 }])],
      ['updateOne', () => tree.$.data.rows.updateOne('a', { n: 9 })],
      ['upsertOne', () => tree.$.data.rows.upsertOne({ id: 'a', n: 10 })],
      ['removeOne', () => tree.$.data.rows.removeOne('b')],
      ['setAll', () => tree.$.data.rows.setAll([{ id: 'z', n: 26 }])],
      ['clear', () => tree.$.data.rows.clear()],
    ] as const) {
      const r = await triggersFor(op as () => void);

      // THE ANSWER TO Q3. The unqualified `{ path: 'rows' }` ping accompanies
      // every transition and is NEVER the only event — each one also emits at
      // least one qualified, value-carrying `rows.<id>`. So a link that filters
      // on the namespace and then LATE-READS the collection sees every
      // transition, and the ping needs no fix for link's sake.
      expect(r.qualified.length, `${label} produced no qualified trigger`)
        .toBeGreaterThan(0);
      expect(r.unqualified.length, `${label} ping count`).toBeGreaterThan(0);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// The internal observer's requirements that were not yet measured
// ───────────────────────────────────────────────────────────────────────────

describe('DEMARCATION-0: same-turn coalescing to the FINAL settled value', () => {
  it('three writes in one turn produce ONE observation, of the last value', async () => {
    const tree = collectionTree();
    await flush();
    const seen: string[] = [];
    const off = observeCommitted<string>(tree.$.theme, (v) => seen.push(v));

    tree.$.theme.set('a');
    tree.$.theme.set('b');
    tree.$.theme.set('c');
    await flush();
    off();

    // A committed-state observer reports STATE, not constituent mutations.
    // Reporting a, b, c would just be the notifier with extra steps.
    expect(seen).toEqual(['c']);
  });

  it('separate turns produce separate observations', async () => {
    const tree = collectionTree();
    await flush();
    const seen: string[] = [];
    const off = observeCommitted<string>(tree.$.theme, (v) => seen.push(v));

    tree.$.theme.set('a');
    await flush();
    tree.$.theme.set('b');
    await flush();
    off();

    // The control for coalescing: without it, the case above is satisfied by an
    // observer that only ever fires once.
    expect(seen).toEqual(['a', 'b']);
  });

  it('a whole collection turn is ONE observation of the final collection', async () => {
    const tree = collectionTree();
    await flush();
    const seen: number[] = [];
    // ⚠️ Observed through the PARENT BRANCH, not the collection node — see the
    // limitation pinned below.
    const off = observeCommitted<unknown>(tree.$.data, () =>
      seen.push(tree.$.data.rows.ids().length)
    );

    tree.$.data.rows.addMany([
      { id: 'a', n: 1 },
      { id: 'b', n: 2 },
      { id: 'c', n: 3 },
    ]);
    await flush();
    off();

    // Three rows, three qualified events, ONE observation — of the settled
    // collection. This is what makes a branch-scope link over a collection
    // behave like a leaf-scope link over a scalar.
    expect(seen).toEqual([3]);
  });
});

describe('DEMARCATION-0: the observer sees every cause link needs', () => {
  const causes = async () => {
    const tree = collectionTree();
    await flush();
    const seen: string[] = [];
    const off = observeCommitted<string>(tree.$.theme, (v) => seen.push(v));

    tree.$.theme.set('authored');
    await flush();
    external(() => tree.$.theme.set('acquired'));
    await flush();
    const p = tree.transaction(() => tree.$.theme.set('speculative'));
    await flush();
    const duringPending = [...seen];
    p.rollback();
    await flush();
    off();
    return { seen, duringPending, final: tree.$.theme() };
  };

  it('authored, external and rollback compensation — but never the speculative value', async () => {
    const r = await causes();

    // Speculative state must not reach the observer; the compensation that
    // restores committed truth must.
    expect(r.duringPending).toEqual(['authored', 'acquired']);
    expect(r.seen).not.toContain('speculative');
    expect(r.seen[r.seen.length - 1]).toBe('acquired');
    expect(r.final).toBe('acquired');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// The strongest argument FOR exporting onCommitted, measured rather than argued
// ───────────────────────────────────────────────────────────────────────────

describe('DEMARCATION-0: what an ordinary Angular effect sees', () => {
  it('...which does NOT by itself earn a public API', async () => {
    const tree = collectionTree();
    await flush();
    const charges: string[] = [];

    // The dangerous pattern the pin above enables — an irreversible action
    // driven by a transiently-wrong read.
    //
    // The remedy is not a public observer. It is that an irreversible action
    // belongs to WHOEVER OWNS TRANSACTION CONFIRMATION, which the same code
    // already has, because it is the code holding `p`.
    const p = tree.transaction(() => tree.$.theme.set('dark'));
    await flush();
    expect(charges).toEqual([]);

    p.confirm();
    await flush();
    charges.push(tree.$.theme()); // ordinary application sequencing

    expect(charges).toEqual(['dark']);

    // For `afterCommit` to earn public surface, the falsifier would have to be
    // code that DOES NOT own settlement, demonstrably needing to register an
    // irreversible consequence with the current operation, and unable to
    // express it by composition. No such case is on record.
  });
});

// ───────────────────────────────────────────────────────────────────────────
// A surface limitation found while measuring
// ───────────────────────────────────────────────────────────────────────────

describe('DEMARCATION-0: the entityMap ownership gap this file found', () => {
  it('⚠️ FIXED by OWNER-LOCATION-0 — it now names its owning tree', async () => {
    const tree = collectionTree();
    await flush();

    // Measured when this file was written: `undefined`, and the observer
    // refused. OWNER-LOCATION-0 then found the same gap in `stored()` and fixed
    // BOTH at the marker construction boundary — not for link's benefit, but
    // because an addressable position must name its owner.
    expect(getPositionRegistry(tree.$.data.rows)).toBe(
      getPositionRegistry(tree.$)
    );
    expect(() => observeCommitted(tree.$.data.rows, () => void 0)).not.toThrow();
  });

  it('...and the PARENT BRANCH covers it, so link is not blocked', async () => {
    const tree = collectionTree();
    await flush();
    const seen: number[] = [];
    const off = observeCommitted<unknown>(tree.$.data, () =>
      seen.push(tree.$.data.rows.ids().length)
    );

    tree.$.data.rows.addOne({ id: 'a', n: 1 });
    await flush();
    tree.$.data.rows.addOne({ id: 'b', n: 2 });
    await flush();
    off();

    // So the limitation costs a spelling, not a capability: persisting a
    // collection means linking the branch that contains it, whose late read
    // includes the collection's settled contents.
    //
    // Whether the collection node SHOULD be directly linkable is a real
    // question — it is a location by every other measure — but it is a
    // ownership-metadata question, not a link question, and it is recorded
    // rather than answered here.
    expect(seen).toEqual([1, 2]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// THE PUBLIC CANDIDATE, composed over the internal observer + public external()
// ───────────────────────────────────────────────────────────────────────────

interface LinkEndpoint<T> {
  get?(): T | Promise<T>;
  set?(value: T): void | Promise<void>;
  subscribe?(next: (value: T) => void): () => void;
}

/**
 * The ENTIRE public surface. No `.subscribe()`, no `.then()`, no `afterGet` /
 * `afterSet` / `afterChange`, no lifecycle callbacks: the application already
 * has X and reacts to it with ordinary Angular reactivity.
 */
/**
 * ⚠️ PRODUCTION. The demarcation controls now run against the shipped `link()`,
 * so "userland can build this with public parts" is asserted about the real
 * function rather than a local reimplementation of it.
 */
const link = <T>(x: unknown, endpoint: LinkEndpoint<T>) =>
  productionLink<never>(x as never, endpoint as LinkEndpoint<never>);

describe('DEMARCATION-0 Q1: does public link work on PRIVATE machinery?', () => {
  it('leaf — acquire, echo-suppress, and send an authored change', async () => {
    const tree = collectionTree();
    await flush();
    const sent: string[] = [];
    const l = link<string>(tree.$.theme, {
      get: () => 'from-Y',
      set: (v) => void sent.push(v),
    });

    await l.retrieve();
    await flush();
    await l.settled();
    expect(tree.$.theme()).toBe('from-Y');
    expect(sent).toEqual([]);

    tree.$.theme.set('typed');
    await flush();
    await l.settled();
    l.dispose();
    expect(sent).toEqual(['typed']);
  });

  it('only settled state escapes — a rollback never reaches Y', async () => {
    const tree = collectionTree();
    await flush();
    const sent: string[] = [];
    const l = link<string>(tree.$.theme, { set: (v) => void sent.push(v) });

    const p = tree.transaction(() => tree.$.theme.set('doomed'));
    await flush();
    expect(sent).toEqual([]);

    p.rollback();
    await flush();
    await l.settled();
    l.dispose();

    expect(sent).not.toContain('doomed');
    expect(tree.$.theme()).toBe('light');
  });

  it('⚠️ a COLLECTION turn produces ONE outbound write, not one per row', async () => {
    const tree = collectionTree();
    await flush();
    const sent: number[] = [];
    const l = link<{ rows: unknown }>(tree.$.data, {
      set: () => void sent.push(tree.$.data.rows.ids().length),
    });

    tree.$.data.rows.addMany([
      { id: 'a', n: 1 },
      { id: 'b', n: 2 },
      { id: 'c', n: 3 },
    ]);
    await flush();
    await l.settled();
    l.dispose();

    // Without the flush turn boundary in the internal observer this was
    // [3, 3, 3] — three identical writes, and with an async endpoint three
    // serialised round-trips for one logical change.
    expect(sent).toEqual([3]);
  });

  it('dispose stops the relationship', async () => {
    const tree = collectionTree();
    await flush();
    const sent: string[] = [];
    const l = link<string>(tree.$.theme, { set: (v) => void sent.push(v) });

    tree.$.theme.set('before');
    await flush();
    await l.settled();
    l.dispose();

    tree.$.theme.set('after');
    await flush();
    await l.settled();

    expect(sent).toEqual(['before']);
  });

  it('an empty endpoint is refused', async () => {
    const tree = collectionTree();
    await flush();
    expect(() => link(tree.$.theme, {})).toThrow(/at least one of get/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Guarantees this file was asserting without testing — found by mutation
// ───────────────────────────────────────────────────────────────────────────

describe('DEMARCATION-0: guarantees the first draft under-tested', () => {
  it('⚠️ owner isolation — a second tree does not drive this link', async () => {
    const a = collectionTree();
    const b = collectionTree();
    await flush();
    const sent: string[] = [];
    const l = link<string>(a.$.theme, { set: (v) => void sent.push(v) });

    // Same path, same local positionId, different tree. Without the namespace
    // filter in the internal observer, B's write drives A's link and sends A's
    // (unchanged) value to A's endpoint.
    b.$.theme.set('from-B');
    await flush();
    await l.settled();
    expect(sent).toEqual([]);

    a.$.theme.set('from-A');
    await flush();
    await l.settled();
    l.dispose();

    expect(sent).toEqual(['from-A']);
  });

  it('⚠️ the reconciliation loop — an inbound value crossing an outbound write', async () => {
    const tree = collectionTree();
    await flush();
    const yState: string[] = [];
    let emit: ((v: string) => void) | undefined;
    let releaseB: (() => void) | undefined;

    const l = link<string>(tree.$.theme, {
      set: (v) => {
        if (v === 'B') {
          return new Promise<void>((resolve) => {
            releaseB = () => {
              yState.push('B');
              resolve();
            };
          });
        }
        yState.push(v);
        return Promise.resolve();
      },
      subscribe: (next) => {
        emit = next;
        return () => void (emit = undefined);
      },
    });

    tree.$.theme.set('B'); // authored; set(B) begins and blocks
    await flush();
    emit?.('C'); // Y pushes newer truth while B is in flight
    await flush();
    expect(tree.$.theme()).toBe('C');

    releaseB?.(); // the older write finally lands at Y
    await l.settled();
    await flush();
    await l.settled();
    l.dispose();

    // LINK-RACE-1, re-proved against THIS composition rather than assumed from
    // the earlier harness: without the loop, Y ends at 'B' while X is 'C'.
    expect(yState).toEqual(['B', 'C']);
    expect(tree.$.theme()).toBe('C');
  });
});
