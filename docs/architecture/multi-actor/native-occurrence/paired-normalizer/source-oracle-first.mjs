import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {createRequire} from 'node:module';
import {selection as s,endpoint as ep,image,normalizePaired} from './model.mjs';
const require=createRequire('/private/tmp/st-occurrence-successor/package.json');const ts=require('typescript');
const path='/private/tmp/st-occurrence-successor/packages/kernel/src/lib/internals/plain-branch-membership.ts';
const text=fs.readFileSync(path,'utf8');
// Execute the exact source normalizer + actual image helpers; only registry/storage ports are fixtures.
const fn=text.slice(text.indexOf('export function settleTurnMemberEffects<'),text.indexOf('\nfunction memberAddress('));
const noop=text.slice(text.indexOf('export function plainBranchMemberEffectIsNoop('),text.indexOf('/** A turn effect'));
const js=ts.transpileModule(noop+fn,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function sourceRun(effects,addresses,final){const context={exports:{},getPositionRegistry:()=>({addressFor:p=>addresses.get(p)}),memberAddress:(_root,p)=>final.has(p)?{branch:{node:final.get(p)},key:'node',node:final.get(p)}:undefined,storedReads:{depth:0},unwrapBranchForWriteCapture:x=>x};vm.runInNewContext(js,context);return context.exports.settleTurnMemberEffects({},effects);}
test('paired normalizer matches actual frozen source for member rewrite and scalar netzero',()=>{
 const proof=s('q',['q']),leaf=v=>ep(true,v,proof),abs=ep(false,undefined,proof);
 const scenarios=[[
 {kind:'set',position:1,address:['g','x'],before:leaf(0),after:leaf(5)},
 {kind:'set',position:2,address:['g'],membership:true,before:image(proof,[['x',leaf(5)],['y',leaf(0)]]),after:abs},
 {kind:'set',position:3,address:['g','y'],before:leaf(0),after:leaf(13)}
 ],[{kind:'set',position:1,address:['x'],before:leaf(7),after:leaf(7)}]];
 for(const paired of scenarios){
  const addresses=new Map(paired.map(e=>[e.position,e.address]));
  const native=paired.map(e=>({...e,before:e.before.value,after:e.after.value,plainBranchMembership:e.membership?{before:e.before.present,after:e.after.present}:undefined}));
  const actual=sourceRun(native,addresses,new Map());const modeled=normalizePaired(paired,{revision:1,entries:new Map()});
  assert.deepEqual(JSON.parse(JSON.stringify(actual.map(e=>({position:e.position,before:e.before,after:e.after})))),JSON.parse(JSON.stringify(modeled.selected.map(e=>({position:e.position,before:e.before.value,after:e.after.value})))));
 }
});
