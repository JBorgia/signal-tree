import { afterEach, describe, expect, it } from 'vitest';

import { getTreeRealizationPort } from '../../lib/internals/causal-runtime/tree-realization-adapter';
import { getOrCreateSubjectRestorationClaims } from '../../lib/internals/subject-restoration-claims';
import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { restoration } from '../restoration/restoration';
import {
  peekInternalTransactionRuntime,
  transactionAuthorityFaults,
  transactions,
} from './transactions';

/**
 * Rollback/rebase review, item 3 (MAJOR): createPending was atomic for a
 * fresh reservation but not idempotent for an id it had already registered.
 * With the recording step failing AFTER the pending turn was registered and
 * the abort's compensation refused, recordConfirmedBucket created the turn a
 * second time: its positions were counted twice and stayed "pending" with no
 * pending turn (pendingPositions [2, 3]), the very symptom 3da1ea5d claimed
 * fixed; and a claims failure on that second call released the live first
 * registration's claims.
 *
 * Now a registered turn is confirmed as recorded (so the abort path never
 * registers twice), and createPending, if ever called again for a registered
 * id, releases the previous counts first and on any failure puts the previous
 * registration back, claims included. Faults are injected at every step that
 * can throw (`transactionAuthorityFaults`), plus the release in its cleanup.
 */
const realSort = Array.prototype.sort;
afterEach(() => {
  Array.prototype.sort = realSort;
  transactionAuthorityFaults.at = undefined;
});
/** The next sort inside transactions()' drain, AFTER createPending. */
const armDrainFault = () => {
  Array.prototype.sort = function (
    this: unknown[],
    compare?: (left: unknown, right: unknown) => number
  ) {
    const frames = (new Error().stack ?? '').split('\n');
    if (
      frames.some(
        (frame) =>
          frame.includes('drainCaptureBucket') &&
          frame.includes('transactions/transactions.ts')
      ) &&
      frames.some((frame) => frame.includes('materializePendingTransaction'))
    ) {
      Array.prototype.sort = realSort;
      throw new Error('INJECTED drain fault');
    }
    return realSort.call(this, compare as never);
  } as typeof realSort;
};

type Row = { id: string; n: number };
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const declaration = () => ({
  x: 0,
  rows: entityMap<Row, string>({ selectId: (row) => row.id }),
});
const typed = () =>
  signalTree(declaration(), { enhancers: [transactions(), restoration()] });
type Tree = ReturnType<typeof typed>;

type Step = 'buildTurn' | 'claims' | 'clone' | 'release';

describe.each([
  ['transactions()', () => [transactions()]],
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const)('pending-turn registration faults (%s)', (_name, enhancers) => {
  /**
   * A transaction whose recording fails (in `steps`, in order), with the
   * abort's compensation refused, then an ordinary later write.
   */
  const run = async (options: { drainFault?: boolean; steps?: Step[] }) => {
    const tree = signalTree(declaration(), {
      enhancers: enhancers() as never,
    }) as unknown as Tree;
    try {
      tree.$.rows.addOne({ id: 'A', n: 1 });
      await flush();
      const claims = getOrCreateSubjectRestorationClaims(tree) as unknown as {
        snapshot(): { owners: number; claimedSubjects: number };
      };
      const port = getTreeRealizationPort(tree.$) as unknown as {
        validateEffects(effects: unknown): unknown;
      };
      const realValidate = port.validateEffects.bind(port);
      port.validateEffects = () => ({ kind: 'structural-drift' });
      const pendingSteps = [...(options.steps ?? [])];
      transactionAuthorityFaults.at = (step) => {
        if (pendingSteps[0] === step) {
          pendingSteps.shift();
          throw new Error(`INJECTED ${step}`);
        }
      };
      if (options.drainFault) armDrainFault();
      let failure: unknown;
      try {
        tree.transaction(() => {
          tree.$.x(1);
          tree.$.rows.removeOne('A');
        });
      } catch (error) {
        failure = error;
      }
      transactionAuthorityFaults.at = undefined;
      Array.prototype.sort = realSort;
      port.validateEffects = realValidate;
      await flush();
      tree.$.rows.addOne({ id: 'B', n: 2 });
      tree.$.x(2);
      await flush();
      const runtime = peekInternalTransactionRuntime(tree);
      return {
        failed: failure !== undefined,
        unused: pendingSteps,
        state: { x: tree.$.x(), rows: tree.$.rows.all() },
        pendingTurns: runtime?.getPendingTurnIds(),
        pendingPositions: runtime?.getPendingPositionIds(),
        claims: claims.snapshot(),
      };
    } finally {
      tree.destroy();
    }
  };

  // The baseline every injected fault is compared with: the drain fault and
  // a refused abort, no fault inside the registration itself.
  it('baseline: a drain fault with the abort refused leaves nothing pending', async () => {
    const control = await run({ drainFault: true });
    expect(control.failed).toBe(true);
    expect(control.pendingTurns).toStrictEqual([]);
    expect(control.pendingPositions).toStrictEqual([]);
  });

  it.each([
    ['the drain after registration (the review shape)', { drainFault: true }],
    ['buildTurn', { steps: ['buildTurn'] as Step[] }],
    ['claims', { steps: ['claims'] as Step[] }],
    ['clone', { steps: ['clone'] as Step[] }],
    [
      'clone, then the release in its cleanup',
      { steps: ['clone', 'release'] as Step[] },
    ],
  ] as const)(
    'a fault in %s leaves nothing pending and no claim',
    async (_case, options) => {
      const control = await run({ drainFault: true });
      const faulted = await run(options);
      expect(faulted.failed).toBe(true);
      expect(faulted.pendingTurns).toStrictEqual([]);
      expect(faulted.pendingPositions).toStrictEqual([]);
      expect(faulted.state).toStrictEqual(control.state);
      expect(faulted.claims).toStrictEqual(control.claims);
    }
  );
});
