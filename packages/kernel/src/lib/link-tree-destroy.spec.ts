import { describe, expect, it } from 'vitest';

import { transactions } from '../enhancers/transactions/transactions';
import { getHeldConsequenceCountForTesting } from './internals/commit-consequence';
import { getTreeLinkCountForTesting } from './internals/link-lifetime';
import { StudioTreeDestroyedError } from './internals/confirmed-turn-view';
import { getEntityMembershipInventory } from './internals/entity-membership-inventory';
import {
  linkStateReader,
  type LinkStateEvent,
} from './internals/link-state-view';
import { link } from './link';
import { entityMap } from './markers/entity-map';
import { getPathNotifier } from './path-notifier';
import { signalTree } from './signal-tree';

/**
 * LINK-TREE-DESTROY (15.4.4). `tree.destroy()` disposes every Link bound to
 * the tree, exactly as each relationship's own `dispose()` would.
 *
 * Since 15.3.1 a destroyed tree left its Links running: a `settled()` waiter
 * on a send that never settled hung forever, queued sends still reached the
 * endpoint, and the endpoint's `subscribe()` cleanup never ran. 15.4.0 already
 * made `dispose()` release waiters without waiting for the send; destroy now
 * reuses that rather than adding a second teardown.
 */
const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const flush = async () => {
  getPathNotifier().flushSync();
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
const never = () => new Promise<void>(() => undefined);

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => (resolve = done));
  return { promise, resolve };
}

/** Resolves true if `settled()` resolves within `ms`. */
const settledWithin = (l: { settled(): Promise<void> }, ms = 100) =>
  Promise.race([
    l.settled().then(() => true),
    new Promise<boolean>((r) => setTimeout(() => r(false), ms)),
  ]);

describe('tree.destroy() disposes the tree’s Links', () => {
  it('releases a settled() waiter on a send that never settles', async () => {
    const tree = signalTree({ x: 0 });
    const connection = link(tree.$.x, { set: never });
    tree.$.x(1);
    await nextTask();
    let done = false;
    const waiting = connection.settled().then(() => void (done = true));
    await nextTask();
    expect(done).toBe(false);

    tree.destroy();
    await nextTask();
    expect(done).toBe(true);
    await waiting;
    // A disposed relationship owns no work: later waiters resolve at once.
    expect(await settledWithin(connection)).toBe(true);
  });

  it('stops queued sends after the in-flight one', async () => {
    const tree = signalTree({ x: 0 });
    const gate = deferred();
    const sent: number[] = [];
    const connection = link(tree.$.x, {
      set: (value) => {
        sent.push(value);
        return gate.promise;
      },
    });
    tree.$.x(1);
    await nextTask();
    tree.$.x(2);
    await nextTask();
    tree.$.x(3);
    await nextTask();
    expect(sent).toEqual([1]);
    const waiting = settledWithin(connection);

    tree.destroy();
    expect(await waiting).toBe(true);
    gate.resolve();
    await nextTask();
    await nextTask();
    expect(sent).toEqual([1]);
  });

  it('sends nothing for a write made after destroy', async () => {
    const tree = signalTree({ x: 0 });
    const sent: number[] = [];
    link(tree.$.x, { set: (value) => void sent.push(value) });
    tree.destroy();
    tree.$.x(1);
    await flush();
    expect(sent).toEqual([]);
  });

  it('releases a waiter and the held send behind a pending transaction', async () => {
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const sent: number[] = [];
    const connection = link(tree.$.x, {
      set: (value) => void sent.push(value),
    });
    const pending = tree.transaction(() => tree.$.x(1));
    await flush();
    const waiting = settledWithin(connection);
    tree.destroy();
    expect(await waiting).toBe(true);
    expect(getHeldConsequenceCountForTesting(tree.$.x)).toBe(0);
    pending.confirm();
    await flush();
    expect(sent).toEqual([]);
  });

  it('runs the endpoint subscription cleanup exactly once', () => {
    const tree = signalTree({ x: 0 });
    let cleanups = 0;
    link(tree.$.x, {
      subscribe: () => () => void cleanups++,
    });
    tree.destroy();
    expect(cleanups).toBe(1);
    tree.destroy();
    expect(cleanups).toBe(1);
  });

  it('dispose then destroy disposes once', () => {
    const tree = signalTree({ x: 0 });
    let cleanups = 0;
    const connection = link(tree.$.x, {
      subscribe: () => () => void cleanups++,
    });
    connection.dispose();
    expect(cleanups).toBe(1);
    tree.destroy();
    expect(cleanups).toBe(1);
    connection.dispose();
    expect(cleanups).toBe(1);
  });

  it('disposes every Link on the tree, even when one cleanup throws', async () => {
    const tree = signalTree({
      x: 0,
      form: { a: 0 },
      rows: entityMap<{ id: string; n: number }, string>(),
    });
    const cleaned: string[] = [];
    const first = link(tree.$.x, {
      set: never,
      subscribe: () => () => {
        cleaned.push('x');
        throw new Error('cleanup failed');
      },
    });
    const second = link(
      tree.$.form as never,
      {
        set: never,
        subscribe: () => () => void cleaned.push('form'),
      } as never
    );
    const third = link(tree.$.rows, {
      set: never,
      subscribe: () => () => void cleaned.push('rows'),
    });
    tree.$.x(1);
    tree.$.form.a(1);
    tree.$.rows.addOne({ id: 'a', n: 1 });
    await nextTask();
    const waiting = Promise.all(
      [first, second, third].map((l) => settledWithin(l))
    );

    expect(() => tree.destroy()).not.toThrow();
    expect(cleaned.sort()).toEqual(['form', 'rows', 'x']);
    expect(await waiting).toEqual([true, true, true]);
  });

  it('leaves Links on another tree running', async () => {
    const doomed = signalTree({ x: 0 });
    const survivor = signalTree({ x: 0 });
    const sent: number[] = [];
    link(doomed.$.x, { set: never });
    const kept = link(survivor.$.x, { set: (value) => void sent.push(value) });
    try {
      doomed.destroy();
      survivor.$.x(5);
      await flush();
      await kept.settled();
      expect(sent).toEqual([5]);
    } finally {
      kept.dispose();
      survivor.destroy();
    }
  });

  it('tooling sees each Link disposed before the tree closes its readers', () => {
    const tree = signalTree({ x: 0, y: 0 });
    const reader = linkStateReader(tree);
    const events: LinkStateEvent[] = [];
    reader.subscribe((event) => events.push(event));
    link(tree.$.x, { set: () => undefined });
    link(tree.$.y, { set: () => undefined });
    events.length = 0;
    tree.destroy();
    expect(events.map((event) => [event.kind, event.link.path])).toEqual([
      ['disposed', 'x'],
      ['disposed', 'y'],
    ]);
    expect(() => reader.snapshot()).toThrow(/destroyed/);
  });

  it('a Link disposed before destroy is not retained for it', () => {
    const tree = signalTree({ x: 0 });
    const kept = link(tree.$.x, { set: () => undefined });
    for (let i = 0; i < 3; i++) {
      link(tree.$.x, { set: () => undefined }).dispose();
    }
    expect(getTreeLinkCountForTesting(tree.$.x)).toBe(1);
    kept.dispose();
    expect(getTreeLinkCountForTesting(tree.$.x)).toBe(0);
    tree.destroy();
  });

  it('a Link whose construction fails is not bound to the tree', () => {
    const tree = signalTree({ x: 0 });
    expect(() =>
      link(tree.$.x, {
        subscribe: () => {
          throw new Error('subscribe');
        },
      })
    ).toThrow('subscribe');
    expect(getTreeLinkCountForTesting(tree.$.x)).toBe(0);
    tree.destroy();
  });
});

