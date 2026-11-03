import { afterEach, describe, expect, it } from 'vitest';
import {
  acquireObservation,
  inheritObservationForAddedMember,
  observationStateForTesting as state,
} from './internals/observation-substrate';
import { nodeStoreOf } from './internals/node-shape';
import { getPathNotifier, resetPathNotifier } from './path-notifier';
import { signalTree } from './signal-tree';

const cleanup: Array<() => void> = [];
function tree<T extends Record<string, unknown>>(value: T) {
  const result = signalTree(value);
  cleanup.push(() => result.destroy());
  return result;
}
function acquire(source: unknown) {
  const release = acquireObservation(source);
  cleanup.push(release);
  return release;
}
afterEach(() => {
  for (const dispose of cleanup.splice(0).reverse()) dispose();
});

describe('observation inheritance for materialized additions', () => {
  it('enrolls an added subtree and later nested additions through either branch half', () => {
    const parent = tree({ branch: { old: 0 }, unrelated: 0 });
    const added = tree({ nested: { value: 1 } });
    const later = tree({ value: 2 });
    const release = acquire(parent.$.branch);
    inheritObservationForAddedMember(nodeStoreOf(parent.$.branch)!, added.$);
    expect(state(added.$.nested.value).claims).toBe(1);
    inheritObservationForAddedMember(added.$.nested, later.$.value);
    expect(state(later.$.value).claims).toBe(1);
    expect(state(parent.$.unrelated).claims).toBe(0);
    release();
    expect(state(parent.$.branch.old).claims).toBe(0);
    expect(state(added.$.nested.value).claims).toBe(0);
    expect(state(later.$.value).claims).toBe(0);
  });

  it('shares physical observation across overlapping scopes and deduplicates enrollment', async () => {
    resetPathNotifier();
    const parent = tree({ branch: {} });
    const added = tree({ value: 0 });
    const outer = acquire(parent.$);
    const inner = acquire(parent.$.branch);
    inheritObservationForAddedMember(parent.$.branch, added.$);
    inheritObservationForAddedMember(nodeStoreOf(parent.$.branch)!, added.$);
    expect(state(added.$.value).claims).toBe(2);
    const publications: unknown[] = [];
    const off = getPathNotifier().subscribe(
      '**',
      (value) => void publications.push(value)
    );
    cleanup.push(off);
    added.$.value(1);
    await Promise.resolve();
    expect(publications).toEqual([1]);
    outer();
    outer();
    expect(state(added.$.value).claims).toBe(1);
    inner();
    expect(state(added.$.value).claims).toBe(0);
    added.$.value(2);
    await Promise.resolve();
    expect(publications).toEqual([1]);
  });

  it('does not arm additions to unobserved or released branches', () => {
    const parent = tree({ branch: {} });
    const added = tree({ value: 0 });
    inheritObservationForAddedMember(parent.$.branch, added.$);
    expect(state(added.$.value)).toMatchObject({
      claims: 0,
      positionId: undefined,
    });
    const release = acquire(parent.$.branch);
    release();
    inheritObservationForAddedMember(parent.$.branch, added.$);
    expect(state(added.$.value)).toMatchObject({
      claims: 0,
      positionId: undefined,
    });
  });

  it('enrolls retained absent branches and releases inherited nested claims', () => {
    const parent = tree({ branch: { value: 1 } });
    const branch = parent.$.branch!;
    parent.$({} as { branch: { value: number } });
    const release = acquire(parent.$);
    expect(state(branch.value).claims).toBe(1);
    const added = tree({ nested: { value: 2 } });
    inheritObservationForAddedMember(branch, added.$);
    expect(state(added.$.nested.value).claims).toBe(1);
    release();
    expect(state(branch.value).claims).toBe(0);
    expect(state(added.$.nested.value).claims).toBe(0);
    const later = tree({ value: 3 });
    inheritObservationForAddedMember(added.$.nested, later.$);
    expect(state(later.$.value).claims).toBe(0);
  });

  it('leaves mutation-capture leaves on their existing publication path', () => {
    const parent = tree({ branch: {} });
    const captured = signalTree(
      { value: 0 },
      { capabilities: ['mutation-capture'] }
    );
    cleanup.push(() => captured.destroy());
    acquire(parent.$.branch);
    inheritObservationForAddedMember(parent.$.branch, captured.$);
    expect(state(captured.$.value)).toMatchObject({
      observable: false,
      claims: 0,
    });
  });
});
