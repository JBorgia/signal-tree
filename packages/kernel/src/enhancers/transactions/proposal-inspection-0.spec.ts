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
 * PROPOSAL-INSPECTION-0 — bounded proof, preregistered in TODO.md.
 *
 * > Question: can the current status of each proposed effect be derived from
 * > existing transaction state and later effects, with NO new retained
 * > semantic fact?
 *
 * WHY THIS IS NOT THE ROLLBACK PLAN. A rollback plan answers "what can I
 * safely compensate?". A review answers "which parts of what I proposed are
 * still represented in current truth?". They overlap and are not the same:
 *
 *     proposal: add row A        server: update A.name
 *         -> rollback REFUSES (newer truth depends on the row)
 *         -> the proposal's structural contribution is entirely CURRENT
 *
 * So `superseded = turn effects - compensation plan` is WRONG, and worse than
 * wrong when the plan returns a conflict, because then there is no
 * compensation list to subtract from at all. That formula was asserted from
 * reading source and is refuted here by case 3.
 *
 * THE CLASSIFIER LIVES IN THIS SPEC, NOT IN PRODUCTION. The kernel exposes
 * only unclassified raw material (`describePendingTurn`). If the six cases
 * classify correctly from that material alone, the derivation is proven and
 * only then does a public shape get chosen.
 */

type Row = { id: string; name: string };

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const realization = (fn: () => void) =>
  withWriteContext({ intent: 'system', participation: 'realized' }, fn);

type Status = 'current' | 'superseded';

/**
 * Candidate rule, under test:
 *
 *   a proposed effect is SUPERSEDED when later work has replaced the exact
 *   contribution it made — a scalar write whose location was written again,
 *   or a structural effect whose SUBJECT was removed. Everything else is
 *   CURRENT, including a subject that newer truth merely updated or renamed,
 *   and including a path later reoccupied by a DIFFERENT subject.
 *
 * Subject identity, never path coincidence, decides the structural cases.
 */
const classify = (
  effect: TurnEffect,
  laterEffects: readonly TurnEffect[]
): Status => {
  if (effect.kind === 'set') {
    const replaced = laterEffects.some(
      (later) =>
        later.kind === 'set' &&
        later.position === effect.position &&
        later.path === effect.path &&
        (later.subject === undefined ||
          effect.subject === undefined ||
          later.subject === effect.subject)
    );
    return replaced ? 'superseded' : 'current';
  }

  let present = true;
  for (const later of laterEffects) {
    if (later.ownerPath !== effect.ownerPath) continue;
    if (later.subject !== effect.subject) continue;
    if (later.kind === 'remove') present = false;
    else present = true;
  }
  return present ? 'current' : 'superseded';
};

const inspect = (tree: unknown): Array<{ kind: string; status: Status }> => {
  const runtime = peekInternalTransactionRuntime(tree as never);
  if (!runtime) throw new Error('no transaction runtime');
  const [turnId] = runtime.getPendingTurnIds();
  const raw = runtime.describePendingTurn(turnId);
  if (!raw) throw new Error('no pending turn');
  return raw.effects.map((effect) => ({
    kind: effect.kind,
    status: classify(effect, raw.laterEffects),
  }));
};

const rowTree = () =>
  signalTree(
    { rows: entityMap<Row, string>({ selectId: (r) => r.id }), x: 0 },
    { enhancers: [transactions()] }
  );

describe('PROPOSAL-INSPECTION-0 / 1 — scalar proposal untouched', () => {
  it('current', async () => {
    const tree = rowTree();
    await flush();
    tree.transact(() => {
      tree.$.x(1);
    });
    await flush();

    expect(inspect(tree)).toEqual([{ kind: 'set', status: 'current' }]);
  });
});

describe('PROPOSAL-INSPECTION-0 / 2 — scalar replaced by a newer write', () => {
  it('superseded', async () => {
    const tree = rowTree();
    await flush();
    tree.transact(() => {
      tree.$.x(1);
    });
    await flush();
    realization(() => tree.$.x(99));
    await flush();

    expect(inspect(tree)).toEqual([{ kind: 'set', status: 'superseded' }]);
  });
});

describe('PROPOSAL-INSPECTION-0 / 3 — structural add, later UPDATE of the subject', () => {
  it('still current — the case that refutes the rollback-plan formula', async () => {
    const tree = rowTree();
    await flush();
    tree.transact(() => {
      tree.$.rows.addOne({ id: 'A', name: 'Proposed' });
    });
    await flush();
    realization(() => tree.$.rows.updateOne('A', { name: 'FromServer' }));
    await flush();

    // The rollback plan REFUSES here. Inspection must still say the
    // proposal's structural contribution is current.
    expect(inspect(tree)).toEqual([{ kind: 'add', status: 'current' }]);
  });
});

describe('PROPOSAL-INSPECTION-0 / 4 — structural add, later REMOVE of the subject', () => {
  it('superseded', async () => {
    const tree = rowTree();
    await flush();
    tree.transact(() => {
      tree.$.rows.addOne({ id: 'A', name: 'Proposed' });
    });
    await flush();
    realization(() => tree.$.rows.removeOne('A'));
    await flush();

    expect(inspect(tree)).toEqual([{ kind: 'add', status: 'superseded' }]);
  });
});

describe('PROPOSAL-INSPECTION-0 / 5 — rekey, later field update', () => {
  it('rekey remains current', async () => {
    const tree = rowTree();
    tree.$.rows.addOne({ id: 'A', name: 'Original' });
    await flush();
    tree.transact(() => {
      tree.$.rows.changeId('A', 'A2');
    });
    await flush();
    realization(() => tree.$.rows.updateOne('A2', { name: 'FromServer' }));
    await flush();

    expect(inspect(tree)).toEqual([{ kind: 'rekey', status: 'current' }]);
  });
});

describe('PROPOSAL-INSPECTION-0 / 6 — remove/re-add of the same business key', () => {
  it('classification follows subject lifetime, not path coincidence', async () => {
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

    // The key is occupied again, by a DIFFERENT subject. The proposal's own
    // subject is gone, so its contribution is superseded — a path-based rule
    // would wrongly report 'current' here.
    expect(inspect(tree)).toEqual([{ kind: 'add', status: 'superseded' }]);
  });
});
