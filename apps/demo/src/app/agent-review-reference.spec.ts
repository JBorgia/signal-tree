import {
  entityMap,
  restoration,
  signalTree,
  transactions,
  undoable,
  external,
  type PendingTransaction,
  type InspectedChange,
} from '@signal-tree/angular';

/**
 * AGENT-UX-REFERENCE-0 — the multi-writer review workflow, built on the public
 * API only. Preregistered in `docs/research/agent-ux-reference-0.md`.
 *
 * THE POINT OF THIS FILE'S LOCATION. Demo specs import `@signal-tree/angular`
 * by PACKAGE NAME, so "public API only" is enforced by the import path rather
 * than by reviewer discipline. A reach into kernel internals — SubjectId,
 * PositionId, transaction effects — would appear as an import, and there is
 * none. The review surface consumes exactly `pending.inspect()` plus ordinary
 * state reads.
 */

type Order = {
  id: string;
  status: string;
  priority: number;
  assignee: string | null;
};

const flush = async (): Promise<void> => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

const makeTree = () =>
  signalTree(
    {
      orders: entityMap<Order, string>({ selectId: (o) => o.id }),
      lastSyncedBy: '',
    },
    { enhancers: [restoration({ maxHistorySize: 20 }), transactions()] }
  );

type Tree = ReturnType<typeof makeTree>;

/**
 * The whole review surface an application has to write. Status comes from
 * `inspect()`; the VALUE beside it is an ordinary read, because `'current'`
 * describes the CONTRIBUTION, not the proposed value.
 */
type ReviewRow = {
  path: string;
  status: InspectedChange['status'];
  currentValue: unknown;
};

const buildReview = (tree: Tree, pending: PendingTransaction): ReviewRow[] =>
  pending.inspect().changes.map((change) => ({
    path: change.path,
    status: change.status,
    currentValue: readByPath(tree, change.path),
  }));

/**
 * Application adapter for this fixture's known collection and dot-free IDs.
 * Display paths are ambiguous for arbitrary keys; this is not a universal
 * SignalTree path resolver.
 */
const readByPath = (tree: Tree, path: string): unknown => {
  const [head, ...rest] = path.split('.');
  if (head === 'orders' && rest.length > 0) {
    return tree.$.orders.byId(rest[0] as string)?.();
  }
  if (head === 'lastSyncedBy') return tree.$.lastSyncedBy();
  return undefined;
};

const seedOrder = (tree: Tree) => {
  tree.$.orders.addOne({
    id: '7841',
    status: 'open',
    priority: 1,
    assignee: null,
  });
};

