/**
 * LINK-REACTIVE-SETTLEMENT (15.4.4). `settled()` waits for sends caused by
 * REACTIVE writes: writes made by a notifier subscriber while it handles an
 * earlier write. Ported from the v16 slice 7 controls (b6633617), adapted to
 * the 15.x API (`transaction()`) and to 15.4.4's `destroy()`, which disposes
 * the tree's Links.
 *
 * A reactive write reaches the shared PathNotifier only at a LATER flush, one
 * microtask per hop. `settled()` checked the chain, retrievals and held sends,
 * all empty while that write was still queued, and resolved before its send
 * started: on f8ff7431 from one hop, and also for a write authored after
 * `settled()` in the same synchronous turn.
 *
 * The invariant, in every case below:
 *
 *   settled() never resolves while a send is unacknowledged, or while a queued
 *   notification can still become one; once it resolves, the endpoint's last
 *   value equals the linked location and no later send follows.
 *
 * Scope: queued notifications are writes that have already happened. Work in
 * ANOTHER relationship's endpoint call is that relationship's, not this one's;
 * a hop through it is visible here only once it writes the tree.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { entityMap, link, signalTree, transactions } from '../index';
import { getPathNotifier } from './path-notifier';
import { acquireObservation } from './internals/observation-substrate';

const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const cleanup: Array<() => void> = [];
afterEach(() => {
  for (const release of cleanup.splice(0).reverse()) release();
});

/** When `pattern` is delivered, run `react`. Arms the observed leaf. */
function hop(
  armed: unknown,
  pattern: string,
  react: (value: unknown) => void
): void {
  const release = acquireObservation(armed);
  const off = getPathNotifier().subscribe(pattern, (value) => react(value));
  cleanup.push(() => {
    off();
    release();
  });
}

type Send<V> = { value: V; ack: () => void };

/** An endpoint whose every send waits for an explicit acknowledgement. */
function slowEndpoint<V>() {
  const sent: V[] = [];
  const unacknowledged: Send<V>[] = [];
  const set = (value: V) =>
    new Promise<void>((resolve) => {
      sent.push(value);
      unacknowledged.push({ value, ack: resolve });
    });
  return { sent, unacknowledged, set };
}

/**
 * Acknowledge sends one at a time. Before each acknowledgement, and at every
 * quiet point, `settled()` must still be waiting; it must resolve once nothing
 * is left unacknowledged.
 */
async function acknowledgeAll<V>(
  endpoint: ReturnType<typeof slowEndpoint<V>>,
  isSettled: () => boolean
): Promise<void> {
  for (let laps = 0; ; laps++) {
    await nextTask();
    if (endpoint.unacknowledged.length === 0) break;
    expect(isSettled()).toBe(false);
    endpoint.unacknowledged.shift()!.ack();
    if (laps > 50) throw new Error('endpoint never went quiet');
  }
  await nextTask();
  expect(isSettled()).toBe(true);
}

function watch(connection: { settled(): Promise<void> }) {
  let settled = false;
  const done = connection.settled().then(() => {
    settled = true;
  });
  return { done, isSettled: () => settled };
}

/** Synchronous acknowledgement: settled() must not beat a later queued send. */
async function expectQuietAfterSettled<V>(
  connection: { settled(): Promise<void> },
  sent: V[],
  current: () => V
): Promise<void> {
  await connection.settled();
  const count = sent.length;
  await nextTask();
  await nextTask();
  expect(sent).toHaveLength(count);
  expect(sent.at(-1)).toEqual(current());
}

const scalarChain = (depth: number) => {
  const initial: Record<string, number> = {};
  for (let index = 0; index <= depth; index++) initial[`s${index}`] = 0;
  const tree = signalTree(initial);
  cleanup.push(() => tree.destroy());
  const at = (index: number) =>
    (tree.$ as unknown as Record<string, (value?: number) => number>)[
      `s${index}`
    ];
  for (let index = 0; index < depth; index++)
    hop(at(index), `s${index}`, (value) => at(index + 1)(value as number));
  return { tree, at };
};

