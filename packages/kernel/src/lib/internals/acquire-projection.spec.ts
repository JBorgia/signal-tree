import { describe, expect, it } from 'vitest';

import { restoration } from '../../enhancers/restoration/restoration';
import { transactions } from '../../enhancers/transactions/transactions';
import { createDiagnosticJournal } from './diagnostics/diagnostic-journal';
import { signalTree } from '../signal-tree';

import {
  acquireScalarProjection,
  EXTERNAL_ACQUISITION,
} from './acquire-projection';

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

type Effect = { path: string; origin?: string; participation?: string };

const drain = (journal: {
  turns(): readonly { effects: readonly unknown[] }[];
  dispose(): void;
}): Effect[] => {
  // ⚠️ Read BEFORE disposing — `turns()` returns the LIVE array.
  const effects = journal.turns().flatMap((t) => t.effects) as Effect[];
  const copy = effects.map((e) => ({ ...e }));
  journal.dispose();
  return copy;
};

const makeTree = () =>
  signalTree(
    { box: { a: 0, b: 0, c: 0 } },
    { enhancers: [restoration(), transactions()] }
  );

describe('non-authored flat-scalar ingress', () => {
  it('realizes exactly the supplied subjects and leaves omitted ones untouched', async () => {
    const tree = makeTree();
    await flush();
    const journal = createDiagnosticJournal(tree as object);

    const realized = acquireScalarProjection(
      tree.$.box as unknown as Record<string, unknown>,
      { a: 10, c: 30 },
      EXTERNAL_ACQUISITION
    );
    await flush();
    const effects = drain(journal);

    // PER-SUBJECT INVENTORY, not just final values. Collapsing the acquisition
    // into one opaque branch realization would produce the right state while
    // destroying the causal information `bind-branch-0` already proved.
    expect(realized).toEqual(['a', 'c']);
    expect(effects.map((e) => e.path).sort()).toEqual(['box.a', 'box.c']);

    expect(tree.$.box.a()).toBe(10);
    expect(tree.$.box.c()).toBe(30);
    expect(tree.$.box.b()).toBe(0); // omitted: no write, no claim
  });

  it('acquisition is not authored work — no transaction, no undo, no history', async () => {
    const tree = makeTree();
    await flush();
    const before = tree.getRestorationHistory().length;

    acquireScalarProjection(
      tree.$.box as unknown as Record<string, unknown>,
      { a: 10 },
      EXTERNAL_ACQUISITION
    );
    await flush();

    expect(tree.getRestorationHistory().length - before).toBe(0);
    expect(tree.canUndo()).toBe(false);
  });

  it('⚠️ THE BOUNDARY — a same-tick authored write to an OMITTED sibling stays authored', async () => {
    const tree = makeTree();
    await flush();
    const journal = createDiagnosticJournal(tree as object);

    acquireScalarProjection(
      tree.$.box as unknown as Record<string, unknown>,
      { a: 1 },
      EXTERNAL_ACQUISITION
    );
    // Deliberately the SAME TICK. If provenance were contagious, timing is what
    // would leak it.
    tree.$.box.b(2);
    await flush();
    const byPath = Object.fromEntries(drain(journal).map((e) => [e.path, e]));

    // PROVENANCE FOLLOWS SUPPLIED INFORMATION, NOT EXECUTION PROXIMITY.
    expect(byPath['box.a'].origin).toBe('external');
    expect(byPath['box.a'].participation).toBe('realized');

    expect(tree.$.box.a()).toBe(1);
    expect(tree.$.box.b()).toBe(2);

    // Storage never spoke about `b`. The authored write must not inherit.
    expect(byPath['box.b'].origin).toBeUndefined();
    expect(byPath['box.b'].participation).toBeUndefined();
  });
});
