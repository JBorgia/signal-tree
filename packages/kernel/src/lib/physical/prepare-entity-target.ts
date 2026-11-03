import { withSelectedEntityDisposition } from '../internals/selected-entity-disposition';
import type { EntityPlacementStage } from './entity-placement-stage';
import type { EntityOrdinaryTopology } from './entity-ordinary-topology';
import { withEntityOrdinaryChanges } from '../internals/entity-value-transition';
import { prepareStructuralTarget } from './prepare-structural-target';
import type { Location } from '../internals/cell-runtime';
import type { EpochHandle } from '../internals/observation-adapter';
import type { PhysicalCommitClock } from '../internals/physical-commit-clock';
import type { EntityMembershipTap } from '../internals/entity-membership-source';
import type { PathObservationPort } from '../internals/path-observation-port';
import type { EntityValueStore } from './entity-value-store';
import type { StructuralStore } from './structural-store';
import type { TapHandlers, WriteMetadata, StructuralEffect } from '../types';
import type { CollectionTransitionTarget } from '../internals/causal-runtime/target-transition';
import {
  MEMBERSHIP_OPEN_ORDER,
  MEMBERSHIP_CLOSE,
} from '../internals/entity-membership-source';
import { replaceLocation, deriveLocation } from '../internals/location-runtime';
import { deepClone } from '../internals/utilities/deep-clone';
import { deepEqual } from '../internals/utilities/deep-equal';

/** Internal owner environment; optional consumers supply the planning algorithm. */
export interface EntityTargetHost<
  E extends Record<string, unknown>,
  K extends string | number
> {
  readonly positionId: number | undefined;
  readonly structuralStore: StructuralStore<K>;
  readonly valueStore: EntityValueStore<E>;
  readonly ordinaryTopology: EntityOrdinaryTopology<K>;
  prepareOrdinaryRealization(
    effects: readonly import('../internals/causal-runtime/causal-types').ReversalEffect[],
    physicalAfter?: ReadonlyMap<number, unknown>,
    physicalEffects?: readonly import('../internals/causal-runtime/causal-types').ReversalEffect[],
    physicalPlacement?: EntityPlacementStage<K>,
    ordinaryOrder?: readonly number[]
  ): {
    install(): void;
    changes: readonly import('../internals/mutation-capture-runtime').CommittedEntityMutation[];
    ordinaryEndpoints?: {
      readonly before: readonly number[];
      readonly after: readonly number[];
      readonly domain?: readonly number[];
    };
  };
  readonly activeIdSignal: Location<K | undefined>;
  readonly subjectEpochs: Map<number, EpochHandle>;
  readonly subjectStateSignals: Map<number, WeakRef<Location<number>>>;
  readonly membershipTap: EntityMembershipTap | undefined;
  readonly physicalCommitClock: PhysicalCommitClock | undefined;
  readonly pathNotifier: PathObservationPort;
  readonly basePath: string;
  advanceEpochHandle(epoch: EpochHandle): void;
  updateSignals(): void;
  publishOrderChange(
    before: number[],
    after: number[],
    beforeFrontier: unknown,
    afterFrontier: unknown,
    ordinaryEndpoints?: {
      readonly before: readonly number[];
      readonly after: readonly number[];
      readonly domain?: readonly number[];
    },
    selectedDisposition?: boolean
  ): void;
  getPositionIdsForNotify(): number[] | undefined;
  createStructuralEffectMeta(effect: StructuralEffect): WriteMetadata;
  ambientMeta(): WriteMetadata | undefined;
  emitTap<M extends keyof TapHandlers<E, K>>(
    method: M,
    ...args: Parameters<NonNullable<TapHandlers<E, K>[M]>>
  ): void;
}

export type EntityTargetPreparer = typeof prepareEntityTransitionTarget;

export function prepareEntityTransitionTarget<
  E extends Record<string, unknown>,
  K extends string | number
