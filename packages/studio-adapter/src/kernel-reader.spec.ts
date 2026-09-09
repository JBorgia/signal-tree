/**
 * THE CONTRACT DISCRIMINATOR.
 *
 * `adapter.spec.ts` exercises the vertical against a hand-written
 * `ConfirmedTurnReader`. This file runs the SAME adapter code against the REAL
 * kernel port, on a real tree, with a real transaction.
 *
 * If the structural contract in `kernel-contract.ts` was guessed correctly,
 * nothing in `normalize.ts`, `attach.ts` or `studio-query` needs to change to
 * accept it.
 */
import { confirmedTurnReader } from '@signal-tree/kernel/internals';
import { createStudioSession } from '@signal-tree/studio-query';
import { describe, expect, it } from 'vitest';

import {
  captureConfirmedTurns,
  createTreeIdentityRegistry,
  type ConfirmedTurnReader,
} from './index';

import { signalTree, transactions } from '@signal-tree/kernel';

type Cart = { promoCode: string | null; discount: number; total: number };

const cartTree = () =>
  signalTree(
    { promoCode: null, discount: 0, total: 12000 } as Cart,
    { enhancers: [transactions()] } as never
  ) as never as {
    $: Record<string, (value?: unknown) => unknown>;
    transaction(fn: () => void): { confirm(): void };
  };

describe('the real kernel port through the Studio vertical', () => {
  it('captures a live transaction with no change to adapter or query code', () => {
    const tree = cartTree();
    tree
      .transaction(() => {
        tree.$['promoCode']('SAVE20');
        tree.$['discount'](2400);
        tree.$['total'](9600);
      })
      .confirm();

    const reader = confirmedTurnReader(tree as never);
    expect(reader).toBeDefined();

    const session = createStudioSession();
    const captured = captureConfirmedTurns({
      // The kernel port satisfies the adapter's structural contract as written.
      reader: reader as unknown as ConfirmedTurnReader,
      session,
      identities: createTreeIdentityRegistry(),
    });

    expect(captured.captured).toBe(1);
    const turn = session.turns()[0];
    expect(turn?.treeId).toBe('tree-0001');
    expect(turn?.disposition).toBe('committed');

    const byPath = Object.fromEntries(
      (turn?.effects ?? []).map((e) => [e.path, [e.before, e.after]])
    );
    expect(byPath['promoCode']).toEqual([null, 'SAVE20']);
    expect(byPath['discount']).toEqual([0, 2400]);
    expect(byPath['total']).toEqual([12000, 9600]);
  });

  it('keeps two live trees isolated end to end', () => {
    const a = cartTree();
    const b = cartTree();
    a.transaction(() => a.$['total'](1)).confirm();
    b.transaction(() => b.$['total'](2)).confirm();

    const session = createStudioSession();
    const identities = createTreeIdentityRegistry();
    for (const tree of [a, b]) {
      captureConfirmedTurns({
        reader: confirmedTurnReader(tree as never) as unknown as ConfirmedTurnReader,
        session,
        identities,
      });
    }

    expect(session.trees()).toEqual(['tree-0001', 'tree-0002']);
    expect(session.turns()).toHaveLength(2);
    expect(session.turn('tree-0001', 1)?.effects[0]?.after).toBe(1);
    expect(session.turn('tree-0002', 1)?.effects[0]?.after).toBe(2);
  });
});
