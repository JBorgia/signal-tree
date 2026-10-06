import { applyInInvalidationGroup } from './post-application-failure';
import { holdEntityMembershipDelivery } from '../entity-membership-view';
import {
  canRealizePlainBranchMember,
  preparePlainBranchMembers,
} from '../plain-branch-membership';
import type {
  ISignalTree,
  PositionId,
  StructuralEffect,
  WriteMetadata,
} from '../../types';
import { getPathNotifier } from '../../path-notifier';
import { getActiveWriteContext, withWriteContext } from '../../write-context';
import { deepClone } from '../utilities/deep-clone';
import { getOwnedOwnerPath, getOwnedPositionIds } from '../owned-mutation';
import { getPhysicalCommitClock } from '../physical-commit-clock';
import {
  getPositionRegistry,
  type PositionRegistry,
} from '../position-registry';
import { getTreeScalarSlotRuntime } from '../tree-scalar-slot-port';
import { isTraversableNode } from '../../utils';
import { visitTree } from '../visit-tree';
import { markOwnerInvalidatedFrom } from '../owner-invalidation-port';
import { getLocationRuntime } from '../location-runtime';

import type { ReversalEffect, ReversalRefusal } from './causal-types';
import { normalizeScopedValuePath } from './scoped-value-addressing';
import { orderInsertions } from './insertion-order';

type StructuralDriftRefusal = Extract<
  ReversalRefusal,
  { readonly kind: 'structural-drift' }
>;

const TREE_REALIZATION_DESCRIPTORS = Symbol.for(
  'SignalTree:TreeRealizationDescriptors'
);
const TREE_REALIZATION_PORT = Symbol.for('SignalTree:TreeRealizationPort');

type CollectionNode = {
  byIdOrFail(id: string | number): unknown;
  changeId(from: string | number, to: string | number): void;
  removeOne(id: string | number): void;
  __planFreshAdd?(
    key: string | number,
    entity: unknown,
    subjectId: number
  ): {
    commit(options?: { advancePhysicalRevision?: boolean }): void;
    publish(metaOverride?: WriteMetadata): void;
  };
  __planRemove?(
    key: string | number,
    subjectId: number
  ): {
    commit(options?: { advancePhysicalRevision?: boolean }): void;
    publish(metaOverride?: WriteMetadata): void;
  };
  __planRestore?(
    key: string | number,
    entity: unknown,
    subjectId: number,
    beforeSubject?: number,
    afterSubject?: number,
    /**
     * Keys this same frame will vacate before the restore commits. Without it
     * the occupancy check is evaluated against pre-frame state and rejects a
     * key the frame itself is about to free. See RESTORE-P0 P0-D.
     */
    vacatingKeys?: ReadonlySet<string | number>
  ): {
    commit(options?: { advancePhysicalRevision?: boolean }): void;
    publish(metaOverride?: WriteMetadata): void;
  };
  __planRekey?(
    from: string | number,
    to: string | number
  ): {
    commit(options?: { advancePhysicalRevision?: boolean }): void;
    publish(metaOverride?: WriteMetadata): void;
  };
  __planPreparedRekey?(
    from: string | number,
    to: string | number,
    subjectId: number,
    entity: unknown
  ): {
    commit(options?: { advancePhysicalRevision?: boolean }): void;
    publish(metaOverride?: WriteMetadata): void;
  };
  __findKeyBySubjectId?(subjectId: number): string | number | undefined;
  __inspectSubjectResources?(
    subjectId: number
  ): { state: 'active' | 'tombstoned' } | undefined;
  __restoreOne?(
    key: string | number,
    entity: unknown,
    subjectId: number,
    beforeSubject?: number,
    afterSubject?: number
  ): void;
};

type WritableLeaf = {
  set(value: unknown): void;
};

type WritableEntityNode = {
  (value: unknown): void;
};

type PreparedSubjectRealization = {
  collectionPath: string;
  /** The collection node this subject belongs to; the scope of its key. */
  scope: object;
  subjectId: number;
  reachable: boolean;
  currentKey: string | number | undefined;
  value: unknown;
};

type PreparedOccupancyState = number | 'vacant';

/**
 * Subject lifetimes are allocated per collection, so two collections routinely
 * hold the same lifetime ID, and two collections can share a path label (a
 * literal `'a.b'` key beside a nested `a.b`). Prepared subjects and key
 * occupancy are therefore scoped by the collection NODE each effect resolves
 * to, by owner position where the effect states one. A bare lifetime once let
 * one collection's restored row absorb another collection's field reversal.
 */
class PreparedRealizationContext {
  constructor(
    private readonly scopeOf: (effect: ReversalEffect) => object | undefined
  ) {}

  private readonly subjects = new Map<
    object,
    Map<number, PreparedSubjectRealization>
  >();
  private readonly occupancy = new Map<
    object,
    Map<string | number, PreparedOccupancyState>
  >();

  private setOccupancy(
    scope: object,
    key: string | number,
    state: PreparedOccupancyState
  ): void {
    let entries = this.occupancy.get(scope);
    if (!entries) {
      entries = new Map<string | number, PreparedOccupancyState>();
      this.occupancy.set(scope, entries);
    }
    entries.set(key, state);
  }

  private subjectsIn(scope: object): Map<number, PreparedSubjectRealization> {
    let subjects = this.subjects.get(scope);
    if (!subjects) {
      subjects = new Map();
      this.subjects.set(scope, subjects);
    }
    return subjects;
  }

  rememberRestoredSubject(
    effect: ReversalEffect,
    subjectId: number,
    collectionPath: string,
    key: string | number,
    value: unknown
  ): void {
    const scope = this.scopeOf(effect);
    if (!scope) return;
    this.subjectsIn(scope).set(subjectId, {
      collectionPath,
      scope,
      subjectId,
      reachable: true,
      currentKey: key,
      value,
    });
    this.setOccupancy(scope, key, subjectId);
  }

  rememberRekeyedSubject(
    effect: ReversalEffect,
    subjectId: number,
    key: string | number
  ): void {
    const existing = this.resolveSubject(effect, subjectId);
    if (!existing) {
      return;
    }

    this.setOccupancy(
      existing.scope,
      existing.currentKey as string | number,
      'vacant'
    );
    this.setOccupancy(existing.scope, key, subjectId);

    this.subjectsIn(existing.scope).set(subjectId, {
      ...existing,
      reachable: true,
      currentKey: key,
    });
  }

  rememberRemovedSubject(
    effect: ReversalEffect,
    subjectId: number,
    collectionPath: string,
    key: string | number,
    value: unknown
  ): void {
    const scope = this.scopeOf(effect);
    if (!scope) return;
    const existing = this.subjectsIn(scope).get(subjectId);
    const currentValue = existing?.value ?? value;

    this.setOccupancy(scope, existing?.currentKey ?? key, 'vacant');

    this.subjectsIn(scope).set(subjectId, {
      collectionPath,
      scope,
      subjectId,
      reachable: false,
      currentKey: undefined,
      value: currentValue,
    });
  }

  resolveSubject(
    effect: ReversalEffect,
    subjectId: number
  ): PreparedSubjectRealization | undefined {
    const scope = this.scopeOf(effect);
    return scope === undefined
      ? undefined
      : this.subjects.get(scope)?.get(subjectId);
  }

  resolveOccupancy(
    scope: object,
    key: string | number
  ): PreparedOccupancyState | undefined {
    return this.occupancy.get(scope)?.get(key);
  }
}

type SubjectRealizationDescriptor = {
  path: string;
  ownerPath: string;
  collectionPath?: string;
  fieldPathFromRow?: string;
};

type InlineSubjectAddressEffect = ReversalEffect & {
  subjectId: number;
  path: string;
  ownerPath: string;
};

export interface TreeRealizationDescriptor {
  readonly path?: string;
  readonly ownerPath?: string;
  readonly collectionPath?: string;
  readonly fieldPathFromRow?: string;
  readonly structuralEffects?: ReadonlyMap<string, StructuralEffect>;
  readonly structuralEffectBySubject?: ReadonlyMap<string, StructuralEffect>;
  readonly subjectDescriptors?: ReadonlyMap<
    string,
    SubjectRealizationDescriptor
  >;
}

export interface RememberTreeRealizationDescriptorOptions {
  readonly descriptors: Map<PositionId, TreeRealizationDescriptor>;
  /**
   * ADDRESS-REPAIR-1 — canonical collection authority.
   *
   * Optional because SUBJECT-ADDRESS-CARDINALITY-0 measured that descriptor
   * capture is FALLBACK machinery: every effect needing a field coordinate
   * carries its own inline address, and the inline term wins. Capture still
   * derives correctly when the registry is supplied, and synthetic callers
   * without one keep the legacy interpretation.
   */
  readonly registry?: PositionRegistry;
  readonly path: string;
  readonly ownerPath?: string;
  readonly positionIds?: readonly number[];
  readonly subjectIds?: readonly number[];
  readonly meta?: WriteMetadata;
}

export interface CreateTreeRealizationAdapterOptions {
  readonly tree: ISignalTree<object>;
  readonly descriptors: ReadonlyMap<PositionId, TreeRealizationDescriptor>;
}

export interface TreeRealizationPort {
  validateEffects(
    effects: readonly ReversalEffect[]
  ): StructuralDriftRefusal | undefined;
  applyAtomically(effects: readonly ReversalEffect[]): void;
}

function isRealizationAttachmentHost(
  node: unknown
): node is Record<PropertyKey, unknown> {
  return isTraversableNode(node) || typeof node === 'function';
}

