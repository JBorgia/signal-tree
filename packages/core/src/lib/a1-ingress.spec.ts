import { describe, expect, it } from 'vitest';

import { entityMap } from './markers/entity-map';
import { getPathNotifier } from './path-notifier';
import { realize } from './realize';
import { signalTree } from './signal-tree';
import { timeTravel } from '../enhancers/time-travel/time-travel';
import { transactions } from '../enhancers/transactions/transactions';
import { undoable } from './undoable';

/**
 * A1 TERMINAL INGRESS — the nine discriminating cases.
 *
 * `realize()` is the candidate public door. It declares two facts on the two
 * independent axes:
 *
 *   origin         external
 *   participation  realized
 *
 * A1 may not reopen participation — that external truth is realized is settled
 * by C3, P0-C and HIST-C2. What is open is whether `'external'` is the right
 * origin name and whether this door's shape is right.
 */

type Row = { id: string; name: string };

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

type Fact = { origin: unknown; participation: unknown };

const observe = () => {
  const seen: Fact[] = [];
  const off = getPathNotifier().subscribe(
    '**',
    (_n, _p, _path, _owner, source, _s, _pos, meta) => {
      const m = (meta ?? {}) as Record<string, unknown>;
      seen.push({
        origin: source ?? m['origin'] ?? null,
        participation: m['participation'] ?? null,
      });
    }
  );
  return { seen, off };
};

describe('A1 case 1-2: classification', () => {
  it('case 1 — an ordinary authored write', async () => {
    const tree = signalTree({ n: 0 }, { enhancers: [timeTravel()] });
    await flush();
    const { seen, off } = observe();
    undoable(() => tree.$.n.set(1));
    await flush();
    off();
    // A1-N. An ordinary authored write carries NO origin. There is no positive
    // `'application'` value, and the falsifier for adding one did not fire: no
    // consumer must distinguish "no origin recorded" from "authored by the
    // application" — `source` is consumed for filtering (skip my own output),
    // side-effect policy and labelling, and all three key on the POSITIVE
    // values. Stamping every write would cost the common path for nobody.
    expect(seen).toEqual([{ origin: null, participation: null }]);
  });

  it('case 2 — an ingress carries external origin and admits no restoration', async () => {
    const tree = signalTree({ n: 0 }, { enhancers: [timeTravel()] });
    await flush();
    undoable(() => tree.$.n.set(1));
    await flush();
    const historyBefore = tree.getHistory().length;

    const { seen, off } = observe();
    realize(() => tree.$.n.set(9));
    await flush();
    off();

    // The pre-registered semantic target, reached: external origin, realized
    // participation, and ZERO restoration admission — the ingress is not an
    // undo step, which is case 8 of A1-0 (`documented-defects` 6c's sibling)
    // fixed at the door instead of by classification the app cannot express.
    expect(seen).toEqual([{ origin: 'external', participation: 'realized' }]);
    expect(tree.getHistory().length - historyBefore).toBe(0);
  });
});

