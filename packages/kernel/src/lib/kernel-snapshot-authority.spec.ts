import { describe, expect, it } from 'vitest';

import { signalTree } from './signal-tree';
import { entityMap } from './markers/entity-map';
import { registerMarkerProcessor } from './internals/materialize-markers';

type Row = { id: number; value: number };

describe('KERNEL-SNAPSHOT-AUTHORITY-0', () => {
  it('preserves root identity until semantic truth changes', () => {
    const tree = signalTree({ count: 1, nested: { value: 2 } });
    const initial = tree.$();

    expect(tree.$()).toBe(initial);

    tree.$.count(1);
    expect(tree.$()).toBe(initial);

    tree.$.count(2);
    expect(tree.$()).not.toBe(initial);
  });

  it('implementation control: rebuilds only the changed path and reuses an unchanged sibling', () => {
    const tree = signalTree({ left: { value: 1 }, right: { value: 2 } });
    const before = tree.$();

    tree.$.left.value(3);
    const after = tree.$();

    expect(after).not.toBe(before);
    expect(after.left).not.toBe(before.left);
    expect(after.right).toBe(before.right);
  });

  it('stays current when a dirty child is read between writes before its root', () => {
    const tree = signalTree({
      branch: { nested: { value: 1 } },
      sibling: { value: 2 },
    });
    const before = tree.$();

    tree.$.branch.nested.value(3);
    expect(tree.$.branch.nested()).toEqual({ value: 3 });

    tree.$.branch.nested.value(4);
    const after = tree.$();

    expect(after.branch.nested.value).toBe(4);
    expect(after.sibling).toBe(before.sibling);
  });

  it('invalidates membership omission and same-value reactivation synchronously', () => {
    const tree = signalTree({
      user: { name: 'Ada', age: 42 as number | undefined },
    });
    const before = tree.$();

    (tree.$.user as unknown as (value: { name: string }) => void)({
      name: 'Grace',
    });
    const omitted = tree.$();

    expect(omitted).not.toBe(before);
    expect(omitted.user).toEqual({ name: 'Grace' });

    (tree.$.user as unknown as (
      value: { name: string; age: number }
    ) => void)({ name: 'Grace', age: 42 });
    const reactivated = tree.$();

    expect(reactivated).not.toBe(omitted);
    expect(reactivated.user).toEqual({ name: 'Grace', age: 42 });
  });

  it('invalidates an EntityMap snapshot while retaining unrelated tree state', () => {
    const tree = signalTree({
      rows: entityMap<Row, number>({ selectId: (row) => row.id }),
      settings: { pageSize: 25 },
    });
    tree.$.rows.setAll([
      { id: 1, value: 10 },
      { id: 2, value: 20 },
    ]);
    const before = tree.$();

    tree.$.rows.updateOne(2, { value: 21 });
    const after = tree.$();

    expect(after).not.toBe(before);
    expect(after.rows).not.toBe(before.rows);
    expect(after.settings).toBe(before.settings);
    const rows = after.rows as unknown as { all: Row[] };
    expect(rows.all.find((row) => row.id === 2)?.value).toBe(21);
  });

  it('implementation control: reuses an independent EntityMap snapshot across unrelated writes', () => {
    const tree = signalTree({
      left: entityMap<Row, number>({ selectId: (row) => row.id }),
      right: entityMap<Row, number>({ selectId: (row) => row.id }),
    });
    tree.$.left.addOne({ id: 1, value: 10 });
    tree.$.right.addOne({ id: 2, value: 20 });
    const before = tree.$();

    tree.$.left.updateOne(1, { value: 11 });
    const after = tree.$();

    expect(after.left).not.toBe(before.left);
    expect(after.right).toBe(before.right);
  });

  it('never caches a public custom marker without snapshot-change evidence', () => {
    const CUSTOM = Symbol('ksa-custom-marker');
    type Marker = { [CUSTOM]: true; initial: number };
    type Node = { current: number; increment(): void };

    registerMarkerProcessor<Marker, Node>(
      (value): value is Marker =>
        typeof value === 'object' && value !== null && CUSTOM in value,
      (marker) => {
        const node: Node = {
          current: marker.initial,
          increment: () => node.current++,
        };
        return node;
      },
      { snapshot: (node) => node.current }
    );

    const tree = signalTree({
      custom: { [CUSTOM]: true, initial: 1 } as Marker,
    });
    expect(tree.$().custom).toBe(1);

    (tree.$.custom as unknown as Node).increment();

    expect(tree.$().custom).toBe(2);
  });
});
