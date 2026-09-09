import { type StudioTreeId, type StudioTurn } from './records';

/**
 * A read-only query surface over turns captured in one Studio session.
 *
 * Deliberately small: S1 needs exactly enough to answer "what did this
 * transaction actually cause state to become?". No AI, invariants, session
 * comparison, graphs or source mapping — those are later slices and adding
 * their shapes now would be speculative architecture.
 */
export interface StudioSession {
  /** Every turn, in capture order. */
  turns(): readonly StudioTurn[];
  /** One turn by tree-scoped identity, or `undefined`. */
  turn(treeId: StudioTreeId, id: number): StudioTurn | undefined;
  /** Trees that have contributed at least one turn. */
  trees(): readonly StudioTreeId[];
}

export interface MutableStudioSession extends StudioSession {
  record(turn: StudioTurn): void;
}

export function createStudioSession(
  initial: readonly StudioTurn[] = []
): MutableStudioSession {
  const captured: StudioTurn[] = [...initial];

  return {
    record(turn) {
      captured.push(turn);
    },
    turns() {
      return captured;
    },
    turn(treeId, id) {
      // Both halves of the key, always. See `effectKey`'s doc for why matching
      // on `id` alone silently merges two trees' turns.
      return captured.find(
        (candidate) => candidate.treeId === treeId && candidate.id === id
      );
    },
    trees() {
      return [...new Set(captured.map((turn) => turn.treeId))];
    },
  };
}
