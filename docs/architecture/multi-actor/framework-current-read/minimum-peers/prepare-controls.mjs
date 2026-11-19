import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const base=path.dirname(new URL(import.meta.url).pathname);
for (const [name,framework] of [['angular20','angular'],['angular21','angular'],['vue350','vue']]) {
 const dir=path.join(base,name),require=createRequire(path.join(dir,'package.json')),ts=require('typescript');
 const src=fs.readFileSync(`/private/tmp/st-current-read-capability-proof/packages/${framework}/src/lib/selected-callback-facade.spec.ts`,'utf8');
 const publicSource=src.replace("from '../index'",`from '@signal-tree/${framework}'`).replace("from 'vitest'","from './assertions.mjs'");
 fs.writeFileSync(path.join(dir,'public-controls.ts'),publicSource);
 fs.writeFileSync(path.join(dir,'public-controls.mjs'),ts.transpileModule(publicSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
 fs.writeFileSync(path.join(dir,'assertions.mjs'),`import assert from 'node:assert/strict';\nimport {test} from 'node:test';\nexport const it=Object.assign((name,fn)=>test(name,fn),{each:values=>(name,fn)=>{for(const value of values)test(name.replace('%s',String(value)),()=>fn(value));}});\nexport const expect=value=>({toBe:expected=>assert.ok(Object.is(value,expected),\`expected Object.is(\${String(value)}, \${String(expected)})\`),toEqual:expected=>assert.deepStrictEqual(value,expected),toBeGreaterThan:expected=>assert.ok(value>expected),toThrow:expected=>assert.throws(value,error=>error===expected)});\n`);
 const native=framework==='angular'?"import type {Signal, WritableSignal} from '@angular/core';":"import type {ComputedRef, Ref} from 'vue';";
 const carrier=framework==='angular'?'Signal':'ComputedRef';
 fs.writeFileSync(path.join(dir,'consumer.ts'),`${native}\nimport {signalTree,entityMap} from '@signal-tree/${framework}';\nimport type {ObservationAdapter} from '@signal-tree/kernel/adapter';\ntype Equal<A,B>=(<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;\ntype Assert<T extends true>=T;\nconst tree=signalTree({count:1,rows:entityMap<{id:string;n:number},string>()});\nconst id: ${carrier}<string|undefined>=tree.$.rows.activeId;\nconst all: ${carrier}<readonly {id:string;n:number}[]>=tree.$.rows.all;\nconst query: ${carrier}<readonly {id:string;n:number}[]>=tree.$.rows.where(row=>row.n>0);\ntype ExactId=Assert<Equal<typeof tree.$.rows.activeId,${carrier}<string|undefined>>>;\n${framework==='angular'?'const writable: WritableSignal<number>=tree.$.count; writable.set(2);':'const writable: Ref<number>=tree.$.count; writable.value=2;'}\nconst capability: NonNullable<ObservationAdapter['createCurrentReadonlyCell']>=<T>(read:()=>T)=>()=>read();\nconst result:number=capability(()=>1)();\nvoid id;void all;void query;void result;tree.destroy();\n`);
 if(framework==='angular') {
 fs.writeFileSync(path.join(dir,'component.ts'),`import {Component} from '@angular/core';\nimport {signalTree,entityMap} from '@signal-tree/angular';\n@Component({selector:'peer-control',standalone:true,template:'<button (click)="increment()">{{tree.$.count()}}</button><p>{{tree.$.rows.activeId()}}</p>'})\nexport class PeerControl {readonly tree=signalTree({count:1,rows:entityMap<{id:string;n:number},string>()}); increment(){this.tree.$.count.set(this.tree.$.count()+1);} ngOnDestroy(){this.tree.destroy();}}\n`);
 fs.writeFileSync(path.join(dir,'tsconfig.aot.json'),JSON.stringify({compilerOptions:{target:'ES2022',module:'ES2022',moduleResolution:'bundler',strict:true,skipLibCheck:false,experimentalDecorators:true,outDir:'aot'},angularCompilerOptions:{strictTemplates:true,compilationMode:'full'},files:['component.ts']},null,2));
 }
}
