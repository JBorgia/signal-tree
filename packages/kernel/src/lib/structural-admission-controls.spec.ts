import { expect, it } from 'vitest';
import { entityMap, external, leaf, restoration, signalTree, undoable } from '../index';
import { getPathNotifier } from './path-notifier';
import { withWriteContext } from './write-context';
import { getEntityPublicationBinding } from './internals/entity-publication';

const drain = async () => { for (let i = 0; i < 32; i++) await Promise.resolve(); };
const build = () => signalTree({ bounds: leaf({ min: 0, max: 10 }), rows: entityMap<{id:number}, number>() }, { enhancers: [restoration()] });
type Tree = ReturnType<typeof build>;
const image = (tree: Tree) => ({ bounds: tree.$.bounds(), ids: tree.$.rows.ids(), index: tree.getCurrentIndex(), redo: tree.canRedo(), undo: tree.canUndo() });
async function author(tree: Tree, scalarFirst: boolean) {
  tree.$.rows.addOne({id:1}); await drain();
  undoable(() => {
    if (scalarFirst) tree.$.bounds({min:1,max:9});
    tree.$.rows.changeId(1,2);
    if (!scalarFirst) tree.$.bounds({min:1,max:9});
  });
  await drain();
}
function captureUndo(tree: Tree): unknown {
  try { tree.undo(); return undefined; } catch (error) { return error; }
}

for (const scalarFirst of [true,false]) {
  for (const mode of ['inspection','external'] as const) {
    it(`paired rekey ${mode}, scalarFirst=${scalarFirst}: whole unit, delivery and history`, async () => {
      const tree=build(); let stop: (()=>void)|undefined;
      try {
        await author(tree,scalarFirst);
        if (mode==='inspection') withWriteContext({intent:'system',origin:'devtools',participation:'inspection'},()=>tree.$.rows.changeId(2,3));
        else external(()=>tree.$.rows.changeId(2,3));
        await drain();
        expect(tree.$.rows.ids()).toEqual([3]);
        expect(tree.$.bounds()).toEqual({min:1,max:9});
        const before=image(tree);
        const delivered: Array<Pick<ReturnType<typeof image>,'bounds'|'ids'>>=[];
        // The file runs sequentially; subscribe after all setup deliveries drain.
        // No Link/retrieval/recipient enrollment is needed for this native control.
        stop=getPathNotifier().subscribe('**', (_next,_prev,path)=> {
          if (path==='bounds'||path==='rows'||path.startsWith('rows.')) delivered.push({bounds:tree.$.bounds(),ids:tree.$.rows.ids()});
        });
        const error=captureUndo(tree); await drain();
        if (mode==='external') {
          // Soft assertions expose state loss even when the first refusal check fails.
          expect.soft(error).toBeInstanceOf(Error);
          expect.soft(image(tree)).toEqual(before);
          expect.soft(delivered).toEqual([]);
          // Refusal is not navigation: a repeated attempt must remain harmless.
          const retryError=captureUndo(tree); await drain();
          expect.soft(retryError).toBeInstanceOf(Error);
          expect.soft(image(tree)).toEqual(before);
          expect.soft(delivered).toEqual([]);
        } else {
          expect.soft(error).toBeUndefined();
          expect.soft(tree.$.bounds()).toEqual({min:0,max:10});
          expect.soft(tree.$.rows.ids()).toEqual([1]);
          // Selective undo moves applied frontiers, not the temporal-view cursor.
          expect.soft(tree.canUndo()).toBe(false);
          expect.soft(tree.canRedo()).toBe(true);
          expect.soft(delivered.length).toBeGreaterThan(0);
          for (const value of delivered) expect.soft(value).toEqual({bounds:{min:0,max:10},ids:[1]});
          tree.redo(); await drain();
          expect.soft(tree.$.bounds()).toEqual({min:1,max:9});
          expect.soft(tree.$.rows.ids()).toEqual([2]);
          expect.soft(tree.getCurrentIndex()).toBe(before.index);
        }
      } finally { stop?.();tree.destroy(); }
    });
  }
  it(`external rekey refusal preserves exact source support and revision, scalarFirst=${scalarFirst}`,async()=>{
    const tree=build();
    try {
      await author(tree,scalarFirst);
      const row=tree.$.rows.byIdOrFail(2);
      const binding=getEntityPublicationBinding(row);
      if (!binding || binding.subject===undefined) throw new Error('Source-issued row binding unavailable');
      const subject=binding.subject;
      external(()=>tree.$.rows.changeId(2,3));await drain();
      const evidence=binding.source.evidence();
      if (!evidence) throw new Error('Native source evidence unavailable');
      const support=()=>[evidence.member(subject,'ordinary'),evidence.member(subject,'physical'),evidence.keyMapping(subject,'ordinary'),evidence.keyMapping(subject,'physical'),evidence.placement(subject,'ordinary'),evidence.placement(subject,'physical'),evidence.field(subject,'id','ordinary'),evidence.field(subject,'id','physical')];
      const before=support(),revision=binding.source.revision(),state=image(tree);
      const error=captureUndo(tree);await drain();
      expect.soft(error).toBeInstanceOf(Error);
      expect.soft(image(tree)).toEqual(state);
      expect.soft(binding.source.revision()).toBe(revision);
      const after=support();for(let i=0;i<before.length;i++)expect.soft(after[i]).toBe(before[i]);
    }finally{tree.destroy();}
  });
}
