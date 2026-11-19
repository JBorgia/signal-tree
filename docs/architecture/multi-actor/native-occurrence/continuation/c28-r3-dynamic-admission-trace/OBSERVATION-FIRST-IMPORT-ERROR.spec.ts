import {appendFileSync} from 'node:fs';
import {expect,it,vi} from 'vitest';
import {signalTree,transactions} from '../index';
import * as intrinsic from './internals/intrinsic-mutation';
import * as selection from './internals/native-scalar-selection';
import {getOwnedPositionIds} from './internals/owned-metadata';
import {getActiveWriteContext} from './write-context';
import {getTreeScalarSlotRuntime} from './internals/tree-scalar-slot-runtime';
for(const route of ['static','dynamic','reentrant'] as const)it(`observes native admission attachment without repair: ${route}`,()=>{
 const sources=new WeakMap<object,ReturnType<typeof intrinsic.registerIntrinsicMutationSource>>();const registrations=new WeakSet<object>();
 const register=intrinsic.registerIntrinsicMutationSource,terminal=intrinsic.prepareTerminalMutations,select=selection.prepareScalarSelection;
 const sourceSpy=vi.spyOn(intrinsic,'registerIntrinsicMutationSource').mockImplementation((...args:Parameters<typeof register>)=>{const result=register(...args);sources.set(args[0],result);return result;});
 const terminalSpy=vi.spyOn(intrinsic,'prepareTerminalMutations').mockImplementation((...args:Parameters<typeof terminal>)=>{const result=terminal(...args);if(result)registrations.add(args[0]);return result;});
 const rows:unknown[]=[];let target:object|undefined;
 const selectSpy=vi.spyOn(selection,'prepareScalarSelection').mockImplementation((...args:Parameters<typeof select>)=>{
  const [registry,node,mutation,before,proposed]=args;
  if(node===target){const source=sources.get(node),meta=getActiveWriteContext(),admission=mutation.preparedTerminal?.scalarAdmission;
   rows.push({route,sourceExists:!!source,terminalRegistered:registrations.has(node),terminalPresent:typeof source?.prepareTerminal==='function',publicationPresent:typeof source?.preparePublication==='function',position:getOwnedPositionIds(node)?.[0],registryPresent:!!registry,transactionId:meta?.transactionId,intent:mutation.intent,changed:mutation.changed,before:mutation.before,after:mutation.after,endpointBefore:before.value,endpointProposed:proposed.value,terminalPresentOnMutation:!!mutation.preparedTerminal,terminalWrites:mutation.preparedTerminal?.writes.length??0,scalarAdmission:!!admission,effect:admission?{...admission.effect}:undefined,operationEffect:admission?{...admission.operationEffect}:undefined});}
  return select(...args);
 });
 const t=signalTree({rows:(route==='static'?{b:{n:2}}:{}) as Record<string,{n:number}>,scratch:{} as Record<string,unknown>},{enhancers:[transactions()]});
 try{
  if(route==='dynamic')t.$.rows({b:{n:2}});
  if(route==='reentrant'){
   const bad:unknown[]=[];Object.defineProperty(bad,'0',{get(){t.$.rows({b:{n:2}});throw Error('outer preparation sentinel');}});
   expect(()=>t.$.scratch({bad})).toThrow('outer preparation sentinel');
  }
  const row=t.$.rows.b;if(!row)throw Error('missing row');target=row.n;
  const position=getOwnedPositionIds(target)?.[0];expect(position).toBeDefined();expect(getTreeScalarSlotRuntime(t.$)?.resolveScalarSlot(position!)).toBeDefined();
  let error:unknown;let pending:ReturnType<typeof t.transact>|undefined;
  try{pending=t.transact(()=>row.n(3));}catch(e){error=e;}
  expect(rows).toHaveLength(1);
  if(route==='static'){expect(error).toBeUndefined();expect(pending).toBeDefined();pending!.rollback();expect(row.n()).toBe(2);}
  else {expect(error).toMatchObject({message:'Scalar selection requires prepared admission'});expect(row.n()).toBe(2);}
  const output=process.env.ST_DYNAMIC_ADMISSION_OUTPUT;if(!output)throw Error('Missing output');
  appendFileSync(output,JSON.stringify({route,selection:rows,error:error instanceof Error?{name:error.name,message:error.message}:null,after:t.$.rows()})+'\n');
 }finally{t.destroy();selectSpy.mockRestore();terminalSpy.mockRestore();sourceSpy.mockRestore();}
});
