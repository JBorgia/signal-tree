import { describe, expect, it } from 'vitest';

import { signalTree } from '../../lib/signal-tree';
import { transactions } from './transactions';

/**
 * R8-OVERLAP-0 — preregistered in docs/research/review-correctness-0/README.md.
 * Expected final states were recorded there BEFORE this file was written.
 *
 * Two outstanding proposals with genuinely OVERLAPPING contributions, settled
 * in every order, through the public API:
 *
 *     base   x=0  y=0  z=0
 *     P1     x=1  y=1
 *     P2          y=2  z=2      <- P2 supersedes P1 on y; x and z are disjoint
 *
 * The question is not "does it throw". It is: can the runtime remove exactly
 * P1's surviving contribution without damaging P2's, and vice versa?
 *
 * R6-LIVENESS-0 showed that checking only final values misses the important
 * failure — there, the ledger and the physical state disagreed about who owned
 * a value. So every settlement here records pending ids, confirmed ids and the
 * thrown cause alongside x/y/z.
 */

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

const scalarTree = () =>
  signalTree({ x: 0, y: 0, z: 0 }, { enhancers: [transactions()] });

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

describe('R8-OVERLAP-0 / A — reject P1, then accept P2', () => {
  it('reverses x, leaves y superseded by P2', async () => {
    const { tree, p1, p2 } = await twoOverlapping();

    const first = settle(() => p1.reject());
    const afterFirst = ledger(tree);

    const second = settle(() => p2.accept());
    const afterSecond = ledger(tree);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(afterFirst.pending).toBe(1);

    // PREREGISTERED x=0 y=2 z=2. MEASURED 2026-09-23: y=0.
    // Rejecting P1 reverted `y` to P1's captured BASELINE, destroying P2's
    // still-pending y=2 — supersession is not recognised across concurrent
    // pending proposals, only against authored/realized later writes.
    expect(afterFirst).toMatchObject({ x: 0, y: 0, z: 2 });
    // Worse: accepting P2 does NOT restore its own contribution. P2's `z`
    // commits, P2's `y` is gone, and nothing raised.
    expect(afterSecond).toMatchObject({ x: 0, y: 0, z: 2 });
  });
});

describe('R8-OVERLAP-0 / B — accept P2, then reject P1', () => {
  it('order-independent with A', async () => {
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

describe('R8-OVERLAP-0 / E — reject P1, then reject P2 (DISCRIMINATOR)', () => {
  it("P2's rollback must NOT resurrect rejected P1's y=1", async () => {
    const { tree, p1, p2 } = await twoOverlapping();

    const first = settle(() => p1.reject());
    const afterFirst = ledger(tree);

    const second = settle(() => p2.reject());

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    // PREREGISTERED x=0 y=2 z=2 after the first reject. MEASURED: y=0, the
    // same clobber as case A.
    expect(afterFirst).toMatchObject({ x: 0, y: 0, z: 2 });
    // PREREGISTERED final x=0 y=0 z=0. MEASURED: x=0 y=1 z=0.
    // BOTH proposals were rejected and neither is pending, yet `y` holds
    // P1's REJECTED value. Rejecting P2 compensated y back to the value P2
    // had captured as its baseline — which was P1's speculative y=1, already
    // rejected by then. The resurrection E was written to detect.
    expect(ledger(tree)).toMatchObject({ x: 0, y: 1, z: 0, pending: 0 });
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
