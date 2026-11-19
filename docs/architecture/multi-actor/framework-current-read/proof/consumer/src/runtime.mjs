import assert from 'node:assert/strict';
import {createSignalTreeFactory} from '@signal-tree/kernel/adapter';
import {entityMap} from '@signal-tree/kernel';
import {isSignal} from '@angular/core';
import {isRef,isReadonly} from 'vue';
import {ANGULAR_OBSERVATION_ADAPTER} from '../node_modules/@signal-tree/angular/dist/lib/observation-adapter.js';
import {createVueObservationAdapter} from '../node_modules/@signal-tree/vue/dist/lib/vue-observation.js';
import {createSolidObservationAdapter} from '../node_modules/@signal-tree/solid/dist/lib/solid-observation.js';
for (const [framework,adapter] of [['angular',ANGULAR_OBSERVATION_ADAPTER],['vue',createVueObservationAdapter()],['solid',createSolidObservationAdapter()]]) {
 const {createCurrentReadonlyCell: omitted,...legacy}=adapter;assert.equal(typeof omitted,'function');
 let getterCalls=0;const initial={get value(){getterCalls++;return 1;}};
 assert.throws(()=>createSignalTreeFactory(legacy)(initial),/require createCurrentReadonlyCell/);assert.equal(getterCalls,0);
 const tree=createSignalTreeFactory(adapter)({rows:entityMap()});let taps=0;
 try {
  tree.$.rows.tap({onAdd:()=>{taps++;const ids=tree.$.rows.ids;
   assert.deepEqual(ids(),['A']);
   if(framework==='angular')assert.equal(isSignal(ids),true);
   if(framework==='vue'){assert.equal(isRef(ids),true);assert.equal(isReadonly(ids),true);assert.deepEqual(ids.value,['A']);}
  }});
  tree.$.rows.addOne({id:'A'});assert.equal(taps,1);
 }finally{tree.destroy();adapter.dispose?.();}
 console.log(JSON.stringify({framework,legacyRejectedBeforeGetter:true,migratedNativeTap:true}));
}
for(let mask=0;mask<7;mask++){
 const adapter={createToken:()=>({observe(){},invalidate(){}}),runInvalidationGroup:run=>run()};
 for(const [bit,name] of [[1,'createWritableCell'],[2,'createWritableProjection'],[4,'createReadonlyCell']])if(mask&bit)adapter[name]=()=>{throw new Error('portable path called unused native factory');};
 const tree=createSignalTreeFactory(adapter)({n:1,rows:entityMap()});let taps=0;
 try{tree.$.n(2);assert.equal(tree.$.n(),2);tree.$.rows.tap({onAdd:()=>{taps++;assert.deepEqual(tree.$.rows.ids(),['A']);}});tree.$.rows.addOne({id:'A'});assert.equal(taps,1);}finally{tree.destroy();}
}
console.log(JSON.stringify({portableMasks:'0-6',nativeFactoriesUsed:false}));
