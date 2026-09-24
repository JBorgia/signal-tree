import { describe, expect, it, vi } from 'vitest';
import { entityMap, link, signalTree, type Location } from '../index';

type Row = { id: string; [key: string]: unknown };
const keys = ['__proto__', 'constructor', 'prototype', 'inherited'];
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const row = (key: string): Row => ({ id: 'a', [key]: 1 });
const omitted = (): Row =>
  Object.assign(Object.create({ inherited: 999 }), { id: 'a' });
function setup(key: string) {
  const tree = signalTree({ rows: entityMap<Row, string>() });
  tree.$.rows.addOne(row(key));
  const node = tree.$.rows.byId('a')!;
  const field = node[key] as Location<unknown>;
  return { tree, node, field };
}

describe('entity own-property audit through public locations', () => {
  for (const key of keys) {
    for (const receive of [false, true]) {
      it(`${key}: omission by ${
        receive ? 'Link receive' : 'replacement'
      } reads undefined and re-add observes fresh own value`, async () => {
        const { tree, field } = setup(key);
        let inbound!: (value: Row[]) => void;
        const connection = link(tree.$.rows, {
          subscribe: (cb) => {
            inbound = cb;
            return vi.fn();
          },
        });
        try {
          if (receive) inbound([omitted()]);
          else tree.$.rows.replaceOne('a', omitted());
          expect(field()).toBeUndefined();
          tree.$.rows.updateOne('a', { [key]: 7 });
          expect(field()).toBe(7);
        } finally {
          connection.dispose();
          tree.destroy();
        }
      });
      it(`${key}: field Link sends undefined after ${
        receive ? 'collection receive' : 'replacement'
      }`, async () => {
        const { tree, field } = setup(key);
        await flush();
        const send = vi.fn();
        const outbound = link(field, { set: send });
        let inbound!: (value: Row[]) => void;
        const collection = link(tree.$.rows, {
          subscribe: (cb) => {
            inbound = cb;
            return vi.fn();
          },
        });
        try {
          if (receive) inbound([omitted()]);
          else tree.$.rows.replaceOne('a', omitted());
          await flush();
          await outbound.settled();
          expect(send.mock.calls).toEqual([[undefined]]);
        } finally {
          collection.dispose();
          outbound.dispose();
          tree.destroy();
        }
      });
    }
    it(`${key}: updater receives undefined and writes an own field`, () => {
      const { tree, node, field } = setup(key);
      try {
        tree.$.rows.replaceOne('a', omitted());
        const update = vi.fn((_value: unknown) => 8);
        field(update);
        expect(update.mock.calls).toEqual([[undefined]]);
        expect(Object.prototype.hasOwnProperty.call(node(), key)).toBe(true);
        expect(field()).toBe(8);
        expect(Object.getPrototypeOf(node())).toBe(Object.prototype);
      } finally {
        tree.destroy();
      }
    });
    it(`${key}: held setter and field Link receive create own data without prototype writes`, async () => {
      const { tree, node, field } = setup(key);
      const descriptors = Object.getOwnPropertyDescriptors(Object.prototype);
      let inbound!: (value: unknown) => void;
      const connection = link(field, {
        subscribe: (cb) => {
          inbound = cb;
          return vi.fn();
        },
      });
      try {
        tree.$.rows.replaceOne('a', omitted());
        field(8);
        expect(field()).toBe(8);
        expect(Object.prototype.hasOwnProperty.call(node(), key)).toBe(true);
        tree.$.rows.replaceOne('a', omitted());
        inbound(9);
        await flush();
        expect(field()).toBe(9);
        expect(Object.prototype.hasOwnProperty.call(node(), key)).toBe(true);
        expect(Object.getPrototypeOf(node())).toBe(Object.prototype);
        expect(Object.getOwnPropertyDescriptors(Object.prototype)).toEqual(
          descriptors
        );
      } finally {
        connection.dispose();
        tree.destroy();
      }
    });
    it(`${key}: present own getter retains value and receiver`, () => {
      const { tree, field } = setup(key);
      const replacement: Row = { id: 'a', value: 42 };
      const getter = vi.fn(function (this: Row) {
        return this['value'];
      });
      Object.defineProperty(replacement, key, {
        get: getter,
        enumerable: true,
        configurable: true,
      });
      try {
        tree.$.rows.replaceOne('a', replacement);
        expect(field()).toBe(42);
        expect(getter.mock.contexts).toContain(replacement);
      } finally {
        tree.destroy();
      }
    });
  }
});
