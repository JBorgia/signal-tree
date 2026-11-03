import { writeDiagnostic } from '../../../../test/optional-diagnostic';
import { getEntityPublicationBinding } from '../entity-publication';
import { expect, it } from 'vitest';
import { entityMap, restoration, signalTree, undoable } from '../../../index';
import { getMutationCaptureRuntime } from '../mutation-capture-runtime';
const diagnosticDirectory=process.env['ST_JOINT_PHASE_OUTPUT'];

const drain = async () => { for (let i = 0; i < 32; i++) await Promise.resolve(); };
it('private source completion sees the complete selected mixed inverse before authoring newer truth', async () => {
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
      tree.$.right.byIdOrFail('a').n(50);
      tree.$.right.byIdOrFail('b').n(60);
    });
    await drain();
    expect(tree.$.left.ids()).toEqual([]);
    expect(tree.$.right.all()).toEqual([{ id: 'a', n: 50 }, { id: 'b', n: 60 }]);
    const runtime = getMutationCaptureRuntime(tree.$.left);
    if (!runtime?.subscribeCommittedEntity) throw new Error('Existing capture seam unavailable');
    releaseCapture = runtime.activateCapture();
    let armed = true;
    const observed: unknown[] = [];
    releaseListener = getEntityPublicationBinding(tree.$.left)!.source.subscribe({ prepare(){return {record:{writes:[],adds:[]},completion:{}};}, complete(){
      if (!armed) return;
      armed = false;
      observed.push({ left: tree.$.left.all(), right: tree.$.right.all() });
      writeDiagnostic(diagnosticDirectory ? `${diagnosticDirectory}/completion.jsonl` : undefined,JSON.stringify({observed,stack:new Error().stack})+'\n',true);
      tree.$.right.byIdOrFail('a').n(777);
    }});
    tree.undo();
    await drain();
    expect(armed).toBe(false);
    expect(observed).toEqual([{
      left: [{ id: 'a', n: 1 }],
      right: [{ id: 'a', n: 11 }, { id: 'b', n: 12 }],
    }]);
    expect(tree.$.right.all()).toEqual([{ id: 'a', n: 777 }, { id: 'b', n: 12 }]);
  } finally {
    releaseListener?.();
    releaseCapture?.();
    tree.destroy();
  }
});
