import { afterEach, describe, expect, it } from 'vitest';

import { signalTree } from '../../lib/signal-tree';
import { transactions } from './transactions';

/** Safety containment, not completion of the surgical R8 product contract.
 * The original measured-corruption fixture is archived verbatim under
 * docs/research/review-correctness-0/fixtures/7ade0e3e/.
 * Older overlapping rollback may now refuse atomically; the frozen research
 * contract still records that as a failure to provide surgical settlement.
 */
const owned: Array<{ destroy(): void }> = [];
afterEach(() => {
  for (const tree of owned.splice(0)) tree.destroy();
});

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

type Ledger = {
  x: number;
  y: number;
  z: number;
  pending: number;
  confirmed: number;
};

const scalarTree = () => {
  const tree = signalTree(
    { x: 0, y: 0, z: 0 },
    { enhancers: [transactions()] }
  );
  owned.push(tree);
  return tree;
};

const ledger = (tree: ReturnType<typeof scalarTree>): Ledger => {
  const tx = (
    tree as unknown as {
      __transactions: {
        getPendingTurnCount(): number;
        getConfirmedTurnCount(): number;
      };
    }
  ).__transactions;
  return {
    x: tree.$.x(),
    y: tree.$.y(),
    z: tree.$.z(),
    pending: tx.getPendingTurnCount(),
    confirmed: tx.getConfirmedTurnCount(),
  };
};

const settle = (
  op: () => void
): { ok: true } | { ok: false; cause: unknown } => {
  try {
    op();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      cause: (error as { cause?: { kind?: unknown } })?.cause?.kind ?? 'error',
    };
  }
};

/** Both proposals outstanding, overlapping on `y`. */
const twoOverlapping = async () => {
  const tree = scalarTree();

  const p1 = tree.propose(() => {
    tree.$.x(1);
    tree.$.y(1);
  });
  await flush();

  const p2 = tree.propose(() => {
    tree.$.y(2);
    tree.$.z(2);
  });
  await flush();

  return { tree, p1, p2 };
};

describe('R8-OVERLAP-0 / setup — both proposals outstanding', () => {
  it('both speculative contributions are visible, P2 wins y', async () => {
    const { tree } = await twoOverlapping();
    expect(ledger(tree)).toMatchObject({ x: 1, y: 2, z: 2, pending: 2 });
  });
});

describe('R8 safety / A — older reject refuses, newer accepts, older retry', () => {
  it('preserves both pending contributions until settlement is safe', async () => {
    const { tree, p1, p2 } = await twoOverlapping();
    expect(settle(() => p1.reject()).ok).toBe(false);
    expect(ledger(tree)).toMatchObject({ x: 1, y: 2, z: 2, pending: 2 });
    expect(settle(() => p2.accept()).ok).toBe(true);
    expect(ledger(tree)).toMatchObject({ x: 1, y: 2, z: 2, pending: 1 });
    expect(settle(() => p1.reject()).ok).toBe(true);
    expect(ledger(tree)).toMatchObject({ x: 0, y: 2, z: 2, pending: 0 });
  });
});

describe('R8-OVERLAP-0 / B — accept P2, then reject P1', () => {
  it('preserves the newer confirmed contribution', async () => {
    const { tree, p1, p2 } = await twoOverlapping();

    const first = settle(() => p2.accept());
    const second = settle(() => p1.reject());

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    // PREREGISTERED: x=0 y=2 z=2
    expect(ledger(tree)).toMatchObject({ x: 0, y: 2, z: 2 });
  });
});

describe('R8-OVERLAP-0 / C — reject P2, then accept P1 (DISCRIMINATOR)', () => {
  it("rolling back P2 must restore y to P1's PENDING value, not the baseline", async () => {
    const { tree, p1, p2 } = await twoOverlapping();

    const first = settle(() => p2.reject());
    const afterFirst = ledger(tree);

    const second = settle(() => p1.accept());

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    // PREREGISTERED: x=1 y=1 z=0.
    // y=0 here would mean P2's rollback destroyed P1's still-pending
    // contribution (SAFETY CORRUPTED).
    expect(afterFirst).toMatchObject({ x: 1, y: 1, z: 0 });
    expect(ledger(tree)).toMatchObject({ x: 1, y: 1, z: 0 });
  });
});

describe('R8-OVERLAP-0 / D — accept P1, then reject P2', () => {
  it("P2's rollback returns y to P1's confirmed value", async () => {
    const { tree, p1, p2 } = await twoOverlapping();

    const first = settle(() => p1.accept());
    const second = settle(() => p2.reject());

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    // PREREGISTERED: x=1 y=1 z=0
    expect(ledger(tree)).toMatchObject({ x: 1, y: 1, z: 0 });
  });
});

describe('R8 safety / E — older reject refuses, newer rejects, older retry', () => {
  it('never resurrects a contribution that was actually rejected', async () => {
    const { tree, p1, p2 } = await twoOverlapping();
    expect(settle(() => p1.reject()).ok).toBe(false);
    expect(ledger(tree)).toMatchObject({ x: 1, y: 2, z: 2, pending: 2 });
    expect(settle(() => p2.reject()).ok).toBe(true);
    // P1 was refused, not rejected: it still owns these values.
    expect(ledger(tree)).toMatchObject({ x: 1, y: 1, z: 0, pending: 1 });
    expect(settle(() => p1.reject()).ok).toBe(true);
    expect(ledger(tree)).toMatchObject({ x: 0, y: 0, z: 0, pending: 0 });
  });
});

describe('R8-OVERLAP-0 / F — reject P2, then reject P1', () => {
  it('reaches the same baseline from the other order', async () => {
    const { tree, p1, p2 } = await twoOverlapping();

    const first = settle(() => p2.reject());
    const second = settle(() => p1.reject());

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    // PREREGISTERED: x=0 y=0 z=0
    expect(ledger(tree)).toMatchObject({ x: 0, y: 0, z: 0, pending: 0 });
  });
});

describe('R8-OVERLAP-0 / G — accept P1, then accept P2', () => {
  it('both committed, P2 wins y as the later write', async () => {
    const { tree, p1, p2 } = await twoOverlapping();

    expect(settle(() => p1.accept()).ok).toBe(true);
    expect(settle(() => p2.accept()).ok).toBe(true);
    // PREREGISTERED: x=1 y=2 z=2
    expect(ledger(tree)).toMatchObject({ x: 1, y: 2, z: 2, pending: 0 });
  });
});

describe('R8-OVERLAP-0 / H — accept P2, then accept P1', () => {
  it('order-independent with G', async () => {
    const { tree, p1, p2 } = await twoOverlapping();

    expect(settle(() => p2.accept()).ok).toBe(true);
    expect(settle(() => p1.accept()).ok).toBe(true);
    // PREREGISTERED: x=1 y=2 z=2
    expect(ledger(tree)).toMatchObject({ x: 1, y: 2, z: 2, pending: 0 });
  });
});