>(
  host: EntityTargetHost<E, K>,
  target: CollectionTransitionTarget
): {
  install(): void;
  publishOrder(): void;
  publish(options?: { advancePhysicalRevision?: boolean }): void;
} {
  const {
    positionId,
    structuralStore,
    valueStore,
    activeIdSignal,
    subjectEpochs,
    subjectStateSignals,
    advanceEpochHandle,
    updateSignals,
    physicalCommitClock,
    pathNotifier,
    basePath,
    getPositionIdsForNotify,
    createStructuralEffectMeta,
    ambientMeta,
    emitTap,
  } = host;
  if (positionId === undefined || target.owner !== positionId) {
    throw new Error(
      'Collection transition target owner does not match the binding'
    );
  }

  const beforeOrderFrontier = structuralStore.activeOrderFrontier();
  const currentSubjects = new Map<number, { key: K; value: E }>();
  const activeIdBefore = activeIdSignal();
  const activeSubjectBefore =
    activeIdBefore === undefined
      ? undefined
      : structuralStore.subjectIdForKey(activeIdBefore);
  for (const key of structuralStore.activeKeysSnapshot()) {
    const subjectId = structuralStore.subjectIdForKey(key);
    const value =
      subjectId === undefined
        ? undefined
        : valueStore.backingForSubject(subjectId);
    if (subjectId !== undefined && value !== undefined) {
      currentSubjects.set(subjectId, { key, value });
    }
  }

  const beforeOrder = [...currentSubjects.keys()];
  const afterOrder = [...target.order];
  const preparedSubjects = target.subjects.map((subject) => {
    if (
      subject.value === null ||
      typeof subject.value !== 'object' ||
      Array.isArray(subject.value)
    ) {
      throw new Error(
        `Collection target subject ${subject.subject} has no entity value`
      );
    }
    return {
      subjectId: subject.subject,
      key: subject.key as K,
      value: deepClone(subject.value) as E,
    };
  });
  const structuralTarget = structuralStore.prepareTarget(
    preparedSubjects,
    target.order,
    target.orderFrontier,
    prepareStructuralTarget
  );
  const valueTarget = valueStore.prepareTargetValues(preparedSubjects);
  const physicalPlacement = structuralStore.preparePlacement();
  for (const subject of currentSubjects.keys())
    physicalPlacement.remove(subject);
  const targetKeys = new Map(
    preparedSubjects.map((row) => [row.subjectId, row.key])
  );
  for (const subject of target.order) {
    const key = targetKeys.get(subject);
    if (key === undefined)
      throw new Error('Prepared target order lacks a lifetime');
    physicalPlacement.insert(subject, key);
  }
  const ordinaryPlan = host.prepareOrdinaryRealization(
    target.admittedEffects ?? [],
    new Map(preparedSubjects.map((row) => [row.subjectId, row.value])),
    [],
    physicalPlacement,
    target.admittedOrder
  );
  const ordinaryBySubject = new Map<
    number,
    import('../internals/mutation-capture-runtime').CommittedEntityMutation[]
  >();
  for (const change of ordinaryPlan?.changes ?? []) {
    let changes = ordinaryBySubject.get(change.subject);
    if (!changes) ordinaryBySubject.set(change.subject, (changes = []));
    changes.push(change);
  }

  const affectedSubjects = new Set([
    ...currentSubjects.keys(),
    ...preparedSubjects.map(({ subjectId }) => subjectId),
  ]);
  const preparedBySubject = new Map(
    preparedSubjects.map((subject) => [subject.subjectId, subject])
  );
  // Selection is a current key choice, not rollback-owned row state. Follow
  // an existing selected subject through a rekey, but preserve the selected
  // key when that subject is absent or removed by this target.
  const activeIdAfter =
    (activeSubjectBefore === undefined
      ? undefined
      : preparedBySubject.get(activeSubjectBefore)?.key) ?? activeIdBefore;
  const targetNeighborBySubject = new Map(
    target.order.map((subjectId, index) => [
      subjectId,
      {
        beforeSubject: target.order[index - 1],
        afterSubject: target.order[index + 1],
      },
    ])
  );
  const subjectChanges = [...affectedSubjects].map((subjectId) => {
    const before = currentSubjects.get(subjectId);
    const after = preparedBySubject.get(subjectId);
    return {
      subjectId,
      beforeKey: before?.key,
      afterKey: after?.key,
      beforeValue: before?.value,
      valueEpoch: subjectEpochs.get(subjectId),
      stateSignal: subjectStateSignals.get(subjectId)?.deref(),
      afterValue: after?.value,
      bindingChanged: !before || !after || before.key !== after.key,
      targetNeighbors: targetNeighborBySubject.get(subjectId),
    };
  });

  return {
    install(): void {
      // Membership observation diffs this collection across the install.
      // Reversals hold reader delivery until every target is installed.
      const tap = host.membershipTap;
      tap?.(MEMBERSHIP_OPEN_ORDER);
      try {
        structuralStore.installPreparedTarget(structuralTarget);
        valueStore.installPreparedTargetValues(valueTarget);
        ordinaryPlan?.install();
        // Selection belongs to the installed unit. Replay taps may author
        // newer selections; publication must never overwrite those writes.
        if (activeIdBefore !== activeIdAfter) {
          replaceLocation(activeIdSignal, activeIdAfter);
        }
      } finally {
        tap?.(MEMBERSHIP_CLOSE);
      }
    },
    publishOrder(): void {
      // Every target is installed before this phase. Capture all installed
      // order transitions before any target callback can author newer order.
      host.publishOrderChange(
        beforeOrder,
        afterOrder,
        beforeOrderFrontier,
        target.orderFrontier,
        ordinaryPlan.ordinaryEndpoints,
        target.admittedEffects !== undefined
      );
    },
    publish(options): void {
      for (const publication of subjectChanges) {
        // Only a realized subject has an epoch, so this stays as lazy as the
        // per-entity signal it replaces.
        if (publication.valueEpoch) advanceEpochHandle(publication.valueEpoch);
        if (publication.bindingChanged) {
          if (publication.stateSignal) {
            deriveLocation(publication.stateSignal, (value) => value + 1);
          }
        }
      }
      updateSignals();
      if (options?.advancePhysicalRevision !== false) {
        physicalCommitClock?.advance();
      }
      for (const publication of subjectChanges) {
        const key = publication.afterKey ?? publication.beforeKey;
        if (key === undefined) {
          continue;
        }
        const structuralEffect: StructuralEffect | undefined =
          publication.beforeKey === undefined
            ? {
                kind: 'add',
                subject: publication.subjectId,
                key,
                value: publication.afterValue,
                ...publication.targetNeighbors,
              }
            : publication.afterKey === undefined
            ? {
                kind: 'remove',
                subject: publication.subjectId,
                key,
                value: publication.beforeValue,
              }
            : publication.beforeKey !== publication.afterKey
            ? {
                kind: 'rekey',
                subject: publication.subjectId,
                beforeKey: publication.beforeKey,
                afterKey: publication.afterKey,
              }
            : undefined;
        pathNotifier.notify(
          `${basePath}.${String(key)}`,
          publication.afterValue,
          publication.beforeValue,
          basePath,
          [publication.subjectId],
          getPositionIdsForNotify(),
          (target.admittedEffects === undefined
            ? withEntityOrdinaryChanges
            : withSelectedEntityDisposition)(
            {
              ...(structuralEffect
                ? createStructuralEffectMeta(structuralEffect)
                : ambientMeta()),
              // Replay publishes retained storage too. Apply the same exposed
              // path protocol as the ordinary realization adapter, without
              // changing the ambient context of subsequent application taps.
              intent: 'system',
              participation: 'realized',
            },
            ordinaryPlan
              ? ordinaryBySubject.get(publication.subjectId) ?? []
              : [
                  {
                    subject: publication.subjectId,
                    before: publication.beforeValue,
                    after: publication.afterValue,
                    structural: structuralEffect !== undefined,
                    path: `${basePath}.${String(key)}`,
                    structuralRecord: structuralEffect,
                  },
                ]
          )
        );
        // Replay taps describe the change actually installed. A rekey has
        // no lifecycle tap, matching changeId; unchanged rows stay silent.
        const { beforeValue, afterValue } = publication;
        const kind = structuralEffect?.kind;
        if (kind === 'add') emitTap('onAdd', afterValue as E, key);
        else if (kind === 'remove') emitTap('onRemove', key, beforeValue as E);
        else if (!kind && !deepEqual(beforeValue, afterValue))
          emitTap('onUpdate', key, afterValue as E, afterValue as E);
      }
    },
  };
}
