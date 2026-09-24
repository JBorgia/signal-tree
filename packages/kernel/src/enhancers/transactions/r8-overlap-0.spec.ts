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

    // WAS ok. MEASURED 2026-09-23: rejecting P1 reverted `y` to P1's captured
    // BASELINE and destroyed P2's still-pending y=2 — supersession was not
    // recognised across concurrent pending proposals, only against
    // authored/realized later writes. Then accepting P2 did NOT restore its own
    // contribution: P2's `z` committed, P2's `y` was gone, nothing raised.
    //
    //     WAS   afterFirst  x=0 y=0 z=2   (preregistered x=0 y=2 z=2)
    //           afterSecond x=0 y=0 z=2   a CONFIRMED proposal missing a field
    //
    // NOW P1's rejection REFUSES while P2 is open, because an unsettled writer
    // can never be superseded — only conflicted with. Nothing moves, both stay
    // pending, and P2 keeps everything it wrote. Surgical multi-writer
    // settlement is the 16.0 ownership model; this line refuses instead of
    // guessing, which is the H4/H5 contract.
    expect(first.ok).toBe(false);
    expect(first).toMatchObject({ cause: 'later-pending-dependency' });
    expect(afterFirst.pending).toBe(2);
    expect(afterFirst).toMatchObject({ x: 1, y: 2, z: 2 });

    // P2 settles cleanly and keeps BOTH of its fields.
    expect(second.ok).toBe(true);
    expect(afterSecond).toMatchObject({ y: 2, z: 2 });
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

    // THE DISCRIMINATOR. WAS: both rejects reported ok, and the tree ended at
    // x=0 y=1 z=0 — BOTH proposals rejected, neither pending, yet `y` held
    // P1's REJECTED value. Rejecting P2 compensated `y` back to the value P2
    // had captured as its baseline, which was P1's speculative y=1, already
    // rejected by then. That is the resurrection this case exists to detect,
    // and it is the clearest evidence for the diagnosis: A BASELINE IS NOT
    // OWNERSHIP. A before-image records what a location HELD, never who owns
    // it now.
    //
    //     WAS   afterFirst x=0 y=0 z=2   final x=0 y=1 z=0   (preregistered 0,0,0)
    //
    // NOW the resurrection is unreachable because the step that caused it is
    // refused: P1 cannot be rejected while P2 is open. Rejecting P2 first still
    // works and is the supported ordering — see case F.
    expect(first.ok).toBe(false);
    expect(first).toMatchObject({ cause: 'later-pending-dependency' });
    expect(afterFirst).toMatchObject({ x: 1, y: 2, z: 2 });
    // P2 reverses cleanly, leaving P1's own contribution live and still pending.
    expect(second.ok).toBe(true);
    expect(ledger(tree)).toMatchObject({ x: 1, y: 1, z: 0, pending: 1 });
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