describe('settled() waits for reactive writes', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])(
    'a scalar chain of %i hops (slow endpoint)',
    async (depth) => {
      const { at } = scalarChain(depth);
      const endpoint = slowEndpoint<number>();
      const connection = link(at(depth) as never, { set: endpoint.set });
      cleanup.push(() => connection.dispose());
      at(0)(7);
      const { done, isSettled } = watch(connection);
      await acknowledgeAll(endpoint, isSettled);
      await done;
      expect(endpoint.sent).toEqual([7]);
      expect(at(depth)()).toBe(7);
    }
  );

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])(
    'a scalar chain of %i hops (synchronous acknowledgement)',
    async (depth) => {
      const { at } = scalarChain(depth);
      const sent: number[] = [];
      const connection = link(at(depth) as never, {
        set: (value: number) => void sent.push(value),
      });
      cleanup.push(() => connection.dispose());
      at(0)(7);
      await expectQuietAfterSettled(connection, sent, () => at(depth)());
      expect(sent).toEqual([7]);
    }
  );

  it('a chain that passes through another tree', async () => {
    // The queue is shared by every tree. Three hops stay in the source tree
    // before the target is written, so a wait filtered to the relationship's
    // own tree sees nothing queued for it and stops early.
    const source = signalTree({ s0: 0, s1: 0, s2: 0, s3: 0 });
    const target = signalTree({ t: 0 });
    cleanup.push(() => {
      source.destroy();
      target.destroy();
    });
    const at = (index: number) =>
      (source.$ as unknown as Record<string, (value?: number) => number>)[
        `s${index}`
      ];
    for (let index = 0; index < 3; index++)
      hop(at(index), `s${index}`, (value) => at(index + 1)(value as number));
    hop(at(3), 's3', (value) => target.$.t(value as number));
    const endpoint = slowEndpoint<number>();
    const connection = link(target.$.t, { set: endpoint.set });
    cleanup.push(() => connection.dispose());
    at(0)(7);
    const { isSettled } = watch(connection);
    await acknowledgeAll(endpoint, isSettled);
    expect(endpoint.sent).toEqual([7]);
  });

  it('settled() requested inside a hop waits for the rest of the chain', async () => {
    const { at } = scalarChain(4);
    const endpoint = slowEndpoint<number>();
    const connection = link(at(4) as never, { set: endpoint.set });
    cleanup.push(() => connection.dispose());
    let watched: ReturnType<typeof watch> | undefined;
    hop(at(1), 's1', () => {
      watched ??= watch(connection);
    });
    at(0)(7);
    await nextTask();
    expect(watched).toBeDefined();
    await acknowledgeAll(endpoint, watched!.isSettled);
    expect(endpoint.sent).toEqual([7]);
  });
});

describe('mixed entity and scalar hops', () => {
  type Row = { id: string; n: number };
  const mixedTree = () => {
    const tree = signalTree({
      s0: 0,
      s1: 0,
      s2: 0,
      rows: entityMap<Row, string>(),
    });
    cleanup.push(() => tree.destroy());
    tree.$.rows.setAll([
      { id: 'a', n: 0 },
      { id: 'b', n: 0 },
    ]);
    return tree;
  };

  it('scalar -> entity row -> scalar, linked scalar', async () => {
    const tree = mixedTree();
    await nextTask();
    hop(tree.$.s0, 's0', (value) =>
      tree.$.rows.updateOne('a', { n: value as number })
    );
    hop(tree.$.rows, 'rows.a', (row) => tree.$.s1((row as Row).n));
    const endpoint = slowEndpoint<number>();
    const connection = link(tree.$.s1, { set: endpoint.set });
    cleanup.push(() => connection.dispose());
    tree.$.s0(7);
    const { isSettled } = watch(connection);
    await acknowledgeAll(endpoint, isSettled);
    expect(endpoint.sent).toEqual([7]);
  });

  it('scalar -> scalar -> entity row, linked collection', async () => {
    const tree = mixedTree();
    await nextTask();
    hop(tree.$.s0, 's0', (value) => tree.$.s1(value as number));
    hop(tree.$.s1, 's1', (value) =>
      tree.$.rows.updateOne('b', { n: value as number })
    );
    const endpoint = slowEndpoint<Row[]>();
    const connection = link(tree.$.rows, { set: endpoint.set });
    cleanup.push(() => connection.dispose());
    tree.$.s0(7);
    const { isSettled } = watch(connection);
    await acknowledgeAll(endpoint, isSettled);
    expect(endpoint.sent).toEqual([
      [
        { id: 'a', n: 0 },
        { id: 'b', n: 7 },
      ],
    ]);
  });

  it('entity row -> scalar -> entity row, linked collection', async () => {
    // 15.x cannot link an entity row field (it is not an owned location), so
    // the collection carries the last hop's write.
    const tree = mixedTree();
    await nextTask();
    hop(tree.$.rows, 'rows.a', (row) => tree.$.s2((row as Row).n));
    hop(tree.$.s2, 's2', (value) =>
      tree.$.rows.updateOne('b', { n: value as number })
    );
    const sent: Row[][] = [];
    const connection = link(tree.$.rows, {
      set: (value) => void sent.push(value.map((row) => ({ ...row }))),
    });
    cleanup.push(() => connection.dispose());
    tree.$.rows.updateOne('a', { n: 7 });
    await expectQuietAfterSettled(connection, sent, () =>
      tree.$.rows.all().map((row) => ({ ...row }))
    );
    expect(sent.at(-1)).toEqual([
      { id: 'a', n: 7 },
      { id: 'b', n: 7 },
    ]);
  });

  it('an order-only change made by a hop', async () => {
    const tree = mixedTree();
    await nextTask();
    hop(tree.$.s0, 's0', () =>
      tree.$.rows.setAll([...tree.$.rows.all()].reverse())
    );
    const endpoint = slowEndpoint<Row[]>();
    const connection = link(tree.$.rows, { set: endpoint.set });
    cleanup.push(() => connection.dispose());
    tree.$.s0(7);
    const { isSettled } = watch(connection);
    await acknowledgeAll(endpoint, isSettled);
    expect(endpoint.sent.map((rows) => rows.map((row) => row.id))).toEqual([
      ['b', 'a'],
    ]);
  });
});