export function rememberTreeRealizationDescriptor(
  options: RememberTreeRealizationDescriptorOptions
): void {
  const owner = options.positionIds?.[0] as PositionId | undefined;
  if (owner === undefined) {
    return;
  }

  const existing = options.descriptors.get(owner);
  const structuralEffects =
    existing?.structuralEffects instanceof Map
      ? (existing.structuralEffects as Map<string, StructuralEffect>)
      : new Map(existing?.structuralEffects ?? []);
  const structuralEffectBySubject =
    existing?.structuralEffectBySubject instanceof Map
      ? (existing.structuralEffectBySubject as Map<string, StructuralEffect>)
      : new Map(existing?.structuralEffectBySubject ?? []);
  const subjectDescriptors =
    existing?.subjectDescriptors instanceof Map
      ? (existing.subjectDescriptors as Map<
          string,
          SubjectRealizationDescriptor
        >)
      : new Map(existing?.subjectDescriptors ?? []);
  if (options.meta?.structuralEffect) {
    structuralEffects.set(
      toStructuralEffectKey(options.meta.structuralEffect),
      options.meta.structuralEffect
    );
    if (
      options.meta.structuralEffect.kind === 'add' ||
      options.meta.structuralEffect.kind === 'remove'
    ) {
      structuralEffectBySubject.set(
        String(options.meta.structuralEffect.subject),
        options.meta.structuralEffect
      );
    }
  }

  const subjectId = options.subjectIds?.[0];
  const ownerPath = options.ownerPath ?? options.path;
  // ADDRESS-REPAIR-1 — the registry answers, the string does not.
  const { collectionPath, fieldPathFromRow } = deriveRealizationAddress(
    options.path,
    ownerPath,
    subjectId,
    options.meta?.structuralEffect,
    options.registry?.collectionPathFor(owner)
  );
  if (typeof subjectId === 'number') {
    const subjectKey = String(subjectId);
    const existingSubjectDescriptor = subjectDescriptors.get(subjectKey);
    if (
      !existingSubjectDescriptor ||
      existingSubjectDescriptor.path !== options.path ||
      existingSubjectDescriptor.ownerPath !== ownerPath ||
      existingSubjectDescriptor.collectionPath !== collectionPath ||
      existingSubjectDescriptor.fieldPathFromRow !== fieldPathFromRow
    ) {
      subjectDescriptors.set(subjectKey, {
        path: options.path,
        ownerPath,
        collectionPath,
        fieldPathFromRow,
      });
    }
  }

  const nextPath = existing?.path ?? options.path;
  const nextOwnerPath = existing?.ownerPath ?? ownerPath;
  const nextCollectionPath = existing?.collectionPath ?? collectionPath;
  const nextFieldPathFromRow = existing?.fieldPathFromRow ?? fieldPathFromRow;

  if (
    existing?.path === nextPath &&
    existing?.ownerPath === nextOwnerPath &&
    existing?.collectionPath === nextCollectionPath &&
    existing?.fieldPathFromRow === nextFieldPathFromRow &&
    existing?.structuralEffects === structuralEffects &&
    existing?.structuralEffectBySubject === structuralEffectBySubject &&
    existing?.subjectDescriptors === subjectDescriptors
  ) {
    return;
  }

  options.descriptors.set(owner, {
    path: nextPath,
    ownerPath: nextOwnerPath,
    collectionPath: nextCollectionPath,
    fieldPathFromRow: nextFieldPathFromRow,
    structuralEffects,
    structuralEffectBySubject,
    subjectDescriptors,
  });
}

/**
 * The port applies effects on behalf of two different callers — `restoration()`
 * restoring, and `transactions()` compensating a rollback — so it no longer
 * asserts an origin of its own. Each site takes `source` from the ambient write
 * context and falls back to `'system'`.
 *
 * This is what makes a restoration distinguishable from external truth at the
 * observation seam without changing its CLASSIFICATION: it stays
 * `participation: 'realized'`, because from the perspective of authorship and
 * history admission it is realization-like, and that is what stops an undo
 * recursively admitting itself.
 */
export function createTreeRealizationAdapter(
  options: CreateTreeRealizationAdapterOptions
): TreeRealizationPort {
  const scalarSlotRuntime =
    getTreeScalarSlotRuntime(options.tree) ??
    getTreeScalarSlotRuntime(options.tree.$);
  const physicalCommitClock =
    getPhysicalCommitClock(options.tree) ??
    getPhysicalCommitClock(options.tree.$);
  const collectionNodes = new Map<PositionId, CollectionNode>();
  COLLECTION_NODES.set(options.tree, collectionNodes);
  const structuralOwnerPaths = indexStructuralOwnerPaths(
    options.tree.$,
    collectionNodes
  );

  return {
    validateEffects(effects) {
      const preparedContext = buildPreparedRealizationContext(
        options.tree,
        options.descriptors,
        structuralOwnerPaths,
        scalarSlotRuntime,
        effects
      );
      if (!preparedContext) {
        return { kind: 'structural-drift' };
      }

      // RESTORE-P0 P0-C is deliberately NOT decided here.
      //
      // The first attempt compared each scalar location against the value the
      // turn left there and refused on any difference. It broke seven existing
      // selective-undo tests, because a closure undo legitimately reverses a
      // dependent turn first — so while reversing turn N the location still
      // holds turn N+1's value, and "current != recorded" is the NORMAL case,
      // not a conflict.
      //
      // The real predicate is provenance, not value: refuse when the current
      // value is EXTERNAL truth, allow when it came from an authored turn the
      // restoration is itself reversing. Only the history authority knows which
      // writes were realizations, so the check lives there.
      return undefined;
    },
    applyAtomically(effects) {
      const memberTargets = new Map<
        number,
        { present: boolean; value: unknown }
      >();
      const valueEffects: ReversalEffect[] = [];
      for (const effect of effects) {
        if (effect.plainBranchMembership) {
          memberTargets.set(effect.owner, {
            present: effect.plainBranchMembership.after,
            value: effect.after,
          });
        } else {
          valueEffects.push(effect);
        }
      }
      const members = memberTargets.size
        ? preparePlainBranchMembers(options.tree.$, memberTargets)
        : undefined;
      const apply = () => {
        // Prepare the remaining frame before any member is installed. All member
        // values and presence are installed before any effect is published.
        const heterogeneousFrame = valueEffects.length
          ? planHeterogeneousFrame(
              options.tree,
              options.descriptors,
              structuralOwnerPaths,
              scalarSlotRuntime,
              physicalCommitClock,
              valueEffects
            )
          : undefined;
        let scalarFrame =
          !heterogeneousFrame && valueEffects.length
            ? planScalarFrame(
                options.tree,
                options.descriptors,
                structuralOwnerPaths,
                scalarSlotRuntime,
                valueEffects
              )
            : undefined;
        // ⚠️ SLOT SCALARS NEVER TAKE THE AUTHORED WRITE (v16 8g cause 4,
        // ported with 8f). A mixed reversal whose collection cannot be
        // planned yet (it lies under a member this reversal re-adds) applies
        // effect by effect. An authored scalar write under a member the
        // reversal hides is an ordinary write since 8f (`structuralWrites`
        // marks only the writer's own locations), so it re-added that member's
        // path: a jump back over a path re-add, a `setAll` and an omission came
        // back with the member present and one child. Membership is the
        // membership targets' to decide; the slot frame writes values only.
        let perEffect: readonly ReversalEffect[] =
          heterogeneousFrame || scalarFrame ? [] : valueEffects;
        if (perEffect.length) {
          const slotScalars = valueEffects.filter(
            (effect) =>
              effect.structural === undefined &&
              effect.subjectId === undefined &&
              effect.fieldSegments === undefined &&
              !hasInlineScopedAddress(effect) &&
              !hasInlineSubjectAddress(effect) &&
              scalarSlotRuntime?.resolveScalarSlot(effect.owner) !== undefined
          );
          scalarFrame = slotScalars.length
            ? planScalarFrame(
                options.tree,
                options.descriptors,
                structuralOwnerPaths,
                scalarSlotRuntime,
                slotScalars
              )
            : undefined;
          if (scalarFrame) {
            const framed = new Set(slotScalars);
            perEffect = valueEffects.filter((effect) => !framed.has(effect));
          }
        }
        members?.install();
        // A membership-only frame has no value frame to advance the shared
        // physical clock. Publish its installed presence under a new revision.
        if (members && valueEffects.length === 0)
          physicalCommitClock?.advance();
        if (heterogeneousFrame) {
          heterogeneousFrame.commit();
        } else {
          scalarFrame?.commit();
          for (const effect of inPlacementOrder(
            perEffect,
            options.descriptors
          )) {
            applyEffect(
              options.tree,
              options.descriptors,
              structuralOwnerPaths,
              scalarSlotRuntime,
              effect
            );
          }
        }
        members?.publish();
      };

      // Membership listeners run once the whole reversal is installed and
      // published, in commit order, whatever throws on the way out.
      const releaseMembership = holdEntityMembershipDelivery(options.tree.$);
      try {
        applyInInvalidationGroup(options.tree.$, apply);
      } finally {
        releaseMembership();
      }
    },
  };
}

export function defineTreeRealizationDescriptors(
  node: object,
  descriptors: Map<PositionId, TreeRealizationDescriptor>
): void {
  Object.defineProperty(node, TREE_REALIZATION_DESCRIPTORS, {
    value: descriptors,
    enumerable: false,
    configurable: true,
  });
}

export function getTreeRealizationDescriptors(
  node: unknown
): Map<PositionId, TreeRealizationDescriptor> | undefined {
  if (!isRealizationAttachmentHost(node)) {
    return undefined;
  }

  return (
    node as Record<
      symbol,
      Map<PositionId, TreeRealizationDescriptor> | undefined
    >
  )[TREE_REALIZATION_DESCRIPTORS];
}

export function defineTreeRealizationPort(
  node: object,
  port: TreeRealizationPort
): void {
  Object.defineProperty(node, TREE_REALIZATION_PORT, {
    value: port,
    enumerable: false,
    configurable: true,
  });
}

export function getTreeRealizationPort(
  node: unknown
): TreeRealizationPort | undefined {
  if (!isRealizationAttachmentHost(node)) {
    return undefined;
  }

  return (node as Record<symbol, TreeRealizationPort | undefined>)[
    TREE_REALIZATION_PORT
  ];
}

