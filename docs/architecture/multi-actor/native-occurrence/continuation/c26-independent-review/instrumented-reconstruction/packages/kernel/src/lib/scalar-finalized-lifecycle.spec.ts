import {expect,it} from 'vitest';
import * as l from './experimental-publication/lifecycle';
import {installTerminalRecord} from './internals/intrinsic-mutation';
const connection=()=>{const c={};l.registerConnection(c,{supported:true,report:()=>{},wake:()=>{}});return c;};
const compact=(r:l.NativeRequirement)=>{expect(r.components).toBeUndefined();expect(Object.getOwnPropertyDescriptor(r,'proof')?.get).toBeUndefined();expect(l.__c26NormalizationState(r).enrolled).toBe(false);};
for(const activationFirst of [true,false])it(`both barriers, same aliases, cleanup activationFirst=${activationFirst}`,()=>{
 const c=connection();let leaf!:l.NativeRequirement,root!:l.NativeRequirement;const alias: l.NativeRequirement[]=[];
 try{
  l.runDeclaration(c,{kind:'independent'},()=>{
   const p=l.prepareNativeRequirement([],false,[]);leaf=p.requirement;installTerminalRecord(p.record);l.finalizeNativeRequirement(leaf);
   root=l.combineScalarNativeRequirements([leaf,l.initialRequirement()]);alias.push(root);
   expect(l.nativeRequirementReady(root)).toBe(false);
   if(activationFirst)l.completeScalarNativeRequirement(root,leaf);
   expect(root.components).toBeDefined();
  });
  if(!activationFirst){expect(l.nativeRequirementReady(root)).toBe(false);expect(root.components).toBeDefined();l.completeScalarNativeRequirement(root,leaf);}
  compact(root);expect(alias[0]).toBe(root);expect(l.nativeRequirementReady(root)).toBe(true);expect(l.__c26NormalizationState(leaf).listeners).toBe(0);
 }finally{l.disposeConnection(c);}
});
it('uninstalled construction attaches no listeners; generic composites remain unchanged',()=>{
 const p=l.prepareNativeRequirement([],false,[]);const root=l.combineScalarNativeRequirements([p.requirement]);
 expect(l.__c26NormalizationState(p.requirement).listeners).toBe(0);expect(l.__c26NormalizationState(root).enrolled).toBe(false);
 const generic=l.combineNativeRequirements([l.initialRequirement()]);expect(generic.components).toBeDefined();
 l.completeScalarNativeRequirement(generic,undefined);expect(generic.components).toBeDefined();
});
it('throwing readiness callback still closes normalization and later listeners',()=>{
 const p=l.prepareNativeRequirement([],false,[]);l.finalizeNativeRequirement(p.requirement);installTerminalRecord(p.record);
 const root=l.combineScalarNativeRequirements([p.requirement]);const error=new Error('ready');let called=0;
 l.onNativeRequirementReady(p.requirement,()=>{throw error;});l.onNativeRequirementReady(p.requirement,()=>called++);
 expect(()=>l.completeScalarNativeRequirement(root,p.requirement)).toThrow(error);compact(root);expect(called).toBe(1);expect(l.__c26NormalizationState(p.requirement).listeners).toBe(0);
});
it('nested reentry and callback sentinel preserve invalidity and release registrations',()=>{
 const c=connection();let root!:l.NativeRequirement;let inner!:l.NativeRequirement;const error=new Error('callback');
 try{
  expect(()=>l.runDeclaration(c,{kind:'independent'},()=>{
   const p=l.prepareNativeRequirement([],false,[]);installTerminalRecord(p.record);l.finalizeNativeRequirement(p.requirement);
   root=l.combineScalarNativeRequirements([p.requirement]);l.completeScalarNativeRequirement(root,p.requirement);
   l.onNativeRequirementReady(p.requirement,()=>{
    l.runDeclaration(c,{kind:'independent'},()=>{const q=l.prepareNativeRequirement([],false,[]);installTerminalRecord(q.record);l.finalizeNativeRequirement(q.requirement);inner=l.combineScalarNativeRequirements([q.requirement]);l.completeScalarNativeRequirement(inner,q.requirement);});
   });throw error;
  })).toThrow(error);
  compact(root);compact(inner);expect(l.nativeProof(root).invalid).toBe(true);expect(l.nativeProof(inner).invalid).toBe(false);expect(l.diagnostics().activeFrames).toBe(0);
 }finally{l.disposeConnection(c);}
});
it('all-ready scalar classification preserves role blockers and qualifying window identity',()=>{
 const cell:l.OwnerCell={owner:987654,id:1,outcome:'confirmed',dependents:new Set()};
 const leaf=l.initialRequirement();leaf.proof={owners:[],possible:[cell],unknown:true,invalid:false,historicalWindow:true};
 Object.defineProperty(leaf,'retirementOwnWindowOnly',{value:true});
 const r=l.combineScalarNativeRequirements([leaf,l.initialRequirement()]);compact(r);expect(l.finalizedRetirement(r)).toEqual({blocked:false,possible:[cell]});expect(r.retirementOwnWindowOnly).toBeUndefined();
 const owned=l.initialRequirement();owned.proof={owners:[cell],destination:[cell],unknown:false,invalid:false};
 const blocked=l.combineScalarNativeRequirements([r,owned]);compact(blocked);expect(l.finalizedRetirement(blocked)?.blocked).toBe(true);expect(l.nativeProof(blocked).destination?.[0]).toBe(cell);
});