describe('a hop that writes nothing ends the chain', () => {
  it.each(['nothing', 'an equal value'] as const)(
    'settled() resolves when the hop writes %s',
    async (kind) => {
      const tree = signalTree({ s0: 0, s1: 3 });
      cleanup.push(() => tree.destroy());
      hop(tree.$.s0, 's0', () => {
        if (kind === 'an equal value') tree.$.s1(tree.$.s1());
      });
      const sent: number[] = [];
      const connection = link(tree.$.s1, {
        set: (value) => void sent.push(value),
      });
      cleanup.push(() => connection.dispose());
      tree.$.s0(7);
      const { done, isSettled } = watch(connection);
      await nextTask();
      expect(isSettled()).toBe(true);
      await done;
      expect(sent).toEqual([]);
    }
  );

  it('the linked write is acknowledged while downstream hops write nothing', async () => {
    const { at } = scalarChain(2);
    hop(at(2), 's2', () => undefined);
    const endpoint = slowEndpoint<number>();
    const connection = link(at(0) as never, { set: endpoint.set });
    cleanup.push(() => connection.dispose());
    at(0)(7);
    const { isSettled } = watch(connection);
    await acknowledgeAll(endpoint, isSettled);
    expect(endpoint.sent).toEqual([7]);
  });
});

