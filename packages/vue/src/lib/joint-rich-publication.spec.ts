import { expect, it } from 'vitest';
import { entityMap, restoration, signalTree, undoable } from '../index';
import { getMutationCaptureRuntime } from '../../../kernel/src/lib/internals/mutation-capture-runtime';

const drain = async () => { for (let i = 0; i < 32; i++) await Promise.resolve(); };
it('rich committed-entity capture sees the complete selected mixed inverse before authoring newer truth', async () => {
  const tree = signalTree({
    left: entityMap<{ id: string; n: number }, string>(),
    right: entityMap<{ id: string; n: number }, string>(),
  }, { enhancers: [restoration()] });
  let releaseCapture: (() => void) | undefined;
  let releaseListener: (() => void) | undefined;
  try {
    tree.$.left.addOne({ id: 'a', n: 1 });
    tree.$.right.setAll([{ id: 'a', n: 11 }, { id: 'b', n: 12 }]);
    await drain();
    undoable(() => {
      tree.$.left.removeOne('a');
      tree.$.right.byIdOrFail('a').n.value=50;
      tree.$.right.byIdOrFail('b').n.value=60;
    });
    await drain();
    expect(tree.$.left.ids.value).toEqual([]);
    expect(tree.$.right.all.value).toEqual([{ id: 'a', n: 50 }, { id: 'b', n: 60 }]);
    const runtime = getMutationCaptureRuntime(tree.$.left);
    if (!runtime?.subscribeCommittedEntity) throw new Error('Existing capture seam unavailable');
    releaseCapture = runtime.activateCapture();
    let armed = true;
    const observed: unknown[] = [];
    releaseListener = runtime.subscribeCommittedEntity(() => {
      if (!armed) return;
      armed = false;
      observed.push({ left: tree.$.left.all.value, right: tree.$.right.all.value });
      tree.$.right.byIdOrFail('a').n.value=777;
    });
    tree.undo();
    await drain();
    expect(armed).toBe(false);
    expect(observed).toEqual([{
      left: [{ id: 'a', n: 1 }],
      right: [{ id: 'a', n: 11 }, { id: 'b', n: 12 }],
    }]);
    expect(tree.$.right.all.value).toEqual([{ id: 'a', n: 777 }, { id: 'b', n: 12 }]);
  } finally {
    releaseListener?.();
    releaseCapture?.();
    tree.destroy();
  }
});
