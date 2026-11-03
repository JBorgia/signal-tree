import { describe, expect, it } from 'vitest';
import { preparePublicationMutations } from './intrinsic-mutation';
import { createTreeScalarLeafRuntime } from './tree-scalar-leaf-runtime';
import { createNativeTreeScalarLeafRuntime } from './native-tree-scalar-leaf-runtime';
import { replaceLocation } from './location-runtime';
import type { ObservationAdapter } from './observation-adapter';
import type { WritableCell } from './cell-runtime';

// These are controlled source-admission faults, not process/OOM guarantees.
function fixture(native: boolean) {
  let notify: () => void = () => undefined;
  const adapter: ObservationAdapter = {
    createToken: () => ({observe: () => undefined, invalidate: () => notify()}),
    runInvalidationGroup: run => run(),
    createWritableCell: <T>(read: () => T) => {
      const cell: WritableCell<T> = Object.assign(() => read(), {
        set: (_value: T) => undefined,
        update: (_fn: (current: T) => T) => undefined,
        asReadonly: () => read,
      });
      return {cell, peek: read, token: {observe: () => undefined, invalidate: () => notify()}};
    },
  };
  const runtime = native ? createNativeTreeScalarLeafRuntime(undefined, adapter) : createTreeScalarLeafRuntime(undefined);
  const leaf = runtime.createLeaf<number>(7, Object.is);
  const other = runtime.createLeaf<number>(0, Object.is);
  const write = (value: number) => replaceLocation(leaf,value);
  const writeOther = (value: number) => replaceLocation(other,value);
  return {leaf, other, write, writeOther, observe(fn: () => void) {if(native)notify=fn;else leaf.subscribe(fn);}};
}

for (const native of [false, true]) describe(`A1 installed publication source (${native ? 'native' : 'neutral'})`, () => {
  it('installs responsibility before observers and completes afterward', () => {
    const f = fixture(native), records = new Map<unknown, unknown>(), key = {}, events: string[] = [];
    const release = preparePublicationMutations(f.leaf, m => ({record: {writes: [{map:records,key,value:m.after}],adds:[]}, completion:{}}), () => events.push('complete'))!;
    f.observe(() => {expect(f.leaf()).toBe(8);expect(records.get(key)).toBe(8);events.push('observe');});
    f.write(8);
    expect(events).toEqual(['observe','complete']);
    release();
  });
  it('preparation failure leaves value and prepared responsibility untouched', () => {
    const f=fixture(native), records=new Map<unknown,unknown>(), key={}, failure=Object.freeze({failure:'prepare'});
    let complete=0;
    const a=preparePublicationMutations(f.leaf, () => ({record:{writes:[{map:records,key,value:8}],adds:[]},completion:{}}), () => complete++)!;
    const b=preparePublicationMutations(f.leaf, () => {throw failure;}, () => complete++)!;
    for(let i=0;i<5;i++)expect(()=>f.write(8)).toThrow(failure);
    expect(f.leaf()).toBe(7);expect(records.size).toBe(0);expect(complete).toBe(0);
    b();f.write(8);expect(f.leaf()).toBe(8);expect(records.get(key)).toBe(8);expect(complete).toBe(1);a();
  });
  it('revision validation preserves preparation reentry and rejects stale outer installation', () => {
    const f=fixture(native), records=new Map<unknown,unknown>(), key={};
    const release=preparePublicationMutations(f.leaf,()=>{f.writeOther(9);return {record:{writes:[{map:records,key,value:8}],adds:[]},completion:{}};},()=>undefined)!;
    expect(()=>f.write(8)).toThrow('Terminal preparation reentered physical installation');
    expect(f.leaf()).toBe(7);expect(f.other()).toBe(9);expect(records.size).toBe(0);release();
  });
  it('equal-value admission completes without a value notification', () => {
    const f=fixture(native), records=new Map<unknown,unknown>(), key={};let notifications=0,complete=0;
    f.observe(()=>notifications++);
    const release=preparePublicationMutations(f.leaf,m=>{expect(m.changed).toBe(false);return {record:{writes:[{map:records,key,value:'new-support'}],adds:[]},completion:{}};},()=>complete++)!;
    f.write(7);expect(f.leaf()).toBe(7);expect(records.get(key)).toBe('new-support');expect(notifications).toBe(0);expect(complete).toBe(1);release();
  });
  it('completion survives synchronous release and reentry after installation', () => {
    const f=fixture(native), records=new Map<unknown,unknown>(), key={};let complete=0;
    const release=preparePublicationMutations(f.leaf,m=>({record:{writes:[{map:records,key,value:m.after}],adds:[]},completion:{}}),()=>complete++)!;
    f.observe(()=>{if(f.leaf()===8){release();f.write(9);}});
    f.write(8);expect(f.leaf()).toBe(9);expect(records.get(key)).toBe(8);expect(complete).toBe(1);
  });
});
