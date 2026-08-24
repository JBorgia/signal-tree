import type { PathNotifierHandler } from '../../path-notifier';

import { getWriteParticipation, isInspectionWrite } from '../../write-participation';

import type { PositionId, StructuralEffect, WriteMetadata } from '../../types';

import type { ExplicitTransactionEffect, GreenfieldTransactionDraft } from './greenfield-transactions';

export function toExplicitTransactionEffect(options: {
  next: unknown;
  prev: unknown;
  subjectIds?: number[];
  positionIds?: number[];
  meta?: WriteMetadata;
}): ExplicitTransactionEffect | undefined {
  const owner = options.positionIds?.[0] as PositionId | undefined;
  if (owner === undefined) {
    return undefined;
  }

  const subjectId = options.subjectIds?.[0];
  const structuralEffect = options.meta?.structuralEffect;
  if (!structuralEffect) {
    return {
      owner,
      before: options.prev,
      after: options.next,
      subjectId,
    };
  }

  return mapStructuralEffect(owner, subjectId, structuralEffect);
}

export function createTransactionCaptureBridge(options: {
  draft: GreenfieldTransactionDraft;
  turnId: number;
  transactionOwner: object;
}): PathNotifierHandler {
  return (
    next,
    prev,
    _path,
    _ownerPath,
    _source,
    subjectIds,
    positionIds,
    meta
  ) => {
    if (
      // DEVTOOLS-JUMP-0.1: an inspection application is not part of any
      // transaction's contribution.
      isInspectionWrite(meta) ||
      getWriteParticipation(meta) === 'realized' ||
      meta?.transactionId !== options.turnId ||
      meta.transactionOwner !== options.transactionOwner
    ) {
      return;
    }

    const effect = toExplicitTransactionEffect({
      next,
      prev,
      subjectIds,
      positionIds,
      meta,
    });
    if (!effect) {
      return;
    }

    options.draft.capture(effect);
  };
}

function mapStructuralEffect(
  owner: PositionId,
  subjectId: number | undefined,
  structuralEffect: StructuralEffect
): ExplicitTransactionEffect {
  switch (structuralEffect.kind) {
    case 'add':
      return {
        owner,
        before: undefined,
        after: structuralEffect.key,
        subjectId,
        structural: 'add',
        structuralContext: structuralEffect,
      };
    case 'remove':
      return {
        owner,
        before: structuralEffect.key,
        after: undefined,
        subjectId,
        structural: 'remove',
        structuralContext: structuralEffect,
      };
    case 'rekey':
      return {
        owner,
        before: structuralEffect.beforeKey,
        after: structuralEffect.afterKey,
        subjectId,
        structural: 'rekey',
        structuralContext: structuralEffect,
      };
  }
}
