import { expect, it } from 'vitest';
import {
  signalTree,
  entityMap,
  restoration,
  transactions,
  undoable,
} from '../../index';
import { withWriteContext } from '../../lib/write-context';
import {
  getMutationCaptureRuntime,
  type CompletedTopologyUnit,
} from '../../lib/internals/mutation-capture-runtime';
const drain = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
it('distinguishes inspection-only physical installation and ordinary-only existence adoption', async () => {
  const t = signalTree(
    { rows: entityMap<{ id: string; n: number }, string>() },
    { enhancers: [transactions(), restoration()] }
  );
  try {
    t.$.rows.addOne({ id: 'a', n: 7 });
    await drain();
    const rt = getMutationCaptureRuntime(t)!;
    const units: CompletedTopologyUnit[] = [];
    const release = rt.activateCapture();
    const off = rt.subscribeCommittedEntity!((c) => {
      if (c.topologyUnit) units.push(c.topologyUnit);
    });
    try {
      withWriteContext({ participation: 'inspection' }, () =>
        t.$.rows.addOne({ id: 'b', n: 99 })
      );
      const inspected = units.at(-1)!;
      expect(inspected.physical.before).not.toBe(inspected.physical.after);
      expect(inspected.ordinary.before).toBe(inspected.ordinary.after);
      const p = t.transact(() => t.$.rows.byIdOrFail('b').n(100));
      const adopted = units.at(-1)!;
      expect(adopted.physical.before).toBe(adopted.physical.after);
      expect(adopted.ordinary.before).not.toBe(adopted.ordinary.after);
      expect(adopted.id).not.toBe(inspected.id);
      expect(adopted.ordinary.before).toBe(inspected.ordinary.after);
      p.rollback();
      expect(t.$.rows.ids()).toEqual(['a']);
    } finally {
      off();
      release();
    }
  } finally {
    t.destroy();
  }
});
it('transaction and history compose addition and subsequent order from the same ordinary boundary facts', async () => {
  const t = signalTree(
    { rows: entityMap<{ id: string; n: number }, string>() },
    { enhancers: [transactions(), restoration()] }
  );
  try {
    t.$.rows.setAll([
      { id: 'z', n: 0 },
      { id: 'a', n: 1 },
      { id: 'c', n: 3 },
    ]);
    await drain();
    const held = t.$.rows.byIdOrFail('a');
    const p = t.transact(() => {
      t.$.rows.addOne({ id: 'w', n: 4 });
      t.$.rows.prependMany([{ id: 'c', n: 30 }], { mode: 'overwrite' });
    });
    p.rollback();
    expect(t.$.rows.ids()).toEqual(['z', 'a', 'c']);
    expect(t.$.rows.byIdOrFail('a')).toBe(held);
    undoable(() => {
      t.$.rows.addOne({ id: 'w', n: 4 });
      t.$.rows.prependMany([{ id: 'c', n: 30 }], { mode: 'overwrite' });
    });
    await drain();
    t.undo();
    expect(t.$.rows.ids()).toEqual(['z', 'a', 'c']);
    t.redo();
    expect(t.$.rows.ids()).toEqual(['c', 'z', 'a', 'w']);
  } finally {
    t.destroy();
  }
});
