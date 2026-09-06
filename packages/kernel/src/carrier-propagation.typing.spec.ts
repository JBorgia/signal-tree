/**
 * PUBLIC-CARRIER-PROPAGATION-0 — the KERNEL half.
 *
 * Same transformation classes, neutral carrier. Together with the Angular half
 * this proves the law in both directions: a public transformation preserves the
 * carrier it was handed, and only a package realization boundary binds it.
 */
import { describe, expect, it } from 'vitest';
import { signalTree, entityMap, asReadonly } from './index';
import type { Location, ReadableCell } from './lib/internals/cell-runtime';

interface Row {
  id: number;
  name: string;
  tags: string[];
}

describe('PCP — kernel public transformations stay neutral', () => {
  it('construction: top-level AND nested leaves are neutral cells', () => {
    const t = signalTree({ count: 0, branch: { leaf: 'a', deep: { n: 1 } } });
    const top: Location<number> = t.$.count;
    const nested: Location<string> = t.$.branch.leaf;
    const deep: Location<number> = t.$.branch.deep.n;
    const destroyed: ReadableCell<boolean> = t.destroyed;
    expect([top, nested, deep, destroyed].length).toBe(4);
  });

  it('declarative derived state keeps the neutral carrier', () => {
    const t = signalTree(
      { count: 1 },
      {
        derived: ($) => ({
          doubled: (() => $.count() * 2) as ReadableCell<number>,
        }),
      }
    );
    const derived: ReadableCell<number> = t.$.doubled;
    expect(derived).toBe(derived);
  });

  it('entity + slices: neutral readers and writers, at depth', () => {
    const t = signalTree({ rows: entityMap<Row, number>() });
    const rows = t.$.rows;
    rows.addOne({ id: 1, name: 'Ada', tags: [] });
    const empty: ReadableCell<boolean> = rows.empty;
    const all: ReadableCell<Row[]> = rows.all;
    const field: Location<string> = rows.byIdOrFail(1).name;
    const ro: ReadableCell<string> = rows.byIdOrFail(1).name.asReadonly();
    expect([empty, all, field, ro].length).toBe(4);
  });

  it('asReadonly(): neutral result that still withholds writers', () => {
    const t = signalTree({ count: 0, branch: { leaf: 'a' } });
    const ro = asReadonly(t);
    const leaf: ReadableCell<number> = ro.$.count;
    const nested: ReadableCell<string> = ro.$.branch.leaf;
    const destroyed: ReadableCell<boolean> = ro.destroyed;
    type HasSet = 'set' extends keyof typeof ro.$.count ? true : false;
    const noSet: HasSet = false;
    expect([leaf, nested, destroyed, noSet].length).toBe(4);
  });
});
