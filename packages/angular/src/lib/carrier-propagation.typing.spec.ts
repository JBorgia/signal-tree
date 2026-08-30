/**
 * PUBLIC-CARRIER-PROPAGATION-0 — the Angular half of the matrix.
 *
 *     A CARRIER-BEARING PUBLIC TRANSFORMATION PRESERVES C END-TO-END.
 *     ONLY A PACKAGE REALIZATION BOUNDARY BINDS IT.
 *
 * One row per transformation CLASS, not per overload. Nested paths are included
 * deliberately: carrier loss hides one transformation deep — `.derived()`
 * returning the neutral public alias dropped C exactly one call into the chain,
 * and `defineStore` bound neutral through its own internal imports.
 *
 * The implementation rule this enforces:
 *     inside carrier-parametric machinery, self-reference `SomeOf<..., C>` —
 *     never a public alias that binds 'cell'.
 */
import { describe, expect, it } from 'vitest';
import type { Signal, WritableSignal } from '@angular/core';
import { signalTree, entityMap, asReadonly, toWritableSignal, defineStore } from '../index';
import type { DerivedOf, ReadonlyStore, TreeNode } from '../index';

interface Row { id: number; name: string; tags: string[] }
interface S {
  count: number;
  branch: { leaf: string; deep: { n: number } };
  rows: ReturnType<typeof entityMap<Row, number>>;
}

declare const roStore: ReadonlyStore<S, TreeNode<S>>;

const derivedBase = signalTree({ count: 2 });
type DerivedFn = ($: typeof derivedBase.$) => { doubled: Signal<number> };
declare const derivedTree: DerivedOf<typeof derivedBase, DerivedFn>;

describe('PCP — Angular public transformations keep the Angular carrier', () => {
  it('construction: top-level AND nested leaves are native', () => {
    const t = signalTree({ count: 0, branch: { leaf: 'a', deep: { n: 1 } } });
    const top: WritableSignal<number> = t.$.count;
    const nested: WritableSignal<string> = t.$.branch.leaf;
    const deep: WritableSignal<number> = t.$.branch.deep.n;
    const destroyed: Signal<boolean> = t.destroyed;
    expect([top, nested, deep, destroyed].length).toBe(4);
  });

  it('builder chaining: .derived() keeps the carrier one call deep', () => {
    const t = signalTree({ count: 1 }).derived(($) => ({
      doubled: (() => $.count() * 2) as unknown as Signal<number>,
    }));
    const base: WritableSignal<number> = t.$.count;
    const destroyed: Signal<boolean> = t.destroyed;
    expect([base, destroyed].length).toBe(2);
  });

  it('entity + slices: readers and writers are native, at depth', () => {
    const t = signalTree({ rows: entityMap<Row, number>() });
    const rows = t.$.rows;
    rows.addOne({ id: 1, name: 'Ada', tags: [] });
    const empty: Signal<boolean> = rows.empty;
    const all: Signal<Row[]> = rows.all;
    const field: WritableSignal<string> = rows.byIdOrFail(1).name;
    const arr: WritableSignal<string[]> = rows.byIdOrFail(1).tags;
    const ro: Signal<string> = rows.byIdOrFail(1).name.asReadonly();
    expect([empty, all, field, arr, ro].length).toBe(5);
  });

  it('asReadonly(): result is native AND withholds writers', () => {
    const t = signalTree({ count: 0, branch: { leaf: 'a' } });
    const ro = asReadonly(t);
    const leaf: Signal<number> = ro.$.count;
    const nested: Signal<string> = ro.$.branch.leaf;
    const destroyed: Signal<boolean> = ro.destroyed;
    // the readonly LAW, not just the carrier: writers are gone
    type HasSet = 'set' extends keyof typeof ro.$.count ? true : false;
    const noSet: HasSet = false;
    expect([leaf, nested, destroyed, noSet].length).toBe(4);
  });

  it('ReadonlyStore annotation: nested leaves and destroyed are native', () => {
    const leaf: Signal<number> = roStore.$.count;
    const destroyed: Signal<boolean> = roStore.destroyed;
    expect([leaf, destroyed].length).toBe(2);
  });

  it('toWritableSignal(): yields a native Angular signal', () => {
    const t = signalTree({ branch: { leaf: 'a' } });
    const w: WritableSignal<{ leaf: string }> = toWritableSignal(t.$.branch);
    expect(w).toBe(w);
  });

  it('DerivedOf: preserves the supplied Angular carrier', () => {
    const base: WritableSignal<number> = derivedTree.$.count;
    const derived: Signal<number> = derivedTree.$.doubled;
    expect([base, derived].length).toBe(2);
  });

  // `defineStore` is ANGULAR-OWNED and was shown to bypass the package-level
  // binding through its own kernel imports, so it gets consumer-shaped rows.
  it('defineStore default: injected store is native', () => {
    const Store = defineStore(() => signalTree({ count: 0, b: { leaf: 'x' } }));
    type Injected = InstanceType<typeof Store>;
    const leaf: WritableSignal<number> = null as unknown as Injected['$']['count'];
    const nested: WritableSignal<string> =
      null as unknown as Injected['$']['b']['leaf'];
    const destroyed: Signal<boolean> = null as unknown as Injected['destroyed'];
    expect([leaf, nested, destroyed].length).toBe(3);
  });

  it('defineStore readonly: native AND still withholds writers', () => {
    const Store = defineStore(() => signalTree({ count: 0 }), {
      expose: 'readonly',
    });
    type Injected = InstanceType<typeof Store>;
    const leaf: Signal<number> = null as unknown as Injected['$']['count'];
    const destroyed: Signal<boolean> = null as unknown as Injected['destroyed'];
    type HasSet = 'set' extends keyof Injected['$']['count'] ? true : false;
    const noSet: HasSet = false;
    expect([leaf, destroyed, noSet].length).toBe(3);
  });
});
