import {expect,it,vi} from 'vitest';

it('resets reporting after a throwing reporter, preserves undefined secondary and primary, and releases connection',async()=>{
 vi.resetModules();
 const life=await import('./experimental-publication/lifecycle');
 const {installTerminalRecord}=await import('./internals/intrinsic-mutation');
 const before=life.diagnostics(), channel={}, queue:VoidFunction[]=[], reports:unknown[]=[];
 vi.stubGlobal('queueMicrotask',(cb:VoidFunction)=>queue.push(cb));
 life.registerConnection(channel,{supported:true,report(e){reports.push(e);throw undefined;},wake(){expect(life.diagnostics().activeFrames).toBe(0);}});
 try {
  const primaries=[{first:true},undefined];
  for(const primary of primaries){
   let caught=false,value:unknown;
   try {life.runDeclaration(channel,{kind:'independent'},()=>{
    const p=life.prepareNativeRequirement([],false,[]);installTerminalRecord(p.record);life.finalizeNativeRequirement(p.requirement);
    life.onNativeRequirementReady(p.requirement,()=>{throw undefined;});life.deliverNativeRequirementReady(p.requirement);
    throw primary;
   });}catch(e){caught=true;value=e;}
   expect(caught).toBe(true);expect(value).toBe(primary);expect(life.diagnostics().activeFrames).toBe(0);
   while(queue.length)queue.shift()!();
  }
  expect(reports).toEqual([undefined,undefined]);
 }finally{life.disposeConnection(channel);while(queue.length)queue.shift()!();vi.unstubAllGlobals();}
 expect(life.diagnostics()).toEqual(before);
});

it('preserves a thrown undefined from scheduling over completion error',async()=>{
 vi.resetModules();const life=await import('./experimental-publication/lifecycle');
 const {installTerminalRecord}=await import('./internals/intrinsic-mutation');
 const before=life.diagnostics(),channel={}, completion={}, queue:VoidFunction[]=[];
 vi.stubGlobal('queueMicrotask',(cb:VoidFunction)=>{queue.push(cb);throw undefined;});
 life.registerConnection(channel,{supported:true,report(){throw new Error('unexpected report');},wake(){}});
 try {
  let caught=false,value:unknown='not-thrown';
  try{life.runDeclaration(channel,{kind:'independent'},()=>{
   const p=life.prepareNativeRequirement([],false,[]);installTerminalRecord(p.record);life.finalizeNativeRequirement(p.requirement);
   life.onNativeRequirementReady(p.requirement,()=>{throw completion;});life.deliverNativeRequirementReady(p.requirement);
  });}catch(e){caught=true;value=e;}
  expect(caught).toBe(true);expect(value).toBeUndefined();expect(life.diagnostics().activeFrames).toBe(0);
 }finally{life.disposeConnection(channel);while(queue.length)queue.shift()!();vi.unstubAllGlobals();}
 expect(life.diagnostics()).toEqual(before);
});
