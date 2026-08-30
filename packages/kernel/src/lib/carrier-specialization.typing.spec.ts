/**
 * KERNEL-side carrier rows.
 *
 * This file used to assert BOTH specializations from the kernel. It no longer
 * can, and that is correct: after GREENFIELD-V15-SURFACE-0 the kernel's registry
 * declares only `'cell'`, and `@signal-tree/angular` merges its own carrier in.
 * The kernel cannot name `'angular'` — which is exactly the property that keeps
 * `@angular/core` out of kernel declarations.
 *
 * The Angular half lives in `packages/angular` (`carrier-binding.typing.spec.ts`),
 * where the registry entry actually exists.
 */
import { describe, expect, it } from 'vitest';
import type { WritableCell } from './internals/cell-runtime';
import type { TreeNodeOf } from './types';

interface State {
  count: number;
  user: { name: string; tags: string[] };
}

type KernelTree<T> = TreeNodeOf<T, 'cell'>;
declare const kn: KernelTree<State>;

describe('kernel carrier specialization', () => {
  it('the kernel leaf is a truthful neutral cell, at depth', () => {
    const top: WritableCell<number> = kn.count;
    expect(top).toBe(top);
  });

  it('the kernel registry has no Angular carrier to name', () => {
    // @ts-expect-error the kernel declares only 'cell'; 'angular' is merged in
    // by @signal-tree/angular and is not nameable here.
    type Leaked = TreeNodeOf<State, 'angular'>;
    const guard: Leaked | undefined = undefined;
    expect(guard).toBeUndefined();
  });
});
