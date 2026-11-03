import { afterEach, expect, it } from 'vitest';
import { createTreeScalarSlotRuntime } from './tree-scalar-slot-runtime';
import { createPhysicalCommitClock } from './physical-commit-clock';
import { withWriteContext } from '../write-context';
import { installProductionSubstrateStatsForTesting, clearProductionSubstrateStatsForTesting, resetProductionSubstrateStatsForTesting } from './production-substrate-stats';
afterEach(clearProductionSubstrateStatsForTesting);
for (const sharedClock of [false,true]) it(`counts preparation and actual once-only installation separately (shared clock ${sharedClock})`,()=>{
 const stats=installProductionSubstrateStatsForTesting();
 const r=createTreeScalarSlotRuntime(sharedClock?createPhysicalCommitClock():undefined);
 const a=r.createSlot(0,Object.is),b=r.createSlot(1,Object.is);
 const frame=r.beginFrame();frame.set(a,10);frame.set(b,11);
 const install=frame.prepareCommit();
 expect({...stats}).toMatchObject({slotReads:0,slotWrites:0,revisionIncrements:0,equalityChecks:2});
 const result=install();
 expect({...stats}).toMatchObject({slotReads:0,slotWrites:2,revisionIncrements:1,equalityChecks:2});
 expect(result.changedSlots).toEqual([a,b]); expect(r.revision()).toBe(1);
 expect(r.readSlot(a)).toBe(10);expect(r.readSlot(b)).toBe(11);expect(stats.slotReads).toBe(2);
 const before={...stats};expect(()=>install()).toThrow('already used');expect({...stats}).toEqual(before);
});
it('counts direct commits, suppressed revision, no-op and discard by actual events',()=>{
 const stats=installProductionSubstrateStatsForTesting(),r=createTreeScalarSlotRuntime();const a=r.createSlot(0,Object.is);
 const discarded=r.beginFrame();discarded.set(a,1);discarded.discard();
 expect({...stats}).toMatchObject({slotWrites:0,equalityChecks:0,revisionIncrements:0});
 const f=r.beginFrame();f.set(a,1);f.commit({advanceRevision:false});
 expect({...stats}).toMatchObject({slotWrites:1,equalityChecks:1,revisionIncrements:0});expect(r.revision()).toBe(0);
 resetProductionSubstrateStatsForTesting(stats);const noop=r.beginFrame();noop.set(a,1);noop.commit();
 expect({...stats}).toMatchObject({slotWrites:0,equalityChecks:1,revisionIncrements:0});
 resetProductionSubstrateStatsForTesting(stats);r.commitSlot(a,2);
 expect({...stats}).toMatchObject({slotWrites:1,equalityChecks:1,revisionIncrements:1});expect(r.readSlot(a)).toBe(2);
});
it('counts fresh equality throws without counting uninstalled writes',()=>{
 const stats=installProductionSubstrateStatsForTesting(),r=createTreeScalarSlotRuntime();const error=new Error('equality');
 const a=r.createSlot(0,Object.is),b=r.createSlot(1,()=>{throw error;});
 const f=r.beginFrame();f.set(a,10);f.set(b,11);expect(()=>f.prepareCommit()).toThrow(error);
 expect({...stats}).toMatchObject({slotReads:0,slotWrites:0,equalityChecks:2,revisionIncrements:0});
 expect(r.readSlot(a)).toBe(0);expect(r.readSlot(b)).toBe(1);expect(r.revision()).toBe(0);
});
it('stale install counts only the independently installed write',()=>{
 const stats=installProductionSubstrateStatsForTesting(),r=createTreeScalarSlotRuntime();const a=r.createSlot(0,Object.is),b=r.createSlot(0,Object.is);
 const f=r.beginFrame();f.set(a,1);const install=f.prepareCommit();r.commitRecorded(b,2);
 expect(()=>install()).toThrow('Stale prepared');
 expect({...stats}).toMatchObject({slotReads:0,slotWrites:1,equalityChecks:2,revisionIncrements:1});
 expect(r.readSlot(a)).toBe(0);expect(r.readSlot(b)).toBe(2);
});
it('reentry counts the surviving nested write but never the refused outer installation',()=>{
 const stats=installProductionSubstrateStatsForTesting(),r=createTreeScalarSlotRuntime();const b=r.createSlot(0,Object.is);
 const a=r.createSlot(0,()=>{r.commitSlot(b,2);return false;});
 const f=r.beginFrame();f.set(a,1);expect(()=>f.prepareCommit()).toThrow('Reentrant scalar preparation');
 expect({...stats}).toMatchObject({slotReads:0,slotWrites:1,equalityChecks:2,revisionIncrements:1});
 expect(r.readSlot(a)).toBe(0);expect(r.readSlot(b)).toBe(2);
});
it('ordinary authority-only frame advances revision without assigning equal physical value',()=>{
 const stats=installProductionSubstrateStatsForTesting(),r=createTreeScalarSlotRuntime();const a=r.createSlot(0,Object.is);
 withWriteContext({participation:'inspection'},()=>r.commitRecorded(a,1));
 resetProductionSubstrateStatsForTesting(stats);const f=r.beginFrame();f.set(a,1);f.commit();
 expect({...stats}).toMatchObject({slotWrites:0,revisionIncrements:1,equalityChecks:2});expect(r.readSlot(a)).toBe(1);
 resetProductionSubstrateStatsForTesting(stats);r.commitRecorded(a,2);
 expect({...stats}).toMatchObject({slotWrites:1,revisionIncrements:1,equalityChecks:1});
});
it('recorded shadow comparison counts both actual equality calls',()=>{
 const stats=installProductionSubstrateStatsForTesting(),r=createTreeScalarSlotRuntime();const a=r.createSlot(0,Object.is);
 withWriteContext({participation:'inspection'},()=>r.commitRecorded(a,1));resetProductionSubstrateStatsForTesting(stats);
 r.commitRecorded(a,1);
 expect({...stats}).toMatchObject({slotWrites:1,revisionIncrements:1,equalityChecks:2,slotReads:0});
});
