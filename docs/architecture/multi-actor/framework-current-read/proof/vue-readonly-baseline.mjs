import assert from 'node:assert/strict';
import {isReadonly} from 'vue';
import {createVueObservationAdapter as baseline} from './baseline-vue-observation.ts';
import {createVueObservationAdapter as candidate} from '../packages/vue/src/lib/vue-observation.ts';
for (const [name,make] of [['retained87f6831f',baseline],['candidate',candidate]]) {
 let raw='X',calls=0;const c=make().createReadonlyCell(()=>{calls++;return raw;});
 assert.equal(isReadonly(c),true); assert.equal(c.value,'X');raw='A';assert.equal(c.value,'X');assert.equal(calls,1);
 console.log(JSON.stringify({name,isReadonly:isReadonly(c),heldValue:c.value,calls}));
}
