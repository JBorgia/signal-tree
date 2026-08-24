import type { PositionId, TurnId } from './causal-types';
import type { TurnStore } from './turn-store';

type AppliedTurnResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: 'turn-evicted' | 'not-applied-frontier';
    };

export interface PreparedUnapply {
  readonly turnId: TurnId;
}

export interface PreparedConfirmation {
  readonly turnId: TurnId;
  readonly participants: readonly PositionId[];
}

type PrepareUnapplyResult =
  | { readonly ok: true; readonly transition: PreparedUnapply }
  | {
      readonly ok: false;
      readonly reason: 'turn-evicted' | 'not-applied-frontier';
    };

export interface PreparedReapply {
  readonly turnId: TurnId;
}

export interface EvictedConfirmedTurnDisposition {
  readonly wasApplied: boolean;
  readonly wasRedoable: boolean;
}

type PrepareReapplyResult =
  | { readonly ok: true; readonly transition: PreparedReapply }
  | {
      readonly ok: false;
      readonly reason: 'turn-evicted' | 'not-redoable-next';
    };

export interface AppliedTurnSnapshot {
  readonly appliedTurnIds: TurnId[];
  readonly redoTurnIds: TurnId[];
  readonly frontiers: Record<string, TurnId>;
}

export class AppliedTurnProjection {
  private readonly appliedTurnIds: TurnId[] = [];
  private readonly redoTurnIds: TurnId[] = [];

  constructor(
    private readonly store: Pick<TurnStore, 'getTurn' | 'getTurnIdsForPosition'>
  ) {}

  admitConfirmed(turnId: TurnId): AppliedTurnResult {
    const turn = this.store.getTurn(turnId);
    if (!turn) {
      return { ok: false, reason: 'turn-evicted' };
    }

    const transition = this.prepareAdmitConfirmedTurn({
      turnId,
      participants: turn.participants,
    });
    this.commitPreparedAdmitConfirmed(transition);

    return { ok: true };
  }

  prepareAdmitConfirmedTurn(turn: {
    readonly turnId: TurnId;
    readonly participants: readonly PositionId[];
  }): PreparedConfirmation {
    return {
      turnId: turn.turnId,
      participants: [...turn.participants],
    };
  }

  commitPreparedAdmitConfirmed(
    transition: PreparedConfirmation
  ): readonly TurnId[] {
    this.insertAppliedTurnCanonical(transition.turnId);
    if (this.redoTurnIds.length > 0) {
      return this.invalidateOverlappingRedoTurns(transition.participants);
    }

    return [];
  }

  prepareUnapplyConfirmedTurn(
    turnId: TurnId
  ): PrepareUnapplyResult {
    const turn = this.store.getTurn(turnId);
    if (!turn) {
      return { ok: false, reason: 'turn-evicted' };
    }

    const isApplied = this.appliedTurnIds.includes(turnId);
    const isParticipantFrontier = turn.participants.every(
      (participant) => this.getFrontier(participant) === turnId
    );
    if (!isApplied || !isParticipantFrontier) {
      return { ok: false, reason: 'not-applied-frontier' };
    }

    return {
      ok: true,
      transition: { turnId },
    };
  }

  commitPreparedUnapply(transition: PreparedUnapply): void {
    const { turnId } = transition;

    this.removeAppliedTurn(turnId);
    this.redoTurnIds.unshift(turnId);
  }

  moveConfirmedTurnToRedo(turnId: TurnId): AppliedTurnResult {
    const prepared = this.prepareUnapplyConfirmedTurn(turnId);
    if (!prepared.ok) {
      return prepared;
    }

    this.commitPreparedUnapply(prepared.transition);
    return { ok: true };
  }

  prepareReapplyConfirmedTurn(
    turnId: TurnId
  ): PrepareReapplyResult {
    const turn = this.store.getTurn(turnId);
    if (!turn) {
      return { ok: false, reason: 'turn-evicted' };
    }

    const isRedoable = this.redoTurnIds.includes(turnId);
    const restoresValidPrefix = turn.participants.every(
      (participant) => this.getFirstUnappliedTurnIdForPosition(participant) === turnId
    );

    if (!isRedoable || !restoresValidPrefix) {
      return { ok: false, reason: 'not-redoable-next' };
    }

    return {
      ok: true,
      transition: { turnId },
    };
  }

