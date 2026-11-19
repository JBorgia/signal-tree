import {expect,it} from 'vitest';
import {entityMap,signalTree,transactions} from '../index';
import {watchEffect,nextTick} from 'vue';
const build=()=>signalTree({scalar:0,rows:entityMap<{id:string;x:number;y:number},string>()},{enhancers:[transactions()]});
type Tree=ReturnType<typeof build>;
type Frame={phase:string;value:string};
const create=()=>{ const tree=build();return {tree,dispose:()=>tree.destroy()};};
const snapshot=($:Tree['$'])=>JSON.stringify([$.scalar.value,$.rows.byIdOrFail('a').x.value,$.rows.all.value[0]?.x]);
const flush=async()=>{await nextTick();for(let i=0;i<12;i++)await Promise.resolve();await nextTick();};
const observe=(tree:Tree,phase:()=>string)=>{return (['pre','sync'] as const).map(flush=>{const seen:Frame[]=[];const stop=watchEffect(()=>seen.push({phase:phase(),value:snapshot(tree.$)}),{flush});return {seen,dispose:stop};});};
it('public second inverse refusal preserves both fields and permits useful retry',async()=>{
 const {tree,dispose}=create();const rows=tree.$.rows;rows.addOne({id:'a',x:0,y:0});await flush();const row=rows.byIdOrFail('a');
 const q=tree.transact(()=>{row.x.value=7;row.y.value=11;});await flush();let calls=0;const off=rows.intercept({onUpdate(_id,_patch,ctx){if(++calls===2)ctx.block('second inverse refused');}});
 try{expect(()=>q.rollback()).toThrow();expect(calls).toBe(2);expect(row.x.value).toBe(7);expect(row.y.value).toBe(11);off();expect(()=>q.rollback()).not.toThrow();await flush();expect(row.x.value).toBe(0);expect(row.y.value).toBe(0);expect(()=>q.confirm()).toThrow();}finally{off();dispose();}
});
it('actual framework delivery of completed mixed scalar/entity inverse is coherent',async()=>{
 const {tree,dispose}=create();tree.$.rows.addOne({id:'a',x:0,y:0});await flush();let phase='setup';const observations=observe(tree,()=>phase);
 try{await flush();for(const o of observations)expect(o.seen.length).toBeGreaterThan(0);phase='authoring';const q=tree.transact(()=>{tree.$.scalar.value=3;tree.$.rows.byIdOrFail('a').x.value=7;});phase='speculative';await flush();for(const o of observations)expect(o.seen.at(-1)?.value).toBe('[3,7,7]');phase='rollback';q.rollback();phase='after-rollback';await flush();for(const o of observations){const settled=o.seen.filter(f=>f.phase==='rollback'||f.phase==='after-rollback');expect(settled.length,JSON.stringify(o.seen)).toBeGreaterThan(0);for(const f of settled)expect(f.value,JSON.stringify(o.seen)).toBe('[0,0,0]');expect(o.seen.at(-1)?.value).toBe('[0,0,0]');}}finally{observations.forEach(o=>o.dispose());dispose();}
});
