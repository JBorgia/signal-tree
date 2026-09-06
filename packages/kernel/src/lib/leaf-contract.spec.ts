import { describe, expect, it, vi } from 'vitest';

import { entityMap } from './markers/entity-map';
import {
  isLeafDefinition,
  leaf,
  leafDefinitionValue,
} from './leaf';
import { signalTree } from './signal-tree';

describe('explicit terminal leaves', () => {
  it('stops object topology and stores the raw value', () => {
    const range = { start: 0, end: 10 };
    const tree = signalTree({
      range: leaf(range),
      branch: { value: 1 },
    });

    expect(tree.$.range()).toBe(range);
    expect('start' in tree.$.range).toBe(false);
    expect(tree.$()).toEqual({ range, branch: { value: 1 } });

    tree.$.range({ start: 2, end: 8 });
    expect(tree.$.range()).toEqual({ start: 2, end: 8 });
  });

  it('stores callable and constructable values without invoking them', () => {
    const first = vi.fn();
    const second = vi.fn();
    let constructed = 0;
    class Thing {
      constructor() {
        constructed += 1;
      }
    }
    const tree = signalTree({
      callback: leaf<null | (() => void)>(first),
      constructor: leaf<typeof Thing | null>(null),
    });

    tree.$.callback(leaf(second));
    tree.$.constructor(leaf(Thing));

    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
    expect(constructed).toBe(0);
    expect(tree.$.callback()).toBe(second);
    expect(tree.$.constructor()).toBe(Thing);
  });

  it('derives function-valued state from a naked updater', () => {
    const first = () => 'first';
    const second = () => 'second';
    const tree = signalTree({ callback: leaf(first) });
    let received: unknown;

    tree.$.callback((current) => {
      received = current;
      return second;
    });

    expect(received).toBe(first);
    expect(tree.$.callback()).toBe(second);
  });

  it('does not let leaf() suppress a semantic marker', () => {
    expect(() =>
      signalTree({
        rows: leaf(entityMap<{ id: number }, number>()),
      })
    ).toThrow('leaf() cannot wrap a semantic marker');
  });

  it('shares its nominal brand across module copies without accepting lookalikes', () => {
    const forged = {
      [Symbol.for('SignalTree:LeafDefinition')]: 'forged',
    };
    const inherited = Object.create(forged) as object;
    const actual = leaf('actual');
    const crossInstance = {};
    Object.defineProperty(
      crossInstance,
      Symbol.for('SignalTree:LeafDefinition'),
      { value: 'cross-instance' }
    );

    expect(isLeafDefinition(forged)).toBe(false);
    expect(isLeafDefinition(inherited)).toBe(false);
    expect(isLeafDefinition({ ...actual })).toBe(false);
    expect(isLeafDefinition(actual)).toBe(true);
    expect(isLeafDefinition(crossInstance)).toBe(true);
    expect(leafDefinitionValue(crossInstance as never)).toBe('cross-instance');
  });
});
