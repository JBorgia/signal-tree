import { act, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { signalTree, transactions } from '@signal-tree/kernel';
// Control C uses the EXISTING settlement-gated mechanism rather than a new
// observer invented for the test, and that mechanism is internal by design —
// so it is reached by path, as ssr-transfer.spec.ts reaches serialization.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { getPositionRegistry } from '../../kernel/src/lib/internals/position-registry';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { scheduleDurableConsequence } from '../../kernel/src/lib/internals/commit-consequence';
import { useSignalTree } from './use-signal-tree';

/**
 * REACT-PENDING-TURN-REALIZATION-0 — acceptance controls A-D.
 *
 * Preregistered in `docs/research/react-pending-turn-realization-0.md` BEFORE
 * any change to the observation seam, so the fix has nowhere to hide.
 *
 * NOT a Proposal defect. `transact()` reproduces it with no facade involved,
 * which is what scoped this to generic pending-turn realization. These controls
 * deliberately use RAW `transact()` for the same reason, and must stay that way
 * permanently: otherwise a later change could make `propose()` pass through some
 * special path while generic pending turns regressed again.
 *
 * The constraint that makes this hard:
 *
 *     state mutation -> canonical speculative truth = 7
 *       UI observation          MUST publish now
 *       settlement consequences MUST remain gated
 *
 * B alone is satisfiable by deleting the open-commit-scope guard, which would
 * publish deferred consequences early and collapse those two layers. B and C
 * must hold together.
 */

const settle = async (): Promise<void> => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

const makeTree = () =>
  signalTree({ scalar: 0 }, { enhancers: [transactions()] });

/**
 * The EXISTING settlement-gated mechanism, not a new observer invented for
 * this test: a durable consequence runs only if the operation that scheduled
 * it survives. Borrowed verbatim from
 * `kernel/src/lib/egress-1-observation-vs-consequence.spec.ts`.
 */
const afterCommit = (x: unknown, effect: () => void): void => {
  const registry = getPositionRegistry(x);
  if (!registry) throw new Error('afterCommit: X must be an owned location.');
  scheduleDurableConsequence({
    claimant: x as object,
    key: effect,
    run: effect,
  });
};

/** One held consumer for the whole scenario — never remounted. */
const mountHeldConsumer = (tree: ReturnType<typeof makeTree>) => {
  const seen: number[] = [];
  function Probe() {
    const value = useSignalTree(tree, ($) => $.scalar());
    seen.push(value);
    return null;
  }
  const view = render(<Probe />);
  return { seen, unmount: () => view.unmount() };
};

describe('REACT-PENDING-TURN-REALIZATION-0 / control A — plain write', () => {
  it('a held consumer updates normally when no turn is open', async () => {
    const tree = makeTree();
    const held = mountHeldConsumer(tree);
    await act(async () => {
      await settle();
    });

    await act(async () => {
      tree.$.scalar(3);
      await settle();
    });

    expect(tree.$.scalar()).toBe(3);
    expect(held.seen.at(-1)).toBe(3);
    held.unmount();
  });
});

describe('REACT-PENDING-TURN-REALIZATION-0 / control B — pending transact', () => {
  it('the SAME held consumer observes the speculative value BEFORE confirm', async () => {
    const tree = makeTree();
    const held = mountHeldConsumer(tree);
    await act(async () => {
      await settle();
    });

    const pending = tree.transact(() => {
      tree.$.scalar(7);
    });
    await act(async () => {
      await settle();
    });

    // Canonical truth is already 7 — the kernel publishes speculative state.
    expect(tree.$.scalar()).toBe(7);
    // The React consumer must physically realize that same truth.
    expect(held.seen.at(-1)).toBe(7);

    pending.confirm();
    held.unmount();
  });
});

describe('REACT-PENDING-TURN-REALIZATION-0 / control C — consequences stay gated', () => {
  it('UI sees the speculative value while durable consequences do NOT run', async () => {
    const tree = makeTree();
    const held = mountHeldConsumer(tree);
    await act(async () => {
      await settle();
    });

    const ran: number[] = [];
    const pending = tree.transact(() => {
      tree.$.scalar(7);
      afterCommit(tree.$.scalar, () => ran.push(tree.$.scalar()));
    });
    await act(async () => {
      await settle();
    });

    // The whole point: these two must be true AT THE SAME TIME.
    expect(held.seen.at(-1)).toBe(7);
    expect(ran).toEqual([]);

    pending.confirm();
    await act(async () => {
      await settle();
    });
    expect(ran).toEqual([7]);

    held.unmount();
  });
});

describe('REACT-PENDING-TURN-REALIZATION-0 / control D — rollback', () => {
  it('the same held consumer observes 0 -> 7 -> 0', async () => {
    const tree = makeTree();
    const held = mountHeldConsumer(tree);
    await act(async () => {
      await settle();
    });

    const pending = tree.transact(() => {
      tree.$.scalar(7);
    });
    await act(async () => {
      await settle();
    });
    expect(held.seen.at(-1)).toBe(7);

    pending.rollback();
    await act(async () => {
      await settle();
    });

    // A seam that delivers the speculative value but not its compensation
    // strands the UI showing a value the tree no longer holds.
    expect(tree.$.scalar()).toBe(0);
    expect(held.seen.at(-1)).toBe(0);

    const distinct = held.seen.filter(
      (v, i) => i === 0 || v !== held.seen[i - 1]
    );
    expect(distinct).toEqual([0, 7, 0]);

    held.unmount();
  });
});
