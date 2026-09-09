import { describe, expect, it } from 'vitest';

import { confirmedTurnReader } from '../../internals';
import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { transactions } from './transactions';

type Cart = { promoCode: string | null; discount: number; total: number };
type Row = { id: string; name: string };

const cartTree = () =>
  signalTree<Cart>(
    { promoCode: null, discount: 0, total: 12000 },
    { enhancers: [transactions()] }
  ) as never as {
    $: Record<string, (value?: unknown) => unknown>;
    transaction(fn: () => void): { confirm(): void };
  };

describe('confirmedTurnReader', () => {
  it('1. reads a plain committed transaction', () => {
    const tree = cartTree();
    tree.transaction(() => {
      tree.$['promoCode']('SAVE20');
      tree.$['discount'](2400);
      tree.$['total'](9600);
    }).confirm();

    const snapshot = confirmedTurnReader(tree as never)?.readConfirmedTurns();
    expect(snapshot?.turns).toHaveLength(1);
    expect(snapshot?.turns[0]?.effects.length).toBeGreaterThan(0);
  });

  it('2. every effect preserves path and ownerPath', () => {
    const tree = cartTree();
    tree.transaction(() => {
      tree.$['promoCode']('SAVE20');
      tree.$['total'](9600);
    }).confirm();

    const effects =
      confirmedTurnReader(tree as never)?.readConfirmedTurns().turns[0]?.effects ?? [];
    expect(effects.length).toBeGreaterThan(0);
    for (const effect of effects) {
      expect(typeof effect.path).toBe('string');
      expect(effect.path.length).toBeGreaterThan(0);
      expect(typeof effect.ownerPath).toBe('string');
    }
    expect(effects.map((e) => e.path).sort()).toEqual(['promoCode', 'total']);
  });

  /**
   * 3. NET consequence, not an attempt log. Same location written twice inside
   * one transaction coalesces to its net effect by design (MO-1B) — which is
   * why Studio can answer "which intermediate writes did not survive?" with
   * UNKNOWN honestly: the intermediate is absent, not withheld.
   */
  it('3. exposes only the net consequence of repeated same-path writes', () => {
    const tree = cartTree();
    tree.transaction(() => {
      tree.$['discount'](2000);
      tree.$['discount'](2400);
    }).confirm();

    const effects =
      confirmedTurnReader(tree as never)?.readConfirmedTurns().turns[0]?.effects ?? [];
    const discount = effects.filter((e) => e.path === 'discount');
    expect(discount).toHaveLength(1);
    expect(discount[0]?.before).toBe(0);
    expect(discount[0]?.after).toBe(2400);
    expect(JSON.stringify(effects)).not.toContain('2000');
  });

  it('4. a value returned to its original is not reported as a change', () => {
    const tree = cartTree();
    tree.transaction(() => {
      tree.$['discount'](2400);
      tree.$['discount'](0);
    }).confirm();

    const effects =
      confirmedTurnReader(tree as never)?.readConfirmedTurns().turns[0]?.effects ?? [];
    expect(effects.filter((e) => e.path === 'discount')).toHaveLength(0);
  });

  /**
   * 5. C11 at the kernel layer. Position and turn ids are allocated from 1 PER
   * TREE, so two live trees both have turn 1 owning position 1. The
   * process-global path notifier already coalesced two trees' writes by
   * ignoring this (NOTIFIER-SCOPE-0).
   */
  it('5. two trees with identical numeric ids stay isolated', () => {
    const a = cartTree();
    const b = cartTree();
    a.transaction(() => a.$['total'](1)).confirm();
    b.transaction(() => b.$['total'](2)).confirm();

    const ra = confirmedTurnReader(a as never);
    const rb = confirmedTurnReader(b as never);

    expect(ra?.treeId).toBeDefined();
    expect(ra?.treeId).not.toBe(rb?.treeId);
    expect(ra?.readConfirmedTurns().turns[0]?.id).toBe(
      rb?.readConfirmedTurns().turns[0]?.id
    );
    expect(ra?.readConfirmedTurns().turns[0]?.effects[0]?.after).toBe(1);
    expect(rb?.readConfirmedTurns().turns[0]?.effects[0]?.after).toBe(2);
  });

  it('6. structural effects keep their address and kind', () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
      { enhancers: [transactions()] }
    ) as never as {
      $: { rows: { addOne(row: Row): void } };
      transaction(fn: () => void): { confirm(): void };
    };
    tree.transaction(() => tree.$.rows.addOne({ id: 'A', name: 'Alpha' })).confirm();

    const effects =
      confirmedTurnReader(tree as never)?.readConfirmedTurns().turns[0]?.effects ?? [];
    expect(effects.length).toBeGreaterThan(0);
    const structural = effects.find((e) => e.kind !== 'set');
    expect(structural?.ownerPath).toBe('rows');
    expect(['add', 'remove', 'rekey']).toContain(structural?.kind);
  });

  it('7. the reader cannot mutate retained history', () => {
    const tree = cartTree();
    tree.transaction(() => tree.$['total'](9600)).confirm();

    const reader = confirmedTurnReader(tree as never);
    const first = reader?.readConfirmedTurns();
    (first?.turns as unknown as unknown[])?.push({ id: 999, positions: [], effects: [] });

    expect(reader?.readConfirmedTurns().turns).toHaveLength(1);
    expect(reader?.readConfirmedTurns().turns[0]?.id).not.toBe(999);
  });

  it('8. retention is reported truthfully rather than assumed complete', () => {
    const tree = cartTree();
    tree.transaction(() => tree.$['total'](9600)).confirm();

    const retention = confirmedTurnReader(tree as never)?.readConfirmedTurns().retention;
    // Nothing evicts from confirmedTurns today, so history is complete — and
    // `truncated` is derived from the retained ids, so it starts reporting true
    // on its own if eviction is ever added.
    expect(retention?.truncated).toBe(false);
    expect(retention?.firstAvailableTurnId).toBe(1);
  });

  /**
   * 10. Zero-cost when unused. A tree that never ran a transaction has no
   * runtime, and LOOKING must not create one — observation peeks, it does not
   * install.
   */
  it('10. observing installs nothing on a tree with no transaction runtime', () => {
    const bare = signalTree<Cart>({ promoCode: null, discount: 0, total: 12000 });

    expect(confirmedTurnReader(bare as never)).toBeUndefined();
    expect(confirmedTurnReader(bare as never)).toBeUndefined();

    const symbols = Object.getOwnPropertySymbols(bare).map(String);
    expect(symbols.some((s) => s.includes('transaction-runtime'))).toBe(false);
  });
});

