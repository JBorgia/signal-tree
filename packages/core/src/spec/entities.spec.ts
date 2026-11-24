/**
 * Spec tests for keyed collections: BRIEF.md 5.1 rows E1 and E2, and 12.5 rows
 * E3 and E4. Written from the spec; each title carries the row it proves.
 */
import { describe, expect, it } from 'vitest';
import { PlainCell, SignalTreeError, entityMap, signalTree } from '@signal-tree/core';

interface Task {
  id: number;
  title: string;
  done: boolean;
}

const seed = (): Task[] => [
  { id: 1, title: 'one', done: false },
  { id: 2, title: 'two', done: false },
  { id: 3, title: 'three', done: false },
];

const tasks = (rows: Task[] = seed()) => signalTree({ tasks: entityMap<Task, number>({ rows }) });

const refused = (fn: () => unknown): SignalTreeError => {
  try {
    fn();
  } catch (error) {
    if (error instanceof SignalTreeError) return error;
    throw error;
  }
  throw new Error('expected a typed refusal');
};

describe('row handles and entity lifetime', () => {
  it('[E1] a held row handle follows its row through a key change by changeId', () => {
    const tree = tasks();
    const held = tree.$.tasks.byId(2)!;
    tree.$.tasks.changeId(2, 20);
    expect(tree.$.tasks.byId(20)).toBe(held);
    expect(held.get()).toEqual({ id: 20, title: 'two', done: false });
  });

  it('[E1] an update that changes what selectId returns is a key change that keeps the row’s lifetime', () => {
    const tree = signalTree({ people: entityMap<{ email: string; name: string }, string>({ selectId: (p) => p.email }) });
    tree.$.people.addOne({ email: 'a@x', name: 'Ada' });
    const held = tree.$.people.byId('a@x')!;
    tree.$.people.updateOne('a@x', { email: 'ada@x' });
    expect(tree.$.people.byId('ada@x')).toBe(held);
    expect(tree.$.people.byId('a@x')).toBeUndefined();
    expect(held.name.get()).toBe('Ada');
  });

  it('[E1] a reused key never retargets an old handle', () => {
    const tree = tasks();
    const held = tree.$.tasks.byId(1)!;
    const title = held.title;
    tree.$.tasks.removeOne(1);
    tree.$.tasks.addOne({ id: 1, title: 'new one', done: true });
    const fresh = tree.$.tasks.byId(1)!;
    expect(fresh).not.toBe(held);
    expect(held.get()).toBeUndefined();
    expect(title.get()).toBeUndefined();
    expect(fresh.title.get()).toBe('new one');
    expect(() => title.set('x')).toThrow(SignalTreeError);
    expect(fresh.title.get()).toBe('new one');
  });

  it('[E1] a key freed by a key change, then reused, does not retarget the moved row’s handle', () => {
    const tree = tasks();
    const held = tree.$.tasks.byId(1)!;
    tree.$.tasks.changeId(1, 10);
    tree.$.tasks.addOne({ id: 1, title: 'reuse', done: false });
    expect(tree.$.tasks.byId(10)).toBe(held);
    expect(tree.$.tasks.byId(1)).not.toBe(held);
    expect(held.title.get()).toBe('one');
  });

  it('[E2] field carriers are created on first access and stable per handle', () => {
    const tree = tasks();
    const row = tree.$.tasks.byId(3)!;
    const done = row.done;
    expect(done).toBeInstanceOf(PlainCell);
    expect(row.done).toBe(done);
    expect(tree.$.tasks.byId(3)!.done).toBe(done);
    tree.$.tasks.updateOne(3, { done: true });
    tree.$.tasks.changeId(3, 30);
    expect(row.done).toBe(done);
    expect(done.get()).toBe(true);
  });

  it('[E2] a field carrier reads and writes the row’s field', () => {
    const tree = tasks();
    const title = tree.$.tasks.byId(2)!.title;
    title.set('second');
    expect(tree.$.tasks.byId(2)!.get()!.title).toBe('second');
    tree.$.tasks.updateOne(2, { title: 'deuxième' });
    expect(title.get()).toBe('deuxième');
  });
});

