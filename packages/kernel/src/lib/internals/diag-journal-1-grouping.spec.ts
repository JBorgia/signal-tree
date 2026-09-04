import { describe, expect, it } from 'vitest';

import { entityMap } from '../markers/entity-map';
import { getPathNotifier } from '../path-notifier';
import { getTransactionLifecycleChannel } from './causal-runtime/transaction-lifecycle';
import { external } from '../external';
import { restoration } from '../../enhancers/restoration/restoration';
import { signalTree } from '../signal-tree';
import { transactions } from '../../enhancers/transactions/transactions';
import { undoable } from '../undoable';
import { withWriteContext } from '../write-context';

/**
 * DIAG-JOURNAL-1 · F1 — GROUPING, probed before anything is named.
 *
 * The representation is deliberately unnamed until this answers: does one
 * flush-bounded retained object correspond 1:1 to a CAUSAL TURN? If it does not,
 * the unit is not a turn and must be named for whatever it actually is (outcome
 * D).
 *
 * This file builds the smallest possible projection out of the seams that
 * already exist — the notifier's `onFlush` boundary, its `**` subscription, and
 * the TURN-FEED lifecycle channel — and only counts. No journal module exists
 * yet; naming one before this measurement would be asserting the answer.
 */

type Row = { id: string; name: string };

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

type Observed = {
  readonly paths: string[];
  readonly origins: Array<unknown>;
  readonly participations: Array<unknown>;
  readonly transactionIds: Array<unknown>;
};

/** The candidate projection: group deliveries by the engine's own flush. */
const probe = (tree: object) => {
  const notifier = getPathNotifier();
  const groups: Observed[] = [];
  const lifecycle: string[] = [];
  let open: {
    paths: string[];
    origins: unknown[];
    participations: unknown[];
    transactionIds: unknown[];
  } | null = null;

  const offWrite = notifier.subscribe(
    '**',
    (_n, _p, path, _owner, origin, _s, _pos, meta) => {
      const m = (meta ?? {}) as Record<string, unknown>;
      open ??= {
        paths: [],
        origins: [],
        participations: [],
        transactionIds: [],
      };
      open.paths.push(path);
      open.origins.push(origin ?? m['origin'] ?? null);
      open.participations.push(m['participation'] ?? null);
      open.transactionIds.push(m['transactionId'] ?? null);
    }
  );

  const offFlush = notifier.onFlush?.(() => {
    if (!open) return;
    groups.push(open as Observed);
    open = null;
  });

  const offLifecycle = getTransactionLifecycleChannel(tree).subscribe((e) => {
    lifecycle.push(e.kind);
  });

  return {
    groups,
    lifecycle,
    stop: () => {
      offWrite();
      offFlush?.();
      offLifecycle();
    },
  };
};

describe('DIAG-JOURNAL-1 F1: does a flush-bounded entry equal one causal turn?', () => {
  it('two authored writes in ONE tick', async () => {
    const tree = signalTree({ a: 0, b: 0 }, { enhancers: [restoration()] });
    await flush();
    const p = probe(tree);

    undoable(() => {
      tree.$.a(1);
      tree.$.b(2);
    });
    await flush();
    p.stop();

    // ONE group for one causal turn, both paths inside it — the flush boundary
    // agrees with HIST-C's turn boundary rather than inventing a finer one.
    // Restoration retains the same single turn; there is no installation entry.
    expect(p.groups.length).toBe(1);
    expect(p.groups[0].paths).toEqual(['a', 'b']);
    expect(tree.getRestorationHistory().length).toBe(1);
  });

  it('two authored writes in SEPARATE ticks', async () => {
    const tree = signalTree({ a: 0, b: 0 }, { enhancers: [restoration()] });
    await flush();
    const p = probe(tree);

    undoable(() => tree.$.a(1));
    await flush();
    undoable(() => tree.$.b(2));
    await flush();
    p.stop();

    expect(p.groups.length).toBe(2);
    expect(p.groups.map((g) => g.paths)).toEqual([['a'], ['b']]);
  });

  it('a CONFIRMED transaction', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }), n: 0 },
      { enhancers: [restoration(), transactions()] }
    );
    await flush();
    const p = probe(tree);

    const pending = tree.transaction(() => {
      tree.$.rows.addOne({ id: 'a', name: 'Alpha' });
      tree.$.n(1);
    });
    await flush();
    pending.confirm();
    await flush();
    p.stop();

    // A confirmed transaction: ONE flush group, correlated by transaction id,
    // alongside the three lifecycle events. Here one entry really would equal
    // one transaction.
    expect(p.groups.length).toBe(1);
    expect(p.lifecycle).toEqual(['opened', 'staged', 'confirmed']);
    expect(p.groups.map((g) => [...new Set(g.transactionIds)])).toEqual([[1]]);
  });

  it('a ROLLED-BACK transaction', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
      { enhancers: [transactions()] }
    );
    await flush();
    const p = probe(tree);

    const pending = tree.transaction(() => {
      tree.$.rows.addOne({ id: 'a', name: 'Alpha' });
    });
    await flush();
    pending.rollback();
    await flush();
    p.stop();

    // ⚠️ THE RESULT THAT SHAPES THE REPRESENTATION. A rollback is TWO causal
    // turns — the speculative writes, then the compensation — against ONE
    // transaction lifecycle that ends `rolled-back`.
    //
    // So "one retained journal object = one transaction" is already false, and
    // outcome D is not in play either: the flush-bounded unit IS a causal turn
    // in every case measured. What the journal needs is causal turns WITH
    // transaction correlation, not a transaction-shaped record.
    expect(p.groups.length).toBe(2);
    expect(p.lifecycle).toEqual(['opened', 'staged', 'rolled-back']);
  });
});

describe('DIAG-JOURNAL-1 F2: the two axes survive observation', () => {
  it('inspection, restoration and external truth stay distinct', async () => {
    const tree = signalTree({ n: 0 }, { enhancers: [restoration()] });
    await flush();
    undoable(() => tree.$.n(1));
    await flush();

    const p = probe(tree);

    withWriteContext(
      { intent: 'system', origin: 'devtools', participation: 'inspection' },
      () => tree.$.n(42)
    );
    await flush();
    // Undo BEFORE the ingress: measured in A1 case 6, external truth at this
    // location would refuse the undo (ST1034), and this case is about
    // observation rather than about re-measuring P0-C.
    tree.undo();
    await flush();
    external(() => tree.$.n(7));
    await flush();
    p.stop();

    // Three occurrences, three distinct (origin, participation) pairs, none of
    // them collapsed into another. A diagnostic observer sees exactly the
    // ontology the release separated — inspection is not reinterpreted as
    // authored or realized, and a restoration stays TWO facts rather than being
    // flattened into "realized".
    expect(
      p.groups.map((g) => ({
        origin: g.origins[0],
        participation: g.participations[0],
      }))
    ).toEqual([
      { origin: 'devtools', participation: 'inspection' },
      { origin: 'restoration', participation: 'realized' },
      { origin: 'external', participation: 'realized' },
    ]);
  });
});
