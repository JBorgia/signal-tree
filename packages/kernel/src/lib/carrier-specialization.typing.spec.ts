/**
 * PACKAGE-LEAF-TYPE-SEAM-0 — TYPE-A carriers.
 *
 * ONE tree-shape law, two truthful specializations. This file is the falsifier:
 * it fails to COMPILE if the Angular surface loses native branding, if the
 * kernel surface fraudulently claims it, or if the two shapes stop agreeing.
 */
import { describe, expect, it } from 'vitest';
import type { Signal, WritableSignal } from '@angular/core';
import type { WritableCell } from './internals/cell-runtime';
import type { NodeAccessor, TreeNode } from './types';
import type { TreeNodeOf } from './types';

interface State {
  count: number;
  user: { name: string; tags: string[] };
}

// what each package binds, ONCE. Users write neither of these type arguments.
type KernelTree<T> = TreeNodeOf<T, 'cell'>;
type AngularTree<T> = TreeNodeOf<T, 'angular'>;

declare const ng: AngularTree<State>;
declare const kn: KernelTree<State>;

describe('TYPE-A carrier specializations', () => {
  it('the Angular leaf is a genuine Angular WritableSignal, at depth', () => {
    const top: WritableSignal<number> = ng.count;
    const deep: WritableSignal<string> = (
      ng.user as NodeAccessor<State['user']> & AngularTree<State['user']>
    ).name;
    const ro: Signal<number> = ng.count;
    expect([top, deep, ro].length).toBe(3);
  });

  it('the kernel leaf is a truthful neutral cell, at depth', () => {
    const top: WritableCell<number> = kn.count;
    const deep: WritableCell<string> = (
      kn.user as NodeAccessor<State['user']> & KernelTree<State['user']>
    ).name;
    expect([top, deep].length).toBe(2);
  });

  it('the kernel leaf does NOT claim Angular branding', () => {
    // @ts-expect-error a neutral cell has no [SIGNAL]/[WRITABLE_SIGNAL]
    const lie: WritableSignal<number> = kn.count;
    expect(lie).toBe(lie);
  });

  it('an Angular leaf still satisfies the neutral contract (one-way)', () => {
    const widened: WritableCell<number> = ng.count;
    expect(widened).toBe(widened);
  });

  it('the PUBLIC tree type takes exactly one parameter — the state', () => {
    // @ts-expect-error carrier selection is not part of the public API
    type Leaked = TreeNode<State, 'cell'>;
    const guard: Leaked | undefined = undefined;
    expect(guard).toBeUndefined();
  });
});
