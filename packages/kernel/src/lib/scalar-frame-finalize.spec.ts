import { expect, it } from 'vitest';
import { registerNativePublicationFactory } from './internals/intrinsic-mutation';
import { createTreeScalarLeafRuntime } from './internals/tree-scalar-leaf-runtime';
import { createNativeTreeScalarLeafRuntime } from './internals/native-tree-scalar-leaf-runtime';
import type { ObservationAdapter } from './internals/observation-adapter';

// Isolated native-participant protocol fixture; no experimental recipient
// authority or production factory is replaced. Installed records remain private.
let failNode: object | undefined;
const records = new Map<object, unknown>();
const failure = new Error('native finalization');
const completed: object[] = [];
registerNativePublicationFactory((node) => ({
  captureInput: () => undefined,
  prepare: (mutation) => ({
    record: {
      writes: [{ map: records, key: node, value: mutation.after }],
      adds: [],
    },
    completion: node,
    finalize: () => {
      if (node === failNode) throw failure;
    },
  }),
  complete: (value) => {
    completed.push(value);
  },
}));
const adapter: ObservationAdapter = {
  createToken: () => ({ observe() {}, invalidate() {} }),
  runInvalidationGroup: (run) => run(),
  createWritableCell: <T>(read: () => T) => {
    const cell = Object.assign(read, {
      set: (_value: T) => {},
      update: (_f: (value: T) => T) => {},
      asReadonly: () => cell,
    });
    return { cell, peek: read, token: { observe() {}, invalidate() {} } };
  },
};
for (const native of [false, true])
  it(`last scalar source finalization fails before any stores (native=${native})`, () => {
    records.clear();
    completed.length = 0;
    const runtime = native
      ? createNativeTreeScalarLeafRuntime(undefined, adapter)
      : createTreeScalarLeafRuntime(undefined);
    const a = runtime.createLeaf<number>(0, Object.is),
      b = runtime.createLeaf<number>(0, Object.is);
    failNode = b;
    const f = runtime.beginFrame();
    f.set(0, 1);
    f.set(1, 2);
    try {
      expect(() => f.prepareCommit!({ publish: false })).toThrow(failure);
      expect([a(), b()]).toEqual([0, 0]);
      expect(records.size).toBe(0);
      expect(completed).toEqual([]);
    } finally {
      failNode = undefined;
    }
  });