describe('atomic entity calls', () => {
  const unchanged = (call: (t: ReturnType<typeof tasks>) => unknown, key: unknown) => {
    const tree = tasks();
    const held = tree.$.tasks.byId(1)!;
    const before = tree.$.tasks.all();
    const error = refused(() => call(tree));
    expect(error.key).toEqual(key);
    expect(tree.$.tasks.all()).toEqual(before);
    expect(tree.$.tasks.byId(1)).toBe(held);
    return tree;
  };

  it('[E3] addOne and addMany on an existing key refuse the whole call, naming the key', () => {
    unchanged((t) => t.$.tasks.addOne({ id: 2, title: 'dup', done: false }), 2);
    unchanged((t) => t.$.tasks.addMany([{ id: 4, title: 'ok', done: false }, { id: 3, title: 'dup', done: false }]), 3);
  });

  it('[E3] updateOne, updateMany, removeOne and removeMany on a missing key refuse the whole call', () => {
    unchanged((t) => t.$.tasks.updateOne(9, { done: true }), 9);
    unchanged((t) => t.$.tasks.updateMany([{ id: 1, changes: { done: true } }, { id: 9, changes: { done: true } }]), 9);
    unchanged((t) => t.$.tasks.removeOne(9), 9);
    unchanged((t) => t.$.tasks.removeMany([1, 9]), 9);
  });

  it('[E3] changeId from a missing key, or a key change onto an occupied key, refuses', () => {
    unchanged((t) => t.$.tasks.changeId(9, 10), 9);
    unchanged((t) => t.$.tasks.changeId(1, 2), 2);
    unchanged((t) => t.$.tasks.updateOne(1, { id: 3 }), 3);
  });

  it('[E3] a key repeated within one call’s input refuses the whole call', () => {
    unchanged((t) => t.$.tasks.addMany([{ id: 5, title: 'a', done: false }, { id: 5, title: 'b', done: false }]), 5);
    unchanged((t) => t.$.tasks.removeMany([2, 2]), 2);
    unchanged((t) => t.$.tasks.updateMany([{ id: 1, changes: {} }, { id: 1, changes: {} }]), 1);
    unchanged((t) => t.$.tasks.setAll([{ id: 7, title: 'a', done: false }, { id: 7, title: 'b', done: false }]), 7);
  });

  it('[E3] a refused call leaves earlier work reversible', () => {
    const tree = tasks();
    tree.turn(() => {
      tree.$.tasks.updateOne(1, { done: true });
      refused(() => tree.$.tasks.addOne({ id: 1, title: 'dup', done: false }));
    });
    expect(tree.$.tasks.byId(1)!.done.get()).toBe(true);
    expect(() =>
      tree.turn(() => {
        tree.$.tasks.updateOne(2, { done: true });
        refused(() => tree.$.tasks.removeOne(9));
        throw new Error('revert');
      }),
    ).toThrow('revert');
    expect(tree.$.tasks.byId(2)!.done.get()).toBe(false);
  });

  it('[E3] a successful update keeps the row’s lifetime, and changeId to the same key changes nothing', () => {
    const tree = tasks();
    const held = tree.$.tasks.byId(1)!;
    let runs = 0;
    held.id.subscribe(() => runs++);
    tree.$.tasks.updateOne(1, { title: 'uno' });
    tree.$.tasks.changeId(1, 1);
    expect(tree.$.tasks.byId(1)).toBe(held);
    expect(runs).toBe(0);
    expect(tree.$.tasks.ids()).toEqual([1, 2, 3]);
  });
});

describe('collection order', () => {
  it('[E4] order is insertion order, reported by all() and ids()', () => {
    const tree = tasks([]);
    tree.$.tasks.addOne({ id: 3, title: 'c', done: false });
    tree.$.tasks.addOne({ id: 1, title: 'a', done: false });
    tree.$.tasks.addOne({ id: 2, title: 'b', done: false });
    expect(tree.$.tasks.ids()).toEqual([3, 1, 2]);
    expect(tree.$.tasks.all().map((t) => t.id)).toEqual([3, 1, 2]);
    expect(tree.$.get().tasks.map((t) => t.id)).toEqual([3, 1, 2]);
  });

  it('[E4] new rows append after the existing tail in input order', () => {
    const tree = tasks();
    tree.$.tasks.addMany([{ id: 9, title: 'i', done: false }, { id: 5, title: 'e', done: false }]);
    tree.$.tasks.upsertMany([{ id: 2, title: 'B', done: true }, { id: 4, title: 'd', done: false }]);
    expect(tree.$.tasks.ids()).toEqual([1, 2, 3, 9, 5, 4]);
  });

  it('[E4] changeId and updates keep a row’s position', () => {
    const tree = tasks();
    tree.$.tasks.changeId(1, 100);
    tree.$.tasks.updateOne(2, { title: 'moved?' });
    expect(tree.$.tasks.ids()).toEqual([100, 2, 3]);
  });

  it('[E4] setAll and a whole-value write set the order to the input’s order', () => {
    const tree = tasks();
    tree.$.tasks.setAll([seed()[2]!, seed()[0]!, seed()[1]!]);
    expect(tree.$.tasks.ids()).toEqual([3, 1, 2]);
    const nested = signalTree({ board: { tasks: entityMap<Task, number>({ rows: seed() }) } as Record<string, unknown> });
    const board = nested.$.board as unknown as { set(v: unknown): void; tasks: { ids(): number[] } };
    board.tasks.ids();
    board.set({ tasks: [seed()[1]!, seed()[2]!] });
    expect(board.tasks.ids()).toEqual([2, 3]);
  });

  it('[E4] a removal closes the gap', () => {
    const tree = tasks();
    tree.$.tasks.removeOne(2);
    expect(tree.$.tasks.ids()).toEqual([1, 3]);
    tree.$.tasks.addOne({ id: 2, title: 'back', done: false });
    expect(tree.$.tasks.ids()).toEqual([1, 3, 2]);
  });

  it('[E4] an all() result already returned never changes', () => {
    const tree = tasks();
    const first = tree.$.tasks.all();
    const copy = JSON.parse(JSON.stringify(first));
    tree.$.tasks.updateOne(1, { done: true });
    tree.$.tasks.removeOne(2);
    tree.$.tasks.setAll([]);
    expect(first).toEqual(copy);
    expect(Object.isFrozen(first)).toBe(true);
  });
});