describe('hops and pending transactions', () => {
  /** s0 -> s1 -> ... -> s{depth}, on a transactional tree. */
  const transactionalChain = (depth: number) => {
    const initial: Record<string, number> = {};
    for (let index = 0; index <= depth; index++) initial[`s${index}`] = 0;
    const tree = signalTree(initial, { enhancers: [transactions()] });
    cleanup.push(() => tree.destroy());
    const at = (index: number) =>
      (tree.$ as unknown as Record<string, (value?: number) => number>)[
        `s${index}`
      ];
    return { tree, at };
  };
  const chainFrom = (
    at: (index: number) => (value?: number) => number,
    from: number,
    to: number
  ) => {
    for (let index = from; index < to; index++)
      hop(at(index), `s${index}`, (value) => at(index + 1)(value as number));
  };

  it.each([
    ['confirm', 2],
    ['rollback', 2],
    ['confirm', 4],
    ['rollback', 4],
  ] as const)(
    'hops of a write authored inside a pending transaction, then %s (%i hops)',
    async (outcome, depth) => {
      const { tree, at } = transactionalChain(depth);
      chainFrom(at, 0, depth);
      const endpoint = slowEndpoint<number>();
      const connection = link(at(depth) as never, { set: endpoint.set });
      cleanup.push(() => connection.dispose());
      const pending = tree.transaction(() => at(0)(7));
      const { isSettled } = watch(connection);
      for (let index = 0; index <= depth; index++) await nextTask();
      // The hops ran, but the tree-wide hold keeps their send waiting.
      expect(at(depth)()).toBe(7);
      expect(endpoint.sent).toEqual([]);
      expect(isSettled()).toBe(false);
      pending[outcome]();
      await acknowledgeAll(endpoint, isSettled);
      expect(at(depth)()).toBe(outcome === 'confirm' ? 7 : 0);
      expect(endpoint.sent.at(-1)).toBe(at(depth)());
    }
  );

  it.each([
    ['confirm', 2],
    ['rollback', 2],
    ['confirm', 4],
    ['rollback', 4],
    ['rollback', 12],
  ] as const)(
    'synchronous acknowledgement after %s of a transaction with hops (%i hops)',
    async (outcome, depth) => {
      const { tree, at } = transactionalChain(depth);
      chainFrom(at, 0, depth);
      const sent: number[] = [];
      const connection = link(at(depth) as never, {
        set: (value: number) => void sent.push(value),
      });
      cleanup.push(() => connection.dispose());
      const pending = tree.transaction(() => at(0)(7));
      for (let index = 0; index <= depth; index++) await nextTask();
      pending[outcome]();
      await expectQuietAfterSettled(connection, sent, () => at(depth)());
      expect(at(depth)()).toBe(outcome === 'confirm' ? 7 : 0);
    }
  );

  it.each([2, 4])(
    'a transaction confirmed before delivery, then %i hops',
    async (depth) => {
      const { tree, at } = transactionalChain(depth);
      chainFrom(at, 0, depth);
      const endpoint = slowEndpoint<number>();
      const connection = link(at(depth) as never, { set: endpoint.set });
      cleanup.push(() => connection.dispose());
      tree.transaction(() => at(0)(7)).confirm();
      const { isSettled } = watch(connection);
      await acknowledgeAll(endpoint, isSettled);
      expect(endpoint.sent).toEqual([7]);
    }
  );

  it.each([
    ['confirm', 2],
    ['rollback', 2],
    ['confirm', 4],
    ['rollback', 4],
  ] as const)(
    'a hop that opens its own transaction, then %s (%i further hops)',
    async (outcome, depth) => {
      const { tree, at } = transactionalChain(depth + 1);
      let pending: { confirm(): void; rollback(): void } | undefined;
      hop(at(0), 's0', (value) => {
        pending = tree.transaction(() => at(1)(value as number));
      });
      chainFrom(at, 1, depth + 1);
      const endpoint = slowEndpoint<number>();
      const connection = link(at(depth + 1) as never, { set: endpoint.set });
      cleanup.push(() => connection.dispose());
      at(0)(7);
      const { isSettled } = watch(connection);
      for (let index = 0; index <= depth + 1; index++) await nextTask();
      expect(pending).toBeDefined();
      expect(endpoint.sent).toEqual([]);
      expect(isSettled()).toBe(false);
      pending![outcome]();
      await acknowledgeAll(endpoint, isSettled);
      expect(at(1)()).toBe(outcome === 'confirm' ? 7 : 0);
      expect(endpoint.sent.at(-1)).toBe(at(depth + 1)());
    }
  );
});

describe('destroy() in the middle of a chain', () => {
  // 15.4.4: destroy() disposes the tree's Links, so settled() resolves and
  // nothing further is sent once the tree is gone.
  it.each(['before', 'after'] as const)(
    'a hop destroys the tree %s writing the linked location',
    async (order) => {
      const tree = signalTree({ s0: 0, s1: 0, s2: 0 });
      hop(tree.$.s0, 's0', (value) => tree.$.s1(value as number));
      hop(tree.$.s1, 's1', (value) => {
        if (order === 'before') tree.destroy();
        tree.$.s2(value as number);
        if (order === 'after') tree.destroy();
      });
      const endpoint = slowEndpoint<number>();
      const connection = link(tree.$.s2, { set: endpoint.set });
      cleanup.push(() => connection.dispose());
      tree.$.s0(7);
      const { done, isSettled } = watch(connection);
      await acknowledgeAll(endpoint, isSettled);
      await done;
      expect(endpoint.sent).toEqual([]);
    }
  );

  it('the tree is destroyed between hops while the linked send is in flight', async () => {
    // The send to s1 starts after the flush delivering s2; s3's hop, one
    // flush later, destroys the tree while that send is unacknowledged.
    const { tree, at } = scalarChain(4);
    const endpoint = slowEndpoint<number>();
    const connection = link(at(1) as never, { set: endpoint.set });
    cleanup.push(() => connection.dispose());
    hop(at(3), 's3', () => tree.destroy());
    at(0)(7);
    const { done, isSettled } = watch(connection);
    for (let laps = 0; laps < 5; laps++) await nextTask();
    // The in-flight send is the endpoint's; the disposed Link owns no work.
    expect(endpoint.sent).toEqual([7]);
    expect(isSettled()).toBe(true);
    endpoint.unacknowledged.shift()?.ack();
    await done;
  });
});

