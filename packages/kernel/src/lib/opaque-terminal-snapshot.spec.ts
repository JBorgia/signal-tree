import { describe, expect, it, vi } from 'vitest';
import { entityMap, leaf, signalTree } from '../index';
import { NEUTRAL_LOCATION_RUNTIME } from './internals/location-runtime';
import { stampDerived, unwrap } from './utils';

describe('canonical snapshots preserve opaque terminal payloads', () => {
  it('preserves callable properties and nested marker definitions through root round-trip', () => {
    const callback = vi.fn();
    const marker = entityMap<{ id: string }>();
    const payload = { callback, marker };
    const tree = signalTree({ terminal: leaf(payload), sibling: 0 });
    const error = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    try {
      const snapshot = tree.$();
      expect(snapshot.terminal.callback).toBe(callback);
      expect(snapshot.terminal.marker.build).toBe(marker.build);
      expect(snapshot.terminal.marker.computed).toBe(marker.computed);
      tree.$(snapshot);
      expect(tree.$.terminal().callback).toBe(callback);
      expect(tree.$.terminal().marker).toBe(marker);
      expect(callback).not.toHaveBeenCalled();
      expect(
        error.mock.calls.some(([message]) => String(message).includes('ST2008'))
      ).toBe(false);
    } finally {
      error.mockRestore();
      tree.destroy();
    }
  });

  it('preserves terminal payload identity in branch/root reads and updater input', () => {
    const payload = { fn: () => 1 };
    const tree = signalTree({ nested: { terminal: leaf(payload), count: 0 } });
    try {
      expect(tree.$.nested().terminal).toBe(payload);
      expect(tree.$().nested.terminal).toBe(payload);
      tree.$((current) => {
        expect(current.nested.terminal).toBe(payload);
        return { nested: { ...current.nested, count: 1 } };
      });
      expect(tree.$.nested().terminal).toBe(payload);
    } finally {
      tree.destroy();
    }
  });

  it.each(['direct', 'string', 'symbol'] as const)(
    'stops at a terminal through the %s walker path',
    (path) => {
      const key = Symbol('payload');
      const payload = {
        callback: () => 1,
        [Symbol.for('SignalTree:payload-data')]: 2,
      };
      const cell = NEUTRAL_LOCATION_RUNTIME.createCell(payload);
      const result =
        path === 'direct'
          ? unwrap(cell)
          : path === 'string'
          ? unwrap<{ terminal: typeof payload }>({ terminal: cell }).terminal
          : unwrap<{ [key]: typeof payload }>({ [key]: cell })[key];
      expect(result).toBe(payload);
    }
  );

  it('preserves Date, Map, Set, arrays and a cyclic leaf through snapshot restore', () => {
    const cyclic: { self?: unknown; fn: () => number } = { fn: () => 1 };
    cyclic.self = cyclic;
    const payload = {
      date: new Date(1),
      map: new Map([['a', 1]]),
      set: new Set([2]),
      array: [cyclic],
      cyclic,
    };
    const tree = signalTree({ terminal: leaf(payload) });
    try {
      const snapshot = tree.$();
      expect(snapshot.terminal).toBe(payload);
      expect(snapshot.terminal.cyclic.self).toBe(cyclic);
      tree.$(snapshot);
      expect(tree.$.terminal()).toBe(payload);
    } finally {
      tree.destroy();
    }
  });

  it('does not interpret a computed marker or reactive callable inside opaque state', () => {
    const compute = vi.fn(() => 42);
    const marker = entityMap<{ id: string }>().computed('totalRows', compute);
    const derived = stampDerived(
      NEUTRAL_LOCATION_RUNTIME.createDerived(compute)
    );
    const payload = { marker, derived };
    const tree = signalTree({ terminal: leaf(payload) });
    try {
      expect(tree.$().terminal.marker).toBe(marker);
      expect(tree.$().terminal.derived).toBe(derived);
      expect(compute).not.toHaveBeenCalled();
      expect(unwrap({ terminal: tree.$.terminal, derived })).toEqual({
        terminal: payload,
      });
    } finally {
      tree.destroy();
    }
  });
});
