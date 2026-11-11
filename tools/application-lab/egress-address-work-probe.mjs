#!/usr/bin/env node
// Exact selected source visits, not CPU timing or a production artifact.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync,mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve,join } from 'node:path';
import { pathToFileURL } from 'node:url';
const [rootArg,outArg]=process.argv.slice(2);assert.ok(rootArg&&outArg);
const root=resolve(rootArg),out=resolve(outArg);assert.ok(!existsSync(out));mkdirSync(out,{recursive:true});
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const require=createRequire(join(root,'package.json')),{build,version}=require('esbuild');
const source=join(root,'packages/kernel/src/lib/internals/entity-egress-projection.ts'),terminal=join(root,'packages/kernel/src/lib/internals/intrinsic-mutation.ts');
const entry=join(out,'entry.mjs'),bundle=join(out,'instrumented.mjs'),bindings={};
writeFileSync(entry,`import assert from 'node:assert/strict';import {createEntityEgressProjection} from ${JSON.stringify(source)};import {installTerminalRecord} from ${JSON.stringify(terminal)};
export function run(n){globalThis.__addressCounts={keyIteration:0,egressIncludes:0,egressIndexOf:0,topologyIncludes:0,topologyIndexOf:0,indexBuild:0,addressLookups:0,addressMatches:0};const fact={};const evidence={member:()=>fact,field:()=>fact,placement:()=>fact,keyMapping:()=>fact};const projection=createEntityEgressProjection([]);const rows=Array.from({length:n},(_,i)=>({id:i,a:i,b:i,c:i,d:i,e:i,f:i,g:i,h:i}));const edits=rows.map((row,i)=>({subject:i,after:row,before:undefined,fields:null,structural:{kind:'add',subject:i,key:i,value:row,...(i?{beforeSubject:i-1}:{})}}));const staged=projection.prepare({owner:1,id:{},meta:undefined,physical:edits,ordinary:edits},evidence);assert.equal(staged.changed,true);assert.deepEqual(staged.value,rows);assert.deepEqual(projection.value(),[]);const preparation={...globalThis.__addressCounts};installTerminalRecord(staged.record);assert.deepEqual(projection.value(),rows);assert.equal(projection.support().size,n*11);return{n,preparation,total:{...globalThis.__addressCounts}};}`,{flag:'wx'});
const bundleResult=await build({entryPoints:[entry],outfile:bundle,bundle:true,format:'esm',platform:'node',target:'node24',metafile:true,logLevel:'silent',plugins:[{name:'exact-selected-visits',setup(build){build.onLoad({filter:/(entity-egress-projection|source-mutation|entity-egress-keys)\.ts$/},args=>{let contents=readFileSync(args.path,'utf8');bindings[args.path]=sha(args.path);
if(args.path.endsWith('entity-egress-projection.ts')||args.path.endsWith('source-mutation.ts')){const label=args.path.endsWith('entity-egress-projection.ts')?'egress':'topology';contents=`function __includes(values:number[],value:number){const i=values.indexOf(value);globalThis.__addressCounts.${label}Includes+=i<0?values.length:i+1;return values.includes(value);}function __indexOf(values:number[],value:number){const i=values.indexOf(value);globalThis.__addressCounts.${label}IndexOf+=i<0?values.length:i+1;return i;}\n`+contents.replaceAll('order.includes(', '__includes(order,').replaceAll('order.indexOf(', '__indexOf(order,');}
if(args.path.endsWith('entity-egress-projection.ts')){
 if(contents.includes('const keyOf = new Map<number, Key>();'))contents=contents.replace('const keyOf = new Map<number, Key>();','const keyOf = new (class extends Map<number,Key>{override *[Symbol.iterator](){for(const entry of super[Symbol.iterator]()){globalThis.__addressCounts.keyIteration++;yield entry;}}})();');
 else assert.ok(contents.includes('const keyOf = new EntityEgressKeys();'),'Unknown key map seam');
}
if(args.path.endsWith('entity-egress-keys.ts')){
 assert.ok(contents.includes('subjectsAt(key: Key | undefined): readonly number[] {'));
 assert.ok(contents.includes('for (const [subject, held] of this) {'));
 contents=contents.replace('subjectsAt(key: Key | undefined): readonly number[] {','subjectsAt(key: Key | undefined): readonly number[] { globalThis.__addressCounts.addressLookups++;').replace('for (const [subject, held] of this) {','for (const [subject, held] of this) { globalThis.__addressCounts.indexBuild++;').replace('return this.byKey.get(key) ?? EMPTY;','const result=this.byKey.get(key) ?? EMPTY;globalThis.__addressCounts.addressMatches+=result.length;return result;');
}
return{contents,loader:'ts'};});}}]});
const api=await import(pathToFileURL(bundle).href);const results=[200,400].map(n=>api.run(n));
for(const result of results){const n=result.n,p=result.preparation;assert.equal(p.egressIncludes,n*(n-1)/2);assert.equal(p.topologyIncludes,n*(n-1)/2);assert.equal(p.egressIndexOf,n*(n-1)/2);assert.equal(p.topologyIndexOf,n*(n-1)/2+1);if(p.addressLookups){assert.equal(p.addressLookups,2*n);assert.equal(p.indexBuild,0);assert.equal(p.addressMatches,0);}else assert.equal(p.keyIteration,n*(n-1));}
writeFileSync(join(out,'metafile.json'),JSON.stringify(bundleResult.metafile,null,2)+'\n',{flag:'wx'});const report={passed:true,command:process.argv,createdUTC:new Date().toISOString(),node:process.version,esbuild:version,bindings,runnerSha256:sha(process.argv[1]),bundleSha256:sha(bundle),results,limits:'Fresh empty-to-N structural prepare with complete physical pass then ordinary pass, id+8 fields, all final rows/order/support asserted. Counts selected key iteration and native includes/indexOf element visits only; not total work, CPU timing or memory. Source topology placement walks and support work are outside these counters.'};writeFileSync(join(out,'results.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report,null,2));
