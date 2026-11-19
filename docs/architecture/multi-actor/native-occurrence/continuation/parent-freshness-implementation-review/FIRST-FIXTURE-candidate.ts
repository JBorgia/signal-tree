import {expect,it} from 'vitest';
import {signal} from '@angular/core';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {signalTree,entityMap,transactions} from '../index';
import {getTreeScalarSlotRuntime} from '../../../kernel/src/lib/internals/tree-scalar-slot-port';
import {getOwnedPositionIds} from '../../../kernel/src/lib/internals/owned-metadata';
import {registerMarkerProcessor} from '../../../kernel/src/lib/internals/materialize-markers';
const KIND=Symbol('independent-public-custom');
type M={[KIND]:true;read:()=>number};
registerMarkerProcessor((v):v is M=>!!v&&typeof v==='object'&&KIND in v,m=>({read:m.read}),{snapshot:n=>n.read()});
it('cold sort write error leaves backing installed and native mirror unchanged',()=>{
 let calls=0;let armed=true;
 const t=signalTree({child:{n:0},rows:entityMap<{id:number},number>({sortComparer:(a,b)=>{calls++;if(armed){armed=false;t.$.child.n.set(1);}return a.id-b.id;}})});
 try{
  t.$.rows.addMany([{id:2},{id:1}]);let error:unknown;try{t.$();}catch(e){error=e;}
  expect(error).toBeInstanceOf(Error);expect((error as Error).message).toContain('NG0600');expect(calls).toBe(1);
  const rt=getTreeScalarSlotRuntime(t.$)!;const slot=rt.resolveScalarSlot(getOwnedPositionIds(t.$.child.n)![0]!)!;
  const backing=rt.readSlot(slot);const native=t.$.child.n();const parent=t.$.child();
  expect(backing).toBe(1);expect(native).toBe(0);expect(calls).toBe(1);
  let again:unknown;try{t.$();}catch(e){again=e;}expect(again).toBe(error);
  writeFileSync(join(process.env.ST_PREPARED_REVIEW_OUTPUT!,'cold-error.json'),JSON.stringify({backing,native,parent,calls,sameError:again===error}));
 }finally{t.destroy();}
});
it('public custom marker foreign dependency remains live across undelivered scalar installation',()=>{
 const external=signal(0);let calls=0;
 const t=signalTree({n:0,custom:{[KIND]:true,read:()=>{calls++;return external();}} as M},{enhancers:[transactions()]});
 try{
  expect(t.$().custom).toBe(0);const rt=getTreeScalarSlotRuntime(t.$)!;const slot=rt.resolveScalarSlot(getOwnedPositionIds(t.$.n)![0]!)!;
  const frame=rt.beginFrame();frame.set(slot,1);const installed=frame.commit({publish:false});
  expect(t.$()).toEqual({n:1,custom:0});const before=calls;external.set(2);expect(t.$()).toEqual({n:1,custom:2});expect(calls).toBeGreaterThan(before);
  rt.publishPrepared(installed);expect(t.$()).toEqual({n:1,custom:2});external.set(3);expect(t.$().custom).toBe(3);
 }finally{t.destroy();}
});