describe('A1 case 3-5: transaction interaction', () => {
  it('case 3 — ingress during a pending transaction is not its contribution', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }), n: 0 },
      { enhancers: [transactions()] }
    );
    await flush();

    const pending = tree.transaction(() => {
      tree.$.rows.addOne({ id: 'a', name: 'Alpha' });
      // An acquisition landing INSIDE the callback. Merged context, so the
      // enclosing transactionId is still ambient here.
      realize(() => tree.$.n.set(7));
    });
    await flush();

    let refusal: unknown = 'no-refusal';
    try {
      pending.rollback();
    } catch (error) {
      refusal = (error as { cause?: { kind?: unknown } })?.cause?.kind;
    }
    await flush();

    // Not the transaction's contribution: the rollback reverses only the
    // authored row and leaves the acquired value standing. The merged context
    // kept the enclosing `transactionId` ambient, so this is the realization
    // branch declining to contribute — not the accident of a dropped id, which
    // is what DEVTOOLS-JUMP-0 caught itself relying on.
    expect(refusal).toBe('no-refusal');
    expect(tree.$.n()).toBe(7);
    expect(tree.$.rows.ids()).toEqual([]);
  });

  it('case 4 — ingress touching speculative structure refuses the rollback', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
      { enhancers: [transactions()] }
    );
    await flush();

    const pending = tree.transaction(() => {
      tree.$.rows.addOne({ id: 'a', name: 'Alpha' });
    });
    await flush();

    realize(() => tree.$.rows.updateOne('a', { name: 'Server' }));
    await flush();

    let refusal: unknown = 'no-refusal';
    try {
      pending.rollback();
    } catch (error) {
      refusal = (error as { cause?: { kind?: unknown } })?.cause?.kind;
    }
    await flush();

    // TX-LEDGER C3, intact and doing its job: server truth now depends on the
    // speculative row, so withdrawing the row would discard truth this
    // authority does not own. Refused, row survives.
    expect(refusal).toBe('later-confirmed-dependency');
    expect(tree.$.rows.ids()).toEqual(['a']);
  });

  it('case 5 — an UNRELATED ingress leaves the rollback legal', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }), n: 0 },
      { enhancers: [transactions()] }
    );
    await flush();

    const pending = tree.transaction(() => {
      tree.$.rows.addOne({ id: 'a', name: 'Alpha' });
    });
    await flush();

    realize(() => tree.$.n.set(7));
    await flush();

    let refusal: unknown = 'no-refusal';
    try {
      pending.rollback();
    } catch (error) {
      refusal = (error as { cause?: { kind?: unknown } })?.cause?.kind;
    }
    await flush();

    // Bounded: dependency admission is by causal EFFECT, so an ingress that
    // touches nothing speculative costs the transaction nothing. Case 4 and
    // case 5 differ only in what the ingress touched.
    expect(refusal).toBe('no-refusal');
    expect(tree.$.n()).toBe(7);
    expect(tree.$.rows.ids()).toEqual([]);
  });
});

describe('A1 case 6: restoration cannot destroy external truth', () => {
  it('case 6 — an undo over a realized location is refused', async () => {
    const tree = signalTree({ n: 0 }, { enhancers: [timeTravel()] });
    await flush();
    undoable(() => tree.$.n.set(1));
    await flush();

    realize(() => tree.$.n.set(9));
    await flush();

    let refusal: unknown = 'no-refusal';
    try {
      tree.undo();
    } catch (error) {
      refusal = (error as { message?: string })?.message?.slice(0, 6);
    }
    await flush();

    // RESTORE-P0 P0-C via the public door: the undo would have to discard the
    // acquired value to reverse the authored turn, so it is refused whole and
    // the cursor does not move. External truth survives at 9.
    expect(refusal).toBe('ST1034');
    expect(tree.$.n()).toBe(9);
  });
});

describe('A1 case 7-9: boundary', () => {
  it('case 7 — nesting is idempotent', async () => {
    const tree = signalTree({ n: 0 }, { enhancers: [timeTravel()] });
    await flush();
    const { seen, off } = observe();
    realize(() => {
      realize(() => tree.$.n.set(5));
    });
    await flush();
    off();
    // Idempotent: an inner scope declares the same two facts as the outer one.
    expect(seen).toEqual([{ origin: 'external', participation: 'realized' }]);
  });

  it('case 8 — classification does not leak past the callback', async () => {
    const tree = signalTree({ n: 0 }, { enhancers: [timeTravel()] });
    await flush();
    realize(() => tree.$.n.set(5));
    await flush();

    const { seen, off } = observe();
    undoable(() => tree.$.n.set(6));
    await flush();
    off();

    // No leak. The write after the scope is authored again, and it is the only
    // restoration step — the ingress before it never became one.
    expect(seen).toEqual([{ origin: null, participation: null }]);
    expect(tree.getHistory().length).toBe(2);
  });

  it('case 9 — an async callback is REFUSED rather than silently unclassified', async () => {
    const tree = signalTree({ n: 0 }, { enhancers: [timeTravel()] });
    await flush();

    let thrown: unknown = 'no-throw';
    try {
      realize(async () => {
        await Promise.resolve();
        tree.$.n.set(9);
      });
    } catch (error) {
      thrown = (error as { message?: string })?.message?.slice(0, 6);
    }
    await flush();

    // ⚠️ The case PER-0 drew blood on, answered the way `undoable()` answers it:
    // REFUSED, not documented. A write after an `await` inside the scope would
    // land unclassified — the server's value would become an undo step — so the
    // async callback is an error rather than a trap. The async boundary is
    // stated by the API instead of inherited from `withWriteContext`.
    expect(thrown).toBe('ST1035');
  });
});
