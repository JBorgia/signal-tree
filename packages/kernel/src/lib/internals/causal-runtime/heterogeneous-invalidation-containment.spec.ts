import type { EntityRealizationEdit, EntityValueTransition } from '../entity-value-transition';
import type { PublicationPreparation } from '../publication-preparation';
import type { SelectedInstallation, SelectedRowEdit } from '../selected-write-operation';
type PointPort = {
  __preparePointValues(
    values: readonly {
      subjectId: number;
      key: string | number;
      value: unknown;
      edits: readonly EntityRealizationEdit[];
      transition?: EntityValueTransition<{ id: string; n: number }>;
    }[],
    selectedSteps?: readonly SelectedRowEdit[],
    publicationPhase?: PublicationPreparation
  ): SelectedInstallation;
};
import { expect, it, vi } from 'vitest';
import { entityMap, restoration, signalTree, undoable } from '../../../index';
import { getTreeScalarSlotRuntime } from '../tree-scalar-slot-port';

const flush = async () => {
  for (let i = 0; i < 32; i++) await Promise.resolve();
};

it('attempts mixed installed invalidation and delivery while preserving the first failure', async () => {
  const tree = signalTree({
    count: 0,
    left: entityMap<{ id: string; n: number }, string>(),
    right: entityMap<{ id: string; n: number }, string>(),
  }, { enhancers: [restoration()] });
  try {
    tree.$.left.addOne({ id: 'a', n: 1 });
    tree.$.right.setAll([{ id: 'a', n: 11 }, { id: 'b', n: 12 }]);
    await flush();
    undoable(() => {
      tree.$.left.removeOne('a');
      tree.$.right.byIdOrFail('a').n(50);
      tree.$.right.byIdOrFail('b').n(60);
      tree.$.count(9);
    });
    await flush();
    const updates: string[] = [];
    const off = tree.$.right.tap({ onUpdate: key => { updates.push(key); } });
    const runtime = getTreeScalarSlotRuntime(tree.$)!;
    expect(runtime).toBeDefined();
    const scalar = vi.spyOn(runtime, 'publishPrepared');
    const port = tree.$.right as unknown as PointPort;
    const original = port.__preparePointValues;
    const attempts: number[] = [];
    const first = new Error('first installed invalidation');
    const second = new Error('second installed invalidation');
    const spy = vi.spyOn(port, '__preparePointValues').mockImplementation(function(this: PointPort, ...args: Parameters<PointPort['__preparePointValues']>) {
      const [values] = args;
      const plan = original.apply(this, args);
      return { ...plan, invalidate() {
        attempts.push(values[0]!.subjectId);
        plan.invalidate();
        throw attempts.length === 1 ? first : second;
      } };
    });
    try {
      let thrown: unknown;
      try { tree.undo(); } catch (error) { thrown = error; }
      expect(thrown).toBe(first);
      expect(new Set(attempts).size).toBe(2);
      expect(scalar).toHaveBeenCalledTimes(1);
      expect(tree.$.count()).toBe(0);
      expect(tree.$.left.ids()).toEqual(['a']);
      expect(tree.$.right.all()).toEqual([{ id: 'a', n: 11 }, { id: 'b', n: 12 }]);
      expect([...updates].sort()).toEqual(['a', 'b']);
    } finally {
      spy.mockRestore(); scalar.mockRestore(); off();
    }
  } finally { tree.destroy(); }
});