  commitPreparedReapply(transition: PreparedReapply): void {
    const { turnId } = transition;

    this.redoTurnIds.splice(this.redoTurnIds.indexOf(turnId), 1);
    this.insertAppliedTurnCanonical(turnId);
  }

  moveRedoTurnToApplied(turnId: TurnId):
    | { readonly ok: true }
    | { readonly ok: false; readonly reason: 'turn-evicted' | 'not-redoable-next' } {
    const prepared = this.prepareReapplyConfirmedTurn(turnId);
    if (!prepared.ok) {
      return prepared;
    }

    this.commitPreparedReapply(prepared.transition);
    return { ok: true };
  }

  getAppliedTurnIds(): readonly TurnId[] {
    return [...this.appliedTurnIds];
  }

  getRedoTurnIds(): readonly TurnId[] {
    return [...this.redoTurnIds];
  }

  forgetRetainedTurn(turnId: TurnId): EvictedConfirmedTurnDisposition {
    const wasApplied = this.appliedTurnIds.includes(turnId);
    const wasRedoable = this.redoTurnIds.includes(turnId);

    if (wasApplied) {
      this.removeAppliedTurn(turnId);
    }

    if (wasRedoable) {
      this.redoTurnIds.splice(this.redoTurnIds.indexOf(turnId), 1);
    }

    return {
      wasApplied,
      wasRedoable,
    };
  }

  getFrontier(positionId: PositionId): TurnId | undefined {
    for (let index = this.appliedTurnIds.length - 1; index >= 0; index -= 1) {
      const turn = this.store.getTurn(this.appliedTurnIds[index]);
      if (turn?.participants.includes(positionId)) {
        return turn.id;
      }
    }

    return undefined;
  }

  inspect(): AppliedTurnSnapshot {
    const frontiers = new Map<PositionId, TurnId>();

    for (const turnId of this.appliedTurnIds) {
      const turn = this.store.getTurn(turnId);
      if (!turn) {
        continue;
      }

      for (const participant of turn.participants) {
        frontiers.set(participant, turn.id);
      }
    }

    return {
      appliedTurnIds: [...this.appliedTurnIds],
      redoTurnIds: [...this.redoTurnIds],
      frontiers: Object.fromEntries(
        [...frontiers.entries()].map(([positionId, turnId]) => [
          String(positionId),
          turnId,
        ])
      ),
    };
  }

  private removeAppliedTurn(turnId: TurnId): void {
    const index = this.appliedTurnIds.indexOf(turnId);
    if (index === -1) {
      return;
    }

    this.appliedTurnIds.splice(index, 1);
  }

  private getFirstUnappliedTurnIdForPosition(
    positionId: PositionId
  ): TurnId | undefined {
    return this.store
      .getTurnIdsForPosition(positionId)
      .find((turnId) => !this.appliedTurnIds.includes(turnId));
  }

  private insertAppliedTurnCanonical(turnId: TurnId): void {
    if (this.appliedTurnIds.includes(turnId)) {
      return;
    }

    const insertionIndex = this.appliedTurnIds.findIndex(
      (appliedTurnId) => appliedTurnId > turnId
    );

    if (insertionIndex === -1) {
      this.appliedTurnIds.push(turnId);
      return;
    }

    this.appliedTurnIds.splice(insertionIndex, 0, turnId);
  }

  private invalidateOverlappingRedoTurns(
    participants: readonly PositionId[]
  ): readonly TurnId[] {
    const participantSet = new Set(participants);
    const invalidatedTurnIds = this.redoTurnIds.filter((turnId) => {
      const turn = this.store.getTurn(turnId);
      if (!turn) {
        return true;
      }

      return turn.participants.some((participant) => participantSet.has(participant));
    });

    this.redoTurnIds.splice(
      0,
      this.redoTurnIds.length,
      ...this.redoTurnIds.filter((turnId) => {
        const turn = this.store.getTurn(turnId);
        if (!turn) {
          return false;
        }

        return !turn.participants.some((participant) =>
          participantSet.has(participant)
        );
      })
    );

    return invalidatedTurnIds;
  }
}
