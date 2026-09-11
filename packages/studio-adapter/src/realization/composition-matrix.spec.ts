import {
  entityMap,
  external,
  restoration,
  signalTree,
  transactions,
  undoable,
} from '@signal-tree/kernel';
import { afterEach, describe, expect, it } from 'vitest';
import {
  attachStudio,
  liveCaptureTarget,
  peekRegistry,
  readStateShape,
  startRealizationCapture,
  StudioCaptureError,
  type LiveTree,
} from '../index';
const cleanup: (() => void)[] = [];
afterEach(() => {
  while (cleanup.length) cleanup.pop()?.();
});
const settle = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
function observe(tree: LiveTree) {
  const attachment = attachStudio(tree);
  cleanup.push(() => attachment.detach());
  const lease = startRealizationCapture(
    liveCaptureTarget(tree, attachment.id)!,
    { maxEffects: 5 }
  );
  cleanup.push(() => lease.dispose());
  return { lease, id: attachment.id };
}
describe('supported Studio composition regression matrix', () => {
  it.each(['transactions', 'restoration', 'both'] as const)(
    'observes nested external writes with %s',
    async (mode) => {
      const enhancers =
        mode === 'transactions'
          ? [transactions()]
          : mode === 'restoration'
          ? [restoration()]
          : [transactions(), restoration()];
      const tree = signalTree(
        { nested: { location: { count: 0 } } },
        { enhancers }
      );
      cleanup.push(() => tree.destroy());
      const { lease } = observe(tree);
      external(() => tree.$.nested.location.count(1));
      await settle();
      expect(lease.snapshot().effects).toMatchObject([
        {
          path: 'nested.location.count',
          origin: 'external',
          after: { kind: 'value', value: 1 },
        },
      ]);
    }
  );
  it('refuses unsupported bare-tree observation explicitly', () => {
    const tree = signalTree({ nested: { n: 0 } });
    cleanup.push(() => tree.destroy());
    expect(() =>
      startRealizationCapture(liveCaptureTarget(tree, 'bare-matrix')!)
    ).toThrow(StudioCaptureError);
  });
  it('does not promote pending or rolled-back writes into committed transactions', async () => {
    const tree = signalTree({ n: 0 }, { enhancers: [transactions()] });
    cleanup.push(() => tree.destroy());
    const { id } = observe(tree);
    const pending = tree.transaction(() => tree.$.n(1));
    await settle();
    const read = () => {
      const result = peekRegistry()!.readConfirmedTurns(id);
      if (!result.ok) throw new Error('committed capability unavailable');
      return result.value.turns;
    };
    expect(read()).toHaveLength(0);
    pending.rollback();
    await settle();
    expect(read()).toHaveLength(0);
    expect(tree.$.n()).toBe(0);
    tree.transaction(() => tree.$.n(2)).confirm();
    expect(read()).toHaveLength(1);
  });
  it('surfaces restoration origin without inventing a transaction parent', async () => {
    const tree = signalTree({ n: 0 }, { enhancers: [restoration()] });
    cleanup.push(() => tree.destroy());
    const { lease } = observe(tree);
    undoable(() => tree.$.n(2));
    await settle();
    tree.undo();
    await settle();
    const restored = lease
      .snapshot()
      .effects.find((effect) => effect.origin === 'restoration');
    expect(restored).toBeDefined();
    expect(restored?.transactionId).toBeUndefined();
    expect(tree.$.n()).toBe(0);
  });
  it('follows entity create/remove/reused-key state without equating subject lifetimes', async () => {
    const tree = signalTree(
      {
        rows: entityMap<{ id: string; generation: number }, string>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [transactions()] }
    );
    cleanup.push(() => tree.destroy());
    const { id } = observe(tree);
    tree
      .transaction(() => tree.$.rows.addOne({ id: 'same', generation: 1 }))
      .confirm();
    await settle();
    expect(tree.$.rows.byId('same')?.()?.generation).toBe(1);
    tree.transaction(() => tree.$.rows.removeOne('same')).confirm();
    await settle();
    expect(tree.$.rows.ids()).toEqual([]);
    tree
      .transaction(() => tree.$.rows.addOne({ id: 'same', generation: 2 }))
      .confirm();
    await settle();
    expect(tree.$.rows.byId('same')?.()?.generation).toBe(2);
    const history = peekRegistry()!.readConfirmedTurns(id);
    expect(history.ok).toBe(true);
    if (history.ok) {
      expect(history.value.turns).toHaveLength(3);
      const additions = history.value.turns
        .flatMap((turn) => turn.effects)
        .filter((effect) => effect.structural === 'add');
      expect(additions).toHaveLength(2);
      // This real source composition does not supply subject identity.
      // Preserve absence instead of inventing lifetime identity from a reused key.
      expect(additions[0].subjectId).toBeUndefined();
      expect(additions[1].subjectId).toBeUndefined();
    }
    expect(readStateShape(tree).ok).toBe(true);
    // Neither path nor reused key is treated as subject identity.
  });
  it('bounds burst retention and marks oversized captured leaves explicitly', async () => {
    const tree = signalTree(
      { n: 0, payload: [] as unknown[] },
      { enhancers: [transactions()] }
    );
    cleanup.push(() => tree.destroy());
    const { lease } = observe(tree);
    for (let i = 1; i <= 20; i++) {
      external(() => tree.$.n(i));
      await settle();
    }
    expect(lease.snapshot().effects).toHaveLength(5);
    expect(lease.snapshot().retention.truncated).toBe(true);
    external(() => tree.$.payload(['x'.repeat(100000)]));
    await settle();
    expect(lease.snapshot().effects.at(-1)?.after).toMatchObject({
      kind: 'unserializable',
      valueType: 'capture-budget',
    });
  });
  it('marks unsupported function payloads instead of silently transporting an empty value', async () => {
    const tree = signalTree(
      { payload: [] as unknown[] },
      { enhancers: [transactions()] }
    );
    cleanup.push(() => tree.destroy());
    const { lease } = observe(tree);
    external(() => tree.$.payload([() => 42]));
    await settle();
    expect(lease.snapshot().effects.at(-1)?.after.kind).toBe('unserializable');
  });
});
