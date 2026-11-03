import {createSignalTreeFactory} from '@signal-tree/kernel/adapter';
import {computed} from '@angular/core';
import {expect,it} from 'vitest';
import {signalTree as facadeSignalTree,entityMap,restoration,undoable} from '../index';
import {ANGULAR_OBSERVATION_ADAPTER as adapter} from './observation-adapter';
const drain=async()=>{for(let i=0;i<32;i++)await Promise.resolve();};
it('Angular instrumented native delivery reads complete ST views and preserves newer nested work',async()=>{
 let before=()=>{};const signalTree=createSignalTreeFactory({...adapter,
 createToken(){const token=adapter.createToken();return {...token,invalidate(){before();token.invalidate();}};},
 advanceEpoch(epoch){before();adapter.advanceEpoch!(epoch);},
 createWritableCell<T>(read:()=>T){const cell=adapter.createWritableCell!<T>(read);return {...cell,token:{...cell.token,invalidate(){before();cell.token.invalidate();}},commit:cell.commit?(value:T)=>{before();cell.commit!(value);}:undefined};}
 }) as unknown as typeof facadeSignalTree;
 const t=signalTree({left:entityMap<{id:string;n:number},string>(),right:entityMap<{id:string;n:number},string>()},{enhancers:[restoration()]});
 try{t.$.left.addOne({id:'a',n:1});t.$.right.setAll([{id:'a',n:11},{id:'b',n:12}]);await drain();undoable(()=>{t.$.left.removeOne('a');t.$.right.byIdOrFail('a').n.set(50);t.$.right.byIdOrFail('b').n.set(60);});await drain();
 let runs=0;const app=computed(()=>{runs++;return t.$.right.all();});const held=app();expect(held).toEqual([{id:'a',n:50},{id:'b',n:60}]);let armed=true;const seen:unknown[]=[];
 before=()=>{if(armed){armed=false;seen.push([t.$.left.all(),t.$.right.all()]);t.$.right.byIdOrFail('a').n.set(777);}};
 try{t.undo();await drain();expect(seen).toEqual([[[{id:'a',n:1}],[{id:'a',n:11},{id:'b',n:12}]]]);expect(t.$.right.all()).toEqual([{id:'a',n:777},{id:'b',n:12}]);expect(app()).toEqual(t.$.right.all());}finally{before=()=>{};}
 }finally{t.destroy();}
});
