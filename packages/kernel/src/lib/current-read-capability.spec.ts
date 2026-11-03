import {describe, expect, it} from 'vitest';
import {createSignalTreeFactory, type ObservationAdapter} from '../adapter';
import {entityMap} from './markers/entity-map';
import {createSignalTreeFactory as internalFactory} from './signal-tree';
import {createLocationRuntime} from './internals/location-runtime';
import {createNativeLocationRuntime} from './internals/native-location-realization';

const neutral = (): ObservationAdapter => ({
  createToken: () => ({observe() {}, invalidate() {}}),
  runInvalidationGroup: run => run(),
});
const writable = <T>(read: () => T) => Object.assign(() => read(), {
  set: (_value: T) => {}, update: (_change: (value: T) => T) => {}, asReadonly: () => read,
});
describe('current-read capability construction boundary', () => {
  for (let mask = 1; mask <= 7; mask++) {
    it(`preserves classification for legacy factory mask ${mask}`, () => {
      let tokens = 0, nativeCalls = 0;
      const adapter: ObservationAdapter = {
        ...neutral(), createToken() {tokens++; return {observe(){},invalidate(){}};},
        ...(mask & 1 ? {createWritableCell: <T>(read: () => T) => {nativeCalls++; return {cell:writable(read), peek:read, token:{observe(){},invalidate(){}}};}} : {}),
        ...(mask & 2 ? {createWritableProjection: <T>(read: () => T) => {nativeCalls++; return {cell:writable(read), peek:read};}} : {}),
        ...(mask & 4 ? {createReadonlyCell: <T>(read: () => T) => {nativeCalls++; return read;}} : {}),
      };
      if (mask === 7) {
        let getters = 0;
        const initial = {get value() {getters++; return 1;}};
        expect(() => createSignalTreeFactory(adapter)(initial)).toThrow(/require createCurrentReadonlyCell/);
        expect(getters).toBe(0); expect(tokens).toBe(0); expect(nativeCalls).toBe(0);
      } else {
        const tree = createSignalTreeFactory(adapter)({value:1, rows:entityMap<{id:string}, string>()});
        try {
          expect(tree.$.value()).toBe(1); tree.$.value(2); expect(tree.$.value()).toBe(2);
          let callbacks = 0;
          tree.$.rows.tap({onAdd: () => {callbacks++; expect(tree.$.rows.ids()).toEqual(['A']);}});
          tree.$.rows.addOne({id:'A'}); expect(callbacks).toBe(1); expect(nativeCalls).toBe(0);
        } finally {tree.destroy();}
      }
      // The internal default factory has always selected portable locations,
      // independently of unused native factory properties.
      const portable = internalFactory(adapter)({value:1});
      expect(portable.$.value()).toBe(1); portable.destroy(); expect(nativeCalls).toBe(0);
    });
    it(`accepts migrated mask ${mask} without changing native routing`, () => {
      let nativeScalar = 0, capabilityCalls = 0;
      const adapter: ObservationAdapter = {
        ...neutral(),
        createCurrentReadonlyCell<T>(read: () => T) {expect(this).toBe(adapter); capabilityCalls++; return read;},
        ...(mask & 1 ? {createWritableCell: <T>(read: () => T) => {nativeScalar++; return {cell:writable(read), peek:read, token:{observe(){},invalidate(){}}};}} : {}),
        ...(mask & 2 ? {createWritableProjection: <T>(read: () => T) => ({cell:writable(read), peek:read})} : {}),
        ...(mask & 4 ? {createReadonlyCell: <T>(read: () => T) => read} : {}),
      };
      const factory = createSignalTreeFactory(adapter);
      expect(capabilityCalls).toBe(0);
      adapter.createCurrentReadonlyCell = () => {throw new Error('unbound replacement');};
      const tree = factory({value:1, rows:entityMap<{id:string}, string>()});
      try {
        expect(tree.$.value()).toBe(1); expect(nativeScalar > 0).toBe(mask === 7);
        let callbacks = 0;
        tree.$.rows.tap({onAdd: () => {callbacks++; expect(tree.$.rows.ids()).toEqual(['A']);}});
        tree.$.rows.addOne({id:'A'}); expect(callbacks).toBe(1); expect(capabilityCalls).toBeGreaterThan(0);
      }
      finally {tree.destroy();}
    });
  }
  it('keeps neutral and capability-only adapters portable; binds the optional method', () => {
    const tree = createSignalTreeFactory(neutral())({value:1});
    tree.$.value(2); expect(tree.$.value()).toBe(2); tree.destroy();
    let value = 1, calls = 0;
    const adapter = {...neutral(), createCurrentReadonlyCell<T>(read: () => T) {
      expect(this).toBe(adapter); calls++; return read;
    }};
    const tree2 = createSignalTreeFactory(adapter)({value:1});
    tree2.$.value(2); expect(tree2.$.value()).toBe(2); tree2.destroy();
    const reader = createLocationRuntime(adapter).createCurrentReadonly(() => value);
    expect(reader()).toBe(1); value = 2; expect(reader()).toBe(2); expect(calls).toBe(1);
  });
  it('propagates capability failure instead of substituting a bare callable', () => {
    const adapter: ObservationAdapter = {...neutral(), createCurrentReadonlyCell() {throw new Error('failed realization');}};
    for (const runtime of [createLocationRuntime(adapter), createNativeLocationRuntime(adapter)]) {
      expect(() => runtime.createCurrentReadonly(() => 1)).toThrow('failed realization');
    }
  });
});
