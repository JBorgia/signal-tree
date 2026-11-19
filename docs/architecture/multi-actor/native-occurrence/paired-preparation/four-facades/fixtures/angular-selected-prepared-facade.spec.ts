import {expect,it} from 'vitest';
import {entityMap,signalTree,transactions} from '../index';
import {effect,Injector,runInInjectionContext} from '@angular/core';
import {TestBed} from '@angular/core/testing';
const build=()=>signalTree({scalar:0,rows:entityMap<{id:string;x:number;y:number},string>()},{enhancers:[transactions()]});
type Tree=ReturnType<typeof build>;
type Frame={phase:string;value:string};
const create=()=>{ TestBed.configureTestingModule({});const tree=build();return {tree,dispose:()=>tree.destroy()};};
const snapshot=($:Tree['$'])=>JSON.stringify([$.scalar(),$.rows.byIdOrFail('a').x(),$.rows.all()[0]?.x]);
const flush=async()=>{TestBed.tick();for(let i=0;i<12;i++)await Promise.resolve();TestBed.tick();};
const observe=(tree:Tree,phase:()=>string)=>{const seen:Frame[]=[];const ref=runInInjectionContext(TestBed.inject(Injector),()=>effect(()=>seen.push({phase:phase(),value:snapshot(tree.$)})));return [{seen,dispose:()=>ref.destroy()}];};
it('public second inverse refusal preserves both fields and permits useful retry',async()=>{
 const {tree,dispose}=create();const rows=tree.$.rows;rows.addOne({id:'a',x:0,y:0});await flush();const row=rows.byIdOrFail('a');
 const q=tree.transact(()=>{row.x.set(7);row.y.set(11);});await flush();let calls=0;const off=rows.intercept({onUpdate(_id,_patch,ctx){if(++calls===2)ctx.block('second inverse refused');}});
 try{expect(()=>q.rollback()).toThrow();expect(calls).toBe(2);expect(row.x()).toBe(7);expect(row.y()).toBe(11);off();expect(()=>q.rollback()).not.toThrow();await flush();expect(row.x()).toBe(0);expect(row.y()).toBe(0);expect(()=>q.confirm()).toThrow();}finally{off();dispose();}
});
it('actual framework delivery of completed mixed scalar/entity inverse is coherent',async()=>{
 const {tree,dispose}=create();tree.$.rows.addOne({id:'a',x:0,y:0});await flush();let phase='setup';const observations=observe(tree,()=>phase);
 try{await flush();for(const o of observations)expect(o.seen.length).toBeGreaterThan(0);phase='authoring';const q=tree.transact(()=>{tree.$.scalar.set(3);tree.$.rows.byIdOrFail('a').x.set(7);});phase='speculative';await flush();for(const o of observations)expect(o.seen.at(-1)?.value).toBe('[3,7,7]');phase='rollback';q.rollback();phase='after-rollback';await flush();for(const o of observations){const settled=o.seen.filter(f=>f.phase==='rollback'||f.phase==='after-rollback');expect(settled.length,JSON.stringify(o.seen)).toBeGreaterThan(0);for(const f of settled)expect(f.value,JSON.stringify(o.seen)).toBe('[0,0,0]');expect(o.seen.at(-1)?.value).toBe('[0,0,0]');}}finally{observations.forEach(o=>o.dispose());dispose();}
});
