import { type MutableStudioSession } from '@signal-tree/studio-query';

import { type ConfirmedTurnReader } from './kernel-contract';
import { toStudioTurn } from './normalize';
import { type TreeIdentityRegistry } from './tree-identity';

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
}): number {
  const { reader, session, identities } = options;
  const treeId = identities.assign(reader.treeId);

  let captured = 0;
  for (const turn of reader.readConfirmedTurns()) {
    // Tree-scoped lookup — a turn id alone is not unique across trees.
    if (session.turn(treeId, turn.id) !== undefined) {
      continue;
    }
    session.record(toStudioTurn(treeId, turn));
    captured += 1;
  }
  return captured;
}
