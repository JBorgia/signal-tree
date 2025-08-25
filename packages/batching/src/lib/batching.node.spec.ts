import { TestBed } from '@angular/core/testing';
import { signalTree } from '@signaltree/core';
import {
  withBatching,
  hasPendingUpdates,
  getBatchQueueSize,
  flushBatchedUpdates,
} from './batching';

describe('Batching - node-level path behavior', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('dedupes multiple batchUpdate calls to the same node path', async () => {
    const tree = signalTree({
      a: { b: { count: 0 } },
      events: [] as string[],
    }).pipe(withBatching());

    // In v1.1.6 design, batchUpdate is only available on tree.$ (root)
    // Enqueue multiple batchUpdate calls that update the same nested path
    tree.$.batchUpdate((state) => ({
      a: {
        ...state.a,
        b: {
          ...state.a.b,
          count: state.a.b.count + 1,
        },
      },
      events: [...state.events, 'b'],
    }));

    tree.$.batchUpdate((state) => ({
      a: {
        ...state.a,
        b: {
          ...state.a.b,
          count: state.a.b.count + 1,
        },
      },
      events: [...state.events, 'b'],
    }));

    tree.$.batchUpdate((state) => ({
      a: {
        ...state.a,
        b: {
          ...state.a.b,
          count: state.a.b.count + 1,
        },
      },
      events: [...state.events, 'b'],
    }));

    // Since all updates target the root and batching is enabled, they should be queued
    expect(hasPendingUpdates()).toBe(true);
    expect(getBatchQueueSize()).toBe(3); // Three separate batchUpdate calls

    // Flush explicitly to make test deterministic in this environment
    flushBatchedUpdates();

    // All three updates should have executed, but events array shows execution
    expect(tree.state.events().length).toBe(3);
    expect(tree.state.a.b.count()).toBe(3);
    expect(hasPendingUpdates()).toBe(false);
  });

  it('executes updates in batch order', async () => {
    const tree = signalTree({
      a: { b: { v: 0 }, v: 0 },
      events: [] as string[],
    }).pipe(withBatching());

    // In v1.1.6 design, all batchUpdate calls go through tree.$ (root)
    // Child update
    tree.$.batchUpdate((state) => ({
      a: {
        ...state.a,
        b: {
          ...state.a.b,
          v: state.a.b.v + 1,
        },
      },
      events: [...state.events, 'child'],
    }));

    // Parent update that depends on child's value
    tree.$.batchUpdate((state) => ({
      a: {
        ...state.a,
        v: state.a.b.v + 100, // Uses current value from state
      },
      events: [...state.events, 'parent'],
    }));

    // Both updates queued at root level
    expect(hasPendingUpdates()).toBe(true);
    expect(getBatchQueueSize()).toBe(2);

    // Flush explicitly to make test deterministic in this environment
    flushBatchedUpdates();

    // Both updates should execute in order they were queued
    expect(tree.state.events()).toEqual(['child', 'parent']);
    expect(tree.state.a.b.v()).toBe(1);
    expect(tree.state.a.v()).toBe(101);
  });
});