/**
 * A Link created AFTER destroy (15.4.4). v15 refuses every relationship or
 * reader created on a destroyed tree with `StudioTreeDestroyedError` (the
 * transaction-lifecycle, restoration, entity-membership, Link-state,
 * state-location and confirmed-turn readers), because a dead tree and an idle
 * one are different facts. `link()` now refuses the same way, before it
 * acquires anything: an inert handle would report `settled()` for a
 * relationship that can never send.
 */
describe('link() on a destroyed tree', () => {
  const destroyedTree = () => {
    const tree = signalTree({
      x: 0,
      form: { a: 0 },
      rows: entityMap<{ id: string; n: number }, string>(),
    });
    tree.destroy();
    return tree;
  };

  it.each([
    ['a leaf', (t: ReturnType<typeof destroyedTree>) => t.$.x],
    ['a branch', (t: ReturnType<typeof destroyedTree>) => t.$.form],
    ['a collection', (t: ReturnType<typeof destroyedTree>) => t.$.rows],
    ['the root', (t: ReturnType<typeof destroyedTree>) => t.$],
  ] as const)('refuses %s with StudioTreeDestroyedError', (_label, source) => {
    const tree = destroyedTree();
    let subscribed = false;
    let error: unknown;
    try {
      link(source(tree) as never, {
        set: () => undefined,
        subscribe: () => {
          subscribed = true;
          return () => undefined;
        },
      });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(StudioTreeDestroyedError);
    expect((error as StudioTreeDestroyedError).code).toBe(
      'STUDIO_TREE_DESTROYED'
    );
    expect((error as Error).message).toMatch(/link/);
    expect(subscribed).toBe(false);
    expect(getTreeLinkCountForTesting(tree.$.x)).toBe(0);
  });

  it('acquires nothing on a destroyed collection', () => {
    const tree = destroyedTree();
    expect(() => link(tree.$.rows, { set: () => undefined })).toThrow(
      StudioTreeDestroyedError
    );
    expect(
      getEntityMembershipInventory(tree.$.rows as object)?.observed(true) ??
        false
    ).toBe(false);
  });

  it('refuses after a destroy that found Links to dispose, too', () => {
    const tree = signalTree({ x: 0 });
    link(tree.$.x, { set: () => undefined });
    tree.destroy();
    expect(() => link(tree.$.x, { set: () => undefined })).toThrow(
      StudioTreeDestroyedError
    );
  });

  it('keeps refusing an empty endpoint and an unowned source first', () => {
    const tree = destroyedTree();
    expect(() => link(tree.$.x, {})).toThrow(
      /at least one of get, set or subscribe/
    );
  });
});