function planHeterogeneousFrame(
  tree: ISignalTree<object>,
  descriptors: ReadonlyMap<PositionId, TreeRealizationDescriptor>,
  structuralOwnerPaths: ReadonlyMap<PositionId, string>,
  scalarSlotRuntime: ReturnType<typeof getTreeScalarSlotRuntime>,
  physicalCommitClock: ReturnType<typeof getPhysicalCommitClock>,
  effects: readonly ReversalEffect[]
): { commit(): void } | undefined {
  if (
    effects.length === 0 ||
    effects.some((effect) => effect.plainBranchMembership) ||
    !effects.some(
      (effect) =>
        effect.structural === 'rekey' ||
        effect.structural === 'add' ||
        effect.structural === 'remove'
    ) ||
    effects.some(
      (effect) =>
        effect.structural &&
        effect.structural !== 'rekey' &&
        effect.structural !== 'add' &&
        effect.structural !== 'remove'
    )
  ) {
    return undefined;
  }

  const scalarEffects = effects.filter((effect) => !effect.structural);
  const preparedContext = buildPreparedRealizationContext(
    tree,
    descriptors,
    structuralOwnerPaths,
    scalarSlotRuntime,
    effects
  );
  if (!preparedContext) {
    return undefined;
  }

  const removeKeysByEffect = new Map<
    ReversalEffect & { structural: 'remove'; subjectId: number },
    string | number
  >();
  const planningPreparedContext = new PreparedRealizationContext(
    preparedSubjectScope(tree, descriptors, structuralOwnerPaths)
  );
  for (const effect of effects) {
    const removeEffect =
      effect.structural === 'remove' && typeof effect.subjectId === 'number'
        ? (effect as ReversalEffect & {
            structural: 'remove';
            subjectId: number;
          })
        : undefined;

    if (removeEffect) {
      const descriptor = descriptors.get(effect.owner);
      const collectionNode = resolveCollectionNode(
        tree,
        descriptor,
        structuralOwnerPaths,
        removeEffect
      );
      if (!collectionNode) {
        return undefined;
      }

      const effectiveRemoveKey = resolveEffectiveRemoveKey(
        collectionNode,
        planningPreparedContext,
        removeEffect
      );
      if (effectiveRemoveKey === undefined) {
        return undefined;
      }

      removeKeysByEffect.set(removeEffect, effectiveRemoveKey);
    }

    updatePreparedRealizationContext(
      tree,
      descriptors,
      structuralOwnerPaths,
      planningPreparedContext,
      effect
    );
  }

  // RESTORE-P0 P0-D — what this frame is about to free, per collection.
  //
  // `removeKeysByEffect` is fully resolved above, BEFORE any restore is
  // planned, so the planner already knows every key its own frame will vacate.
  // It just never told the collection, and `planRestore` therefore validated
  // occupancy against pre-frame state.
  //
  // Scoped by owner (position id) rather than global: two collections may
  // legitimately hold the same key, and freeing 'a' in one must not license
  // overwriting 'a' in another.
  const vacatingKeysByOwner = new Map<number, Set<string | number>>();
  // Subjects this frame removes: restoring one of them (a move to a new key)
  // has to wait for its removal.
  const removedSubjects = new Set<string>();
  for (const [removeEffect, removedKey] of removeKeysByEffect) {
    removedSubjects.add(`${removeEffect.owner}\u0000${removeEffect.subjectId}`);
    let keys = vacatingKeysByOwner.get(removeEffect.owner);
    if (!keys) {
      keys = new Set<string | number>();
      vacatingKeysByOwner.set(removeEffect.owner, keys);
    }
    keys.add(removedKey);
  }

  const preparedSubjectScalarEffects = scalarEffects.filter((effect) =>
    isPreparedSubjectScalarEffect(effect, preparedContext)
  );
  const framedScalarEffects = scalarEffects.filter(
    (effect) => !isPreparedSubjectScalarEffect(effect, preparedContext)
  );
  const rekeyEffects = effects.filter(
    (effect): effect is ReversalEffect & { structural: 'rekey' } =>
      effect.structural === 'rekey'
  );
  // Restores commit in this order, and each resolves its anchors against the
  // rows live at that moment — so the order decides the placement.
  const restoreEffects = orderRestoresForPlacement(
    effects.filter(
      (
        effect
      ): effect is ReversalEffect & { structural: 'add'; subjectId: number } =>
        effect.structural === 'add' && typeof effect.subjectId === 'number'
    ),
    (effect) => getStructuralAddEffect(descriptors.get(effect.owner), effect)
  );
  const baseRevision = scalarSlotRuntime?.revision();
  const scalarFrameRuntime =
    framedScalarEffects.length > 0 ? scalarSlotRuntime : undefined;

  const scalarFrame =
    framedScalarEffects.length > 0
      ? scalarFrameRuntime?.beginFrame()
      : undefined;
  if (framedScalarEffects.length > 0 && (!scalarFrameRuntime || !scalarFrame)) {
    return undefined;
  }
  const resolvedScalarFrameRuntime = scalarFrameRuntime;
  // Restores and fresh adds, in restore order (one list: a fresh add may
  // anchor to a restore and the reverse).
  const plannedInsertions: Array<{
    effect: ReversalEffect & { structural: 'add'; subjectId: number };
    vacatedKey: boolean;
    plan: {
      commit(options?: { advancePhysicalRevision?: boolean }): void;
      publish(metaOverride?: WriteMetadata): void;
    };
  }> = [];
  const plannedRekeys: Array<{
    effect: ReversalEffect & { structural: 'rekey' };
    plan: {
      commit(options?: { advancePhysicalRevision?: boolean }): void;
      publish(metaOverride?: WriteMetadata): void;
    };
  }> = [];
  const plannedRemoves: Array<{
    effect: ReversalEffect & { structural: 'remove'; subjectId: number };
    plan: {
      commit(options?: { advancePhysicalRevision?: boolean }): void;
      publish(metaOverride?: WriteMetadata): void;
    };
  }> = [];

  for (const effect of restoreEffects) {
    const descriptor = descriptors.get(effect.owner);
    const collectionNode = resolveCollectionNode(
      tree,
      descriptor,
      structuralOwnerPaths,
      effect
    );
    const structuralEffect = getStructuralAddEffect(descriptor, effect);
    const collectionPath = resolveCollectionPath(
      descriptor,
      structuralOwnerPaths,
      effect
    );
    const subjectInventory = collectionNode?.__inspectSubjectResources?.(
      effect.subjectId
    );
    const isFreshSubject = subjectInventory === undefined;
    if (
      !collectionNode ||
      !structuralEffect ||
      !collectionPath ||
      (isFreshSubject
        ? typeof collectionNode.__planFreshAdd !== 'function'
        : typeof collectionNode.__planRestore !== 'function')
    ) {
      scalarFrame?.discard();
      return undefined;
    }

    const preparedSubject = preparedContext.resolveSubject(
      effect,
      effect.subjectId
    );
    if (!preparedSubject) {
      scalarFrame?.discard();
      return undefined;
    }

    if (isFreshSubject) {
      const planFreshAdd = collectionNode.__planFreshAdd;
      if (typeof planFreshAdd !== 'function') {
        scalarFrame?.discard();
        return undefined;
      }

      plannedInsertions.push({
        effect,
        vacatedKey:
          vacatingKeysByOwner
            .get(effect.owner)
            ?.has(effect.after as string | number) ?? false,
        plan: planFreshAdd(
          effect.after as string | number,
          preparedSubject.value,
          effect.subjectId
        ),
      });
      continue;
    }

    const planRestore = collectionNode.__planRestore;
    if (typeof planRestore !== 'function') {
      scalarFrame?.discard();
      return undefined;
    }

    plannedInsertions.push({
      effect,
      vacatedKey:
        (vacatingKeysByOwner
          .get(effect.owner)
          ?.has(effect.after as string | number) ??
          false) ||
        removedSubjects.has(`${effect.owner}\u0000${effect.subjectId}`),
      plan: planRestore(
        effect.after as string | number,
        preparedSubject.value,
        effect.subjectId,
        structuralEffect.beforeSubject,
        structuralEffect.afterSubject,
        vacatingKeysByOwner.get(effect.owner)
      ),
    });
  }

  for (const effect of framedScalarEffects) {
    if (!resolvedScalarFrameRuntime) {
      scalarFrame?.discard();
      return undefined;
    }

    const slotIndex = resolvedScalarFrameRuntime.resolveScalarSlot(
      effect.owner
    );
    if (slotIndex === undefined) {
      scalarFrame?.discard();
      return undefined;
    }
    scalarFrame?.set(slotIndex, effect.after);
  }

  for (const effect of rekeyEffects) {
    const descriptor = descriptors.get(effect.owner);
    const collectionNode = resolveCollectionNode(
      tree,
      descriptor,
      structuralOwnerPaths,
      effect
    );
    if (
      !collectionNode ||
      (typeof collectionNode.__planRekey !== 'function' &&
        typeof collectionNode.__planPreparedRekey !== 'function')
    ) {
      scalarFrame?.discard();
      return undefined;
    }

    const preparedSubject =
      typeof effect.subjectId === 'number'
        ? preparedContext.resolveSubject(effect, effect.subjectId)
        : undefined;
    const plan =
      preparedSubject &&
      typeof collectionNode.__planPreparedRekey === 'function'
        ? collectionNode.__planPreparedRekey(
            effect.before as string | number,
            effect.after as string | number,
            effect.subjectId as number,
            preparedSubject.value
          )
        : typeof collectionNode.__planRekey === 'function'
        ? collectionNode.__planRekey(
            effect.before as string | number,
            effect.after as string | number
          )
        : undefined;
    if (!plan) {
      scalarFrame?.discard();
      return undefined;
    }

    plannedRekeys.push({
      effect,
      plan,
    });

    if (typeof effect.subjectId === 'number') {
      preparedContext.rememberRekeyedSubject(
        effect,
        effect.subjectId,
        effect.after as string | number
      );
    }
  }

  const removeEffects = effects.filter(
    (
      effect
    ): effect is ReversalEffect & { structural: 'remove'; subjectId: number } =>
      effect.structural === 'remove' && typeof effect.subjectId === 'number'
  );

  for (const effect of removeEffects) {
    const descriptor = descriptors.get(effect.owner);
    const collectionNode = resolveCollectionNode(
      tree,
      descriptor,
      structuralOwnerPaths,
      effect
    );
    if (!collectionNode || typeof collectionNode.__planRemove !== 'function') {
      scalarFrame?.discard();
      return undefined;
    }

    const effectiveRemoveKey = removeKeysByEffect.get(effect);
    if (effectiveRemoveKey === undefined) {
      scalarFrame?.discard();
      return undefined;
    }

    plannedRemoves.push({
      effect,
      plan: collectionNode.__planRemove(effectiveRemoveKey, effect.subjectId),
    });
  }

  return {
    commit(): void {
      if (
        scalarFrame &&
        physicalCommitClock &&
        physicalCommitClock.revision() !== baseRevision
      ) {
        throw new Error('Heterogeneous realization base revision is stale.');
      }

      const commitAndPublish = () => {
        const scalarCommitResult = scalarFrame?.commit({
          advanceRevision: false,
          publish: false,
        });

        // Insertions first, deletions last (insertion-order.ts): a restore
        // anchored to a row this frame removes still finds it (redo of
        // `prependMany x; removeMany a, e` anchors x to a). A restore into a
        // key this frame vacates, or of a subject it removes (a move), waits
        // for the removal (RESTORE-P0 P0-D).
        const insertions = plannedInsertions.filter(
          ({ vacatedKey }) => !vacatedKey
        );
        const afterRemovals = plannedInsertions.filter(
          ({ vacatedKey }) => vacatedKey
        );
        for (const { plan } of insertions) {
          plan.commit({ advancePhysicalRevision: false });
        }

        for (const { plan } of plannedRemoves) {
          plan.commit({ advancePhysicalRevision: false });
        }

        for (const { plan } of afterRemovals) {
          plan.commit({ advancePhysicalRevision: false });
        }

        for (const { plan } of plannedRekeys) {
          plan.commit({ advancePhysicalRevision: false });
        }

        physicalCommitClock?.advance();
        if (scalarCommitResult && scalarSlotRuntime) {
          scalarSlotRuntime.publishPrepared(scalarCommitResult);
        }

        for (const { plan } of plannedRemoves) {
          plan.publish({
            ...(getActiveWriteContext() ?? {}),
            intent: 'system',
            participation: 'realized',
          });
        }

        for (const { plan } of plannedInsertions) {
          plan.publish({
            ...(getActiveWriteContext() ?? {}),
            intent: 'system',
            participation: 'realized',
          });
        }

        for (const { plan } of plannedRekeys) {
          plan.publish({
            ...(getActiveWriteContext() ?? {}),
            intent: 'system',
            participation: 'realized',
          });
        }

        // A row this frame puts back carries its prepared fields in the
        // insertion's own publication, the WHOLE row, as every restore does;
        // a row it removes has no fields left to publish. Publishing those
        // fields again on their own paths sent Link (and any whole-row
        // reader) the bare field value as the row: undo of an
        // edit-then-remove turn delivered `[z, 1, c]` (15.4.3 and earlier;
        // undo-rules review of b2107f43, item 2).
        const structurallyPublished = new Set(
          [...plannedInsertions, ...plannedRemoves].map(
            ({ effect }) => `${effect.owner}\u0000${effect.subjectId}`
          )
        );
        for (const effect of [
          ...preparedSubjectScalarEffects.filter(
            ({ owner, subjectId }) =>
              !structurallyPublished.has(`${owner}\u0000${subjectId}`)
          ),
          ...framedScalarEffects,
        ]) {
          const descriptor = descriptors.get(effect.owner);
          const notifyPath = resolveNotifyPath(
            tree,
            descriptor,
            structuralOwnerPaths,
            effect
          );
          if (!notifyPath) {
            continue;
          }

          getPathNotifier().notify(
            notifyPath,
            effect.after,
            effect.before,
            descriptor?.ownerPath ?? notifyPath,
            typeof effect.subjectId === 'number'
              ? [effect.subjectId]
              : undefined,
            [effect.owner],
            {
              ...(getActiveWriteContext() ?? {}),
              intent: 'system',
              participation: 'realized',
            }
          );
        }

        markOwnerInvalidatedFrom(tree as object);
      };

      const locations = getLocationRuntime(tree.$);
      if (locations) {
        locations.runInvalidationGroup(commitAndPublish);
      } else if (scalarSlotRuntime) {
        scalarSlotRuntime.runInvalidationGroup(commitAndPublish);
      } else {
        commitAndPublish();
      }
    },
  };
}

