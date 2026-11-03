import assert from 'node:assert/strict';
import {watchEffect} from 'vue';
import {createSignalTreeFactory} from '@signal-tree/kernel/adapter';
import {entityMap,transactions} from '@signal-tree/kernel';
import {createVueObservationAdapter} from '@proof/packages/vue/src/lib/vue-observation.ts';
const tree=createSignalTreeFactory(createVueObservationAdapter())({scalar:0,rows:entityMap({selectId:r=>r.id})},{enhancers:[transactions()]});
tree.$.rows.addOne({id:'A',v:0});tree.$.rows.setActiveId('A');
let phase='setup';const seen=[];const stop=watchEffect(()=>seen.push({phase,scalar:tree.$.scalar(),ids:tree.$.rows.ids(),all:tree.$.rows.all().map(r=>r.v),row:tree.$.rows.byId('A')?.()?.v,activeId:tree.$.rows.activeId(),active:tree.$.rows.activeEntity()?.v}),{flush:'sync'});
try {
 const pending=tree.transact(()=>{tree.$.scalar.set(1);tree.$.rows.removeOne('A');});
 assert.equal(tree.$.scalar(),1);assert.equal(tree.$.rows.activeEntity(),undefined);
 phase='rollback';pending.rollback();phase='after';
 const final={scalar:tree.$.scalar(),row:tree.$.rows.byId('A')?.()?.v,activeId:tree.$.rows.activeId(),active:tree.$.rows.activeEntity()?.v};
 console.log(JSON.stringify({seen,final}));
 const delivery=seen.filter(x=>x.phase==='rollback');assert.ok(delivery.length);
 assert.equal(final.row,0);assert.equal(final.activeId,'A');assert.equal(final.active,0,'selected restored row must be visible through activeEntity');
 for(const x of delivery)assert.equal(x.active,0);
} finally {stop();tree.destroy();}
