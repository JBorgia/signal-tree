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
it('attempts later live lifetime invalidation after first installed row invalidation fails', async () => {
 const t=signalTree({left:entityMap<{id:string;n:number},string>(),right:entityMap<{id:string;n:number},string>()},{enhancers:[restoration()]});
 try {
  t.$.left.addOne({id:'a',n:1});t.$.right.setAll([{id:'a',n:11},{id:'b',n:12}]);
  for(let i=0;i<32;i++)await Promise.resolve();
  undoable(()=>{t.$.left.removeOne('a');t.$.right.byIdOrFail('a').n(50);t.$.right.byIdOrFail('b').n(60);});
  for(let i=0;i<32;i++)await Promise.resolve();
  const port=t.$.right as unknown as PointPort;
  const original=port.__preparePointValues;const attempts:number[]=[];const sentinel=new Error('controlled installed lifetime invalidation');
  const spy=vi.spyOn(port,'__preparePointValues').mockImplementation(function(this: PointPort, ...args: Parameters<PointPort['__preparePointValues']>){
   const [values] = args;
   const plan=original.apply(this,args);
   return {...plan,invalidate(){attempts.push(values[0]!.subjectId);plan.invalidate();if(attempts.length===1)throw sentinel;}};
  });
  try {expect(()=>t.undo()).toThrow(sentinel);}finally{spy.mockRestore();}
  expect(t.$.left.ids()).toEqual(['a']);
  expect(t.$.right.all()).toEqual([{id:'a',n:11},{id:'b',n:12}]);
  expect(new Set(attempts).size).toBe(2);
 } finally {t.destroy();}
});
