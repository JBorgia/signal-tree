import { afterEach, describe, expect, it, vi } from 'vitest';

import { restoration, signalTree, transactions, undoable } from '../index';
import {
  hasPathObservers,
  installPathDeliveryRuntime,
  resetPathDeliveryRuntime,
} from './internals/path-observation-port';
import { getPositionRegistry } from './internals/position-registry';
import {
  getPathNotifier,
  PathNotifier,
  resetPathNotifier,
} from './path-notifier';

const cleanup: Array<() => void> = [];
afterEach(() => {
  for (const dispose of cleanup.splice(0).reverse()) dispose();
  resetPathDeliveryRuntime();
});
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
const local = () => {
  const notifier = new PathNotifier();
  installPathDeliveryRuntime(notifier);
  return notifier;
};

describe('tree-owned path observation demand', () => {
  it('reports only owned demand while retaining aggregate queries', () => {
    const notifier = local();
    const stop = notifier.subscribe('**', () => undefined, 1);
    expect(hasPathObservers()).toBe(true);
    expect(hasPathObservers(1)).toBe(true);
    expect(hasPathObservers(2)).toBe(false);
    expect(notifier.hasObservers(2)).toBe(false);
    stop();
    stop();
    expect(hasPathObservers()).toBe(false);
    expect(hasPathObservers(1)).toBe(false);
  });

  it('tracks flush-only demand without filtering flush or notification delivery', () => {
    const notifier = local();
    const flushed = vi.fn();
    const delivered = vi.fn();
    const stopFlush = notifier.onFlush(flushed, 1);
    expect(hasPathObservers(1)).toBe(true);
    expect(hasPathObservers(2)).toBe(false);
    const stop = notifier.subscribe('**', delivered, 1);
    notifier.notify('n', 2, 1, undefined, undefined, undefined, undefined, 2);
    notifier.flushSync();
    expect(delivered).toHaveBeenCalledTimes(1);
    expect(flushed).toHaveBeenCalledTimes(1);
    stop();
    expect(hasPathObservers(1)).toBe(true);
    stopFlush();
    expect(hasPathObservers()).toBe(false);
  });

  it.each(['subscribe', 'flush'] as const)(
    'keeps unscoped %s consumers as wildcard demand',
    (kind) => {
      const notifier = local();
      const stopOwned = notifier.subscribe('**', () => undefined, 1);
      const stopGlobal =
        kind === 'subscribe'
          ? notifier.subscribe('n', () => undefined)
          : notifier.onFlush(() => undefined);
      expect(hasPathObservers(0)).toBe(true);
      expect(hasPathObservers(2)).toBe(true);
      stopGlobal();
      expect(hasPathObservers(2)).toBe(false);
      expect(hasPathObservers(1)).toBe(true);
      stopOwned();
      expect(hasPathObservers()).toBe(false);
    }
  );

  it.each(['subscribe', 'flush'] as const)(
    'preserves callback deduplication and repeated unsubscribe (%s)',
    (kind) => {
      const notifier = local();
      const callback = vi.fn();
      const add = (owner: number) =>
        kind === 'subscribe'
          ? notifier.subscribe('**', callback, owner)
          : notifier.onFlush(callback, owner);
      const stopA = add(1);
      const stopAgain = add(1);
      const stopB = add(2);
      expect(hasPathObservers(1)).toBe(true);
      expect(hasPathObservers(2)).toBe(true);
      expect(hasPathObservers(3)).toBe(false);
      notifier.notify('n', 2, 1);
      notifier.flushSync();
      expect(callback).toHaveBeenCalledTimes(1);
      // Same-owner duplicates still share a lifetime; a distinct owner does not.
      stopA();
      expect(hasPathObservers(1)).toBe(false);
      expect(hasPathObservers(2)).toBe(true);
      const stopNew = add(1);
      stopAgain();
      expect(hasPathObservers(1)).toBe(true);
      notifier.notify('n', 3, 2);
      notifier.flushSync();
      expect(callback).toHaveBeenCalledTimes(2);
      stopNew();
      expect(hasPathObservers(2)).toBe(true);
      stopB();
      expect(hasPathObservers()).toBe(false);
    }
  );

  it.each(['subscribe', 'flush'] as const)(
    'keeps wildcard and owned lifetimes independent for one callback (%s)',
    (kind) => {
      const notifier = local();
      const callback = vi.fn();
      const add = (owner?: number) =>
        kind === 'subscribe'
          ? notifier.subscribe('**', callback, owner)
          : notifier.onFlush(callback, owner);
      const stopOwned = add(1);
      const stopGlobal = add();
      stopOwned();
      expect(hasPathObservers(2)).toBe(true);
      const stopOther = add(2);
      stopGlobal();
      expect(hasPathObservers(1)).toBe(false);
      expect(hasPathObservers(2)).toBe(true);
      notifier.notify('n', 1, 0);
      notifier.flushSync();
      expect(callback).toHaveBeenCalledTimes(1);
      stopOther();
      expect(hasPathObservers()).toBe(false);
    }
  );

  it('clear removes subscriber demand but preserves flush demand and fresh subscriptions', () => {
    const notifier = local();
    const oldStop = notifier.subscribe('**', () => undefined, 1);
    const stopFlush = notifier.onFlush(() => undefined, 2);
    notifier.clear();
    expect(hasPathObservers(1)).toBe(false);
    expect(hasPathObservers(2)).toBe(true);
    expect(hasPathObservers(3)).toBe(false);
    const stopNew = notifier.subscribe('**', () => undefined, 3);
    oldStop();
    expect(notifier.getSubscriberCount()).toBe(1);
    expect(hasPathObservers(3)).toBe(true);
    stopNew();
    stopFlush();
    expect(hasPathObservers()).toBe(false);
  });

  it('clear during delivery preserves the remaining current handlers', () => {
    const notifier = local();
    notifier.setBatchingEnabled(false);
    const seen: string[] = [];
    notifier.subscribe(
      'n',
      () => {
        seen.push('first');
        notifier.clear();
      },
      1
    );
    notifier.subscribe(
      'n',
      () => {
        seen.push('second');
      },
      2
    );
    notifier.notify('n', 1, 0);
    expect(seen).toEqual(['first', 'second']);
    expect(hasPathObservers()).toBe(false);
    notifier.notify('n', 2, 1);
    expect(seen).toEqual(['first', 'second']);
  });

  it('a detached port reports no owned or aggregate demand', () => {
    const notifier = local();
    const stop = notifier.onFlush(() => undefined, 1);
    resetPathDeliveryRuntime();
    expect(hasPathObservers()).toBe(false);
    expect(hasPathObservers(1)).toBe(false);
    // clear deliberately preserves flush listeners on the engine itself.
    installPathDeliveryRuntime(notifier);
    expect(hasPathObservers(1)).toBe(true);
    expect(hasPathObservers(2)).toBe(false);
    stop();
  });

  it.each([false, true])(
    'isolates two real trees through history and rollback (reset=%s)',
    async (reset) => {
      getPathNotifier();
      const make = () =>
        signalTree(
          { g: { n: 0 }, count: 0 },
          { enhancers: [transactions(), restoration()] }
        );
      const a = make();
      const b = make();
      const plain = signalTree({ count: 0 });
      cleanup.push(
        () => a.destroy(),
        () => b.destroy(),
        () => plain.destroy()
      );
      const aId = getPositionRegistry(a.$)?.id;
      const bId = getPositionRegistry(b.$)?.id;
      const plainId = getPositionRegistry(plain.$.count)?.id;
      expect(aId).toBeDefined();
      expect(bId).toBeDefined();
      expect(plainId).toBeDefined();
      expect(aId).not.toBe(bId);
      if (reset) resetPathNotifier();
      expect(hasPathObservers(aId)).toBe(true);
      expect(hasPathObservers(bId)).toBe(true);
      expect(hasPathObservers(plainId)).toBe(false);
      const pending = b.transaction(() => b.$({ count: 2 } as never));
      undoable(() => a.$({ count: 1 } as never));
      plain.$.count(9);
      await flush();
      expect(a.$()).toEqual({ count: 1 });
      expect(b.$()).toEqual({ count: 2 });
      expect(a.getRestorationHistory()).toHaveLength(1);
      expect(b.getRestorationHistory()).toHaveLength(0);
      pending.rollback();
      expect(b.$()).toEqual({ g: { n: 0 }, count: 0 });
      expect(a.$()).toEqual({ count: 1 });
      a.undo();
      expect(a.$()).toEqual({ g: { n: 0 }, count: 0 });
      a.redo();
      expect(a.$()).toEqual({ count: 1 });
      expect(plain.$.count()).toBe(9);
      a.destroy();
      expect(hasPathObservers(aId)).toBe(false);
      expect(hasPathObservers(bId)).toBe(true);
      b.destroy();
      expect(hasPathObservers()).toBe(false);
    }
  );
});
