/**
 * S1 DISABLED/UNUSED CONTRACT — the structural half (§8.5 points 1-5, 8).
 *
 * Points 6 and 7 are measured numbers, recorded in
 * `apps/studio-devtools/smoke/README.md`. These are the invariants that can be
 * asserted rather than timed, so they cannot silently regress.
 */
import { describe, expect, it } from 'vitest';

import { confirmedTurnReader } from '../../internals';
import { signalTree } from '../../lib/signal-tree';
import { transactions } from './transactions';

type Cart = { total: number };

const cart = () =>
  signalTree({ total: 0 } as Cart, { enhancers: [transactions()] }) as never as {
    $: Record<string, (v?: unknown) => unknown>;
    transaction(fn: () => void): { confirm(): void };
  };

describe('Studio costs nothing when unused', () => {
  it('1. importing the kernel registers no observer', () => {
    const bare = signalTree({ total: 0 } as Cart);
    const symbols = Object.getOwnPropertySymbols(bare).map(String);
    expect(symbols.some((s) => s.includes('transaction-runtime'))).toBe(false);
    expect(symbols.some((s) => s.toLowerCase().includes('studio'))).toBe(false);
  });

  it('3. observing a tree with no transactions retains nothing', () => {
    const bare = signalTree({ total: 0 } as Cart);
    const before = Object.getOwnPropertySymbols(bare).length;

    expect(confirmedTurnReader(bare as never)).toBeUndefined();
    expect(confirmedTurnReader(bare as never)).toBeUndefined();

    // Looking must not install. `getOrCreate` would have allocated an
    // authority here and made inspection change the inspected.
    expect(Object.getOwnPropertySymbols(bare).length).toBe(before);
  });

  it('4/5. no Studio branch scales with writes, and none is reachable', () => {
    const tree = cart();
    // Writes are unaffected by whether a reader was ever created.
    tree.transaction(() => tree.$['total'](1)).confirm();
    const withoutReader = tree.$['total']();

    const reader = confirmedTurnReader(tree as never);
    expect(reader).toBeDefined();

    tree.transaction(() => tree.$['total'](2)).confirm();
    expect(tree.$['total']()).toBe(2);
    expect(withoutReader).toBe(1);
  });

  /**
   * The seam reads the history the enhancer ALREADY retains. If it ever grew a
   * second capture path, this count would diverge from the enhancer's own.
   */
  it('no second history — the reader projects what is already retained', () => {
    const tree = cart();
    // Start at 1: writing the initial value is a no-op change, so it records
    // no turn — correct kernel behaviour, and a fixture that ignored it made
    // this assertion fail for the wrong reason.
    for (let i = 1; i <= 5; i++) {
      tree.transaction(() => tree.$['total'](i)).confirm();
    }

    const first = confirmedTurnReader(tree as never)?.readConfirmedTurns();
    const second = confirmedTurnReader(tree as never)?.readConfirmedTurns();

    expect(first?.turns).toHaveLength(5);
    expect(second?.turns).toHaveLength(5);
    // Reading twice must not duplicate, accumulate or mutate.
    expect(second?.turns.map((t) => t.id)).toEqual(first?.turns.map((t) => t.id));
  });

  it('8. enabling is explicit and disposable', () => {
    const tree = cart();
    tree.transaction(() => tree.$['total'](1)).confirm();

    // Nothing is installed by construction; a reader is created on request and
    // holds no registration that would need tearing down.
    const a = confirmedTurnReader(tree as never);
    const b = confirmedTurnReader(tree as never);
    expect(a).not.toBe(b);
    expect(a?.readConfirmedTurns().turns).toHaveLength(1);
    expect(b?.readConfirmedTurns().turns).toHaveLength(1);
  });
});
