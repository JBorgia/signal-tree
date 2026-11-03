import { expect, it } from 'vitest';
import { entityMap, transactions } from '../index';
import { createReactiveTestRealization } from '../reactive-test-realization';
import { createSignalTreeFactory } from './signal-tree';
import { registerMembershipPublication } from './internals/intrinsic-mutation';
import { snapshotMarkerNode } from './internals/materialize-markers';
import { MATERIALIZED } from './internals/snapshot-installation';

const realization = createReactiveTestRealization();
const signalTree = createSignalTreeFactory(realization);
const computed = realization.locations.createDerived;
type Row = { id: string; n: number };
const Z = { id: 'z', n: 9 };

for (const direct of [false, true]) for (const warmWrapper of [false, true]) {
  it(`effective presence is current at completion: direct=${direct}, explicit-wrapper-read=${warmWrapper}`, () => {
    const tree = signalTree({ a: { rows: entityMap<Row, string>(), n: 1 }, other: 0 }, { enhancers: [transactions()] });
    const rows = tree.$.a.rows;
    const all = rows.all, ids = rows.ids, count = rows.count, map = rows.asMap;
    const has = rows.has('z'), where = rows.where(row => row.n === 9), find = rows.find(row => row.n === 9);
    let off = () => {};
    try {
      rows.addOne({ id: 'old', n: 1 });
      if (direct) tree.$.a({ n: 1 } as { rows: { all: Row[] }; n: number });
      else tree.$({ other: 0 } as { a: { rows: { all: Row[] }; n: number }; other: number });
      expect(all()).toEqual([]); expect(ids()).toEqual([]); expect(count()).toBe(0);
      expect(map().size).toBe(0); expect(has()).toBe(false); expect(where()).toEqual([]); expect(find()).toBeUndefined();
      if (warmWrapper) expect(snapshotMarkerNode(rows)?.value).toEqual({ all: [] });
      expect(MATERIALIZED.has(rows)).toBe(true); // Ordinary preparation already warmed it.
      // Native projection remains cached until normal membership delivery.
      const native = computed(() => all()); const before = native();
      let calls = 0; let early: ReturnType<typeof snapshotMarkerNode>;
      off = registerMembershipPublication(
        e => e.branch === (direct ? tree.$.a : tree.$) && e.key === (direct ? 'rows' : 'a') && e.present
          ? { record: { writes: [], adds: [] }, completion: {} } : undefined,
        () => {
          calls++;
          expect(all()).toEqual([Z]); expect(ids()).toEqual(['z']); expect(count()).toBe(1);
          expect([...map().values()]).toEqual([Z]); expect(has()).toBe(true);
          expect(where()).toEqual([Z]); expect(find()).toEqual(Z);
          early = snapshotMarkerNode(rows);
          expect(early?.value).toEqual({ all: [Z] });
          expect(tree.$().a.rows).toEqual({ all: [Z] });
          expect(native()).toBe(before);
        }
      );
      rows.addOne(Z); off();
      expect(calls).toBe(1); expect(native()).toEqual([Z]);
      expect(snapshotMarkerNode(rows)).toBe(early);
      rows.addOne({ id: 'next', n: 10 });
      expect(native()).toHaveLength(2);
    } finally { off(); tree.destroy(); }
  });
}

it('independently omitted edge keeps held projection and wrapper identity before delivery', () => {
  const tree = signalTree({ a: { rows: entityMap<Row, string>(), n: 1 }, other: 0 }, { enhancers: [transactions()] });
  const rows = tree.$.a.rows; let off = () => {};
  try {
    rows.addOne(Z);
    tree.$.a({ n: 1 } as { rows: { all: Row[] }; n: number });
    tree.$({ other: 0 } as { a: { rows: { all: Row[] }; n: number }; other: number });
    const all = rows.all(); const wrapper = snapshotMarkerNode(rows);
    expect(all).toEqual([]); expect(wrapper?.value).toEqual({ all: [] });
    let calls = 0;
    off = registerMembershipPublication(e => e.branch === tree.$ && e.key === 'a' && e.present
      ? { record: { writes: [], adds: [] }, completion: {} } : undefined, () => {
        calls++;
        expect(rows.all()).toBe(all); expect(snapshotMarkerNode(rows)).toBe(wrapper);
      });
    // Re-add only a's scalar path; rows remains independently omitted.
    writeNumber(tree.$.a.n, 2); off(); expect(calls).toBe(1);
    expect(rows.all()).toEqual([]); expect(tree.$().a).toEqual({ n: 2 });
    const stable = snapshotMarkerNode(rows); const stableAll = rows.all();
    writeNumber(tree.$.other, 1);
    expect(snapshotMarkerNode(rows)).toBe(stable); expect(rows.all()).toBe(stableAll);
  } finally { off(); tree.destroy(); }
});

it('presence invalidation treats cyclic marker payload and throwing getters as opaque', () => {
  const tree = signalTree({ a: { rows: entityMap<Row, string>() }, other: 0 }, { enhancers: [transactions()] });
  const rows = tree.$.a.rows;
  let gets = 0;
  const payload: { self?: unknown } = {}; payload.self = payload;
  Object.defineProperty(payload, 'trap', { get() { gets++; throw new Error('opaque payload getter'); }, enumerable: true });
  Object.defineProperty(rows, 'opaquePayload', { value: payload, configurable: true, enumerable: true });
  Object.defineProperty(rows, 'opaqueGetter', { get() { gets++; throw new Error('opaque marker getter'); }, configurable: true, enumerable: true });
  try {
    rows.addOne(Z); tree.$();
    tree.$({ other: 0 } as { a: { rows: { all: Row[] }; n: number }; other: number });
    rows.addOne(Z);
    expect(tree.$().a.rows).toEqual({ all: [Z] }); expect(gets).toBe(0);
  } finally { tree.destroy(); }
});

function writeNumber(leaf: unknown, value: number): void {
  if (typeof leaf !== 'function') throw new Error('missing scalar');
  (leaf as (value: number) => void)(value);
}

it('cold wrapper stays unmaterialized while a held projection follows omission and re-add', () => {
  const tree = signalTree({ a: { rows: entityMap<Row, string>() }, other: 0 });
  const rows = tree.$.a.rows;
  try {
    const all = rows.all;
    rows.addOne(Z); expect(all()).toEqual([Z]);
    expect(MATERIALIZED.has(rows)).toBe(false);
    tree.$({ other: 0 } as { a: { rows: { all: Row[] }; n: number }; other: number });
    expect(all()).toEqual([]);
    expect(MATERIALIZED.has(rows)).toBe(false);
    rows.addOne(Z);
    expect(MATERIALIZED.has(rows)).toBe(false);
    expect(all()).toEqual([Z]); expect(tree.$().a.rows).toEqual({ all: [Z] });
    expect(MATERIALIZED.has(rows)).toBe(true);
  } finally { tree.destroy(); }
});
