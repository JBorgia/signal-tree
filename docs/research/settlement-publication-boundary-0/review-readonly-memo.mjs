import assert from 'node:assert/strict';
import {watchEffect} from 'vue';
import {createVueObservationAdapter} from '@proof/packages/vue/src/lib/vue-observation.ts';
const a=createVueObservationAdapter(); const token=a.createToken(); let computes=0, rows=[]; const owned=a.createReadonlyCell(()=>({value:++computes})); const initial=owned();
const stop=watchEffect(()=>{token.observe(); const x=owned(),y=owned(); rows.push({x:x.value,y:y.value,same:x===y,sameInitial:x===initial});},{flush:'sync'});
a.runInvalidationGroup(()=>token.invalidate());stop();console.log(JSON.stringify({computes,rows}));assert.ok(rows.every(r=>r.same),'same readonly cell changed identity between two reads without a source mutation');assert.equal(computes,1,'unrelated publication recomputed owned cell');
