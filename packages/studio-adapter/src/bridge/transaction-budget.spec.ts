import { afterEach, describe, expect, it } from 'vitest';
import { dropRegistryIfEmpty, registryForAttach } from '../registry';
import type { KernelConfirmedTurn } from '../kernel-contract';
import { clearStudioHistory, readStudioTurns, acquireStudioRecording } from './recording';
import { handleStudioRequest } from './handle-request';

const cleanup:(()=>void)[]=[];
afterEach(()=>{while(cleanup.length)cleanup.pop()?.();dropRegistryIfEmpty();});
const turn=(id:number,value:unknown):KernelConfirmedTurn=>({id,positions:[1],effects:[{position:1,path:'value',ownerPath:'value',kind:'set',before:0,after:value}]});
function source(turns:KernelConfirmedTurn[]){
 const registry=registryForAttach();const id=registry.add({}, {reader:{treeId:{},readConfirmedTurns:()=>({turns,retention:{truncated:false}})},capabilities:[]});
 cleanup.push(()=>registry.remove(id));return {registry,id};
}
function read(id:string){const result=readStudioTurns(id);expect(result?.ok).toBe(true);if(!result?.ok)throw new Error('read failed');return result.value;}

describe('bounded transaction bridge reads',()=>{
 it('omits oversized transactions whole and preserves surrounding records and source IDs',()=>{
  const turns=[turn(1,1),turn(2,'x'.repeat(100000)),turn(3,3)];const {id}=source(turns);const value=read(id);
  expect(value.turns.map(turn=>turn.id)).toEqual([1,3]);
  expect(value.retention).toMatchObject({truncated:true,omittedTransactions:1,omissionReasons:['value-budget'],retainedTurnIds:[1,3],observedTurnIds:[1,2,3],maxBytes:2097152});
  expect(value.turns[0]!.effects[0]!.after).toBe(1);expect(turns[1]!.effects[0]!.after).toHaveLength(100000);
 });
 it('clones cyclic objects, Dates, Maps and Sets without retaining mutable source values',()=>{
  const value:{self?:unknown;date:Date;map:Map<string,unknown>;set:Set<unknown>}={date:new Date('2026-09-10'),map:new Map(),set:new Set()};value.self=value;value.map.set('self',value);value.set.add(value);
  const {id}=source([turn(1,value)]);const saved=read(id).turns[0]!.effects[0]!.after as typeof value;
  expect(saved).not.toBe(value);expect(saved.self).toBe(saved);expect(saved.map.get('self')).toBe(saved);expect(saved.set.has(saved)).toBe(true);expect(saved.date).not.toBe(value.date);expect(saved.date.getTime()).toBe(value.date.getTime());
  value.date.setFullYear(2000);value.map.clear();expect(saved.map.size).toBe(1);expect(saved.date.getFullYear()).toBe(2026);
 });
 it('refuses accessors without invoking them and does not fabricate placeholder values',()=>{
  let calls=0;const value={get hidden(){calls++;return 1;}};const {id}=source([turn(1,42),turn(2,value)]);const result=read(id);
  expect(calls).toBe(0);expect(result.turns.map(turn=>turn.id)).toEqual([1]);expect(result.retention.omissionReasons).toEqual(['unsupported-value']);
 });
 it('bounds the aggregate read budget and returns exact retained IDs for cache eviction',()=>{
  const {id}=source(Array.from({length:100},(_,i)=>turn(i,'x'.repeat(20000))));const result=read(id);
  expect(result.turns.length).toBeGreaterThan(0);expect(result.turns.length).toBeLessThan(100);expect(result.retention.retainedBytes).toBeLessThanOrEqual(2097152);expect(result.retention.omittedTransactions).toBe(100-result.turns.length);expect(result.retention.omissionReasons).toContain('history-budget');expect(result.retention.retainedTurnIds).toEqual(result.turns.map(turn=>turn.id));
 });
 it('reports interior omissions even when a client already knows that transaction',()=>{
  const turns=[turn(1,1),turn(2,2),turn(3,3)];const {id}=source(turns);const first=read(id);turns[1]=turn(2,'x'.repeat(100000));
  const response=handleStudioRequest({protocol:1,id:'delta',command:'readConfirmedTurns',treeId:id,historyEpoch:0,knownTurnIds:first.turns.map(turn=>turn.id)});
  expect(response.ok).toBe(true);if(!response.ok)return;
  const value=response.value as ReturnType<typeof read>;
  expect(value.turns).toEqual([]);expect(value.retention.retainedTurnIds).toEqual([1,3]);expect(value.retention.omittedTransactions).toBe(1);
 });
 it('clears omitted source IDs too and does not let them reappear when their values become readable',()=>{
  cleanup.push(acquireStudioRecording());const turns=[turn(1,1),turn(2,'x'.repeat(100000))];const {id}=source(turns);clearStudioHistory(id);turns[1]=turn(2,2);turns.push(turn(3,3));
  expect(read(id).turns.map(turn=>turn.id)).toEqual([3]);
 });
 it('does not discard a lower ID that confirms after a cleared higher ID',()=>{
  cleanup.push(acquireStudioRecording());const turns=[turn(3,3)];const {id}=source(turns);clearStudioHistory(id);turns.unshift(turn(1,1));
  expect(read(id).turns.map(turn=>turn.id)).toEqual([1]);
 });
 it('terminates oversized cyclic captures and preserves another readable transaction',()=>{
  const cycle:{self?:unknown;items:number[]}={items:Array(100000).fill(1)};cycle.self=cycle;
  const {id}=source([turn(1,cycle),turn(2,42)]);const result=read(id);
  expect(result.turns.map(turn=>turn.id)).toEqual([2]);expect(result.retention.omittedTransactions).toBe(1);expect(result.retention.omissionReasons).toEqual(['value-budget']);expect(cycle.self).toBe(cycle);
 });

});