function planScalarFrame(
  tree: ISignalTree<object>,
  descriptors: ReadonlyMap<PositionId, TreeRealizationDescriptor>,
  structuralOwnerPaths: ReadonlyMap<PositionId, string>,
  scalarSlotRuntime: ReturnType<typeof getTreeScalarSlotRuntime>,
  effects: readonly ReversalEffect[]
): { commit(): void } | undefined {
  void tree;
  void descriptors;
  void structuralOwnerPaths;
  if (
    effects.length === 0 ||
    effects.some((effect) => effect.plainBranchMembership) ||
    effects.some(
      (effect) =>
        effect.structural ||
        hasInlineScopedAddress(effect) ||
        hasInlineSubjectAddress(effect) ||
        effect.fieldSegments !== undefined
    )
  ) {
    return undefined;
  }

  if (!scalarSlotRuntime) {
    return undefined;
  }

  const frame = scalarSlotRuntime.beginFrame();
  for (const effect of effects) {
    const slotIndex = scalarSlotRuntime.resolveScalarSlot(effect.owner);
    if (slotIndex === undefined) {
      return undefined;
    }

    frame.set(slotIndex, effect.after);
  }

  return {
    commit(): void {
      frame.commit();

      for (const effect of effects) {
        const descriptor = descriptors.get(effect.owner);
        const notifyPath = resolveNotifyPath(
          tree,
          descriptor,
          structuralOwnerPaths,
          effect
        );
        if (!notifyPath) {
          continue;
        }

        getPathNotifier().notify(
          notifyPath,
          effect.after,
          effect.before,
          descriptor?.ownerPath ?? notifyPath,
          typeof effect.subjectId === 'number' ? [effect.subjectId] : undefined,
          [effect.owner],
          {
            ...(getActiveWriteContext() ?? {}),
            intent: 'system',
            participation: 'realized',
          }
        );
      }
    },
  };
}

function canApplyEffect(
  tree: ISignalTree<object>,
  descriptors: ReadonlyMap<PositionId, TreeRealizationDescriptor>,
  structuralOwnerPaths: ReadonlyMap<PositionId, string>,
  scalarSlotRuntime: ReturnType<typeof getTreeScalarSlotRuntime>,
  effect: ReversalEffect,
  preparedContext?: PreparedRealizationContext
): boolean {
  const membership = effect.plainBranchMembership;
  if (membership) {
    return canRealizePlainBranchMember(tree.$, effect.owner);
  }
  const descriptor = descriptors.get(effect.owner);
  if (
    !descriptor &&
    !effect.structural &&
    !scalarSlotRuntime?.resolveScalarLeaf(effect.owner) &&
    effect.fieldSegments === undefined &&
    !hasInlineSubjectAddress(effect) &&
    !hasInlineScopedAddress(effect)
  ) {
    return false;
  }

  if (!effect.structural) {
    if (
      canResolvePreparedSubjectTarget(
        descriptor,
        effect,
        preparedContext,
        getPositionRegistry(tree.$)
      )
    ) {
      return true;
    }

    const target = resolveLiveScalarNode(
      tree,
      descriptor,
      scalarSlotRuntime,
      effect
    );
    return isWritableLeaf(target) || isWritableEntityNode(target);
  }

  const ownerNode = resolveCollectionNode(
    tree,
    descriptor,
    structuralOwnerPaths,
    effect
  );
  if (!ownerNode) {
    return false;
  }

  const currentSubjectKey =
    typeof effect.subjectId === 'number'
      ? resolvePreparedOrLiveSubjectKey(
          ownerNode,
          preparedContext,
          effect,
          effect.subjectId
        )
      : undefined;
  const destinationOccupied =
    effect.structural === 'rekey' || effect.structural === 'add'
      ? isCollectionKeyOccupied(
          ownerNode,
          effect.after as string | number,
          preparedContext
        )
      : false;

  switch (effect.structural) {
    case 'remove': {
      const removeEffect =
        typeof effect.subjectId === 'number'
          ? (effect as ReversalEffect & {
              structural: 'remove';
              subjectId: number;
            })
          : undefined;
      return (
        (removeEffect
          ? resolveEffectiveRemoveKey(
              ownerNode,
              preparedContext,
              removeEffect
            ) !== undefined
          : hasCollectionKey(ownerNode, effect.before as string | number)) &&
        (typeof effect.subjectId !== 'number' ||
          currentSubjectKey !== undefined)
      );
    }
    case 'rekey':
      return (
        (typeof effect.subjectId === 'number'
          ? currentSubjectKey === effect.before
          : hasCollectionKey(ownerNode, effect.before as string | number)) &&
        (typeof effect.subjectId !== 'number' ||
          currentSubjectKey === effect.before) &&
        !destinationOccupied
      );
    case 'add': {
      if (
        typeof effect.subjectId !== 'number' ||
        typeof ownerNode.__restoreOne !== 'function' ||
        destinationOccupied ||
        currentSubjectKey !== undefined
      ) {
        return false;
      }

      return getStructuralAddEffect(descriptor, effect) !== undefined;
    }
  }
}

