from pathlib import Path
import hashlib,json
root=Path('/private/tmp/st-c47b-facade-controls');b=root/'candidate'
for fw in ['angular','vue','solid','react']:
 path=b/f'packages/{fw}/src'/('selected-prepared-facade.spec.tsx' if fw=='react' else 'lib/selected-prepared-facade.spec.ts')
 imp="import {expect,it} from 'vitest';\nimport {entityMap,signalTree,transactions"+(',useSignalTree' if fw=='react' else '')+"} from '"+('./index' if fw=='react' else '../index')+"';\n"
 imports={'angular':"import {effect,Injector,runInInjectionContext} from '@angular/core';\nimport {TestBed} from '@angular/core/testing';\n",'vue':"import {watchEffect,nextTick} from 'vue';\n",'solid':"import {createEffect,createRoot} from 'solid-js';\n",'react':"import {act,render} from '@testing-library/react';\nimport {useEffect} from 'react';\n"}
 setup="const build=()=>signalTree({scalar:0,rows:entityMap<{id:string;x:number;y:number},string>()},{enhancers:[transactions()]});\ntype Tree=ReturnType<typeof build>;\ntype Frame={phase:string;value:string};\n"
 setup+="const create=()=>{let tree!:Tree;const stop=createRoot(dispose=>{tree=build();return dispose;});return {tree,dispose:()=>{stop();tree.destroy();}};};\n" if fw=='solid' else "const create=()=>{ "+("TestBed.configureTestingModule({});" if fw=='angular' else '')+"const tree=build();return {tree,dispose:()=>tree.destroy()};};\n"
 read=lambda expr: expr+'.value' if fw=='vue' else expr+'()'
 val='JSON.stringify(['+','.join([read('$.scalar'),read("$.rows.byIdOrFail('a').x"),('$.rows.all.value' if fw=='vue' else '$.rows.all()')+"[0]?.x"])+'])'
 setup+='const snapshot=($:Tree[\'$\'])=>'+val+';\n'
 flush={'angular':"TestBed.tick();for(let i=0;i<12;i++)await Promise.resolve();TestBed.tick();",'vue':"await nextTick();for(let i=0;i<12;i++)await Promise.resolve();await nextTick();",'solid':"await new Promise<void>(resolve=>setTimeout(resolve,0));",'react':"await act(async()=>{for(let i=0;i<12;i++)await Promise.resolve();});"}
 setup+='const flush=async()=>{'+flush[fw]+'};\n'
 obs={'angular':"const seen:Frame[]=[];const ref=runInInjectionContext(TestBed.inject(Injector),()=>effect(()=>seen.push({phase:phase(),value:snapshot(tree.$)})));return [{seen,dispose:()=>ref.destroy()}];",'vue':"return (['pre','sync'] as const).map(flush=>{const seen:Frame[]=[];const stop=watchEffect(()=>seen.push({phase:phase(),value:snapshot(tree.$)}),{flush});return {seen,dispose:stop};});",'solid':"const seen:Frame[]=[];const stop=createRoot(dispose=>{createEffect(()=>seen.push({phase:phase(),value:snapshot(tree.$)}));return dispose;});return [{seen,dispose:stop}];",'react':"const seen:Frame[]=[];function Probe(){const value=useSignalTree(tree,snapshot);useEffect(()=>{seen.push({phase:phase(),value});},[value]);return null;}const view=render(<Probe/>);return [{seen,dispose:()=>view.unmount()}];"}
 setup+='const observe=(tree:Tree,phase:()=>string)=>{'+obs[fw]+'};\n'
 write=lambda expr,n: expr+'.value='+str(n) if fw=='vue' else expr+('.set' if fw in ['angular','solid'] else '')+'('+str(n)+')'
 body="""it('public second inverse refusal preserves both fields and permits useful retry',async()=>{
 const {tree,dispose}=create();const rows=tree.$.rows;rows.addOne({id:'a',x:0,y:0});await flush();const row=rows.byIdOrFail('a');
 const q=tree.transact(()=>{WRITE_X;WRITE_Y;});await flush();let calls=0;const off=rows.intercept({onUpdate(_id,_patch,ctx){if(++calls===2)ctx.block('second inverse refused');}});
 try{expect(()=>q.rollback()).toThrow();expect(calls).toBe(2);expect(READ_X).toBe(7);expect(READ_Y).toBe(11);off();expect(()=>q.rollback()).not.toThrow();await flush();expect(READ_X).toBe(0);expect(READ_Y).toBe(0);expect(()=>q.confirm()).toThrow();}finally{off();dispose();}
});
it('actual framework delivery of completed mixed scalar/entity inverse is coherent',async()=>{
 const {tree,dispose}=create();tree.$.rows.addOne({id:'a',x:0,y:0});await flush();let phase='setup';const observations=observe(tree,()=>phase);
 try{await flush();for(const o of observations)expect(o.seen.length).toBeGreaterThan(0);phase='authoring';const q=tree.transact(()=>{WRITE_SCALAR;WRITE_FIELD;});phase='speculative';await flush();for(const o of observations)expect(o.seen.at(-1)?.value).toBe('[3,7,7]');phase='rollback';q.rollback();phase='after-rollback';await flush();for(const o of observations){const settled=o.seen.filter(f=>f.phase==='rollback'||f.phase==='after-rollback');expect(settled.length,JSON.stringify(o.seen)).toBeGreaterThan(0);for(const f of settled)expect(f.value,JSON.stringify(o.seen)).toBe('[0,0,0]');expect(o.seen.at(-1)?.value).toBe('[0,0,0]');}}finally{observations.forEach(o=>o.dispose());dispose();}
});
"""
 for a,z in {'WRITE_X':write('row.x',7),'WRITE_Y':write('row.y',11),'READ_X':read('row.x'),'READ_Y':read('row.y'),'WRITE_SCALAR':write('tree.$.scalar',3),'WRITE_FIELD':write("tree.$.rows.byIdOrFail('a').x",7)}.items():body=body.replace(a,z)
 path.write_text(imp+imports[fw]+setup+body)
(root/'FIXTURE-SHA256.json').write_text(json.dumps({str(p.relative_to(b)):hashlib.sha256(p.read_bytes()).hexdigest() for p in b.glob('packages/*/src/**/selected-prepared-facade.spec.*')},indent=2)+'\n')
