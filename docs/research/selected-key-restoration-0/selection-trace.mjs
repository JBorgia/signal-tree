import assert from 'node:assert/strict';
import {createSignalTreeFactory} from '@signal-tree/kernel/adapter';
import {entityMap,transactions} from '@signal-tree/kernel';
import {createVueObservationAdapter} from '@proof/packages/vue/src/lib/vue-observation.ts';
const mode=process.argv[2];const tree=createSignalTreeFactory(createVueObservationAdapter())({scalar:0,rows:entityMap({selectId:r=>r.id})},{enhancers:[transactions()]});
const rows=tree.$.rows;rows.addOne({id:'A',v:0});rows.setActiveId('A');const held=rows.byIdOrFail('A');const trace=[];
const snap=phase=>trace.push({phase,activeId:rows.activeId()??null,row:rows.byId('A')?.()?.v??null,held:held()?.v??null});
globalThis.__selectionTrace=(phase,record)=>trace.push({phase,...record});
try {
 snap('before-removal');const h=tree.transact(()=>{tree.$.scalar.set(1);rows.removeOne('A');});snap('after-removal');
 if(mode==='new-selection'){rows.setActiveId('B');snap('selection-changed-while-absent');}
 h.rollback();snap('after-rollback');snap('after-restoration-read');
 console.log(JSON.stringify({mode,trace}));
 assert.equal(rows.activeId(),mode==='new-selection'?'B':'A','restoration preserves current key selection');assert.equal(rows.byIdOrFail('A')(),held());assert.equal(held()?.v,0);
} finally {delete globalThis.__selectionTrace;tree.destroy();}
