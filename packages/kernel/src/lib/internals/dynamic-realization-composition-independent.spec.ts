import { describe, expect, it } from 'vitest';
import { signalTree, createSignalTreeFactory } from '../signal-tree';
import { transactions } from '../../enhancers/transactions/transactions';
import { getPathNotifier } from '../path-notifier';
import { getActiveWriteContext, withWriteContext } from '../write-context';
import type { WriteMetadata } from '../types';
import { createTreeScalarLeafRuntime } from './tree-scalar-leaf-runtime';
import { createNativeTreeScalarLeafRuntime } from './native-tree-scalar-leaf-runtime';
import { prepareTerminalMutations, preparePublicationMutations } from './intrinsic-mutation';
import { replaceLocation } from './location-runtime';
import type { ObservationAdapter } from './observation-adapter';
import type { WritableCell } from './cell-runtime';
import { scalarAdmissionMetadata } from './scalar-admission-metadata';
import { getTreeScalarSlotRuntime } from './tree-scalar-slot-port';
import { getOwnedPositionIds } from './owned-mutation';

// Existing a1-publication-installation pattern: actual native kernel carrier,
// controlled observation adapter; not a claim about framework UI scheduling.
const observation: ObservationAdapter = {
  createToken: () => ({ observe: () => undefined, invalidate: () => undefined }),
  runInvalidationGroup: run => run(),
  createWritableCell: <T>(read: () => T) => {
    const cell: WritableCell<T> = Object.assign(() => read(), {
      set: (_value: T) => undefined,
      update: (_fn: (current: T) => T) => undefined,
      asReadonly: () => read,
    });
    return { cell, peek: read, token: { observe: () => undefined, invalidate: () => undefined } };
  },
};
const nativeTree = createSignalTreeFactory(observation, clock => createNativeTreeScalarLeafRuntime(clock, observation));
const ambient: WriteMetadata = { transactionId: 73, transactionOwner: {}, participation: 'authored' };


// Added composition controls: sources are created AFTER enhancer enrollment.
for (const native of [false,true]) {
 for (const method of ['prepareCommit','commit'] as const) it(`dynamic exact attempt ${native}/${method}`,()=>{
  const tree=(native?nativeTree:signalTree)({a:0,rows:{} as Record<string,number>,c:0},{enhancers:[transactions()]});
  tree.$.rows({b:0});
  const b=tree.$.rows.b as import('./cell-runtime').Location<number>;
  expect(typeof b).toBe('function');
  const flags:Array<string|undefined>=[];
  const off=preparePublicationMutations(b,m=>{flags.push(m.admissionParticipation);return undefined;},()=>undefined)!;
  try{
   const runtime=getTreeScalarSlotRuntime(tree.$)!;const slot=runtime.resolveScalarSlot(getOwnedPositionIds(b)![0])!;
   const pending=tree.transact(()=>{
    replaceLocation(tree.$.a,1);const context=getActiveWriteContext();
    const frame=runtime.beginFrame();frame.set(slot,2);
    if(method==='prepareCommit')frame.prepareCommit!({admissionParticipation:'realized'})();else frame.commit({admissionParticipation:'realized'});
    expect(getActiveWriteContext()).toBe(context);replaceLocation(tree.$.c,3);
   });
   getPathNotifier().flushSync();expect(tree.$()).toEqual({a:1,rows:{b:2},c:3});expect(flags).toEqual(['realized']);
   pending.rollback();getPathNotifier().flushSync();expect(tree.$()).toEqual({a:0,rows:{b:2},c:0});expect(tree.$.rows.b).toBe(b);
   const next=tree.transact(()=>replaceLocation(b,4));expect(b()).toBe(4);expect(flags.at(-1)).toBeUndefined();next.rollback();getPathNotifier().flushSync();expect(b()).toBe(2);
  }finally{off();tree.destroy();}
 });
 for (const same of [false,true]) it(`dynamic reentrant write retains its own authored attempt ${native}/${same}`,()=>{
  const tree=(native?nativeTree:signalTree)({a:0,rows:{} as Record<string,number>,c:0},{enhancers:[transactions()]});tree.$.rows({b:0,d:0});
  const b=tree.$.rows.b as import('./cell-runtime').Location<number>,d=tree.$.rows.d as import('./cell-runtime').Location<number>;expect(typeof b).toBe('function');expect(typeof d).toBe('function');
  let entered=0;const flags:Array<string|undefined>=[];
  const off=preparePublicationMutations(b,m=>{flags.push(m.admissionParticipation);if(m.after===7){entered++;replaceLocation(same?b:d,9);}return undefined;},()=>undefined)!;
  try{
   const runtime=getTreeScalarSlotRuntime(tree.$)!;const slot=runtime.resolveScalarSlot(getOwnedPositionIds(b)![0])!;
   const pending=tree.transact(()=>{
    replaceLocation(tree.$.a,1);const context=getActiveWriteContext();const frame=runtime.beginFrame();frame.set(slot,7);
    expect(()=>frame.prepareCommit!({admissionParticipation:'realized'})).toThrow('Reentrant scalar preparation');expect(getActiveWriteContext()).toBe(context);replaceLocation(tree.$.c,3);
   });
   expect(entered).toBe(1);expect(flags).toEqual(same?['realized',undefined]:['realized']);getPathNotifier().flushSync();
   expect(tree.$()).toEqual({a:1,rows:{b:same?9:0,d:same?0:9},c:3});pending.rollback();getPathNotifier().flushSync();expect(tree.$()).toEqual({a:0,rows:{b:0,d:0},c:0});expect(tree.$.rows.b).toBe(b);
  }finally{off();tree.destroy();}
 });
}
