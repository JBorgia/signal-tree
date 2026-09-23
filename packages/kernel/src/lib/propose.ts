import {
  PENDING_TURN_ID,
  peekInternalTransactionRuntime,
  type TurnEffect,
} from '../enhancers/transactions/transactions';
import type {
  Proposal,
  ProposalAcceptance,
  ProposalInspection,
  ProposalStatus,
  TransactionsCapability,
} from '../enhancers/transactions/transactions.types';
import type { ISignalTree } from './types';

/**
 * CAPABILITY-SURFACE-0 arm B. The review facade as a STANDALONE operation
 * rather than a method installed on the tree by `transactions()`.
 *
 * Nothing about the semantics changes — this is the same pending turn, the
 * same authority, the same classifier. Only public reachability moves: a
 * consumer that never imports `propose` never references this module, so a
 * bundler can drop the classifier entirely.
 */

/**
 * PROPOSAL-0. Classify one proposed effect against the later work admitted
 * against its turn.
 *
 * Proven as `PROPOSAL-INSPECTION-0` (6 cases) before being written here. The
 * rule: a proposed effect is SUPERSEDED when later work replaced the exact
 * contribution it made — a scalar whose location was written again, or a
 * structural effect whose SUBJECT was removed. Everything else is CURRENT,
 * including a subject newer truth merely updated or renamed, and including a
 * path later reoccupied by a DIFFERENT subject.
 *
 * ⚠️ This is NOT the rollback plan. A rollback plan answers "what can I safely
 * compensate?"; this answers "which parts of what I proposed are still
 * represented in current truth?". They come apart: a later UPDATE of a
 * proposed row makes the rollback REFUSE while leaving the proposal's
 * structural contribution entirely current, and a refused plan has no
 * compensation list to reason from at all.
 *
 * Subject identity decides the structural cases. Path coincidence must not:
 * a reused business key belongs to a different record.
 */
function classifyProposedEffect(
  effect: TurnEffect,
  laterEffects: readonly TurnEffect[]
): ProposalStatus {
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
    if (later.ownerPath !== effect.ownerPath) {
      continue;
    }
    if (later.subject !== effect.subject) {
      continue;
    }
    present = later.kind !== 'remove';
  }
  return present ? 'current' : 'superseded';
}
export function propose<T extends object>(
  tree: ISignalTree<T> & TransactionsCapability,
  fn: () => void
): Proposal {
  const runtime = peekInternalTransactionRuntime(tree);
  if (!runtime) {
    throw new Error(
      'propose() requires the transactions() enhancer on this tree.'
    );
  }
  const pending = runtime.transaction(fn);
  const turnId = (pending as unknown as Record<PropertyKey, unknown>)[
    PENDING_TURN_ID
  ] as number | undefined;

  let settled: ProposalInspection | undefined;

  const read = (): ProposalInspection => {
    if (turnId === undefined) return { changes: [] };
    const raw = runtime.describePendingTurn(turnId);
    if (!raw) return { changes: [] };
    return {
      changes: raw.effects.map((effect) => ({
        path: effect.path,
        status: classifyProposedEffect(effect, raw.laterEffects),
      })),
    };
  };

  return {
    inspect: () => settled ?? read(),
    accept(): ProposalAcceptance {
      const atSettlement = settled ?? read();
      pending.confirm();
      settled = atSettlement;
      return atSettlement;
    },
    reject(): void {
      const atSettlement = settled ?? read();
      pending.rollback();
      settled = atSettlement;
    },
  };
}