describe('disposal and public-API hops', () => {
  it('dispose() from a hop releases a waiting settled()', async () => {
    const { at } = scalarChain(3);
    const endpoint = slowEndpoint<number>();
    const connection = link(at(3) as never, { set: endpoint.set });
    hop(at(1), 's1', () => connection.dispose());
    at(0)(7);
    const { done } = watch(connection);
    await nextTask();
    await done;
    expect(endpoint.sent).toEqual([]);
  });

  it('a canonical value pushed back before the endpoint acknowledges, then relayed by hops', async () => {
    // The write arrives while settled() is already waiting on this
    // relationship's chain: the backend announces the canonical form of each
    // save before acknowledging it, and reactive hops carry it back to the
    // linked location. Six hops outlast the acknowledgement's own microtasks,
    // so the chain completes before the relayed write is delivered.
    const relays = 6;
    const initial: Record<string, string> = { draft: '', canonical: '' };
    for (let index = 0; index < relays; index++) initial[`r${index}`] = '';
    const tree = signalTree(initial);
    cleanup.push(() => tree.destroy());
    const at = (name: string) =>
      (tree.$ as unknown as Record<string, (value?: string) => string>)[name];
    const names = ['canonical'];
    for (let index = 0; index < relays; index++) names.push(`r${index}`);
    names.push('draft');
    for (let index = 0; index < names.length - 1; index++)
      hop(at(names[index]), names[index], (value) =>
        at(names[index + 1])(value as string)
      );
    const listeners = new Set<(value: string) => void>();
    const acks: Array<() => void> = [];
    const sent: string[] = [];
    const save = link(at('draft') as never, {
      set: (value: string) =>
        new Promise<void>((resolve) => {
          sent.push(value);
          acks.push(() => {
            for (const listener of listeners) listener(value.toUpperCase());
            resolve();
          });
        }),
    });
    const mirror = link(
      at('canonical') as never,
      {
        subscribe: (next: (value: string) => void) => {
          listeners.add(next);
          return () => void listeners.delete(next);
        },
      } as never
    );
    cleanup.push(() => {
      save.dispose();
      mirror.dispose();
    });
    at('draft')('hello');
    const { done, isSettled } = watch(save);
    for (let laps = 0; ; laps++) {
      await nextTask();
      if (acks.length === 0) break;
      expect(isSettled()).toBe(false);
      acks.shift()!();
      if (laps > 10) throw new Error('endpoint never went quiet');
    }
    await done;
    expect(sent).toEqual(['hello', 'HELLO']);
    expect(at('draft')()).toBe('HELLO');
  });

  it("an endpoint echo through another relationship stays that relationship's work", async () => {
    // Scope, as in 16.x: queued notifications count, another relationship's
    // queued endpoint call does not. Here `save` has not called its endpoint
    // when the audit relationship's settled() looks, so the echo is save's
    // work; settling save first and then audit observes it. (16.x passes the
    // single-await form of this case only through its microtask order.)
    const tree = signalTree({ draft: '', saved: '' });
    cleanup.push(() => tree.destroy());
    const listeners = new Set<(value: string) => void>();
    const save = link(tree.$.draft, {
      set: (value) => {
        for (const listener of listeners) listener(value);
      },
    });
    const mirror = link(tree.$.saved, {
      subscribe: (next) => {
        listeners.add(next);
        return () => void listeners.delete(next);
      },
    });
    const endpoint = slowEndpoint<string>();
    const audit = link(tree.$.saved, { set: endpoint.set });
    cleanup.push(() => {
      save.dispose();
      mirror.dispose();
      audit.dispose();
    });
    tree.$.draft('hello');
    await save.settled();
    const { isSettled } = watch(audit);
    await acknowledgeAll(endpoint, isSettled);
    expect(endpoint.sent).toEqual(['hello']);
    expect(tree.$.saved()).toBe('hello');
  });
});

describe('a write authored after settled() in the same synchronous turn', () => {
  it.each(['a scalar', 'a collection'] as const)(
    'is waited for (%s)',
    async (kind) => {
      type Row = { id: string; n: number };
      const tree = signalTree({ x: 0, rows: entityMap<Row, string>() });
      cleanup.push(() => tree.destroy());
      const endpoint = slowEndpoint<unknown>();
      const connection =
        kind === 'a scalar'
          ? link(tree.$.x, {
              set: endpoint.set as (v: number) => Promise<void>,
            })
          : link(tree.$.rows, {
              set: endpoint.set as (v: Row[]) => Promise<void>,
            });
      cleanup.push(() => connection.dispose());
      const { isSettled } = watch(connection);
      if (kind === 'a scalar') tree.$.x(1);
      else tree.$.rows.addOne({ id: 'a', n: 1 });
      await acknowledgeAll(endpoint, isSettled);
      expect(endpoint.sent).toHaveLength(1);
    }
  );
});
