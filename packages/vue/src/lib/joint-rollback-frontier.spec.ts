import {expect,it} from 'vitest';
import {computed,watch} from 'vue';
import {signalTree,entityMap,transactions} from '../index';
import {getEntityPublicationBinding} from '../../../kernel/src/lib/internals/entity-publication';
it('structural rollback source completion follows all native readers and grouped delivery',()=>{
 const t=signalTree({left:entityMap<{id:number;n:number},number>(),right:entityMap<{id:number;n:number},number>()},{enhancers:[transactions()]});t.$.left.addOne({id:1,n:1});t.$.right.addOne({id:1,n:11});const p=t.transact(()=>{t.$.left.removeOne(1);t.$.right.byIdOrFail(1).n.value=50;});const leaf=t.$.right.byIdOrFail(1).n;const app=computed(()=>leaf.value);expect(app.value).toBe(50);let native=false;const stop=watch(()=>t.$.left.all.value,()=>{native=true;},{flush:'sync'});const seen:unknown[]=[];
 const off=getEntityPublicationBinding(t.$.left)!.source.subscribe({prepare(){return {record:{writes:[],adds:[]},completion:{}};},complete(){seen.push({native,left:t.$.left.all.value,right:t.$.right.all.value,leaf:leaf.value,app:app.value});}});
 try{p.rollback();expect(seen.length).toBeGreaterThan(0);for(const snapshot of seen)expect(snapshot).toEqual({native:true,left:[{id:1,n:1}],right:[{id:1,n:11}],leaf:11,app:11});}finally{off();stop();t.destroy();}
});
