import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { withWriteContext } from '../../lib/write-context';
import {
  peekInternalTransactionRuntime,
  transactions,
  type TurnEffect,
} from './transactions';

/**
 * PROPOSAL-REVIEW-SURFACE-0 — bounded proof, preregistered in TODO.md.
 *
 * > Question: can an application truthfully review a pending WITHOUT being
 * > given the kernel's internal identity?
 *
 * Not "can the kernel tell the subjects apart" — PROPOSAL-INSPECTION-0 case 6
 * already proved it can and must. This asks whether the classification RESULT
 * has to carry the identity that produced it.
 *
 * The review surface below is built from public information only: a
 * `{ path, status }` list plus ordinary tree reads the application already
 * performs. `SubjectId` and `PositionId` are never handed to it.
 */

type Row = { id: string; name: string };

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const realization = (fn: () => void) =>
  withWriteContext({ intent: 'system', participation: 'realized' }, fn);

/** Candidate PUBLIC shape. Deliberately carries no identity token. */
type InspectedChange = { path: string; status: 'current' | 'superseded' };

/** Proven in PROPOSAL-INSPECTION-0. Uses subject identity — privately. */
const classify = (
  effect: TurnEffect,
  later: readonly TurnEffect[]
): InspectedChange['status'] => {
  if (effect.kind === 'set') {
    return later.some(
      (l) =>
        l.kind === 'set' &&
        l.position === effect.position &&
        l.path === effect.path
    )
      ? 'superseded'
      : 'current';
  }
  let present = true;
  for (const l of later) {
    if (l.ownerPath !== effect.ownerPath) continue;
    if (l.subject !== effect.subject) continue;
    present = l.kind !== 'remove';
  }
  return present ? 'current' : 'superseded';
};

const inspect = (tree: unknown): InspectedChange[] => {
  const runtime = peekInternalTransactionRuntime(tree as never);
  if (!runtime) throw new Error('no runtime');
  const [turnId] = runtime.getPendingTurnIds();
  const raw = runtime.describePendingTurn(turnId);
  if (!raw) throw new Error('no pending turn');
  // The public projection: path + status. Identity is dropped HERE.
  return raw.effects.map((effect) => ({
    path: effect.path,
    status: classify(effect, raw.laterEffects),
  }));
};

/**
 * The smallest plausible review UI. Consumes ONLY InspectedChange plus a
 * value-reader the application already owns.
 */
type ReviewRow = {
  path: string;
  headline: string;
  detail: string;
  currentValue: unknown;
  actions: string[];
};

const renderReview = (
  changes: readonly InspectedChange[],
  readCurrent: (path: string) => unknown
): ReviewRow[] =>
  changes.map((change) => ({
    path: change.path,
    headline:
      change.status === 'current'
        ? 'Still part of this pending'
        : 'Superseded by newer state',
    detail:
      change.status === 'current'
        ? `This pending still owns the change at ${change.path}. Review the current value before accepting.`
        : `The state at ${change.path} changed after this pending was created. This pending no longer owns it.`,
    currentValue: readCurrent(change.path),
    actions:
      change.status === 'current'
        ? ['accept', 'reject']
        : ['accept', 'reject', 'reconcile'],
  }));

const rowTree = () =>
  signalTree(
    { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
    { enhancers: [transactions()] }
  );

describe('PROPOSAL-REVIEW-SURFACE-0 / A — server updates the SAME subject', () => {
  it('renders "current" from path + status alone', async () => {
    const tree = rowTree();
    await flush();

    tree.transact(() => {
      tree.$.rows.addOne({ id: 'A', name: 'Proposed' });
    });
    await flush();

    realization(() => tree.$.rows.updateOne('A', { name: 'FromServer' }));
    await flush();

    const changes = inspect(tree);
    expect(changes).toEqual([{ path: 'rows.A', status: 'current' }]);

    const view = renderReview(changes, () => tree.$.rows.byId('A')?.());

    expect(view[0].path).toBe('rows.A');
    expect(view[0].headline).toBe('Still part of this pending');
    expect(view[0].actions).toEqual(['accept', 'reject']);
    // The reviewer SEES the newer value through an ordinary tree read.
    expect(view[0].currentValue).toEqual({ id: 'A', name: 'FromServer' });
  });
});

describe('PROPOSAL-REVIEW-SURFACE-0 / B — server removes and creates a NEW subject', () => {
  it('renders "superseded" from the SAME public shape, no identity needed', async () => {
    const tree = rowTree();
    await flush();

    tree.transact(() => {
      tree.$.rows.addOne({ id: 'A', name: 'Proposed' });
    });
    await flush();

    realization(() => {
      tree.$.rows.removeOne('A');
      tree.$.rows.addOne({ id: 'A', name: 'FromServer' });
    });
    await flush();

    const changes = inspect(tree);
    expect(changes).toEqual([{ path: 'rows.A', status: 'superseded' }]);

    const view = renderReview(changes, () => tree.$.rows.byId('A')?.());

    expect(view[0].path).toBe('rows.A');
    expect(view[0].headline).toBe('Superseded by newer state');
    expect(view[0].actions).toEqual(['accept', 'reject', 'reconcile']);
    // A row IS visible at this path — a different one. The UI does not have to
    // explain that, and does not claim the path is empty.
    expect(view[0].currentValue).toEqual({ id: 'A', name: 'FromServer' });
  });
});

describe('PROPOSAL-REVIEW-SURFACE-0 / C — A and B are distinguishable publicly', () => {
  it('identical paths and identical visible values, different status', async () => {
    const build = async (superseding: boolean) => {
      const tree = rowTree();
      await flush();
      tree.transact(() => {
        tree.$.rows.addOne({ id: 'A', name: 'Proposed' });
      });
      await flush();
      realization(() => {
        if (superseding) {
          tree.$.rows.removeOne('A');
          tree.$.rows.addOne({ id: 'A', name: 'FromServer' });
        } else {
          tree.$.rows.updateOne('A', { name: 'FromServer' });
        }
      });
      await flush();
      return {
        changes: inspect(tree),
        visible: tree.$.rows.byId('A')?.(),
      };
    };

    const a = await build(false);
    const b = await build(true);

    // Same path, same visible value — the ONLY public difference is status,
    // and it is sufficient to drive a different reviewer decision.
    expect(a.changes[0].path).toBe(b.changes[0].path);
    expect(a.visible).toEqual(b.visible);
    expect(a.changes[0].status).toBe('current');
    expect(b.changes[0].status).toBe('superseded');
  });
});