function applyEffect(
  tree: ISignalTree<object>,
  descriptors: ReadonlyMap<PositionId, TreeRealizationDescriptor>,
  structuralOwnerPaths: ReadonlyMap<PositionId, string>,
  scalarSlotRuntime: ReturnType<typeof getTreeScalarSlotRuntime>,
  effect: ReversalEffect
): void {
  const descriptor = descriptors.get(effect.owner);
  if (
    !descriptor &&
    !effect.structural &&
    !scalarSlotRuntime?.resolveScalarLeaf(effect.owner) &&
    effect.fieldSegments === undefined &&
    !hasInlineSubjectAddress(effect) &&
    !hasInlineScopedAddress(effect)
  ) {
    throw new Error(
      `Missing live descriptor for owner ${String(effect.owner)}`
    );
  }

  withWriteContext(
    {
      ...(getActiveWriteContext() ?? {}),
      intent: 'system',
      participation: 'realized',
    },
    () => {
      if (
        !effect.structural &&
        effect.fieldPresence?.after === false &&
        typeof effect.subjectId === 'number' &&
        effect.fieldSegments?.length
      ) {
        // The field was absent at the target endpoint: remove the key from the
        // row rather than writing undefined into it.
        const row = resolveCurrentSubjectTarget(
          tree,
          descriptor,
          effect.subjectId,
          { ...effect, fieldSegments: [] }
        );
        if (isWritableEntityNode(row)) {
          const read = row as unknown as () => unknown;
          row(withoutFieldAtSegments(read(), effect.fieldSegments));
          return;
        }
      }
      if (!effect.structural) {
        const target = resolveLiveScalarNode(
          tree,
          descriptor,
          scalarSlotRuntime,
          effect
        );
        if (isWritableLeaf(target)) {
          target.set(effect.after);
          return;
        }

        if (isWritableEntityNode(target)) {
          target(effect.after);
          return;
        }

        if (!isWritableLeaf(target)) {
          throw new Error(
            `Missing live leaf for owner ${String(effect.owner)}`
          );
        }
        return;
      }

      const ownerNode = resolveCollectionNode(
        tree,
        descriptor,
        structuralOwnerPaths,
        effect
      );
      if (!ownerNode) {
        throw new Error(`Missing structural owner for ${String(effect.owner)}`);
      }

      switch (effect.structural) {
        case 'rekey':
          ownerNode.changeId(
            effect.before as string | number,
            effect.after as string | number
          );
          return;
        case 'remove': {
          const removeEffect =
            typeof effect.subjectId === 'number'
              ? (effect as ReversalEffect & {
                  structural: 'remove';
                  subjectId: number;
                })
              : undefined;
          const effectiveRemoveKey = removeEffect
            ? resolveEffectiveRemoveKey(ownerNode, undefined, removeEffect)
            : (effect.before as string | number);
          if (effectiveRemoveKey === undefined) {
            throw new Error(
              `Missing live structural subject for owner ${String(
                effect.owner
              )}`
            );
          }

          ownerNode.removeOne(effectiveRemoveKey);
          return;
        }
        case 'add': {
          const structuralEffect = getStructuralAddEffect(descriptor, effect);
          if (!structuralEffect) {
            throw new Error(
              `Missing structural restore metadata for owner ${String(
                effect.owner
              )}`
            );
          }

          ownerNode.__restoreOne?.(
            effect.after as string | number,
            structuralEffect.value,
            effect.subjectId as number,
            structuralEffect.beforeSubject,
            structuralEffect.afterSubject
          );
          return;
        }
      }
    }
  );
}

function resolveLiveScalarNode(
  tree: ISignalTree<object>,
  descriptor: TreeRealizationDescriptor | undefined,
  scalarSlotRuntime: ReturnType<typeof getTreeScalarSlotRuntime>,
  effect: ReversalEffect
): unknown {
  if (typeof effect.subjectId === 'number') {
    return resolveCurrentSubjectTarget(
      tree,
      descriptor,
      effect.subjectId,
      effect
    );
  }

  if (hasInlineScopedAddress(effect)) {
    return resolveCurrentScopedTarget(tree, descriptor, effect);
  }

  const directLeaf = scalarSlotRuntime?.resolveScalarLeaf(effect.owner);
  if (directLeaf) {
    return directLeaf;
  }

  if (!descriptor?.path) {
    return undefined;
  }

  const pathNode = resolveNodeAtPath(
    tree.$ as Record<string, unknown>,
    descriptor.path
  );
  return isWritableLeaf(pathNode) || isWritableEntityNode(pathNode)
    ? pathNode
    : undefined;
}

function canResolvePreparedSubjectTarget(
  descriptor: TreeRealizationDescriptor | undefined,
  effect: ReversalEffect,
  preparedContext: PreparedRealizationContext | undefined,
  registry: PositionRegistry | undefined
): boolean {
  if (typeof effect.subjectId !== 'number') {
    return false;
  }

  const preparedSubject = preparedContext?.resolveSubject(
    effect,
    effect.subjectId
  );
  if (!preparedSubject) {
    return false;
  }

  if (!preparedSubject.reachable) {
    return false;
  }

  const fieldSegments = resolveSubjectFieldSegments(
    descriptor,
    effect,
    registry
  );
  if (fieldSegments === undefined) {
    return false;
  }

  const value = preparedSubject.value as Record<string, unknown>;
  // A reversal that RE-CREATES a field targets a key the prepared row lacks:
  // the turn dropped the field and then removed the row, so the row is back
  // as removed. Its parent is the target. Requiring the key itself refused
  // replaceOne/overwrite-without-a-field then removeOne, on undo and rollback.
  return effect.fieldPresence?.after === true && fieldSegments.length > 0
    ? isTraversableNode(
        resolveNodeAtSegments(value, fieldSegments.slice(0, -1))
      )
    : resolveNodeAtSegments(value, fieldSegments) !== undefined;
}

function resolveCollectionNode(
  tree: ISignalTree<object>,
  descriptor: TreeRealizationDescriptor | undefined,
  structuralOwnerPaths: ReadonlyMap<PositionId, string>,
  effect: ReversalEffect
): CollectionNode | undefined {
  // Owner position first: a path label cannot tell a literal 'a.b' key from
  // nested a -> b. Legacy descriptors whose owner is a leaf fall through.
  const byOwner = collectionNodeByOwner(tree, effect.owner);
  if (byOwner) return byOwner;
  const collectionPath = resolveCollectionPath(
    descriptor,
    structuralOwnerPaths,
    effect
  );
  if (collectionPath === undefined) {
    return undefined;
  }

  const node = resolveNodeAtPath(
    tree.$ as Record<string, unknown>,
    collectionPath
  );
  return isCollectionNode(node) ? node : undefined;
}

function resolveCollectionPath(
  descriptor: TreeRealizationDescriptor | undefined,
  structuralOwnerPaths: ReadonlyMap<PositionId, string>,
  effect: ReversalEffect
): string | undefined {
  return (
    descriptor?.collectionPath ??
    (effect.structural ? descriptor?.ownerPath : undefined) ??
    structuralOwnerPaths.get(effect.owner)
  );
}

function isCollectionKeyOccupied(
  ownerNode: CollectionNode,
  key: string | number,
  preparedContext: PreparedRealizationContext | undefined
): boolean {
  const preparedOccupancy = preparedContext?.resolveOccupancy(ownerNode, key);
  if (preparedOccupancy === 'vacant') {
    return false;
  }
  if (preparedOccupancy !== undefined) {
    return true;
  }

  return hasCollectionKey(ownerNode, key);
}

function resolvePreparedOrLiveSubjectKey(
  ownerNode: CollectionNode,
  preparedContext: PreparedRealizationContext | undefined,
  effect: ReversalEffect,
  subjectId: number
): string | number | undefined {
  const preparedSubject = preparedContext?.resolveSubject(effect, subjectId);
  if (preparedSubject) {
    return preparedSubject.currentKey;
  }

  return ownerNode.__findKeyBySubjectId?.(subjectId);
}

function resolveEffectiveRemoveKey(
  ownerNode: CollectionNode,
  preparedContext: PreparedRealizationContext | undefined,
  effect: ReversalEffect & { structural: 'remove'; subjectId: number }
): string | number | undefined {
  return resolvePreparedOrLiveSubjectKey(
    ownerNode,
    preparedContext,
    effect,
    effect.subjectId
  );
}

function snapshotCollectionEntityValue(
  collectionNode: CollectionNode,
  key: string | number
): unknown {
  const rowNode = collectionNode.byIdOrFail(key);
  return typeof rowNode === 'function' ? rowNode() : rowNode;
}

function updatePreparedRealizationContext(
  tree: ISignalTree<object>,
  descriptors: ReadonlyMap<PositionId, TreeRealizationDescriptor>,
  structuralOwnerPaths: ReadonlyMap<PositionId, string>,
  preparedContext: PreparedRealizationContext,
  effect: ReversalEffect
): void {
  if (typeof effect.subjectId === 'number' && !effect.structural) {
    const descriptor = descriptors.get(effect.owner);
    const preparedSubject = preparedContext.resolveSubject(
      effect,
      effect.subjectId
    );
    const fieldSegments = resolveSubjectFieldSegments(
      descriptor,
      effect,
      getPositionRegistry(tree.$)
    );
    if (preparedSubject && fieldSegments !== undefined) {
      if (fieldSegments.length === 0) preparedSubject.value = effect.after;
      else if (effect.fieldPresence?.after === false)
        preparedSubject.value = withoutFieldAtSegments(
          preparedSubject.value,
          fieldSegments
        );
      else
        assignPreparedSubjectValue(
          preparedSubject.value,
          fieldSegments,
          effect.after
        );
    }
    return;
  }

  if (typeof effect.subjectId !== 'number' || !effect.structural) {
    return;
  }

  const descriptor = descriptors.get(effect.owner);
  switch (effect.structural) {
    case 'add': {
      const collectionPath = resolveCollectionPath(
        descriptor,
        structuralOwnerPaths,
        effect
      );
      if (!collectionPath) {
        return;
      }
      const structuralEffect = getStructuralAddEffect(descriptor, effect);
      if (!structuralEffect) {
        return;
      }
      const preparedValue = deepClone(structuralEffect.value);
      preparedContext.rememberRestoredSubject(
        effect,
        effect.subjectId,
        collectionPath,
        effect.after as string | number,
        preparedValue
      );

      return;
    }
    case 'rekey':
      preparedContext.rememberRekeyedSubject(
        effect,
        effect.subjectId,
        effect.after as string | number
      );
      return;
    case 'remove': {
      const collectionPath = resolveCollectionPath(
        descriptor,
        structuralOwnerPaths,
        effect
      );
      if (!collectionPath) {
        return;
      }

      const collectionNode = resolveCollectionNode(
        tree,
        descriptor,
        structuralOwnerPaths,
        effect
      );
      if (!collectionNode) {
        return;
      }

      const removeEffect = effect as ReversalEffect & {
        structural: 'remove';
        subjectId: number;
      };
      const effectiveRemoveKey = resolveEffectiveRemoveKey(
        collectionNode,
        preparedContext,
        removeEffect
      );
      if (effectiveRemoveKey === undefined) {
        return;
      }

      const liveValue = snapshotCollectionEntityValue(
        collectionNode,
        effectiveRemoveKey
      );
      if (liveValue === undefined) {
        return;
      }

      preparedContext.rememberRemovedSubject(
        effect,
        effect.subjectId,
        collectionPath,
        effectiveRemoveKey,
        liveValue
      );
      return;
    }
  }
}

