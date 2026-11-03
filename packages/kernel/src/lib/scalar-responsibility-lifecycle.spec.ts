import {expect,it,vi} from 'vitest';
import {signalTree,transactions,restoration} from '../index';
import * as intrinsic from './internals/intrinsic-mutation';
import {attachScalarResponsibility,registerScalarResponsibility} from './internals/scalar-responsibility-attachment';
import {createMutationCaptureRuntime,getMutationCaptureRuntime} from './internals/mutation-capture-runtime';
import {createTreeScalarLeafRuntime} from './internals/tree-scalar-leaf-runtime';
import {wrapOwnedWritableSignal} from './internals/owned-mutation';
import {interceptLeafSignals} from './internals/intercept-leaf-signals';
import {ConstructionAllocation} from './internals/construction-allocation';
function assertInstalledNumber(value:unknown):asserts value is {():number;(value:number):void;(update:(value:number)=>number):void} {
 if(typeof value!=='function')throw Error('Expected explicitly installed numeric leaf');
}
const plan=()=>({writes:[],adds:[]});
for(const capture of [false,true])it(`absent provider reserves no terminal slots: capture=${capture}`,()=>{
 const sources=new WeakMap<object,ReturnType<typeof intrinsic.registerIntrinsicMutationSource>>();const original=intrinsic.registerIntrinsicMutationSource;
 const spy=vi.spyOn(intrinsic,'registerIntrinsicMutationSource').mockImplementation((...args:Parameters<typeof original>)=>{const result=original(...args);sources.set(args[0],result);return result;});
 const t=signalTree({n:0,rows:{} as Record<string,number>},{enhancers:capture?[restoration()]:[]});
 try{
  t.$.rows({fresh:0});const fresh=t.$.rows.fresh;if(!fresh)throw Error('missing installed leaf');assertInstalledNumber(fresh);
  for(const leaf of [t.$.n,fresh]){
   expect(sources.get(leaf)?.prepareTerminal).toBeUndefined();let calls=0;
   const off=intrinsic.prepareTerminalMutations(leaf,()=>{calls++;return plan();});expect(off).toBeDefined();
   leaf(1);expect(calls).toBe(1);off!();off!();expect(sources.get(leaf)?.prepareTerminal).toBeUndefined();
   leaf(2);expect(calls).toBe(1);expect(leaf()).toBe(2);
  }
 }finally{t.destroy();spy.mockRestore();}
});
it('seeded and dynamic transactional leaves prepare once with exact replace/derive intent',()=>{
 const t=signalTree({n:0,rows:{} as Record<string,number>},{enhancers:[transactions()]});
 t.$.rows({fresh:0});const fresh=t.$.rows.fresh;if(!fresh)throw Error('missing installed leaf');assertInstalledNumber(fresh);
 const runtime=getMutationCaptureRuntime(t)!;const original=runtime.prepareScalarResponsibility!;const seen:{path:string;intent:unknown;admission:boolean}[]=[];
 const spy=vi.spyOn(runtime,'prepareScalarResponsibility').mockImplementation((...args:Parameters<typeof original>)=>{const result=original(...args);seen.push({path:args[0],intent:args[3]?.mutationIntent,admission:!!result?.scalarAdmission});return result;});
 try{
  const p=t.transact(()=>{t.$.n(1);t.$.n(v=>v+1);fresh(1);fresh(v=>v+1);fresh(2);});
  expect(seen).toEqual([{path:'n',intent:'replace',admission:true},{path:'n',intent:'derive',admission:true},{path:'rows.fresh',intent:'replace',admission:true},{path:'rows.fresh',intent:'derive',admission:true}]);
  expect(t.$()).toEqual({n:2,rows:{fresh:2}});expect(p.inspect().changes.length).toBeGreaterThan(0);
  p.rollback();expect(t.$()).toEqual({n:0,rows:{fresh:0}});
 }finally{spy.mockRestore();t.destroy();}
 expect(runtime.prepareScalarResponsibility).toBeUndefined();
});
it('failed dynamic attachment unwinds its observer without stealing the terminal owner',()=>{
 const runtime=createMutationCaptureRuntime();registerScalarResponsibility(runtime,()=>plan());
 const leaf=createTreeScalarLeafRuntime(undefined).createLeaf<number>(0,Object.is);let calls=0;
 const existing=intrinsic.prepareTerminalMutations(leaf,()=>{calls++;return plan();})!;
 try{
  expect(intrinsic.getIntrinsicMutationObserver(leaf)).toBeUndefined();
  expect(()=>wrapOwnedWritableSignal(leaf,{path:'n',positionIds:undefined,captureRuntime:runtime})).toThrow('Terminal preparation already owned');
  expect(intrinsic.getIntrinsicMutationObserver(leaf)).toBeUndefined();
  leaf(1);expect(leaf()).toBe(1);expect(calls).toBe(1);
  expect(()=>attachScalarResponsibility(leaf,runtime,'n')).toThrow('Terminal preparation already owned');
 }finally{existing();existing();}
 const release=attachScalarResponsibility(leaf,runtime,'n');expect(release).toBeDefined();release!();release!();
});
it('failed initial traversal unwinds prior attachments and preserves the conflicting owner',()=>{
 const t=signalTree({a:0,b:0}),runtime=createMutationCaptureRuntime();let originalCalls=0;
 registerScalarResponsibility(runtime,()=>plan());const existing=intrinsic.prepareTerminalMutations(t.$.b,()=>{originalCalls++;return plan();})!;
 try{
  const beforeA=intrinsic.getIntrinsicMutationObserver(t.$.a),beforeB=intrinsic.getIntrinsicMutationObserver(t.$.b);
  expect(()=>interceptLeafSignals(t.$,()=>{ /* This fixture tests attachment lifetime; no work is needed in this callback. */ }, {scalarResponsibility:runtime,beforePublication:()=>{ /* This fixture tests attachment lifetime; no work is needed in this callback. */ }})).toThrow('Terminal preparation already owned');
  expect(intrinsic.getIntrinsicMutationObserver(t.$.a)).toBe(beforeA);expect(intrinsic.getIntrinsicMutationObserver(t.$.b)).toBe(beforeB);
  const free=intrinsic.prepareTerminalMutations(t.$.a,()=>plan());expect(free).toBeDefined();free!();t.$.b(1);expect(originalCalls).toBe(1);
 }finally{existing();t.destroy();}
});
it('provider cleanup is idempotent and cannot erase replacement authority',()=>{
 const runtime=createMutationCaptureRuntime(),first=()=>plan(),second=()=>plan();
 const release=registerScalarResponsibility(runtime,first);
 expect(()=>registerScalarResponsibility(runtime,second)).toThrow('Scalar responsibility provider already owned');expect(runtime.prepareScalarResponsibility).toBe(first);
 runtime.prepareScalarResponsibility=second;release();release();expect(runtime.prepareScalarResponsibility).toBe(second);
 delete runtime.prepareScalarResponsibility;const off=registerScalarResponsibility(runtime,first);off();off();expect(runtime.prepareScalarResponsibility).toBeUndefined();
});
it('provisional delegates stay inactive and cancellation releases only its own allocation',()=>{
 const runtime=createMutationCaptureRuntime();const calls:string[]=[];registerScalarResponsibility(runtime,path=>{calls.push(path);return plan();});
 const leafRuntime=createTreeScalarLeafRuntime(undefined),outer=leafRuntime.createLeaf<number>(0,Object.is),inner=leafRuntime.createLeaf<number>(0,Object.is);
 const a=new ConstructionAllocation(),b=new ConstructionAllocation();
 const offA=wrapOwnedWritableSignal(outer,{path:'outer',positionIds:undefined,captureRuntime:runtime},{isActive:()=>a.installed});
 const offB=wrapOwnedWritableSignal(inner,{path:'inner',positionIds:undefined,captureRuntime:runtime},{isActive:()=>b.installed});
 a.add(()=>{ /* This fixture tests attachment lifetime; no work is needed in this callback. */ },offA);b.add(()=>{ /* This fixture tests attachment lifetime; no work is needed in this callback. */ },offB);
 try{
  outer(1);inner(1);expect(calls).toEqual([]);
  b.install();a.cancel();a.cancel();inner(2);expect(calls).toEqual(['inner']);
  expect(intrinsic.getIntrinsicMutationObserver(outer)).toBeUndefined();
  const unowned=intrinsic.prepareTerminalMutations(outer,()=>plan());expect(unowned).toBeDefined();unowned!();
  offB();offB();inner(3);expect(calls).toEqual(['inner']);expect(intrinsic.getIntrinsicMutationObserver(inner)).toBeUndefined();
 }finally{offA();offB();}
});
