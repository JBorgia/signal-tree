import { describe, expect, it } from 'vitest';

import { createDiagnosticJournal } from './diagnostic-journal';
import { entityMap } from '../../markers/entity-map';
import { restoration } from '../../../enhancers/restoration/restoration';
import { signalTree } from '../../signal-tree';
import { transactions } from '../../../enhancers/transactions/transactions';
import { undoable } from '../../undoable';

/**
 * DIAG-JOURNAL-1 · F7 and the compensation-correlation question.
 *
 * F7 is a representation audit, not a "no functions anywhere" rule: user state
 * may legitimately contain arbitrary values, including callables. What must be
 * proved is that the JOURNAL's own construction inserts no SignalTree-owned live
 * object — no signal, node, turn store, capture bucket, claim handle, reversal
 * plan, authority or unsubscribe closure. The journal runtime holds its own
 * subscriptions; the retained RECORDS must not.
 */

type Row = { id: string; name: string };

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

type Rows = {
  addOne(row: Row): void;
  removeOne(id: string): void;
  updateOne(id: string, patch: Partial<Row>): void;
  ids(): string[];
};

type Store = {
  $: { rows: Rows; n: { (): number; set(v: number): void } };
  transaction(fn: () => void): { confirm(): void; rollback(): void };
  undo(): void;
};

const makeTree = () =>
  signalTree(
    { rows: entityMap<Row, string>({ selectId: (r) => r.id }), n: 0 },
    { enhancers: [restoration(), transactions()] }
  ) as unknown as Store;

/** Every value reachable from a retained record, bounded against cycles. */
const reachable = (root: unknown): unknown[] => {
  const seen = new Set<unknown>();
  const out: unknown[] = [];
  const walk = (v: unknown, depth: number) => {
    if (depth > 8 || v === null || typeof v !== 'object') {
      if (typeof v === 'function') out.push(v);
      return;
    }
    if (seen.has(v)) return;
    seen.add(v);
    out.push(v);
    for (const item of Array.isArray(v) ? v : Object.values(v)) {
      walk(item, depth + 1);
    }
  };
  walk(root, 0);
  return out;
};

describe('DIAG-JOURNAL-1 F7: retained records hold no live SignalTree handles', () => {
  it('nothing reachable from a record is a signal, node or authority', async () => {
    const tree = makeTree();
    await flush();
    const journal = createDiagnosticJournal(tree as unknown as object);

    undoable(() => tree.$.rows.addOne({ id: 'a', name: 'Alpha' }));
    await flush();
    undoable(() => tree.$.rows.updateOne('a', { name: 'Renamed' }));
    await flush();
    const pending = tree.transaction(() => tree.$.n.set(3));
    await flush();
    pending.rollback();
    await flush();
    tree.undo();
    await flush();

    const records = [...journal.turns(), ...journal.transactionEvents()];
    expect(records.length).toBeGreaterThan(0);

    const values = records.flatMap((r) => reachable(r));

    // No callables at all here — user state in this tree is plain data, so any
    // function reachable from a record would be something the journal inserted.
    // (The rule is "the journal inserts no live handle", not "records may never
    // contain a function": a tree whose state legitimately holds callables is a
    // different case, and this one is constructed to isolate the journal.)
    expect(values.filter((v) => typeof v === 'function')).toEqual([]);

    // And nothing carrying a SignalTree internal marker.
    const INTERNAL = [
      'SignalTree:TransactionLifecycleChannel',
      'SignalTree:TransactionLifecycleOwnerPresent',
      'SignalTree:SubjectPhysicalOwners',
    ].map((k) => Symbol.for(k));
    for (const value of values) {
      if (value && typeof value === 'object') {
        for (const marker of INTERNAL) {
          expect(
            Object.prototype.hasOwnProperty.call(value, marker)
          ).toBe(false);
        }
        // The tree itself, its `$`, and any node would satisfy these.
        expect(
          typeof (value as { getRestorationHistory?: unknown })
            .getRestorationHistory
        ).not.toBe('function');
        expect(
          typeof (value as { transaction?: unknown }).transaction
        ).not.toBe('function');
      }
    }
  });

  it('a record never holds the tree, a node, or a live accessor', async () => {
    const tree = makeTree();
    await flush();
    const journal = createDiagnosticJournal(tree as unknown as object);
    undoable(() => tree.$.n.set(1));
    await flush();

    const values = journal.turns().flatMap((t) => reachable(t));
    expect(values).not.toContain(tree as unknown);
    expect(values).not.toContain((tree as unknown as { $: unknown }).$);
    expect(values).not.toContain(
      (tree as unknown as { $: { n: unknown } }).$.n
    );
    journal.dispose();
  });
});

describe('DIAG-JOURNAL-1: can a reader tell the compensation turn from the speculative one?', () => {
  it('MEASURED — what correlation the compensation turn actually carries', async () => {
    const tree = makeTree();
    await flush();
    const journal = createDiagnosticJournal(tree as unknown as object);

    const pending = tree.transaction(() =>
      tree.$.rows.addOne({ id: 'a', name: 'Alpha' })
    );
    await flush();
    pending.rollback();
    await flush();

    const shape = journal.turns().map((t) => ({
      txIds: [...new Set(t.effects.map((e) => e.transactionId))],
      origins: [...new Set(t.effects.map((e) => e.origin))],
      participations: [...new Set(t.effects.map((e) => e.participation))],
    }));

    // ⚠️ THE QUESTION THE OWNER FLAGGED. A rollback is two causal turns, and a
    // diagnostic reader must be able to say the second one IS the compensation
    // for transaction 1 — WITHOUT inferring it from "it came after the
    // rolled-back event", which is temporal adjacency, not correlation.
    //
    // Whatever this measures is the answer: if the facts are there, the journal
    // uses them; if they are not, that is a missing diagnostic fact and a
    // candidate for one narrow seam, recorded rather than papered over.
    expect(shape).toEqual([
      {
        txIds: [1],
        origins: [undefined],
        participations: [undefined],
      },
      {
        txIds: [undefined],
        origins: [undefined],
        participations: ['realized'],
      },
    ]);

    // The lifecycle stream does carry the transaction identity and its outcome.
    expect(journal.transactionEvents()).toEqual([
      { sequence: 0, kind: 'opened', id: 1 },
      { sequence: 2, kind: 'staged', id: 1 },
      { sequence: 3, kind: 'rolled-back', id: 1 },
    ]);

    journal.dispose();
  });
});