function preparedSubjectScope(
  tree: ISignalTree<object>,
  descriptors: ReadonlyMap<PositionId, TreeRealizationDescriptor>,
  structuralOwnerPaths: ReadonlyMap<PositionId, string>
): (effect: ReversalEffect) => object | undefined {
  return (effect) =>
    resolveCollectionNode(
      tree,
      descriptors.get(effect.owner),
      structuralOwnerPaths,
      effect
    );
}

function buildPreparedRealizationContext(
  tree: ISignalTree<object>,
  descriptors: ReadonlyMap<PositionId, TreeRealizationDescriptor>,
  structuralOwnerPaths: ReadonlyMap<PositionId, string>,
  scalarSlotRuntime: ReturnType<typeof getTreeScalarSlotRuntime>,
  effects: readonly ReversalEffect[]
): PreparedRealizationContext | undefined {
  const preparedContext = new PreparedRealizationContext(
    preparedSubjectScope(tree, descriptors, structuralOwnerPaths)
  );
  for (const effect of effects) {
    if (
      !canApplyEffect(
        tree,
        descriptors,
        structuralOwnerPaths,
        scalarSlotRuntime,
        effect,
        preparedContext
      )
    ) {
      return undefined;
    }

    updatePreparedRealizationContext(
      tree,
      descriptors,
      structuralOwnerPaths,
      preparedContext,
      effect
    );
  }

  return preparedContext;
}

function resolveSubjectFieldSegments(
  descriptor: TreeRealizationDescriptor | undefined,
  effect: ReversalEffect,
  registry: PositionRegistry | undefined
): readonly string[] | undefined {
  if (typeof effect.subjectId !== 'number') {
    return undefined;
  }

  if (effect.fieldSegments !== undefined) return effect.fieldSegments;
  const inlineFieldPathFromRow = deriveFieldPathFromEffect(effect, registry);
  const path =
    inlineFieldPathFromRow ??
    descriptor?.subjectDescriptors?.get(String(effect.subjectId))
      ?.fieldPathFromRow ??
    descriptor?.fieldPathFromRow;
  return path === undefined ? undefined : path === '' ? [] : path.split('.');
}

function assignPreparedSubjectValue(
  subjectValue: unknown,
  segments: readonly string[],
  nextValue: unknown
): void {
  if (segments.length === 0) {
    return;
  }

  if (!isTraversableNode(subjectValue)) {
    return;
  }

  let cursor: unknown = subjectValue;
  for (const segment of segments.slice(0, -1)) {
    if (!isTraversableNode(cursor)) {
      return;
    }
    cursor = (cursor as Record<string, unknown>)[segment];
  }

  const leafKey = segments.at(-1);
  if (leafKey === undefined || !isTraversableNode(cursor)) {
    return;
  }

  (cursor as Record<string, unknown>)[leafKey] = nextValue;
}

function isPreparedSubjectScalarEffect(
  effect: ReversalEffect,
  preparedContext: PreparedRealizationContext
): boolean {
  return (
    typeof effect.subjectId === 'number' &&
    !effect.structural &&
    preparedContext.resolveSubject(effect, effect.subjectId) !== undefined
  );
}

/**
 * Collection nodes by their owned position, indexed by the same walk that
 * builds the owner-path index at adapter creation, so resolution performs no
 * further tree visits. Keyed by the tree handle the adapter was created with.
 * A collection created later is not indexed and resolves by its path, as before.
 */
const COLLECTION_NODES = new WeakMap<object, Map<PositionId, CollectionNode>>();

function collectionNodeByOwner(
  tree: object,
  owner: PositionId
): CollectionNode | undefined {
  return COLLECTION_NODES.get(tree)?.get(owner);
}

function indexStructuralOwnerPaths(
  root: unknown,
  collectionNodes?: Map<PositionId, CollectionNode>
): Map<PositionId, string> {
  const ownerPaths = new Map<PositionId, string>();

  visitTree(
    root,
    (node) => {
      if (!isCollectionNode(node)) {
        return undefined;
      }

      const positionId = getOwnedPositionIds(node)?.[0] as
        | PositionId
        | undefined;
      const ownerPath = getOwnedOwnerPath(node);
      if (positionId === undefined || ownerPath === undefined) {
        return undefined;
      }

      // This is only a current realization address for an actual collection
      // node, not structural identity. PositionId, subject lifetime, and
      // ownerPath can diverge if topology support expands further.
      ownerPaths.set(positionId, ownerPath);
      collectionNodes?.set(positionId, node);
      return undefined;
    },
    {
      skipKey: (key) =>
        key === 'set' || key === 'update' || key.startsWith('_'),
    }
  );

  return ownerPaths;
}

function resolveCurrentSubjectTarget(
  tree: ISignalTree<object>,
  descriptor: TreeRealizationDescriptor | undefined,
  subjectId: number,
  effect: ReversalEffect
): unknown {
  const registry = getPositionRegistry(tree.$);
  const inlineCollectionPath = deriveCollectionPathFromEffect(effect, registry);
  const inlineFieldPathFromRow = deriveFieldPathFromEffect(effect, registry);
  const subjectDescriptor = descriptor?.subjectDescriptors?.get(
    String(subjectId)
  );
  const collectionPath =
    inlineCollectionPath ??
    subjectDescriptor?.collectionPath ??
    descriptor?.collectionPath ??
    (effect.structural ? descriptor?.ownerPath : undefined);
  const byOwner = collectionNodeByOwner(tree, effect.owner);
  if (!byOwner && !collectionPath && collectionPath !== '') {
    return undefined;
  }
  const collectionNode =
    byOwner ??
    resolveNodeAtPath(tree.$ as Record<string, unknown>, collectionPath ?? '');
  if (!isCollectionNode(collectionNode)) {
    return undefined;
  }

  const currentKey = collectionNode.__findKeyBySubjectId?.(subjectId);
  if (currentKey === undefined) {
    return undefined;
  }

  const rowNode = collectionNode.byIdOrFail(currentKey);
  if (effect.fieldSegments !== undefined) {
    const segments = effect.fieldSegments;
    if (segments.length === 0) return rowNode;
    if (typeof rowNode === 'function') {
      // EntityNode exposes top-level field carriers; deeper fields live in
      // their natural values. Apply exact keys to the subject's CURRENT row
      // so sibling fields and rekeys survive. No display-path parsing occurs.
      const row = rowNode as { (): unknown; (value: unknown): void };
      return Object.assign(
        () => resolveNodeAtSegments(row() as Record<string, unknown>, segments),
        {
          set: (value: unknown): void =>
            row(replaceFieldAtSegments(row(), segments, value)),
        }
      );
    }
    return resolveNodeAtSegments(rowNode as Record<string, unknown>, segments);
  }
  const fieldPathFromRow =
    inlineFieldPathFromRow ??
    subjectDescriptor?.fieldPathFromRow ??
    descriptor?.fieldPathFromRow;

  if (fieldPathFromRow === '') {
    return rowNode;
  }

  if (!fieldPathFromRow) {
    return undefined;
  }

  return resolveNodeAtPath(
    rowNode as Record<string, unknown>,
    fieldPathFromRow
  );
}

function resolveNotifyPath(
  tree: ISignalTree<object>,
  descriptor: TreeRealizationDescriptor | undefined,
  structuralOwnerPaths: ReadonlyMap<PositionId, string>,
  effect: ReversalEffect
): string | undefined {
  if (hasInlineScopedAddress(effect)) {
    return effect.path;
  }

  if (typeof effect.subjectId !== 'number') {
    return descriptor?.path ?? effect.path;
  }

  const registry = getPositionRegistry(tree.$);
  const inlineCollectionPath = deriveCollectionPathFromEffect(effect, registry);
  const inlineFieldPathFromRow = deriveFieldPathFromEffect(effect, registry);
  const collectionPath =
    inlineCollectionPath ??
    descriptor?.subjectDescriptors?.get(String(effect.subjectId))
      ?.collectionPath ??
    descriptor?.collectionPath ??
    structuralOwnerPaths.get(effect.owner);
  if (collectionPath === undefined) {
    return descriptor?.path;
  }

  const collectionNode = resolveNodeAtPath(
    tree.$ as Record<string, unknown>,
    collectionPath
  );
  if (!isCollectionNode(collectionNode)) {
    return descriptor?.path;
  }

  const currentKey = collectionNode.__findKeyBySubjectId?.(effect.subjectId);
  if (currentKey === undefined) {
    return descriptor?.path;
  }

  const fieldPathFromRow =
    inlineFieldPathFromRow ??
    descriptor?.subjectDescriptors?.get(String(effect.subjectId))
      ?.fieldPathFromRow ??
    descriptor?.fieldPathFromRow;
  const rowPath = `${collectionPath}.${String(currentKey)}`;

  if (fieldPathFromRow === '') {
    return rowPath;
  }

  return fieldPathFromRow ? `${rowPath}.${fieldPathFromRow}` : descriptor?.path;
}

function hasInlineSubjectAddress(
  effect: ReversalEffect
): effect is InlineSubjectAddressEffect {
  return (
    typeof effect.subjectId === 'number' &&
    typeof effect.path === 'string' &&
    typeof effect.ownerPath === 'string'
  );
}

function hasInlineScopedAddress(
  effect: ReversalEffect
): effect is ReversalEffect & { path: string; ownerPath: string } {
  return (
    typeof effect.path === 'string' &&
    typeof effect.ownerPath === 'string' &&
    effect.path !== effect.ownerPath
  );
}

/**
 * ⚠️ THE INLINE PATH IS THE ONE THAT MATTERED.
 *
 * SUBJECT-ADDRESS-CARDINALITY-0 measured that these two win over every
 * descriptor fallback — `descField=""` sat unused while `inlineField` supplied
 * the answer on every resolution. So the nested rollback defect lived HERE, not
 * in descriptor capture or its merge policy, and the registry has to be
 * reachable from this call site or the repair does nothing.
 */
