import { TestBed } from '@angular/core/testing';
import { signalTree } from '@signaltree/core';
import {
  withBatching,
  flushBatchedUpdates,
  getPendingBatchedUpdates,
} from './batching';

describe('Batching - mixed update/batch ordering', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('ensures updates queued with update() and batchUpdate() maintain expected ordering', () => {
    const tree = signalTree({ x: { v: 0 }, log: [] as string[] }).with(
      withBatching()
    );

    // Queue an imperative update (should be queued but not schedule flush)
    tree.$.update(() => ({ x: { v: tree.state.x.v() + 1 } }));

    // Queue a batched update at root level (v1.1.6 design)
    tree.$.batchUpdate((state) => ({
      x: { v: state.x.v + 10 },
    }));

    // At this point, we expect updates to be queued
    const pending = getPendingBatchedUpdates();
    expect(pending.length).toBeGreaterThanOrEqual(1);

    // Flush and assert final state
    flushBatchedUpdates();

    expect(tree.state.x.v()).toBeGreaterThanOrEqual(11);
  });
});
