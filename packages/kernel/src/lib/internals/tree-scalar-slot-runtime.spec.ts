import { describe, expect, it } from 'vitest';

import { signalTree } from '../signal-tree';
import type { ISignalTree } from '../types';

import { getOwnedPositionIds } from './owned-mutation';
import {
  createTreeScalarSlotRuntime as createTreeScalarSlotKernel,
  type ScalarSlotCommitResult,
  type SingleSlotCommitResult,
} from './tree-scalar-slot-runtime';
import { getTreeScalarSlotRuntime } from './tree-scalar-slot-port';
import { createTreeScalarLeafRuntime as createTreeScalarSlotRuntime } from './tree-scalar-leaf-runtime';
import { observeIntrinsicMutations } from './intrinsic-mutation';

describe('tree scalar slot runtime', () => {
  it('exposes a framework-independent subscribable scalar location', () => {
    const runtime = createTreeScalarSlotRuntime(undefined);
    const location = runtime.createLeaf('A', Object.is) as {
      (): string;
      set(value: string): void;
      update(update: (value: string) => string): void;
      peek(): string;
      subscribe(listener: () => void): () => void;
    };
    const values: string[] = [];
    const unsubscribe = location.subscribe(() => values.push(location.peek()));

    expect(location.peek()).toBe('A');
    location.set('B');
    location.set('B');
    location.update((value) => `${value}2`);
    unsubscribe();
    location.set('C');

    expect(location()).toBe('C');
    expect(values).toEqual(['B', 'B2']);
  });

  it('publishes committed truth even when an intrinsic observer throws', () => {
    const runtime = createTreeScalarSlotRuntime(undefined);
    const location = runtime.createLeaf<string>('A', Object.is);
    const seen: string[] = [];
    observeIntrinsicMutations(location, () => {
      throw new Error('observer exploded');
    });
    location.subscribe(() => seen.push(location.peek()));

    expect(() => location.set('B')).not.toThrow();
    expect(location.peek()).toBe('B');
    expect(seen).toEqual(['B']);
  });

  it('keeps the same PositionId bound to the same SlotIndex across scalar writes', () => {
    const tree = signalTree(
      { profile: { name: 'Alice', enabled: true } },
      { capabilities: ['causal-runtime'] }
    ) as ISignalTree<{
      profile: {
        name: { (): string; set(value: string): void };
        enabled: { (): boolean; set(value: boolean): void };
      };
    }>;

    const runtime = getTreeScalarSlotRuntime(tree.$);
    if (!runtime) {
      throw new Error('Expected scalar slot runtime');
    }

    const positionId = getOwnedPositionIds(tree.$.profile.name)?.[0];
    if (positionId === undefined) {
      throw new Error('Expected owned position for profile.name');
    }

    const before = runtime.resolveScalarSlot(positionId);
    tree.$.profile.name.set('Alicia');
    tree.$.profile.name.set('Ally');
    const after = runtime.resolveScalarSlot(positionId);

    expect(before).toBeDefined();
    expect(after).toBe(before);
  });

  it('binds different PositionIds to different live scalar slots', () => {
    const tree = signalTree(
      { profile: { name: 'Alice' }, settings: { enabled: true } },
      { capabilities: ['causal-runtime'] }
    ) as ISignalTree<{
      profile: {
        name: { (): string; set(value: string): void };
      };
      settings: {
        enabled: { (): boolean; set(value: boolean): void };
      };
    }>;

    const runtime = getTreeScalarSlotRuntime(tree.$);
    if (!runtime) {
      throw new Error('Expected scalar slot runtime');
    }

    const namePositionId = getOwnedPositionIds(tree.$.profile.name)?.[0];
    const enabledPositionId = getOwnedPositionIds(tree.$.settings.enabled)?.[0];
    if (namePositionId === undefined || enabledPositionId === undefined) {
      throw new Error('Expected owned scalar positions');
    }

    expect(runtime.resolveScalarSlot(namePositionId)).not.toBe(
      runtime.resolveScalarSlot(enabledPositionId)
    );
  });

  it('preserves semantic PositionId and SlotIndex across parent rewrites of the same scalar path', () => {
    const tree = signalTree(
      { profile: { name: 'Alice', enabled: true } },
      { capabilities: ['causal-runtime'] }
    ) as ISignalTree<{
      profile: {
        (): { name: string; enabled: boolean };
        name: { (): string; set(value: string): void };
        enabled: { (): boolean; set(value: boolean): void };
      };
    }>;

    const runtime = getTreeScalarSlotRuntime(tree.$);
    if (!runtime) {
      throw new Error('Expected scalar slot runtime');
    }

    const beforePositionId = getOwnedPositionIds(tree.$.profile.name)?.[0];
    if (beforePositionId === undefined) {
      throw new Error('Expected owned position for profile.name');
    }

    const beforeSlot = runtime.resolveScalarSlot(beforePositionId);
    tree.$.profile({ name: 'Alicia', enabled: false });

    const afterPositionId = getOwnedPositionIds(tree.$.profile.name)?.[0];
    const afterSlot =
      afterPositionId === undefined
        ? undefined
        : runtime.resolveScalarSlot(afterPositionId);

    expect(afterPositionId).toBe(beforePositionId);
    expect(afterSlot).toBe(beforeSlot);
    expect(tree.$.profile.name()).toBe('Alicia');
    expect(tree.$.profile.enabled()).toBe(false);
  });

  it('leaves all slot values and revision untouched when a later equality check throws during frame commit', () => {
    const runtime = createTreeScalarSlotKernel();
    const stableSlot = runtime.createSlot('A', Object.is);
    const throwsOnChangeSlot = runtime.createSlot('B', (current, next) => {
      if (!Object.is(current, next)) {
        throw new Error('equality exploded');
      }

      return true;
    });
    const frame = runtime.beginFrame();
    frame.set(stableSlot, 'A2');
    frame.set(throwsOnChangeSlot, 'B2');

    expect(() => frame.commit()).toThrow('equality exploded');
    expect(runtime.readSlot<string>(stableSlot)).toBe('A');
    expect(runtime.readSlot<string>(throwsOnChangeSlot)).toBe('B');
    expect(runtime.revision()).toBe(0);
  });

  it('returns framework-neutral commit results from the scalar slot kernel', () => {
    const runtime = createTreeScalarSlotKernel();
    const stableSlot = runtime.createSlot('A', Object.is);
    const result = runtime.commitSlot(stableSlot, 'A2');

    expect(result).toEqual<SingleSlotCommitResult>({
      revision: 1,
      changed: true,
      slot: stableSlot,
    });
    expect(runtime.readSlot<string>(stableSlot)).toBe('A2');
    expect(runtime.revision()).toBe(1);
  });

  it('returns no change and preserves revision for an unchanged direct slot commit', () => {
    const runtime = createTreeScalarSlotKernel();
    const stableSlot = runtime.createSlot('A', Object.is);

    expect(runtime.commitSlot(stableSlot, 'A')).toEqual<SingleSlotCommitResult>(
      {
        revision: 0,
        changed: false,
      }
    );
    expect(runtime.readSlot<string>(stableSlot)).toBe('A');
    expect(runtime.revision()).toBe(0);
  });

  it('leaves value and revision untouched when direct slot equality throws', () => {
    const runtime = createTreeScalarSlotKernel();
    const slot = runtime.createSlot('A', (current, next) => {
      if (!Object.is(current, next)) {
        throw new Error('equality exploded');
      }

      return true;
    });

    expect(() => runtime.commitSlot(slot, 'A2')).toThrow('equality exploded');
    expect(runtime.readSlot<string>(slot)).toBe('A');
    expect(runtime.revision()).toBe(0);
  });

  it('publishes leaf writes through the Angular adapter after kernel commit', () => {
    const runtime = createTreeScalarSlotRuntime(undefined);
    const stable = runtime.createLeaf('A', Object.is);
    const throwsOnChange = runtime.createLeaf('B', (current, next) => {
      if (!Object.is(current, next)) {
        throw new Error('equality exploded');
      }

      return true;
    });

    const frame = runtime.beginFrame();
    frame.set(0, 'A2');
    frame.set(1, 'B2');

    expect(() => frame.commit()).toThrow('equality exploded');
    expect(stable()).toBe('A');
    expect(throwsOnChange()).toBe('B');
    expect(runtime.revision()).toBe(0);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ATOMIC-STATE-RETIREMENT — ORPHANED INVARIANT RECOVERY.
  //
  // The `atomic-state/**` prototypes were production-UNREACHABLE (zero non-spec
  // importers) but were NOT vacuous: a carrier audit found two subjects that
  // survive into the shipped flat-slot kernel and had NO permanent carrier
  // anywhere outside those prototypes.
  //
  //   atomic-scalar-store.spec.ts   'discard is inert'
  //                                 'does not allow a discarded frame to publish later'
  //                                 'refuses the second of two frames that began
  //                                  from the same base revision'
  //   slot-token-tree-prototype     'commits slot frames atomically without
  //                                  exposing a partial pair'
  //
  // Zero production importers proves no REACHABILITY. It does not prove no
  // surviving invariant carrier — deleting on import count alone would have
  // silently dropped these. Recovered here, at the boundary the claims are
  // actually about (the kernel), before the prototypes are retired.
  // ─────────────────────────────────────────────────────────────────────────

  it('keeps staged frame writes out of committed truth until commit', () => {
    const kernel = createTreeScalarSlotKernel();
    const a = kernel.createSlot(1, Object.is);
    const frame = kernel.beginFrame();

    frame.set(a, 99);

    // Staged, not committed: truth and revision are both untouched.
    expect(kernel.readSlot<number>(a)).toBe(1);
    expect(kernel.revision()).toBe(0);
  });

  it('discard is inert and a discarded frame can never commit', () => {
    const kernel = createTreeScalarSlotKernel();
    const a = kernel.createSlot(1, Object.is);
    const frame = kernel.beginFrame();
    frame.set(a, 99);

    frame.discard();

    expect(kernel.readSlot<number>(a)).toBe(1);
    expect(kernel.revision()).toBe(0);
    // A discarded frame is CLOSED — it cannot publish later on a retry.
    expect(() => frame.commit()).toThrow(/already closed/i);
  });

  it('commits a multi-slot frame atomically under one revision', () => {
    const kernel = createTreeScalarSlotKernel();
    const a = kernel.createSlot(1, Object.is);
    const b = kernel.createSlot('x', Object.is);
    const frame = kernel.beginFrame();
    frame.set(a, 2);
    frame.set(b, 'y');

    const result: ScalarSlotCommitResult = frame.commit();

    // ONE revision for the whole frame — never one per slot, which is what
    // would expose a partial pair to an observer counting revisions.
    expect(result.revision).toBe(1);
    expect([...result.changedSlots].sort()).toEqual([a, b].sort());
    expect(kernel.readSlot<number>(a)).toBe(2);
    expect(kernel.readSlot<string>(b)).toBe('y');
  });

  it('omits equal slots from changedSlots and commits nothing when all are equal', () => {
    const kernel = createTreeScalarSlotKernel();
    const a = kernel.createSlot(1, Object.is);
    const b = kernel.createSlot('x', Object.is);
    const frame = kernel.beginFrame();
    frame.set(a, 2);
    frame.set(b, 'x'); // unchanged

    expect(frame.commit().changedSlots).toEqual([a]);

    const noop = kernel.beginFrame();
    noop.set(a, 2); // already 2
    const result = noop.commit();
    expect(result.changedSlots).toEqual([]);
    expect(result.revision).toBe(1); // no advance on an empty commit
  });

  it('refuses the second of two frames opened from the same base revision', () => {
    const kernel = createTreeScalarSlotKernel();
    const a = kernel.createSlot(1, Object.is);
    const first = kernel.beginFrame();
    const second = kernel.beginFrame();

    first.set(a, 2);
    first.commit();

    // `second` based its read on revision 0, which no longer holds.
    second.set(a, 3);
    expect(() => second.commit()).toThrow(/stale/i);
    expect(kernel.readSlot<number>(a)).toBe(2);
  });
});
