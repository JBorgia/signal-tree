import { describe, expect, it } from 'vitest';

import {
  createMutationCaptureRuntime,
  type CommittedEntityCapture,
  type CollectionOrderCapture,
} from './mutation-capture-runtime';
import { createPositionRegistry } from './position-registry';

const entityCapture: CommittedEntityCapture = {
  owner: 1,
  ownerPath: 'rows',
  changes: [
    { subject: 1, before: undefined, after: { id: 'a' }, structural: true },
  ],
};
const orderCapture: CollectionOrderCapture = {
  owner: 1,
  ownerPath: 'rows',
  beforeFrontier: 0,
  afterFrontier: 1,
};

describe('runtime activation after an empty lifetime prefix', () => {
  it('starts and stops capture without requiring a subscriber at activation', () => {
    const runtime = createMutationCaptureRuntime();
    const release = runtime.activateCapture();
    expect(runtime.hasCommittedEntityObservers?.()).toBe(false);
    runtime.publishCommittedEntity?.(entityCapture);
    runtime.publishCollectionOrder?.(orderCapture);
    const entities: CommittedEntityCapture[] = [];
    const orders: CollectionOrderCapture[] = [];
    const offEntity = runtime.subscribeCommittedEntity?.((value) =>
      entities.push(value)
    );
    const offOrder = runtime.subscribeCollectionOrder?.((value) =>
      orders.push(value)
    );
    expect(runtime.hasCommittedEntityObservers?.()).toBe(true);
    runtime.publishCommittedEntity?.(entityCapture);
    runtime.publishCollectionOrder?.(orderCapture);
    expect(entities).toEqual([entityCapture]);
    expect(orders).toEqual([orderCapture]);
    release();
    runtime.publishCommittedEntity?.(entityCapture);
    runtime.publishCollectionOrder?.(orderCapture);
    expect(entities).toHaveLength(1);
    expect(orders).toHaveLength(1);
    offEntity?.();
    offOrder?.();
    const releaseAgain = runtime.activateCapture();
    expect(runtime.hasCommittedEntityObservers?.()).toBe(false);
    releaseAgain();
  });

  it('keeps current entity delivery stable across subscription mutation', () => {
    const runtime = createMutationCaptureRuntime();
    const seen: string[] = [];
    const release = runtime.activateCapture();
    runtime.subscribeCommittedEntity?.(() => {
      seen.push('first');
      offSecond?.();
      throw new Error('contained observer failure');
    });
    const offSecond = runtime.subscribeCommittedEntity?.(() =>
      seen.push('second')
    );
    runtime.publishCommittedEntity?.(entityCapture);
    runtime.publishCommittedEntity?.(entityCapture);
    expect(seen).toEqual(['first', 'second', 'first']);
    release();
  });

  it('preserves namespace, ancestry and exact addresses after first registration', () => {
    const registry = createPositionRegistry();
    const other = createPositionRegistry();
    expect(registry.id).not.toBe(other.id);
    expect(registry.addressFor(1)).toBeUndefined();
    expect(registry.collectionPathFor(1)).toBeUndefined();
    expect(registry.parentOf(1)).toBeUndefined();
    const root = registry.allocate();
    const child = registry.allocate(root);
    const sibling = registry.allocate(root);
    const address = ['rows'];
    registry.registerPositionAddress(child, address);
    registry.registerCollectionPath(child, 'rows');
    expect(registry.contains(root, child)).toBe(true);
    expect(registry.contains(child, sibling)).toBe(false);
    expect(registry.addressFor(child)).toBe(address);
    expect(registry.collectionPathFor(child)).toBe('rows');
    expect(other.addressFor(child)).toBeUndefined();
  });
});
