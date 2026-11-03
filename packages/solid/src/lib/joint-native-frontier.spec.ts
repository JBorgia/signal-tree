import {createMemo,createComputed,createRoot} from 'solid-js';
import {expect,it} from 'vitest';
import {signalTree,entityMap,restoration,undoable} from '../index';
import {getEntityPublicationBinding} from '../../../kernel/src/lib/internals/entity-publication';
const drain=async()=>{for(let i=0;i<32;i++)await Promise.resolve();};
it('first synchronous Solid observer and detached completion see the installed mixed unit',async()=>{
 const t=signalTree({left:entityMap<{id:string;n:number},string>(),right:entityMap<{id:string;n:number},string>()},{enhancers:[restoration()]});let stop=()=>{};let off=()=>{};
 try{t.$.left.addOne({id:'a',n:1});t.$.right.setAll([{id:'a',n:11},{id:'b',n:12}]);await drain();undoable(()=>{t.$.left.removeOne('a');t.$.right.byIdOrFail('a').n.set(50);t.$.right.byIdOrFail('b').n.set(60);});await drain();
 const app=createMemo(()=>t.$.right.all());expect(app()).toEqual([{id:'a',n:50},{id:'b',n:60}]);const events:string[]=[];const seen:unknown[]=[];let armed=true;
 createRoot(dispose=>{stop=dispose;let first=true;createComputed(()=>{t.$.left.all();if(first){first=false;return;}if(!armed)return;armed=false;events.push('native');seen.push([t.$.left.all(),t.$.right.all()]);t.$.right.byIdOrFail('a').n.set(777);});});
 off=getEntityPublicationBinding(t.$.left)!.source.subscribe({prepare(){return {record:{writes:[],adds:[]},completion:{}};},complete(){events.push('complete');expect(events[0]).toBe('native');}});
 t.undo();await drain();expect(seen).toEqual([[[{id:'a',n:1}],[{id:'a',n:11},{id:'b',n:12}]]]);expect(t.$.right.all()).toEqual([{id:'a',n:777},{id:'b',n:12}]);expect(app()).toEqual(t.$.right.all());expect(events).toContain('complete');
 }finally{off();stop();t.destroy();}
});
