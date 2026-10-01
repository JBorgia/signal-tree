import { describe, expect, it, vi } from 'vitest';
import { signalTree } from '../../lib/signal-tree';
import { entityMap } from '../../lib/markers/entity-map';
import { undoable } from '../../lib/undoable';
import { getPathNotifier } from '../../lib/path-notifier';
import {
  entityMembershipReader,
  type EntityMembershipEvent,
  type EntityMembershipSnapshot,
} from '../../lib/internals/entity-membership-view';
import { transactions } from '../transactions/transactions';
import { restoration } from './restoration';

// Promoted from the independent review of the reader slice. A replica that
// applies membership events in delivery order must always equal the reader's
// snapshot, and a listener must never see a partially applied reversal:
//   - a listener's reentrant write could be delivered before an earlier-committed
//     collection of the same reversal (inverted deltas);
//   - a throw while publishing a reversal could drop later collections' deltas;
//   - reversals mixing structure with row values applied one effect at a time
//     and exposed intermediate inventories.
type Row = { id: string; n: number };
const row = (id: string, n = 0): Row => ({ id, n });
const flush = async () => {
  for (let i = 0; i < 16; i++) await Promise.resolve();
};
const ORDERS = [
  ['transactions, restoration', () => [transactions(), restoration()]],
  ['restoration, transactions', () => [restoration(), transactions()]],
] as const;
type Member = { lifetimeId: number; key: string | number };

class Replica {
  readonly lists = new Map<number, Member[]>();
  readonly issues: string[] = [];
  constructor(snapshot: EntityMembershipSnapshot) {
    for (const c of snapshot.collections)
      this.lists.set(
        c.collectionPosition,
        c.members.map((m) => ({ ...m }))
      );
  }
  apply(event: EntityMembershipEvent): void {
    const owner = event.collection.collectionPosition;
    const list = this.lists.get(owner) ?? [];
    this.lists.set(owner, list);
    const at = (id: number) => list.findIndex((m) => m.lifetimeId === id);
    const deferred: Extract<
      EntityMembershipEvent['changes'][number],
      { kind: 'add' }
    >[] = [];
    const tryAdd = (change: (typeof deferred)[number]): boolean => {
      if (at(change.lifetimeId) !== -1) {
        this.issues.push(
          `seq${event.sequence} duplicate add ${change.lifetimeId}`
        );
        return true;
      }
      let index = 0;
      if (change.beforeLifetimeId !== undefined) {
        const before = at(change.beforeLifetimeId);
        if (before === -1) return false;
        index = before + 1;
      }
      list.splice(index, 0, { lifetimeId: change.lifetimeId, key: change.key });
      return true;
    };
    const drain = () => {
      for (let progress = true; deferred.length && progress; ) {
        progress = false;
        for (let k = 0; k < deferred.length; k++)
          if (tryAdd(deferred[k])) {
            deferred.splice(k--, 1);
            progress = true;
          }
      }
    };
    for (const change of event.changes) {
      if (change.kind === 'remove') {
        const index = at(change.lifetimeId);
        if (index === -1 || list[index].key !== change.key)
          this.issues.push(
            `seq${event.sequence} remove ${change.lifetimeId} does not match`
          );
        if (index !== -1) list.splice(index, 1);
      } else if (change.kind === 'rekey') {
        const index = at(change.lifetimeId);
        if (index === -1 || list[index].key !== change.beforeKey)
          this.issues.push(
            `seq${event.sequence} rekey ${change.lifetimeId} does not match`
          );
        if (index !== -1) list[index].key = change.afterKey;
      } else if (change.kind === 'add') {
        if (!tryAdd(change)) deferred.push(change);
        drain();
      } else {
        drain();
        const current = list.map((m) => m.lifetimeId);
        if (JSON.stringify(current) !== JSON.stringify(change.before))
          this.issues.push(
            `seq${event.sequence} reorder before does not match`
          );
        const next = change.after.map((id) =>
          list.find((m) => m.lifetimeId === id)
        );
        if (next.some((m) => !m))
          this.issues.push(`seq${event.sequence} reorder unknown lifetime`);
        else list.splice(0, list.length, ...(next as Member[]));
      }
    }
    drain();
    for (const change of deferred)
      this.issues.push(
        `seq${event.sequence} add ${change.lifetimeId} has unknown predecessor`
      );
  }
  compare(snapshot: EntityMembershipSnapshot, label: string): void {
    for (const c of snapshot.collections) {
      const mine = this.lists.get(c.collectionPosition) ?? [];
      if (JSON.stringify(mine) !== JSON.stringify(c.members))
        this.issues.push(
          `${label}: replica differs from snapshot at ${c.path}`
        );
    }
  }
}

