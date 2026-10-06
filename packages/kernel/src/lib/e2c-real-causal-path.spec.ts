import { describe, expect, it } from 'vitest';
import { undoable } from '../lib/undoable';
import { transactions } from '../enhancers/transactions/transactions';

import { restoration } from '../enhancers/restoration/restoration';
import { signalTree } from '../index';

/**
 * E2-C — THE REAL CAUSAL PATH. Characterization first.
 *
 * E2's model asserted that after `T1 pending A->B`, `T2 confirmed B->C`, and
 * `rollback T1`, confirmed undo must land on `A` because `B` was contributed by
 * a turn that no longer survives.
 *
 * **That contract was NOT FROZEN anywhere in this repository** until the owner
 * decided it for 15.4.4 (after a rollback, no undo/redo/jumpTo reinstates a
 * value only the rejected turn wrote). Until then these rows RECORDED what the
 * real system did, as characterization; the E2-C1/E2-C2 undo rows now assert
 * the decided contract.
 *
 * PUBLIC SURFACE, measured: the `transactions()` enhancer publishes only
 * `transaction()`. `getConfirmedTurnCount` / `getPendingTurnIds` and friends live
 * on the INTERNAL runtime, not the public tree. `restoration()` publishes
 * `transaction()` on its own, so grouping is reachable without `transactions()`.
 */

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

type TT<S> = {
  $: S;
  transaction(fn: () => void): { confirm(): void; rollback(): void };
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  destroy(): void;
  getRestorationHistory(): unknown[];
};

type Scalar = {
  x: { (value: string): void; (update: (current: string) => string): void; (): string };
};
type Nested = {
  profile: {
    (): { name: string; age: number };
    name: { (value: string): void; (update: (current: string) => string): void; (): string };
    age: { (value: number): void; (update: (current: number) => number): void; (): number };
  };
};

// ============================================================================
// E2-C1 — the frozen P3 scenario, through the real path
// ============================================================================
describe('E2-C1 — real P3', () => {
  it('a PENDING write is visible in canonical truth but adds NO restoration history entry', async () => {
    const tree = signalTree(
      { x: 'A' },
      { enhancers: [restoration(), transactions()] }
    ) as unknown as TT<Scalar>;
    const base = tree.getRestorationHistory().length;

    undoable(() => tree.transaction(() => tree.$.x('B')));
    await tick();

    expect(tree.$.x()).toBe('B'); // optimistic: visible immediately
    expect(tree.getRestorationHistory().length).toBe(base); // but NOT historied
  });

  it('CONFIRMATION historicises; ROLLBACK of a superseded pending turn changes neither truth nor history', async () => {
    const tree = signalTree(
      { x: 'A' },
      { enhancers: [restoration(), transactions()] }
    ) as unknown as TT<Scalar>;

    const t1 = undoable(() => tree.transaction(() => tree.$.x('B'))); // pending
    await tick();
    const histAfterT1 = tree.getRestorationHistory().length;

    const t2 = undoable(() => tree.transaction(() => tree.$.x('C')));
    await tick();
    expect(tree.getRestorationHistory().length).toBe(histAfterT1); // still not historied
    t2.confirm();
    await tick();
    const histAfterConfirm = tree.getRestorationHistory().length;
    expect(histAfterConfirm).toBe(histAfterT1 + 1);

    t1.rollback();
    await tick();

    expect(tree.$.x()).toBe('C'); // truth untouched — T2 owns the position
    expect(tree.getRestorationHistory().length).toBe(histAfterConfirm); // history NOT rewritten
  });

  it('confirmed undo lands on A, not B — and redo returns to C', async () => {
    const tree = signalTree(
      { x: 'A' },
      { enhancers: [restoration(), transactions()] }
    ) as unknown as TT<Scalar>;

    const t1 = undoable(() => tree.transaction(() => tree.$.x('B')));
    await tick();
    const t2 = undoable(() => tree.transaction(() => tree.$.x('C')));
    await tick();
    t2.confirm();
    await tick();
    t1.rollback();
    await tick();

    tree.undo();
    await tick();

    // CONTRACT DECIDED (owner, 15.4.4): after a rollback no undo, redo or
    // jumpTo may reinstate a value only the rejected turn wrote. T2's recorded
    // baseline 'B' was T1's speculative value; T1's rejection re-bases it onto
    // what T1 replaced, so undo lands on 'A'. This row RECORDED 'B' through
    // 15.4.3 while the contract was open ("NOT FROZEN"); see
    // enhancers/transactions/undo-after-rejection.spec.ts.
    expect(tree.$.x()).toBe('A');

    tree.redo();
    await tick();
    expect(tree.$.x()).toBe('C');
  });
});

// ============================================================================
// E2-C2 — nested path, sibling preservation
// ============================================================================
describe('E2-C2 — nested path', () => {
  it('undo preserves the untouched sibling', async () => {
    const tree = signalTree(
      {
        profile: { name: 'A', age: 30 },
      },
      { enhancers: [restoration(), transactions()] }
    ) as unknown as TT<Nested>;

    const t1 = undoable(() => tree.transaction(() => tree.$.profile.name('B')));
    await tick();
    const t2 = undoable(() => tree.transaction(() => tree.$.profile.name('C')));
    await tick();
    t2.confirm();
    await tick();
    t1.rollback();
    await tick();

    tree.undo();
    await tick();

    // Same decided contract as the scalar case (15.4.4: 'A', was 'B')...
    expect(tree.$.profile.name()).toBe('A');
    // ...and critically, the untouched sibling SURVIVES. The real path does not
    // clobber `age`, which is the bug E2-B found in the model's own repair.
    expect(tree.$.profile.age()).toBe(30);
  });
});

// ============================================================================
// E2-C3 — ABA against the real kernel. The row that decides E2.
// ============================================================================
describe('E2-C3 — real ABA authorship', () => {
  it('refuses confirmed undo while a pending ABA write owns the same location', async () => {
    const tree = signalTree(
      { x: 'A' },
      { enhancers: [restoration(), transactions()] }
    ) as unknown as TT<Scalar>;

    const t1 = undoable(() => tree.transaction(() => tree.$.x('B')));
    t1.confirm(); // CONFIRMED — this is the entry undo targets
    await tick();
    const hist = tree.getRestorationHistory().length;

    // Later work outside confirmed history, produced by the real mechanism: a
    // PENDING turn is visible in truth and adds no restoration history entry (E2-C1 row 1).
    const later = tree.transaction(() => {
      undoable(() => tree.$.x('C'));
      tree.$.x('B'); // value returns to T1's, authored by THIS turn
    });
    await tick();
    expect(tree.$.x()).toBe('B');
    expect(tree.getRestorationHistory().length).toBe(hist); // still not historied

    // b3d17d25 characterized destructive undo here without endorsing it.
    // Pending-overlap admission now protects ownership even when values match.
    expect(() => tree.undo()).toThrow(/ST1034/);
    expect(tree.$.x()).toBe('B');
    expect(tree.canUndo()).toBe(true);
    expect(tree.getRestorationHistory().length).toBe(hist);
    later.confirm();
    tree.undo();
    expect(tree.$.x()).toBe('A');
    tree.destroy();
  });
});