describe('AGENT-UX-REFERENCE-0 — agent proposes, human reviews', () => {
  it('1 LIVE REVIEW — proposed values are visible before settlement', async () => {
    const tree = makeTree();
    seedOrder(tree);
    await flush();

    const pending = tree.transact(() => {
      tree.$.orders.updateOne('7841', { priority: 3, assignee: 'Ada' });
    });
    await flush();

    // The reviewer reads the tree the application already binds to.
    expect(tree.$.orders.byId('7841')?.()?.priority).toBe(3);
    expect(tree.$.orders.byId('7841')?.()?.assignee).toBe('Ada');

    pending.rollback();
    tree.destroy();
  });

  it('2 CURRENT vs SUPERSEDED — inspect() reports each contribution', async () => {
    const tree = makeTree();
    seedOrder(tree);
    await flush();

    const pending = tree.transact(() => {
      tree.$.orders.updateOne('7841', { priority: 3 });
      tree.$.lastSyncedBy.set('agent');
    });
    await flush();

    expect(buildReview(tree, pending).map((r) => r.status)).toEqual([
      'current',
      'current',
    ]);

    // A human edits one of the proposed locations while the review is open.
    tree.$.lastSyncedBy.set('human');
    await flush();

    const review = buildReview(tree, pending);
    const synced = review.find((r) => r.path === 'lastSyncedBy');
    expect(synced?.status).toBe('superseded');
    expect(synced?.currentValue).toBe('human');

    pending.rollback();
    tree.destroy();
  });

  it('3 CONCURRENT TRUTH — a server write during review is visible normally', async () => {
    const tree = makeTree();
    seedOrder(tree);
    await flush();

    const pending = tree.transact(() => {
      tree.$.orders.updateOne('7841', { priority: 3 });
    });
    await flush();

    // Outside truth arrives mid-review through the ordinary public door.
    external(() => {
      tree.$.orders.updateOne('7841', { status: 'escalated' });
    });
    await flush();

    // No special channel: the review screen re-reads state it already binds to.
    expect(tree.$.orders.byId('7841')?.()?.status).toBe('escalated');
    expect(tree.$.orders.byId('7841')?.()?.priority).toBe(3);

    pending.confirm();
    tree.destroy();
  });

  it('4 SAFE SETTLEMENT — accepting does not clobber newer truth', async () => {
    const tree = makeTree();
    seedOrder(tree);
    await flush();

    const pending = tree.transact(() => {
      tree.$.orders.updateOne('7841', { priority: 3 });
      tree.$.lastSyncedBy.set('agent');
    });
    await flush();

    external(() => tree.$.lastSyncedBy.set('server'));
    await flush();

    pending.confirm();
    const settled = pending.inspect();
    await flush();

    // The superseded location keeps the newer value; the rest commits.
    expect(tree.$.lastSyncedBy()).toBe('server');
    expect(tree.$.orders.byId('7841')?.()?.priority).toBe(3);

    // And acceptance REPORTS the supersession, closing the read/act race.
    expect(settled.changes.find((c) => c.path === 'lastSyncedBy')?.status).toBe(
      'superseded'
    );

    tree.destroy();
  });

  it('5 ONE LOGICAL ACTION — multi-field, multi-entity, settled as one unit', async () => {
    const tree = makeTree();
    seedOrder(tree);
    tree.$.orders.addOne({
      id: '9002',
      status: 'open',
      priority: 1,
      assignee: null,
    });
    await flush();

    const pending = tree.transact(() => {
      tree.$.orders.updateOne('7841', { priority: 3, assignee: 'Ada' });
      tree.$.orders.updateOne('9002', { priority: 5 });
      tree.$.lastSyncedBy.set('agent');
    });
    await flush();

    // One reject withdraws every field across both entities.
    pending.rollback();
    await flush();

    expect(tree.$.orders.byId('7841')?.()?.priority).toBe(1);
    expect(tree.$.orders.byId('7841')?.()?.assignee).toBeNull();
    expect(tree.$.orders.byId('9002')?.()?.priority).toBe(1);
    expect(tree.$.lastSyncedBy()).toBe('');

    tree.destroy();
  });
});

describe('AGENT-UX-REFERENCE-0 — `current` is the contribution, not the value', () => {
  it('an added row stays current while a server renames it', async () => {
    const tree = makeTree();
    await flush();

    const pending = tree.transact(() => {
      tree.$.orders.addOne({
        id: 'A',
        status: 'open',
        priority: 1,
        assignee: 'Alpha',
      });
    });
    await flush();

    external(() => tree.$.orders.updateOne('A', { assignee: 'Server Name' }));
    await flush();

    const [row] = buildReview(tree, pending);

    // The contribution — the entity existing — still stands.
    expect(row.status).toBe('current');
    // The VALUE on screen is the server's, read ordinarily. A UI that showed
    // status without this column would tell the reviewer the wrong thing.
    expect((row.currentValue as Order).assignee).toBe('Server Name');

    pending.confirm();
    tree.destroy();
  });
});

describe('AGENT-UX-REFERENCE-0 — restoration is a separate decision', () => {
  it('designation wraps the authored pending, not accept()', async () => {
    const tree = makeTree();
    seedOrder(tree);
    await flush();
    const before = tree.getRestorationHistory().length;

    let pending!: PendingTransaction;
    undoable(() => {
      pending = tree.transact(() => {
        tree.$.orders.updateOne('7841', { priority: 3, assignee: 'Ada' });
      });
    });

    // The review gap: designation must survive an arbitrary delay.
    await flush();
    await flush();
    await flush();

    pending.confirm();
    await flush();

    expect(tree.getRestorationHistory().length).toBe(before + 1);

    tree.undo();
    await flush();

    expect(tree.$.orders.byId('7841')?.()?.priority).toBe(1);
    expect(tree.$.orders.byId('7841')?.()?.assignee).toBeNull();

    tree.destroy();
  });
});
