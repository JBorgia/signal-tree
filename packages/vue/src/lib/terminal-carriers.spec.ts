import { isRef } from 'vue';
import { describe, expect, it } from 'vitest';

import { leaf, signalTree, type LeafDefinition } from '../index';

describe('terminal carrier identity', () => {
  it('keeps built-ins, typed functions and constructors in terminal refs', () => {
    class Example {
      constructor(readonly label: string) {}
    }
    const values = {
      weakMap: new WeakMap<object, string>(),
      weakSet: new WeakSet<object>(),
      bytes: new Uint8Array(2),
      buffer: new ArrayBuffer(2),
      view: new DataView(new ArrayBuffer(2)),
      promise: Promise.resolve(1),
      fn: (text: string) => text.length,
      ctor: Example,
    };
    const tree = signalTree(values);
    try {
      const snapshot = tree.$();
      for (const key of Object.keys(values) as (keyof typeof values)[]) {
        expect(isRef(tree.$[key])).toBe(true);
        expect(tree.$[key].value).toBe(values[key]);
        expect(snapshot[key]).toBe(values[key]);
      }
      expect(tree.$.fn.value('hello')).toBe(5);
      expect(new tree.$.ctor.value('hello').label).toBe('hello');
      expect('get' in tree.$.weakMap).toBe(false);
      expect('has' in tree.$.weakSet).toBe(false);
      expect('0' in tree.$.bytes).toBe(false);
      expect('getUint8' in tree.$.view).toBe(false);
      expect('then' in tree.$.promise).toBe(false);
    } finally {
      tree.destroy();
    }
  });

  it('unwraps optional and union leaf definitions in locations and root snapshots', () => {
    const payload = { a: 1 };
    const optionalDefinition: { data?: LeafDefinition<typeof payload> } = {
      data: leaf(payload),
    };
    const unionDefinition: { data: LeafDefinition<number> | string } = {
      data: leaf(1),
    };
    const optional = signalTree(optionalDefinition);
    const union = signalTree(unionDefinition);
    try {
      expect(optional.$.data?.value).toBe(payload);
      expect(optional.$().data).toEqual(payload);
      expect(union.$.data.value).toBe(1);
      expect(union.$().data).toBe(1);
      union.$.data.value = 'updated';
      expect(union.$().data).toBe('updated');
    } finally {
      optional.destroy();
      union.destroy();
    }
  });
});
