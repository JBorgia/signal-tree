import { expect, it } from 'vitest';
import { installTerminalRecord } from './internals/intrinsic-mutation';
import * as lifecycle from './experimental-publication/lifecycle';
import { compactTerminalProof, REJECTED_DESTINATION, REJECTED_INPUT, REJECTED_VALIDATION } from './experimental-publication/proof-retirement';

const requirement = (proof: Readonly<lifecycle.Proof>): lifecycle.NativeRequirement => ({proof, inputs: [], frames: [], known: [], unknown: false, possible: [], captureWindow: false});
let identity = 930_000;
const cell = (outcome: lifecycle.Outcome): lifecycle.OwnerCell => ({owner: identity++, id: 1, outcome, dependents: new Set()});

function consume(input: lifecycle.NativeRequirement, kind: 'independent'|'unknown', thrown?:object) {
  const channel={}; const reported:unknown[]=[]; let calls=0; let error:unknown; let output:lifecycle.NativeRequirement|undefined;
  lifecycle.registerConnection(channel,{supported:true,report:value=>{reported.push(value);throw Error('secondary reporter');},wake:()=>undefined});
  try {
    lifecycle.runDeclaration(channel,{kind},()=>{
      calls++;
      const prepared=lifecycle.prepareNativeRequirement([],false,[lifecycle.captureNativeInput(input)]);
      lifecycle.finalizeNativeRequirement(prepared.requirement);installTerminalRecord(prepared.record);output=prepared.requirement;
      if(thrown)throw thrown;
    });
  }catch(value){error=value;}
  finally{lifecycle.disposeConnection(channel);}
  return {calls,error,reported,output:output&&lifecycle.nativeProof(output)};
}

it.each([
  ['destination', REJECTED_DESTINATION], ['input', REJECTED_INPUT], ['validation', REJECTED_VALIDATION],
] as const)('retired rejected %s remains a required input without retaining owner identity', (role, bit) => {
  const rejected=cell('rolled-back');
  const original:lifecycle.Proof={owners:[rejected],[role]:[rejected],unknown:false,invalid:false};
  const compact=compactTerminalProof(original);
  expect(compact.owners).toEqual([]);expect(compact.terminalRejectedRoles).toBe(bit);
  const before=consume(requirement(original),'independent');const after=consume(requirement(compact),'independent');
  for(const result of [before,after]){expect(result.calls).toBe(1);expect(result.error).toMatchObject({stage:'after-callback',reason:'contradiction'});expect(result.output?.invalid).toBe(true);}
  expect(original.owners).toEqual([rejected]);
  expect(consume(requirement(compact),'unknown').error).toBeUndefined();
});

it.each(['confirmed','rolled-back'] as const)('closed W(%s) retains uncertainty and does not become a fresh input window', outcome => {
  const owner=cell(outcome);const original:lifecycle.Proof={owners:[],possible:[owner],unknown:true,invalid:false,historicalWindow:true};
  const compact=compactTerminalProof(original);
  expect(compact).toMatchObject({owners:[],possible:[],unknown:true,historicalWindow:true,terminalRejectedRoles:0});
  expect(compact.unavailableInput).not.toBe(true);
  const result=consume(requirement(compact),'independent');
  expect(result.calls).toBe(1);expect(result.error).toBeUndefined();expect(result.output).toMatchObject({unknown:true,possible:[],invalid:false});
  expect(original.possible).toEqual([owner]);
});

it('pending and abandoned roles remain exact; retirement cannot invent terminality', () => {
  const pending=cell('pending'),abandoned=cell('abandoned');
  const original:lifecycle.Proof={owners:[pending,abandoned],destination:[pending],input:[abandoned],possible:[pending,abandoned],unknown:true,invalid:false};
  const compact=compactTerminalProof(original);
  expect(compact.owners).toEqual([pending,abandoned]);expect(compact.possible).toEqual([pending,abandoned]);expect(compact.terminalRejectedRoles).toBe(0);
});

it('terminal required-input contradiction preserves callback error and secondary reporting', () => {
  const rejected=cell('rolled-back'),sentinel=Object.freeze({callback:'primary'});
  const original:lifecycle.Proof={owners:[rejected],input:[rejected],unknown:false,invalid:false};
  for(const proof of [original,compactTerminalProof(original)]){
    const result=consume(requirement(proof),'independent',sentinel);
    expect(result.calls).toBe(1);expect(result.error).toBe(sentinel);expect(result.reported).toHaveLength(1);
    expect(result.reported[0]).toMatchObject({stage:'after-callback',reason:'contradiction'});
  }
});

it('compaction cannot rewrite a capture issued while an owner was pending', () => {
  const owner=cell('pending');const original=requirement({owners:[owner],destination:[owner],unknown:false,invalid:false});
  const issued=lifecycle.captureNativeInput(original);owner.outcome='confirmed';
  const compact=compactTerminalProof(lifecycle.nativeProof(original));
  expect(compact.owners).toEqual([]);expect(issued.owners).toEqual([owner]);expect(issued.requirement).toBe(original);
  expect(lifecycle.captureNativeInput(requirement(compact)).owners).toEqual([]);
});
