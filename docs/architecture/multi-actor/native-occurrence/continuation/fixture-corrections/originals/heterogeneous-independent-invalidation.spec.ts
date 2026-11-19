import { expect, it, vi } from 'vitest';
import { entityMap, restoration, signalTree, undoable } from '../../../index';
it('attempts later live lifetime invalidation after first installed row invalidation fails', async () => {
 const t=signalTree({left:entityMap<{id:string;n:number},string>(),right:entityMap<{id:string;n:number},string>()},{enhancers:[restoration()]});
 try {
  t.$.left.addOne({id:'a',n:1});t.$.right.setAll([{id:'a',n:11},{id:'b',n:12}]);
  for(let i=0;i<32;i++)await Promise.resolve();
  undoable(()=>{t.$.left.removeOne('a');t.$.right.byIdOrFail('a').n(50);t.$.right.byIdOrFail('b').n(60);});
  for(let i=0;i<32;i++)await Promise.resolve();
  type Plan={install():void;invalidate():void;publish():void};
  const port=t.$.right as unknown as {__preparePointValues(values:readonly {subjectId:number}[]):Plan};
  const original=port.__preparePointValues;const attempts:number[]=[];const sentinel=new Error('controlled installed lifetime invalidation');
  const spy=vi.spyOn(port,'__preparePointValues').mockImplementation(function(values){
   const plan=original.call(port,values);
   return {...plan,invalidate(){attempts.push(values[0]!.subjectId);plan.invalidate();if(attempts.length===1)throw sentinel;}};
  });
  try {expect(()=>t.undo()).toThrow(sentinel);}finally{spy.mockRestore();}
  expect(t.$.left.ids()).toEqual(['a']);
  expect(t.$.right.all()).toEqual([{id:'a',n:11},{id:'b',n:12}]);
  expect(new Set(attempts).size).toBe(2);
 } finally {t.destroy();}
});