describe('destroyed-tree lifecycle (acceptance 9)', () => {
  it('refuses explicitly after destroy, rather than reporting empty history', async () => {
    const { StudioTreeDestroyedError } = await import('../../internals');
    const tree = cartTree();
    tree.transaction(() => tree.$['total'](9600)).confirm();

    const reader = confirmedTurnReader(tree as never);
    expect(reader?.readConfirmedTurns().turns).toHaveLength(1);

    (tree as unknown as { destroy(): void }).destroy();

    // Empty history and a dead tree are different facts.
    expect(() => reader?.readConfirmedTurns()).toThrow(StudioTreeDestroyedError);
    expect(() => reader?.readConfirmedTurns()).toThrow(/STUDIO_TREE_DESTROYED/);
  });

  /**
   * The three states a consumer must be able to tell apart. Collapsing any two
   * of them produces a confident wrong answer, which is worse than a refusal.
   */
  it('distinguishes no-transactions, live-but-empty, and destroyed', () => {
    // 1. no transactions enhancer -> no reader at all.
    const bare = signalTree<Cart>({ promoCode: null, discount: 0, total: 12000 });
    expect(confirmedTurnReader(bare as never)).toBeUndefined();

    // 2. live tree, enhancer present, nothing committed -> a reader that
    //    truthfully reports an empty history.
    const idle = cartTree();
    const idleSnapshot = confirmedTurnReader(idle as never)?.readConfirmedTurns();
    expect(idleSnapshot?.turns).toEqual([]);
    expect(idleSnapshot?.retention.truncated).toBe(false);

    // 3. destroyed -> a reader that refuses, so (2) and (3) never look alike.
    const used = cartTree();
    used.transaction(() => used.$['total'](1)).confirm();
    const reader = confirmedTurnReader(used as never);
    (used as unknown as { destroy(): void }).destroy();
    expect(() => reader?.readConfirmedTurns()).toThrow(/STUDIO_TREE_DESTROYED/);
  });
});
