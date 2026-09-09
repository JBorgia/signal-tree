import { type MutableStudioSession } from '@signal-tree/studio-query';

import { type ConfirmedTurnReader, type KernelRetention } from './kernel-contract';
import { toStudioTurn } from './normalize';
import { type TreeIdentityRegistry } from './tree-identity';

export interface CaptureResult {
  readonly captured: number;
  /**
   * Carried through, never dropped. A caller that renders turns without
   * consulting this can present bounded retention as complete history — the
   * "approximate rather than refuse" failure §22.1.11 forbids.
   */
  readonly retention: KernelRetention;
}

/**
 * Read one tree's retained committed turns into a session.
 *
 * Pull-based and idempotent per call: it reads what the kernel already retains
 * and normalizes it. It installs nothing, subscribes to nothing, and leaves no
 * state behind in the kernel — so a tree with no Studio attached pays exactly
 * what it pays today.
 */
export function captureConfirmedTurns(options: {
  reader: ConfirmedTurnReader;
  session: MutableStudioSession;
  identities: TreeIdentityRegistry;
}): CaptureResult {
  const { reader, session, identities } = options;
  const treeId = identities.assign(reader.treeId);
  const snapshot = reader.readConfirmedTurns();

  let captured = 0;
  for (const turn of snapshot.turns) {
    // Tree-scoped lookup — a turn id alone is not unique across trees.
    if (session.turn(treeId, turn.id) !== undefined) {
      continue;
    }
    session.record(toStudioTurn(treeId, turn));
    captured += 1;
  }
  return { captured, retention: snapshot.retention };
}
