import { describe, expect, it } from 'vitest';

import {
  entityMap,
  link,
  restoration,
  signalTree,
  transactions,
  undoable,
} from '../index';
import {
  createEntityMembershipInventory,
  getEntityMembershipInventory,
  type EntityMembershipChange,
  type EntityMembershipInventory,
} from './internals/entity-membership-inventory';
import {
  entityMembershipReader,
  type EntityMembershipEvent,
} from './internals/entity-membership-view';
import { getPathNotifier } from './path-notifier';

/**
 * LINK ORDER DEMAND (15.4.4). A Link follows collection ORDER only.
 *
 * The first reorder repair subscribed Link to full entity membership, so a
 * linked collection built add, remove and rekey change records on every
 * structural operation for a consumer that reads only `reorder`. The
 * membership inventory now has an order-only tier: a Link observes order,
 * full membership stays unobserved unless a tooling reader asks for it, and
 * non-reorder operations commit no change records on a Link's behalf.
 */
type Row = { id: string; n: number };
const row = (id: string): Row => ({ id, n: id.charCodeAt(0) });
const rows = (ids: string): Row[] => [...ids].map(row);
const ids = (value: readonly Row[]) => value.map((r) => r.id).join('');
const flush = async () => {
  getPathNotifier().flushSync();
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

const make = () =>
  signalTree(
    { rows: entityMap<Row, string>() },
    { enhancers: [transactions(), restoration()] }
  );

/** Record the change list of every membership unit the collection commits. */
function recordCommits(inventory: EntityMembershipInventory) {
  const commits: EntityMembershipChange['kind'][][] = [];
  const begin = inventory.begin.bind(inventory);
  inventory.begin = () => {
    const unit = begin();
    return {
      commit: (changes) => {
        if (changes.length) commits.push(changes.map((change) => change.kind));
        unit.commit(changes);
      },
      cancel: () => unit.cancel(),
    };
  };
  return commits;
}

describe('a Link observes collection order, not full membership', () => {
  it('observes order only while it exists', async () => {
    const tree = make();
    tree.$.rows.setAll(rows('ABC'));
    await flush();
    const connection = link(tree.$.rows, { set: () => undefined });
    const inventory = getEntityMembershipInventory(tree.$.rows as object)!;
    expect(inventory.observed()).toBe(false);
    expect(inventory.observed(true)).toBe(true);
    connection.dispose();
    expect(inventory.observed(true)).toBe(false);
    tree.destroy();
  });

  it('non-reorder structural work commits no change records for a Link', async () => {
    const tree = make();
    tree.$.rows.setAll(rows('ABCD'));
    await flush();
    const sent: string[] = [];
    const connection = link(tree.$.rows, {
      set: (value) => void sent.push(ids(value)),
    });
    const commits = recordCommits(
      getEntityMembershipInventory(tree.$.rows as object)!
    );
    try {
      tree.$.rows.addMany(rows('EF'));
      tree.$.rows.addOne(row('G'));
      tree.$.rows.updateOne('A', { n: 0 });
      tree.$.rows.removeOne('G');
      tree.$.rows.removeMany(['E', 'F']);
      tree.$.rows.changeId('D', 'Z');
      tree.$.rows.setAll(rows('ABCZ'));
      tree.$.rows.prependOne(row('X'));
      await flush();
      // Only prependOne reorders; it commits that reorder and nothing else.
      expect(commits).toEqual([['reorder']]);

      // A setAll that removes, adds and reorders commits only the reorder.
      tree.$.rows.setAll(rows('CQA'));
      await flush();
      await connection.settled();
      expect(commits).toEqual([['reorder'], ['reorder']]);
      expect(sent.at(-1)).toBe('CQA');
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });

  it.each([
    [
      'an undone reorder',
      (t: ReturnType<typeof make>) => t.$.rows.setAll(rows('DCBA')),
      [['reorder'], ['reorder']],
    ],
    [
      'an undone removal',
      (t: ReturnType<typeof make>) => t.$.rows.removeMany(['A', 'B']),
      [],
    ],
  ] as const)(
    'reversals commit only what the Link reads: %s',
    async (_label, op, expected) => {
      const tree = make();
      tree.$.rows.setAll(rows('ABCD'));
      await flush();
      const sent: string[] = [];
      const connection = link(tree.$.rows, {
        set: (value) => void sent.push(ids(value)),
      });
      const commits = recordCommits(
        getEntityMembershipInventory(tree.$.rows as object)!
      );
      try {
        undoable(() => op(tree));
        await flush();
        await connection.settled();
        expect(sent.at(-1)).toBe(ids(tree.$.rows.all()));
        tree.undo();
        await flush();
        await connection.settled();
        expect(sent.at(-1)).toBe('ABCD');
        // A removal and its undo change no surviving order: no records at all.
        expect(commits).toEqual(expected);
      } finally {
        connection.dispose();
        tree.destroy();
      }
    }
  );

  it('a membership reader beside a Link still receives every change', async () => {
    const tree = make();
    tree.$.rows.setAll(rows('ABC'));
    await flush();
    const sent: string[] = [];
    const connection = link(tree.$.rows, {
      set: (value) => void sent.push(ids(value)),
    });
    const events: EntityMembershipEvent[] = [];
    const stop = entityMembershipReader(tree)!.subscribe((event) =>
      events.push(event)
    );
    try {
      expect(
        getEntityMembershipInventory(tree.$.rows as object)!.observed()
      ).toBe(true);
      tree.$.rows.setAll(rows('CXA'));
      await flush();
      await connection.settled();
      expect(
        events.flatMap((event) => event.changes.map((c) => c.kind))
      ).toEqual(['remove', 'add', 'reorder']);
      expect(sent).toEqual(['CXA']);
    } finally {
      stop();
      connection.dispose();
      tree.destroy();
    }
  });
});

describe('the membership inventory order tier', () => {
  const reorder = (
    before: number[],
    after: number[]
  ): EntityMembershipChange => ({
    kind: 'reorder',
    before,
    after,
  });

  it('observed() reports full listeners; observed(true) reports either tier', () => {
    const inventory = createEntityMembershipInventory(() => []);
    expect([inventory.observed(), inventory.observed(true)]).toEqual([
      false,
      false,
    ]);
    const stopOrder = inventory.subscribeOrder(() => undefined);
    expect([inventory.observed(), inventory.observed(true)]).toEqual([
      false,
      true,
    ]);
    const stopFull = inventory.subscribe(() => undefined);
    expect([inventory.observed(), inventory.observed(true)]).toEqual([
      true,
      true,
    ]);
    stopOrder();
    expect([inventory.observed(), inventory.observed(true)]).toEqual([
      true,
      true,
    ]);
    stopFull();
    expect([inventory.observed(), inventory.observed(true)]).toEqual([
      false,
      false,
    ]);
  });

  it('an order listener receives each reorder of a unit, in commit order, as copies', () => {
    const inventory = createEntityMembershipInventory(() => []);
    const received: Array<readonly number[]> = [];
    inventory.subscribeOrder((change) => received.push(change.after));
    const after = [2, 1];
    const unit = inventory.begin();
    unit.commit([
      { kind: 'add', lifetimeId: 3, key: 'c' },
      reorder([1, 2], after),
      reorder([2, 1], [1, 2]),
    ]);
    expect(received).toEqual([
      [2, 1],
      [1, 2],
    ]);
    expect(received[0]).not.toBe(after);
  });

  it('one order listener mutating its copy cannot change what the next one sees', () => {
    const inventory = createEntityMembershipInventory(() => []);
    const seen: number[][] = [];
    inventory.subscribeOrder((change) => {
      (change.after as number[]).push(99);
    });
    inventory.subscribeOrder((change) => void seen.push([...change.after]));
    inventory.subscribe((publication) => {
      const first = publication.changes[0];
      if (first.kind === 'reorder') (first.after as number[]).push(77);
    });
    inventory.begin().commit([reorder([1, 2], [2, 1])]);
    expect(seen).toEqual([[2, 1]]);
  });

  it('nested units deliver once, at the outermost commit', () => {
    const inventory = createEntityMembershipInventory(() => []);
    const received: Array<readonly number[]> = [];
    inventory.subscribeOrder((change) => received.push(change.after));
    const outer = inventory.begin();
    inventory.begin().commit([reorder([1, 2], [2, 1])]);
    expect(received).toEqual([]);
    outer.commit([]);
    expect(received).toEqual([[2, 1]]);
  });

  it('a unit with no reorder reaches no order listener', () => {
    const inventory = createEntityMembershipInventory(() => []);
    let calls = 0;
    inventory.subscribeOrder(() => void calls++);
    inventory.begin().commit([{ kind: 'remove', lifetimeId: 1, key: 'a' }]);
    expect(calls).toBe(0);
  });

  it('a throwing order listener cannot fail the commit or starve the others', () => {
    const inventory = createEntityMembershipInventory(() => []);
    const received: string[] = [];
    inventory.subscribeOrder(() => {
      throw new Error('listener');
    });
    inventory.subscribeOrder(() => void received.push('second'));
    inventory.subscribe(() => void received.push('full'));
    expect(() =>
      inventory.begin().commit([reorder([1, 2], [2, 1])])
    ).not.toThrow();
    expect(received.sort()).toEqual(['full', 'second']);
  });

  it('close() ends the order tier like the full one', () => {
    const inventory = createEntityMembershipInventory(() => []);
    let calls = 0;
    inventory.subscribeOrder(() => void calls++);
    inventory.close();
    expect(inventory.observed(true)).toBe(false);
    inventory.begin().commit([reorder([1, 2], [2, 1])]);
    expect(calls).toBe(0);
    expect(() => inventory.subscribeOrder(() => undefined)).toThrow(/closed/);
  });
});
