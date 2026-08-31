import { describe, expect, it } from 'vitest';

import {
  createReactiveTestRealization,
  observeReactiveTestValue,
} from '../../reactive-test-realization';
import { bindSignalTreeRealization } from '../signal-tree';
import type { ISignalTree } from '../types';

import { getOwnedPositionIds } from './owned-mutation';
import { getTreeScalarSlotRuntime } from './tree-scalar-slot-port';

describe('tree physical substrate', () => {
  const testRealization = createReactiveTestRealization();
  const signalTree = bindSignalTreeRealization(testRealization);

  // ⚠️ TITLE CORRECTED. This read "…on the public signalTree path BY DEFAULT",
  // which its own fixture contradicts — it explicitly passes
  // `capabilities: ['causal-runtime']`. A plain `signalTree(...)` has NO scalar
  // slot runtime, measured. A TEST TITLE IS A CLAIM; this one asserted the
  // public default while proving only the opted-in path.
  it('uses the slot-backed scalar substrate when causal-runtime is requested', () => {
    const tree = signalTree(
      { profile: { name: 'Alice' }, enabled: true },
      { capabilities: ['causal-runtime'] }
    ) as ISignalTree<{
      profile: {
        name: { (): string; set(value: string): void };
      };
      enabled: { (): boolean; set(value: boolean): void };
    }>;

    expect(getTreeScalarSlotRuntime(tree.$)).toBeDefined();
  });

  it('publishes reactive consequences only after a coherent slot-frame commit', () => {
    const tree = signalTree(
      { a: 'A', b: 'B' },
      { capabilities: ['causal-runtime'] }
    ) as ISignalTree<{
      a: { (): string; set(value: string): void };
      b: { (): string; set(value: string): void };
    }>;
    const runtime = getTreeScalarSlotRuntime(tree.$);
    if (!runtime) {
      throw new Error('Expected scalar slot runtime on public signalTree path');
    }

    const aPositionId = getOwnedPositionIds(tree.$.a)?.[0];
    const bPositionId = getOwnedPositionIds(tree.$.b)?.[0];
    if (aPositionId === undefined || bPositionId === undefined) {
      throw new Error(
        'Expected owned positions for scalar frame publication test'
      );
    }

    const aSlot = runtime.resolveScalarSlot(aPositionId);
    const bSlot = runtime.resolveScalarSlot(bPositionId);
    if (aSlot === undefined || bSlot === undefined) {
      throw new Error('Expected slot bindings for scalar frame publication test');
    }

    const observedValues: string[] = [];
    const observed = observeReactiveTestValue(
      () => `${tree.$.a()}|${tree.$.b()}`,
      (value) => observedValues.push(value)
    );
    expect(observed()).toBe('A|B');

    const frame = runtime.beginFrame();
    frame.set(aSlot, 'A2');
    frame.set(bSlot, 'B2');

    expect(tree.$.a()).toBe('A');
    expect(tree.$.b()).toBe('B');
    expect(observed()).toBe('A|B');

    frame.commit();

    expect(observed()).toBe('A2|B2');
    expect(observedValues).toContain('A2|B2');
    expect(observedValues).not.toContain('A2|B');
    expect(observedValues).not.toContain('A|B2');
  });

  it('does not publish unchanged direct scalar writes and publishes exactly one changed slot write', () => {
    const tree = signalTree(
      { a: 'A' },
      { capabilities: ['causal-runtime'] }
    ) as ISignalTree<{
      a: { (): string; set(value: string): void };
    }>;
    const runtime = getTreeScalarSlotRuntime(tree.$);
    if (!runtime) {
      throw new Error('Expected scalar slot runtime on public signalTree path');
    }

    const snapshot = testRealization.derived.createDerived(() => tree.$.a());
    let reads = 0;
    const observed = testRealization.derived.createDerived(() => {
      reads++;
      return snapshot();
    });
    expect(observed()).toBe('A');
    expect(reads).toBe(1);

    const beforeRevision = runtime.revision();
    tree.$.a.set('A');

    expect(runtime.revision()).toBe(beforeRevision);
    expect(observed()).toBe('A');
    expect(reads).toBe(1);

    tree.$.a.set('A2');
    expect(runtime.revision()).toBe(beforeRevision + 1);
    expect(observed()).toBe('A2');
    expect(reads).toBe(2);
  });
});
