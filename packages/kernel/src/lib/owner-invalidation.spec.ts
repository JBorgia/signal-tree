import { describe, expect, it, vi } from 'vitest';

import { observeOwnerInvalidation } from '../adapter';
import { transactions } from '../enhancers/transactions/transactions';
import { restoration } from '../enhancers/restoration/restoration';
import { batching } from '../enhancers/batching/batching';
import { entityMap } from './markers/entity-map';
import {
  openCommitScope,
  settleCommitScope,
} from './internals/commit-consequence';
import { ownerInvalidationStateForTesting } from './internals/owner-invalidation';
import { observationStateForTesting } from './internals/observation-substrate';
import { signalTree } from './signal-tree';
import { withWriteContext } from './write-context';
import { undoable } from './undoable';

const flush = async () => {
  for (let index = 0; index < 8; index++) await Promise.resolve();
};

describe('OWNER INVALIDATION LAW', () => {
  it('invalidates after an ordinary scalar write with no payload', async () => {
    const tree = signalTree({ count: 0 });
    const callback = vi.fn();
    const cleanup = observeOwnerInvalidation(tree, callback);

    tree.$.count.set(1);
    await flush();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith();

    cleanup();
    tree.destroy();
  });

  it('invalidates after a nested write', async () => {
    const tree = signalTree({ settings: { theme: 'light' } });
    const callback = vi.fn();
    const cleanup = observeOwnerInvalidation(tree, callback);

    tree.$.settings.theme.set('dark');
    await flush();

    expect(callback).toHaveBeenCalledTimes(1);

    cleanup();
    tree.destroy();
  });

  it('invalidates after EntityMap add, update, and remove operations', async () => {
    const tree = signalTree({
      rows: entityMap<{ id: string; value: number }, string>({
        selectId: (row) => row.id,
      }),
    });
    const callback = vi.fn();
    const cleanup = observeOwnerInvalidation(tree, callback);

    tree.$.rows.addOne({ id: 'a', value: 1 });
    await flush();
    tree.$.rows.updateOne('a', { value: 2 });
    await flush();
    tree.$.rows.removeOne('a');
    await flush();

    expect(callback).toHaveBeenCalledTimes(3);

    cleanup();
    tree.destroy();
  });

  it('invalidates after active selection changes', async () => {
    const tree = signalTree({
      rows: entityMap<{ id: string }, string>({ selectId: (row) => row.id }),
    });
    tree.$.rows.addOne({ id: 'a' });
    await flush();

    const callback = vi.fn();
    const cleanup = observeOwnerInvalidation(tree, callback);
    tree.$.rows.setActiveId('a');
    await flush();

    expect(tree.$.rows.activeId()).toBe('a');
    expect(callback).toHaveBeenCalledTimes(1);

    tree.$.rows.clearActiveId();
    await flush();
    expect(tree.$.rows.activeId()).toBeUndefined();
    expect(callback).toHaveBeenCalledTimes(2);

    cleanup();
    tree.destroy();
  });

  it('invalidates when a derived public read changes', async () => {
    const tree = signalTree({
      rows: entityMap<{ id: string }, string>({ selectId: (row) => row.id }),
    });
    const callback = vi.fn();
    const cleanup = observeOwnerInvalidation(tree, callback);

    expect(tree.$.rows.count()).toBe(0);
    tree.$.rows.addOne({ id: 'a' });
    await flush();

    expect(tree.$.rows.count()).toBe(1);
    expect(callback).toHaveBeenCalledTimes(1);

    cleanup();
    tree.destroy();
  });

  it('invalidates diagnostic inspection truth visible through public reads', async () => {
    const tree = signalTree({ count: 0 });
    const callback = vi.fn();
    const cleanup = observeOwnerInvalidation(tree, callback);

    withWriteContext(
      {
        intent: 'system',
        origin: 'devtools',
        participation: 'inspection',
      },
      () => tree.$.count.set(7)
    );
    await flush();

    expect(tree.$.count()).toBe(7);
    expect(callback).toHaveBeenCalledTimes(1);

    cleanup();
    tree.destroy();
  });

  it('invalidates only after coherent multi-write transaction state is readable', async () => {
    const tree = signalTree(
      { left: 0, right: 0 },
      { enhancers: [transactions()] }
    );
    const seen: Array<readonly [number, number]> = [];
    const cleanup = observeOwnerInvalidation(tree, () => {
      seen.push([tree.$.left(), tree.$.right()]);
    });

    tree.transaction(() => {
      tree.$.left.set(1);
      tree.$.right.set(1);
    }).confirm();
    await flush();

    expect(seen).toEqual([[1, 1]]);

    cleanup();
    tree.destroy();
  });

  it('does not invalidate after an ordinary no-op write', async () => {
    const tree = signalTree({ value: 1 });
    const callback = vi.fn();
    const cleanup = observeOwnerInvalidation(tree, callback);

    tree.$.value.set(1);
    await flush();

    expect(callback).not.toHaveBeenCalled();

    cleanup();
    tree.destroy();
  });

  it('invalidates only after final coherent rollback truth is readable', async () => {
    const tree = signalTree(
      { left: 0, right: 0 },
      { enhancers: [transactions()] }
    );
    const seen: Array<readonly [number, number]> = [];
    const cleanup = observeOwnerInvalidation(tree, () => {
      seen.push([tree.$.left(), tree.$.right()]);
    });

    tree.transaction(() => {
      tree.$.left.set(1);
      tree.$.right.set(1);
    }).rollback();
    await flush();

    expect(seen).toEqual([[0, 0]]);

    cleanup();
    tree.destroy();
  });

  it('isolates two owners strictly', async () => {
    const first = signalTree({ value: 0 });
    const second = signalTree({ value: 0 });
    const firstCallback = vi.fn();
    const secondCallback = vi.fn();
    const cleanupFirst = observeOwnerInvalidation(first, firstCallback);
    const cleanupSecond = observeOwnerInvalidation(second, secondCallback);

    first.$.value.set(1);
    await flush();

    expect(firstCallback).toHaveBeenCalledTimes(1);
    expect(secondCallback).not.toHaveBeenCalled();

    cleanupFirst();
    cleanupSecond();
    first.destroy();
    second.destroy();
  });

  it('may coalesce multiple same-tick public changes into one invalidation', async () => {
    const tree = signalTree({ left: 0, right: 0 });
    const callback = vi.fn();
    const cleanup = observeOwnerInvalidation(tree, callback);

    tree.$.left.set(1);
    tree.$.right.set(1);
    await flush();

    expect(tree.$.left()).toBe(1);
    expect(tree.$.right()).toBe(1);
    expect(callback).toHaveBeenCalledTimes(1);

    cleanup();
    tree.destroy();
  });

  it('shares one observation claim across subscribers with independent cleanup', async () => {
    const tree = signalTree({ value: 0 });
    const first = vi.fn();
    const second = vi.fn();
    const cleanupFirst = observeOwnerInvalidation(tree, first);
    const cleanupSecond = observeOwnerInvalidation(tree, second);

    expect(observationStateForTesting(tree.$.value).claims).toBe(1);
    expect(ownerInvalidationStateForTesting(tree)).toEqual({
      active: true,
      subscribers: 2,
      pending: false,
    });

    cleanupFirst();
    cleanupFirst();
    tree.$.value.set(1);
    await flush();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(observationStateForTesting(tree.$.value).claims).toBe(1);

    cleanupSecond();
    expect(observationStateForTesting(tree.$.value).claims).toBe(0);
    expect(ownerInvalidationStateForTesting(tree)).toEqual({
      active: false,
      subscribers: 0,
      pending: false,
    });

    tree.destroy();
  });

  it('treats duplicate callback identity as independent subscriptions', async () => {
    const tree = signalTree({ value: 0 });
    const callback = vi.fn();
    const cleanupFirst = observeOwnerInvalidation(tree, callback);
    const cleanupSecond = observeOwnerInvalidation(tree, callback);

    cleanupFirst();
    tree.$.value.set(1);
    await flush();

    expect(callback).toHaveBeenCalledTimes(1);

    cleanupSecond();
    tree.destroy();
  });

  it('isolates a throwing subscriber from later subscribers', async () => {
    const tree = signalTree({ value: 0 });
    const later = vi.fn();
    const cleanupThrowing = observeOwnerInvalidation(tree, () => {
      throw new Error('subscriber failed');
    });
    const cleanupLater = observeOwnerInvalidation(tree, later);

    tree.$.value.set(1);
    await flush();

    expect(later).toHaveBeenCalledTimes(1);

    cleanupThrowing();
    cleanupLater();
    tree.destroy();
  });

  it('does not invalidate a deferred transaction before final settlement', async () => {
    const tree = signalTree(
      { value: 0 },
      { enhancers: [transactions()] }
    );
    const seen: number[] = [];
    const cleanup = observeOwnerInvalidation(tree, () => seen.push(tree.$.value()));

    const pending = tree.transaction(() => tree.$.value.set(1));
    await flush();
    expect(seen).toEqual([]);

    pending.rollback();
    await flush();
    expect(seen).toEqual([0]);

    cleanup();
    tree.destroy();
  });

  it('does not reschedule owner invalidation through a newly opened commit scope', async () => {
    const tree = signalTree({ value: 0 });
    const callback = vi.fn();
    const cleanup = observeOwnerInvalidation(tree, callback);
    const owner = {};

    tree.$.value.set(1);
    openCommitScope(owner, 1, tree.$);
    tree.$.value.set(2);
    await flush();

    expect(callback).not.toHaveBeenCalled();

    settleCommitScope(owner, 1, 'commit');
    await flush();
    expect(callback).toHaveBeenCalledTimes(1);

    cleanup();
    tree.destroy();
  });

  it('invalidates restoration status after the status itself settles', async () => {
    const tree = signalTree(
      { value: 0 },
      { enhancers: [restoration()] }
    );
    const seen: boolean[] = [];
    const cleanup = observeOwnerInvalidation(tree, () => seen.push(tree.canUndo()));

    undoable(() => tree.$.value.set(1));
    await flush();

    expect(seen).toEqual([true]);

    tree.resetRestorationHistory();
    await flush();
    expect(seen).toEqual([true, false]);

    cleanup();
    tree.destroy();
  });

  it('invalidates delayed batching pending-state settlement', async () => {
    const tree = signalTree(
      { value: 0 },
      { enhancers: [batching({ notificationDelayMs: 60_000 })] }
    );
    const seen: boolean[] = [];
    const cleanup = observeOwnerInvalidation(tree, () =>
      seen.push(tree.hasPendingNotifications())
    );

    tree.batch(() => tree.$.value.set(1));
    await flush();
    expect(seen).toEqual([true]);

    tree.flushNotifications();
    await flush();
    expect(seen).toEqual([true, false]);

    cleanup();
    tree.destroy();
  });

  it('invalidates after whole-value membership omission', async () => {
    const tree = signalTree(
      { box: { keep: { value: 1 }, drop: { value: 2 } } },
      { capabilities: ['causal-runtime', 'position-topology'] }
    );
    const seen: string[][] = [];
    const cleanup = observeOwnerInvalidation(tree, () => {
      seen.push(Object.keys(tree.$.box()));
    });

    const writeBox = tree.$.box as unknown as (value: object) => void;
    writeBox({ keep: { value: 1 } });
    await flush();

    expect(seen).toEqual([['keep']]);

    cleanup();
    tree.destroy();
  });

  it('invalidates after equal-value dormant-member reactivation', async () => {
    const tree = signalTree(
      { box: { keep: { value: 1 }, drop: { value: 2 } } },
      { capabilities: ['causal-runtime', 'position-topology'] }
    );
    const writeBox = tree.$.box as unknown as (value: object) => void;
    writeBox({ keep: { value: 1 } });
    await flush();

    const seen: string[][] = [];
    const cleanup = observeOwnerInvalidation(tree, () => {
      seen.push(Object.keys(tree.$.box()));
    });

    writeBox({ keep: { value: 1 }, drop: { value: 2 } });
    await flush();

    expect(seen).toEqual([['keep', 'drop']]);

    cleanup();
    tree.destroy();
  });

  it('terminates active invalidation when the owner is destroyed', async () => {
    const tree = signalTree({ value: 0 });
    const callback = vi.fn();
    const cleanup = observeOwnerInvalidation(tree, callback);

    tree.destroy();

    expect(observationStateForTesting(tree.$.value).claims).toBe(0);
    expect(ownerInvalidationStateForTesting(tree).active).toBe(false);

    tree.$.value.set(1);
    await flush();
    expect(callback).not.toHaveBeenCalled();

    cleanup();
  });

  it('cannot activate an owner destroyed before subscription', async () => {
    const tree = signalTree({ value: 0 });
    tree.destroy();
    const callback = vi.fn();

    const cleanup = observeOwnerInvalidation(tree, callback);
    tree.$.value.set(1);
    await flush();

    expect(callback).not.toHaveBeenCalled();
    expect(observationStateForTesting(tree.$.value).claims).toBe(0);
    expect(ownerInvalidationStateForTesting(tree).active).toBe(false);

    cleanup();
  });
});