function deriveCollectionPathFromEffect(
  effect: ReversalEffect,
  registry: PositionRegistry | undefined
): string | undefined {
  const collectionPath = registry?.collectionPathFor(effect.owner);
  if (effect.fieldSegments !== undefined && collectionPath !== undefined)
    return collectionPath;
  if (!hasInlineSubjectAddress(effect)) {
    return undefined;
  }

  return deriveRealizationAddress(
    effect.path,
    effect.ownerPath,
    effect.subjectId as number,
    undefined,
    registry?.collectionPathFor(effect.owner)
  ).collectionPath;
}

export function deriveFieldPathFromEffect(
  effect: ReversalEffect,
  registry: PositionRegistry | undefined
): string | undefined {
  // Kept for display/legacy descriptor consumers only. Real entity identity
  // is carried and resolved as fieldSegments, never reconstructed from this.
  if (effect.fieldSegments !== undefined) return effect.fieldSegments.join('.');
  if (!hasInlineSubjectAddress(effect)) {
    return undefined;
  }

  return deriveRealizationAddress(
    effect.path,
    effect.ownerPath,
    effect.subjectId as number,
    undefined,
    registry?.collectionPathFor(effect.owner)
  ).fieldPathFromRow;
}

function resolveCurrentScopedTarget(
  tree: ISignalTree<object>,
  descriptor: TreeRealizationDescriptor | undefined,
  effect: ReversalEffect & { path: string; ownerPath: string }
): unknown {
  const scopePath = effect.ownerPath ?? descriptor?.ownerPath;
  if (!scopePath) {
    return undefined;
  }

  const scopeNode = resolveNodeAtPath(
    tree.$ as Record<string, unknown>,
    scopePath
  );
  if (scopeNode === undefined) {
    return undefined;
  }

  const relativePath = effect.path.startsWith(`${scopePath}.`)
    ? effect.path.slice(scopePath.length + 1)
    : '';
  const normalizedRelativePath = normalizeScopedValuePath(relativePath);

  if (normalizedRelativePath === '') {
    return scopeNode;
  }

  const scopedFieldTree =
    scopeNode && typeof scopeNode === 'function' && '$' in (scopeNode as object)
      ? (scopeNode as { $?: unknown }).$
      : undefined;

  if (isTraversableNode(scopedFieldTree)) {
    const scopedTarget = resolveNodeAtPath(
      scopedFieldTree as Record<string, unknown>,
      normalizedRelativePath
    );
    if (isWritableLeaf(scopedTarget) || isWritableEntityNode(scopedTarget)) {
      return scopedTarget;
    }
  }

  if (!isTraversableNode(scopeNode)) {
    return undefined;
  }

  return resolveNodeAtPath(
    scopeNode as Record<string, unknown>,
    normalizedRelativePath
  );
}

function resolveNodeAtPath(
  root: Record<string, unknown>,
  path: string
): unknown {
  if (path === '') {
    return root;
  }

  return resolveNodeAtSegments(root, path.split('.'));
}

function resolveNodeAtSegments(
  root: Record<string, unknown>,
  segments: readonly string[]
): unknown {
  let cursor: unknown = root;
  for (const segment of segments) {
    if (cursor === null || cursor === undefined) {
      return undefined;
    }
    cursor = (cursor as Record<string, unknown>)[segment];
  }

  return cursor;
}

/** A copy of `value` without the field at `segments`; other keys untouched. */
function withoutFieldAtSegments(
  value: unknown,
  segments: readonly string[]
): unknown {
  if (segments.length === 0 || !isTraversableNode(value)) return value;
  const [head, ...tail] = segments;
  const record = value as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(record, head)) return value;
  if (tail.length === 0) {
    const { [head]: _removed, ...rest } = record;
    return rest;
  }
  return { ...record, [head]: withoutFieldAtSegments(record[head], tail) };
}

function replaceFieldAtSegments(
  value: unknown,
  segments: readonly string[],
  next: unknown
): unknown {
  if (segments.length === 0) return next;
  const [head, ...tail] = segments;
  const record = value as Record<string, unknown> | null | undefined;
  return {
    ...record,
    [head]: replaceFieldAtSegments(record?.[head], tail, next),
  };
}

/**
 * Orders a frame's restores so each one, when it commits, finds its recorded
 * neighbours: the replay order of `orderInsertions` (later removals first;
 * rows removed together as one block; creations in creation order). Restores
 * commit in sequence and each resolves its anchors against the rows live at
 * that moment, so the order decides the placement. Capture order cannot be
 * used: the notifier delivers a row's removal in the slot of that row's
 * EARLIER write. 64313c7f replaced d2cbd16f's chain-head choice with "the
 * first unplaced restore", which put `removeOne(e); clear()` back as
 * [e, a, b, c, d]. An anchor that is neither live nor restored by the frame is
 * left to the commit-time resolution, as before.
 */
/**
 * The one-effect-at-a-time fallback (no heterogeneous frame: a field write
 * to a row of a collection the reversal does not otherwise touch, with no
 * scalar slot runtime) applied restores in capture order, each placed by its
 * anchors against the rows already in: `clear()` with a rename and another
 * collection's edit in the same turn undid [a, b, c, d] as [b, c, d, a].
 * A collection's restores now go in placement order (`orderInsertions`), as
 * the frames commit them, at the first restore's slot: every field reversal
 * still follows its row's re-add. Left in capture order where a restore
 * waits for a removal of the same collection (a vacated key, or a move).
 */
function inPlacementOrder(
  effects: readonly ReversalEffect[],
  descriptors: ReadonlyMap<PositionId, TreeRealizationDescriptor>
): readonly ReversalEffect[] {
  type Restore = ReversalEffect & { structural: 'add'; subjectId: number };
  const restoresByOwner = new Map<PositionId, Restore[]>();
  for (const effect of effects) {
    if (effect.structural !== 'add' || typeof effect.subjectId !== 'number') {
      continue;
    }
    const list = restoresByOwner.get(effect.owner);
    if (list) list.push(effect as Restore);
    else restoresByOwner.set(effect.owner, [effect as Restore]);
  }
  const reordered = new Map<PositionId, Restore[]>();
  for (const [owner, restores] of restoresByOwner) {
    if (restores.length < 2) continue;
    const waits = effects.some(
      (effect) =>
        effect.owner === owner &&
        effect.structural === 'remove' &&
        restores.some(
          (restore) =>
            restore.subjectId === effect.subjectId ||
            restore.after === effect.before
        )
    );
    if (!waits) {
      reordered.set(
        owner,
        orderRestoresForPlacement(restores, (effect) =>
          getStructuralAddEffect(descriptors.get(effect.owner), effect)
        )
      );
    }
  }
  if (reordered.size === 0) return effects;
  const result: ReversalEffect[] = [];
  for (const effect of effects) {
    const block = reordered.get(effect.owner);
    if (!block || effect.structural !== 'add') {
      result.push(effect);
      continue;
    }
    if (block.length > 0) {
      result.push(...block);
      block.length = 0;
    }
  }
  return result;
}

function orderRestoresForPlacement<
  T extends ReversalEffect & { subjectId: number }
>(
  restores: readonly T[],
  anchorsOf: (
    effect: T
  ) => { beforeSubject?: number; afterSubject?: number } | undefined
): T[] {
  if (restores.length < 2) return [...restores];
  const ordered: T[] = [];
  const byOwner = new Map<PositionId, T[]>();
  for (const effect of restores) {
    const list = byOwner.get(effect.owner);
    if (list) list.push(effect);
    else byOwner.set(effect.owner, [effect]);
  }
  for (const effects of byOwner.values()) {
    orderInsertions(
      effects.map((effect) => ({
        item: effect,
        subject: effect.subjectId,
        anchors: anchorsOf(effect),
        creation: effect.structuralContext?.kind === 'add',
      })),
      // Only the order is used here; placement resolves at commit time.
      () => true,
      (input) => {
        ordered.push(input.item);
      }
    );
  }
  return ordered;
}

function getStructuralAddEffect(
  descriptor: TreeRealizationDescriptor | undefined,
  effect: ReversalEffect
): Extract<StructuralEffect, { kind: 'add' | 'remove' }> | undefined {
  if (effect.structural !== 'add' || typeof effect.subjectId !== 'number') {
    return undefined;
  }

  if (isStructuralEffect(effect.structuralContext)) {
    return effect.structuralContext.kind === 'remove' ||
      effect.structuralContext.kind === 'add'
      ? effect.structuralContext
      : undefined;
  }

  const removeEffect = descriptor?.structuralEffects?.get(
    `remove:${String(effect.subjectId)}:${String(effect.after)}`
  );
  if (removeEffect?.kind === 'remove') {
    return removeEffect;
  }

  const subjectEffect = descriptor?.structuralEffectBySubject?.get(
    String(effect.subjectId)
  );
  if (subjectEffect?.kind === 'remove' || subjectEffect?.kind === 'add') {
    return subjectEffect;
  }

  const addEffect = descriptor?.structuralEffects?.get(
    `add:${String(effect.subjectId)}:${String(effect.after)}`
  );
  return addEffect?.kind === 'add' ? addEffect : undefined;
}

/**
 * ADDRESS-REPAIR-1 — the explicit subject address.
 *
 * ```text
 * undefined            this effect establishes NO subject address
 * { kind: 'whole' }    it targets the entire current subject
 * { kind: 'field' }    it targets a coordinate within the current subject
 * ```
 *
 * ⚠️ Absence is a SEPARATE VALUE, not a falsy string. The previous encoding was
 * `undefined | '' | string`, and DESCRIPTOR-ROLE-0 measured two consumers
 * disagreeing about `''` — one read it as "no path", the other as "the whole
 * subject". Those are different answers to the same question, and the collision
 * is what let an owner-only ping claim a whole-subject address.
 *
 * ⚠️ `whole` exists at THIS layer only. REAL-WHOLE-EFFECT-0 captured every
 * `ReversalEffect` reaching realization and found none that needs it — every
 * whole-entity operation decomposes into per-field effects. So `whole` is
 * produced by row-level NOTIFICATION capture and must not be carried into
 * `ReversalEffect` itself.
 */
type SubjectAddress =
  | { readonly kind: 'whole' }
  | { readonly kind: 'field'; readonly path: string };

const WHOLE_SUBJECT: SubjectAddress = { kind: 'whole' };