const NAMES = ['left', 'right', 'third'] as const;
type Name = (typeof NAMES)[number];
type Enhancers = (typeof ORDERS)[number][1];
const make = (enhancers: Enhancers) =>
  signalTree(
    {
      left: entityMap<Row, string>(),
      right: entityMap<Row, string>(),
      third: entityMap<Row, string>(),
    },
    { enhancers: enhancers() }
  );
type Tree = ReturnType<typeof make>;
const ids = (tree: Tree) => NAMES.map((name) => tree.$[name].ids());
const ACTS: Record<string, (tree: Tree, name: Name) => void> = {
  add: (t, n) => t.$[n].addOne(row('x', 5)),
  remove: (t, n) => t.$[n].removeOne('a'),
  removeMid: (t, n) => {
    if (t.$[n].has('b')()) t.$[n].removeOne('b');
  },
  rekey: (t, n) => t.$[n].changeId('a', 'z'),
  clear: (t, n) => t.$[n].clear(),
  setAll: (t, n) => t.$[n].setAll([row('q', 31), row('a', 30)]),
  readd: (t, n) => {
    t.$[n].removeOne('a');
    t.$[n].addOne(row('a', 40));
  },
  prepend: (t, n) => t.$[n].prependOne(row('p', 6)),
  field: (t, n) => t.$[n].byId('a')!.n(50),
  removeTwo: (t, n) => {
    t.$[n].removeOne('a');
    if (t.$[n].has('b')()) t.$[n].removeOne('b');
  },
};

describe.each(ORDERS)(
  'membership delivery during reversals (%s)',
  (_order, enhancers) => {
    for (const [leftName, left] of Object.entries(ACTS))
      for (const [rightName, right] of Object.entries(ACTS)) {
        it(`left ${leftName} + right ${rightName}`, async () => {
          const error = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
          const tree = make(enhancers);
          try {
            tree.$.left.addMany([row('a', 1), row('b', 2), row('c', 3)]);
            tree.$.right.addMany([row('a', 11), row('b', 12)]);
            tree.$.third.addMany([row('a', 21)]);
            await flush();
            const reader = entityMembershipReader(tree)!;
            const replica = new Replica(reader.snapshot());
            const problems: string[] = [];
            let expected: unknown;
            let label = '';
            reader.subscribe((event) => {
              const keys = NAMES.map((name) => {
                const c = reader
                  .snapshot()
                  .collections.find((x) => x.path === name);
                return c?.members.map((m) => m.key);
              });
              if (expected && JSON.stringify(keys) !== JSON.stringify(expected))
                problems.push(
                  `${label}: partial reversal visible to a listener`
                );
              replica.apply(event);
            });
            const seeded = ids(tree);
            const act = () => {
              left(tree, 'left');
              right(tree, 'right');
            };
            undoable(act);
            await flush();
            const after = ids(tree);
            const run = (
              name: string,
              operation: () => void,
              target: unknown
            ) => {
              label = name;
              expected = target;
              operation();
              expected = undefined;
              if (JSON.stringify(ids(tree)) !== JSON.stringify(target))
                problems.push(`${name}: final state differs`);
              replica.compare(reader.snapshot(), name);
            };
            run('undo', () => tree.undo(), seeded);
            run('redo', () => tree.redo(), after);
            run('undo again', () => tree.undo(), seeded);
            const pending = tree.transaction(act);
            replica.compare(reader.snapshot(), 'transaction');
            run('rollback', () => pending.rollback(), seeded);
            expect([...problems, ...replica.issues]).toEqual([]);
          } finally {
            error.mockRestore();
            tree.destroy();
          }
        });
      }
  }
);

