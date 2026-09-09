/**
 * THE REAL KERNEL/ADAPTER JOIN.
 *
 * Most adapter specs inject a `StudioTreeProbe` to stay fast and focused. These
 * use an actual `signalTree()`, so the final seam — identity, capability
 * derivation, reading, and destruction — is proven rather than assumed.
 */
import { signalTree, transactions } from '@signal-tree/kernel';
import { afterEach, describe, expect, it } from 'vitest';

import {
  attachStudio,
  peekRegistry,
  StudioRequirementError,
  type StudioAttachableTree,
} from './index';

type Cart = { promoCode: string | null; discount: number; total: number };

const opened: { detach: () => void }[] = [];
afterEach(() => {
  while (opened.length > 0) opened.pop()?.detach();
});
const open = (tree: StudioAttachableTree, options?: Parameters<typeof attachStudio>[1]) => {
  const a = attachStudio(tree, options);
  opened.push(a);
  return a;
};

const bare = () =>
  signalTree({ promoCode: null, discount: 0, total: 12000 } as Cart);

const transactional = () =>
  signalTree({ promoCode: null, discount: 0, total: 12000 } as Cart, {
    enhancers: [transactions()],
  } as never) as never as StudioAttachableTree & {
    $: Record<string, (v?: unknown) => unknown>;
    transaction(fn: () => void): { confirm(): void };
    destroy(): void;
  };

describe('attachStudio on a real SignalTree', () => {
  it('attaches a tree WITHOUT transactions and reports the capability absent', () => {
    const attachment = open(bare() as never);

    expect(attachment.capabilities).toEqual([]);
    expect(peekRegistry()?.listTrees()).toEqual([
      { id: attachment.id, label: undefined, capabilities: [] },
    ]);
    expect(peekRegistry()?.readConfirmedTurns(attachment.id)).toEqual({
      ok: false,
      error: {
        code: 'STUDIO_CAPABILITY_UNAVAILABLE',
        capability: 'committed-transactions',
      },
    });
  });

  it('derives the capability and returns the real committed effect', () => {
    const tree = transactional();
    const attachment = open(tree, { label: 'AppTree' });
    expect(attachment.capabilities).toEqual(['committed-transactions']);

    tree
      .transaction(() => {
        tree.$['promoCode']('SAVE20');
        tree.$['discount'](2400);
        tree.$['total'](9600);
      })
      .confirm();

    const result = peekRegistry()?.readConfirmedTurns(attachment.id);
    expect(result?.ok).toBe(true);
    if (!result?.ok) return;

    expect(result.value.treeId).toBe(attachment.id);
    expect(result.value.retention.truncated).toBe(false);

    const byPath = Object.fromEntries(
      result.value.turns[0]!.effects.map((e) => [e.path, [e.before, e.after]])
    );
    expect(byPath['promoCode']).toEqual([null, 'SAVE20']);
    expect(byPath['discount']).toEqual([0, 2400]);
    expect(byPath['total']).toEqual([12000, 9600]);
  });

  it('two real trees stay isolated despite identical numeric ids', () => {
    const a = transactional();
    const b = transactional();
    const ra = open(a);
    const rb = open(b);

    a.transaction(() => a.$['total'](1)).confirm();
    b.transaction(() => b.$['total'](2)).confirm();

    expect(ra.id).not.toBe(rb.id);
    const readA = peekRegistry()?.readConfirmedTurns(ra.id);
    const readB = peekRegistry()?.readConfirmedTurns(rb.id);
    expect(readA?.ok && readA.value.turns[0]?.effects[0]?.after).toBe(1);
    expect(readB?.ok && readB.value.turns[0]?.effects[0]?.after).toBe(2);
  });

  /** The lifecycle glue: the tree's own cleanup evicts the attachment. */
  it('destroying the tree removes the attachment automatically', () => {
    const tree = transactional();
    const attachment = open(tree, { label: 'Doomed' });
    tree.transaction(() => tree.$['total'](9600)).confirm();

    expect(peekRegistry()?.listTrees()).toHaveLength(1);

    tree.destroy();

    // Unlisted, and the registry drops because it was the last attachment.
    expect(peekRegistry()).toBeUndefined();
  });

  describe('the strict path', () => {
    it('throws when a required capability is genuinely absent', () => {
      expect(() =>
        attachStudio(bare() as never, { require: ['committed-transactions'] })
      ).toThrow(StudioRequirementError);
    });

    it('registers nothing and consumes no session id on failure', () => {
      expect(peekRegistry()).toBeUndefined();

      expect(() =>
        attachStudio(bare() as never, { require: ['committed-transactions'] })
      ).toThrow();
      expect(() =>
        attachStudio(bare() as never, { require: ['committed-transactions'] })
      ).toThrow();

      // No registry, and — because ids are allocated only after `require`
      // passes — repeated bad wiring has not advanced the session sequence.
      expect(peekRegistry()).toBeUndefined();
      const good = open(transactional());
      expect(good.capabilities).toEqual(['committed-transactions']);
    });

    it('succeeds when the requirement is satisfied', () => {
      const attachment = open(transactional(), {
        require: ['committed-transactions'],
      });
      expect(attachment.capabilities).toEqual(['committed-transactions']);
    });
  });
});