/**
 * The single canonical derivation, replacing `deriveCollectionPath` and
 * `deriveFieldPathFromRow` as independent guesses.
 *
 * `canonicalCollectionPath` comes from `PositionRegistry.collectionPathFor()` —
 * the owner position's REGISTERED address — so the collection is never inferred
 * from a string. Given it, the subject coordinate is pure segment arithmetic:
 *
 * ```text
 * path === collection            owner-only notification   -> NO address
 * collection + 1 segment         the row itself            -> whole
 * collection + 2+ segments       a field within the row    -> field(rest)
 * ```
 *
 * ⚠️ The first line is the fix for the owner ping. The old code returned `''`
 * on `path === ownerPath` BEFORE it ever examined `subjectId`, so a value-less
 * collection notification carrying no subject still manufactured the strongest
 * address in the model. Here that case simply has no address to give.
 *
 * ⚠️ The entity-key segment is CONSUMED as event addressing and never becomes a
 * durable coordinate. That is the nested defect that produced `FIELD="seed"` —
 * the key returned as a field name — and it is now impossible rather than
 * avoided, because the key's position in the path is known rather than guessed.
 */
function deriveSubjectAddress(
  path: string,
  subjectId: number | undefined,
  structuralEffect: StructuralEffect | undefined,
  canonicalCollectionPath: string
): SubjectAddress | undefined {
  // Structural effects address existence and membership, never scalar state.
  // `structuralContext` carries add / remove / rekey.
  if (structuralEffect) {
    return undefined;
  }

  if (path === canonicalCollectionPath) {
    return undefined;
  }

  const prefix = `${canonicalCollectionPath}.`;
  if (!path.startsWith(prefix)) {
    return undefined;
  }

  const relative = path.slice(prefix.length);
  const firstDot = relative.indexOf('.');

  // `collection.<key>` — the row itself.
  if (firstDot === -1) {
    return typeof subjectId === 'number' ? WHOLE_SUBJECT : undefined;
  }

  // `collection.<key>.<rest>` — a coordinate inside the row.
  const fieldPath = relative.slice(firstDot + 1);
  return fieldPath === '' ? undefined : { kind: 'field', path: fieldPath };
}

/**
 * The storage encoding, isolated to one place.
 *
 * `TreeRealizationDescriptor` and the inline resolution chain still speak
 * `string | undefined` with `''` meaning whole. That wire format is unchanged by
 * ADDRESS-REPAIR-1 — only the DERIVATION is corrected — so the ambiguity is now
 * confined to storage rather than being the semantics.
 *
 * ⚠️ It is a real remaining wart. `''` is still falsy at
 * `canResolvePreparedSubjectTarget` and whole-subject at
 * `assignPreparedSubjectValue`. Migrating the stored shape is deliberately NOT
 * part of a correctness fix; it is safe now only because the derivation above no
 * longer produces `''` for anything that means "no address".
 */
function encodeSubjectAddress(
  address: SubjectAddress | undefined
): string | undefined {
  if (!address) return undefined;
  return address.kind === 'whole' ? '' : address.path;
}

/**
 * ⚠️ LEGACY FALLBACK — used only when the owner position has NO registered
 * canonical collection.
 *
 * That happens for synthetic descriptors built directly by the adapter tests,
 * whose `ownerPath` names a ROW (`data.users.u1`) rather than a collection.
 * REALIZATION-TARGET-ROLE-1 measured that both shapes are legitimate for the
 * same owner position and that no string test separates them — which is exactly
 * why the registry answers instead. Those cases never materialized an entityMap,
 * so they have nothing registered and keep their existing interpretation by
 * construction rather than by a special case.
 */
function deriveCollectionPathLegacy(
  path: string,
  ownerPath: string,
  subjectId: number | undefined,
  structuralEffect: StructuralEffect | undefined
): string | undefined {
  if (structuralEffect) return ownerPath;
  if (path === ownerPath) {
    return ownerPath.includes('.') ? parentPath(ownerPath) : undefined;
  }
  if (!path.startsWith(`${ownerPath}.`)) return undefined;
  if (!ownerPath.includes('.')) return ownerPath;
  if (typeof subjectId !== 'number') return undefined;
  return parentPath(ownerPath);
}

function deriveFieldPathFromRowLegacy(
  path: string,
  ownerPath: string,
  subjectId: number | undefined,
  structuralEffect: StructuralEffect | undefined
): string | undefined {
  if (structuralEffect) {
    return undefined;
  }

  if (path === ownerPath) {
    return '';
  }

  if (typeof subjectId !== 'number' || !path.startsWith(`${ownerPath}.`)) {
    return undefined;
  }

  const relativePath = path.slice(ownerPath.length + 1);
  if (!ownerPath.includes('.')) {
    const firstDot = relativePath.indexOf('.');
    return firstDot === -1 ? '' : relativePath.slice(firstDot + 1);
  }

  return relativePath;
}

/**
 * The one entry point. Registry first; legacy only when the owner is not a
 * registered collection.
 */
function deriveRealizationAddress(
  path: string,
  ownerPath: string,
  subjectId: number | undefined,
  structuralEffect: StructuralEffect | undefined,
  canonicalCollectionPath: string | undefined
): {
  collectionPath: string | undefined;
  fieldPathFromRow: string | undefined;
} {
  if (canonicalCollectionPath !== undefined) {
    return {
      collectionPath: canonicalCollectionPath,
      fieldPathFromRow: encodeSubjectAddress(
        deriveSubjectAddress(
          path,
          subjectId,
          structuralEffect,
          canonicalCollectionPath
        )
      ),
    };
  }

  return {
    collectionPath: deriveCollectionPathLegacy(
      path,
      ownerPath,
      subjectId,
      structuralEffect
    ),
    fieldPathFromRow: deriveFieldPathFromRowLegacy(
      path,
      ownerPath,
      subjectId,
      structuralEffect
    ),
  };
}

function parentPath(path: string): string {
  const lastDot = path.lastIndexOf('.');
  return lastDot === -1 ? '' : path.slice(0, lastDot);
}

/**
 * Drop every realization record belonging to subjects that can no longer be
 * restored.
 *
 * ## Why these are subject-lifetime state, not history state
 *
 * `structuralEffects`, `structuralEffectBySubject` and
 * `subjectDescriptors` are read on exactly one path — reversal planning — and
 * every read is keyed by subject id:
 *
 *   structuralEffects     `${kind}:${subject}:${key}`, read by
 *                                `resolveStructuralEffect`
 *   structuralEffectBySubject   `String(subject)`, same reader
 *   subjectDescriptors           `String(subject)`, read for `collectionPath`
 *                                and `fieldPathFromRow`
 *
 * So an entry is needed for exactly as long as its subject is restorable, which
 * is exactly as long as something claims it. Nothing pruned them: they were
 * bounded by neither `maxHistorySize` nor reclamation, and grew four entries per
 * retired subject — 256,600 at 64,000 retirements — which was the whole
 * remaining slope after the entity layer plateaued. See
 * docs/architecture/retired-subject-churn.md, "STEP 8 PHASE 6D".
 *
 * ## Why a scan rather than a subject index
 *
 * The effect keys are prefixed by subject, so a `subject -> keys` index would
 * make this O(1) per subject. It would also be a second structure that can
 * drift out of step with the first, for a pass over a map that pruning itself
 * keeps bounded at a few entries per live row plus one window. The scan is the
 * cheaper thing to be sure about.
 *
 * The CALLER must have established that these subjects are unclaimed. This
 * function does not re-check — it is the destructive half of a decision made
 * against the claim registry.
 */
export function forgetSubjectsInTreeRealizationDescriptors(
  descriptors: Map<PositionId, TreeRealizationDescriptor>,
  subjectIds: readonly number[]
): void {
  if (subjectIds.length === 0 || descriptors.size === 0) {
    return;
  }
  const forgotten = new Set(subjectIds.map((id) => String(id)));

  for (const descriptor of descriptors.values()) {
    const bySubject = descriptor.structuralEffectBySubject;
    if (bySubject instanceof Map) {
      for (const key of forgotten) {
        bySubject.delete(key);
      }
    }

    const subjectDescriptors = descriptor.subjectDescriptors;
    if (subjectDescriptors instanceof Map) {
      for (const key of forgotten) {
        subjectDescriptors.delete(key);
      }
    }

    const effects = descriptor.structuralEffects;
    if (effects instanceof Map) {
      for (const key of [...effects.keys()]) {
        // `${kind}:${subject}:...` — the subject is always the second segment.
        const firstColon = key.indexOf(':');
        if (firstColon === -1) {
          continue;
        }
        const secondColon = key.indexOf(':', firstColon + 1);
        const subject = key.slice(
          firstColon + 1,
          secondColon === -1 ? undefined : secondColon
        );
        if (forgotten.has(subject)) {
          effects.delete(key);
        }
      }
    }
  }
}

function toStructuralEffectKey(effect: StructuralEffect): string {
  switch (effect.kind) {
    case 'add':
    case 'remove':
      return `${effect.kind}:${String(effect.subject)}:${String(effect.key)}`;
    case 'rekey':
      return `rekey:${String(effect.subject)}:${String(
        effect.beforeKey
      )}:${String(effect.afterKey)}`;
  }
}

function isWritableLeaf(value: unknown): value is WritableLeaf {
  return Boolean(
    value &&
      typeof value === 'function' &&
      'set' in (value as object) &&
      typeof (value as { set?: unknown }).set === 'function'
  );
}

function isWritableEntityNode(value: unknown): value is WritableEntityNode {
  return Boolean(
    value && typeof value === 'function' && !('set' in (value as object))
  );
}

function isStructuralEffect(value: unknown): value is StructuralEffect {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'kind' in (value as object) &&
      ((value as StructuralEffect).kind === 'add' ||
        (value as StructuralEffect).kind === 'remove' ||
        (value as StructuralEffect).kind === 'rekey')
  );
}

function isCollectionNode(value: unknown): value is CollectionNode {
  return Boolean(
    value &&
      'byIdOrFail' in (value as object) &&
      'changeId' in (value as object) &&
      'removeOne' in (value as object)
  );
}

function hasCollectionKey(node: CollectionNode, key: string | number): boolean {
  try {
    node.byIdOrFail(key);
    return true;
  } catch {
    return false;
  }
}