describe.each(ORDERS)(
  'reentrant and failing delivery (%s)',
  (_order, enhancers) => {
    for (const via of ['undo', 'rollback'] as const)
      for (const write of ['remove', 'rekey', 'update'] as const) {
        it(`a listener ${write} of the other collection queues after the reversal (${via})`, async () => {
          const error = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
          const tree = signalTree(
            { left: entityMap<Row, string>(), right: entityMap<Row, string>() },
            { enhancers: enhancers() }
          );
          try {
            tree.$.left.addMany([row('a', 1), row('b', 2)]);
            tree.$.right.addMany([row('b', 11), row('a', 12)]);
            await flush();
            const reader = entityMembershipReader(tree)!;
            const replica = new Replica(reader.snapshot());
            let armed = false;
            let writeError: unknown;
            const restored = { left: 'b', right: 'a' } as const;
            reader.subscribe((event) => {
              replica.apply(event);
              if (!armed) return;
              armed = false;
              const other = event.collection.path === 'left' ? 'right' : 'left';
              try {
                if (write === 'remove')
                  tree.$[other].removeOne(restored[other]);
                if (write === 'rekey')
                  tree.$[other].changeId(restored[other], 'k');
                if (write === 'update')
                  tree.$[other].updateOne(restored[other], { n: 5 });
              } catch (failure) {
                writeError = failure;
              }
            });
            const act = () => {
              tree.$.left.changeId('b', 'z');
              tree.$.right.changeId('a', 'y');
            };
            let pending: ReturnType<typeof tree.transaction> | undefined;
            if (via === 'undo') {
              undoable(act);
              await flush();
            } else pending = tree.transaction(act);
            armed = true;
            if (via === 'undo') tree.undo();
            else pending!.rollback();
            await flush();
            replica.compare(reader.snapshot(), 'after');
            expect({ issues: replica.issues, writeError }).toEqual({
              issues: [],
              writeError: undefined,
            });
          } finally {
            error.mockRestore();
            tree.destroy();
          }
        });
      }

    for (const via of ['undo', 'rollback'] as const)
      it(`a subscriber throwing while a reversal publishes does not drop deltas (${via})`, async () => {
        const error = vi
          .spyOn(console, 'error')
          .mockImplementation(() => undefined);
        const notifier = getPathNotifier();
        const tree = signalTree(
          { left: entityMap<Row, string>(), right: entityMap<Row, string>() },
          { enhancers: enhancers() }
        );
        let stop: (() => void) | undefined;
        try {
          tree.$.left.addMany([row('a', 1), row('b', 2)]);
          tree.$.right.addMany([row('b', 11), row('a', 12)]);
          await flush();
          const reader = entityMembershipReader(tree)!;
          const replica = new Replica(reader.snapshot());
          reader.subscribe((event) => replica.apply(event));
          const act = () => {
            tree.$.left.changeId('b', 'z');
            tree.$.right.changeId('a', 'y');
          };
          let pending: ReturnType<typeof tree.transaction> | undefined;
          if (via === 'undo') {
            undoable(act);
            await flush();
          } else pending = tree.transaction(act);
          notifier.flushSync();
          notifier.setBatchingEnabled(false);
          let fired = false;
          stop = notifier.subscribe('**', () => {
            if (fired) return;
            fired = true;
            throw new Error('synchronous subscriber');
          });
          try {
            if (via === 'undo') tree.undo();
            else pending!.rollback();
          } catch {
            /* delivery failure after the reversal applied */
          }
          stop();
          stop = undefined;
          notifier.setBatchingEnabled(true);
          expect(fired).toBe(true);
          replica.compare(reader.snapshot(), 'after');
          expect(replica.issues).toEqual([]);
        } finally {
          stop?.();
          notifier.setBatchingEnabled(true);
          error.mockRestore();
          tree.destroy();
        }
      });
  }
);
