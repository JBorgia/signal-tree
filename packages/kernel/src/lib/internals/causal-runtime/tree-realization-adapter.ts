import { getEntityPreparationReader } from '../entity-preparation-reader';
import {withScalarSelections} from '../native-scalar-selection';
import { PublicationPreparation } from '../publication-preparation';
import { completeScalarFrame } from '../tree-scalar-slot-runtime';
import type { EntityStructureOperation, PreparedEntityStructure } from '../prepared-entity-structure';
import {scalarFrameMetadata} from '../scalar-publication-coverage';
import { orderRestoresForPlacement } from '../../physical/order-restores-for-placement';
import {openSelected,consumeSelected,closeSelected,type SelectedPreparation,type SelectedRowIntent,type SelectedOutcome} from '../selected-write-operation';
import { replaceSelectedLocation } from '../location-runtime';
import {fieldEndpoints} from '../native-field-selection';
import {getEntityPublicationBinding} from '../entity-publication';
import { withEntityPointPublicationPreparation } from '../entity-publication';
import { withSelectedEntityDisposition } from '../selected-entity-disposition';
import {
  prepareOrdinaryRealization,
  ordinaryRealization,
  realizationPlacement,
} from './ordinary-realization';
import type { EntityRealizationEdit } from '../entity-value-transition';
import type { CommittedEntityMutation } from '../mutation-capture-runtime';
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
import { applyInInvalidationGroup } from './post-application-failure';
import { holdEntityMembershipDelivery } from '../entity-membership-source';
import { normalizeScopedValuePath } from './scoped-value-addressing';

type StructuralDriftRefusal = Extract<
  ReversalRefusal,
  { readonly kind: 'structural-drift' }
>;

const TREE_REALIZATION_DESCRIPTORS = Symbol.for(
  'SignalTree:TreeRealizationDescriptors'
);
const TREE_REALIZATION_PORT = Symbol.for('SignalTree:TreeRealizationPort');

type CollectionNode = {
  __validateOrdinaryStructure?(effects: readonly ReversalEffect[]): boolean;
  __prepareOrdinaryRealization?(
    effects: readonly ReversalEffect[],
    physicalAfter?: ReadonlyMap<number, unknown>,
    physicalEffects?: readonly ReversalEffect[], _placement?:never,_order?:never,publicationPhase?:PublicationPreparation
  ): { install(): void; complete():void; changes: readonly CommittedEntityMutation[] };
  __preparePointValues?(
    values: readonly {
      subjectId: number;
      key: string | number;
      value: unknown;
      edits: readonly EntityRealizationEdit[];
    }[], _selected?:never, publicationPhase?:PublicationPreparation
  ): {
    complete():void;
    install(): void;
    invalidate(): void;
    publish(): void;
  };
  byIdOrFail(id: string | number): unknown;
  changeId(from: string | number, to: string | number): void;
  removeOne(id: string | number): void;
  __planFreshAdd?(
    key: string | number,
    entity: unknown,
    subjectId: number
  ): {
    commit(options?: { advancePhysicalRevision?: boolean; publication?: 'physical' }): void;
    publish(metaOverride?: WriteMetadata): void;
  };
  __planRemove?(
    key: string | number,
    subjectId: number
  ): {
    commit(options?: { advancePhysicalRevision?: boolean; publication?: 'physical' }): void;
    publish(metaOverride?: WriteMetadata): void;
  };
  __prepareStructuralUnit?(operations: readonly EntityStructureOperation[], publicationPhase?:PublicationPreparation): PreparedEntityStructure;
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
    commit(options?: { advancePhysicalRevision?: boolean; publication?: 'physical' }): void;
    publish(metaOverride?: WriteMetadata): void;
  };
  __planRekey?(
    from: string | number,
    to: string | number,
    vacatingKeys?: ReadonlySet<string | number>
  ): {
    readonly recipe:EntityStructureOperation;
    commit(options?: { advancePhysicalRevision?: boolean; publication?: 'physical' }): void;
    publish(metaOverride?: WriteMetadata): void;
  };
  __planPreparedRekey?(
    from: string | number,
    to: string | number,
    subjectId: number,
    entity: unknown,
    placement?: { beforeSubject?: number; afterSubject?: number }
  ): {
    readonly recipe:EntityStructureOperation;
    commit(options?: { advancePhysicalRevision?: boolean; publication?: 'physical' }): void;
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

type StructuralOwnerIndex = ReadonlyMap<PositionId, string> & {
  readonly nodes: ReadonlyMap<PositionId, CollectionNode>;
};

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
  /** Uses this adapter's retained source identities, including hidden collections.
   * Lifetime validation and public visibility remain the installer's responsibility.
   */
  prepareSelectedUnit?(
    effects: readonly ReversalEffect[]
  ): { install(): void; publish(options?:{deferCompletion?:boolean}): void; complete():void };
  prepareOrdinaryEffects?(
    effects: readonly ReversalEffect[]
  ): readonly ReversalEffect[];
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
  const structuralOwnerPaths = indexStructuralOwnerPaths(options.tree.$);
  // The exact returned array is an invocation-local admitted operation, not a
  // reusable current-key rewrite. Legacy unlowered callers retain validation.
  const admissions = new WeakMap<readonly ReversalEffect[], {
    valid: boolean; revision: number | undefined; consumed: boolean;
  }>();
  const admissionCurrent = (effects: readonly ReversalEffect[]): boolean => {
    const admission = admissions.get(effects);
    return !admission || (admission.valid && !admission.consumed &&
      admission.revision === physicalCommitClock?.revision());
  };

  return {
    prepareSelectedUnit(effects) {
      return prepareSelectedOperation(options.tree, effects, structuralOwnerPaths);
    },
    prepareOrdinaryEffects(effects) {
      const revision = physicalCommitClock?.revision();
      const groups = new Map<PositionId, ReversalEffect[]>();
      for (const effect of effects) {
        if (!effect.structural || typeof effect.subjectId !== 'number') continue;
        let group = groups.get(effect.owner);
        if (!group) groups.set(effect.owner, group = []);
        group.push(effect);
      }
      let valid = true;
      // Retain the authentic recipe resolved at admission. Physical lowering
      // must not erase an ordinary contribution or defer descriptor lookup.
      const resolved = new Map<ReversalEffect, ReversalEffect>();
      for (const [owner, group] of groups) {
        const node = resolveCollectionNode(options.tree, options.descriptors.get(owner), structuralOwnerPaths, group[0]);
        if (!node?.__validateOrdinaryStructure ||
          !node.__prepareOrdinaryRealization ||
          !node.__validateOrdinaryStructure(group)) {
          valid = false;
          break;
        }
        for (const effect of group) {
          if (effect.structural === 'rekey') continue;
          const context = effect.structural === 'add'
            ? getStructuralAddEffect(options.descriptors.get(owner), effect)
            : effect.structuralContext;
          // The existing ordinary installer requires an existence recipe.
          // Without it, refuse the entire paired operation before lowering.
          // Legacy unlowered physical routes retain subject-based removal.
          if (!context || context.kind === 'rekey' ||
            context.subject !== effect.subjectId ||
            !Object.prototype.hasOwnProperty.call(context, 'value') ||
            (effect.structural === 'add' && !node.__restoreOne)) {
            valid = false;
            break;
          }
          resolved.set(effect, context === effect.structuralContext ? effect :
            Object.freeze({ ...effect, structuralContext: context }));
        }
        if (!valid) break;
      }
      const byOwner = new Map(effects.map(effect => [effect.owner, effect]));
      // Failed semantic admission is returned for the existing typed refusal
      // path; it must not be lowered or partially installed.
      const ordinary = effects.map(effect => resolved.get(effect) ?? effect);
      const physical = valid ? prepareOrdinaryRealization(ordinary, (owner, subject) => {
        const effect = byOwner.get(owner);
        return effect ? resolveCollectionNode(options.tree, options.descriptors.get(owner), structuralOwnerPaths, effect)?.__findKeyBySubjectId?.(subject) : undefined;
      }).physical : Object.freeze([...effects]);
      admissions.set(physical, { valid: valid && revision === physicalCommitClock?.revision(), revision, consumed: false });
      return physical;
    },
    validateEffects(effects) {
      if (!admissionCurrent(effects)) return { kind: 'structural-drift' };
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
      const admission = admissions.get(effects);
      if (admission) {
        if (!admissionCurrent(effects) || !buildPreparedRealizationContext(
          options.tree, options.descriptors, structuralOwnerPaths, scalarSlotRuntime, effects
        )) throw new Error('Ordinary structural admission refused at structural-drift');
        admission.consumed = true;
      }
      const memberTargets = new Map<
        number,
        { present: boolean; value: unknown; turn?: number }
      >();
      const authoredValueEffects: ReversalEffect[] = [];
      for (const effect of effects) {
        if (effect.plainBranchMembership) {
          // Last-write order, as `deriveDeclarativeTransitionTarget` keeps it:
          // a jump concatenates every turn it crosses into one application.
          memberTargets.delete(effect.owner);
          memberTargets.set(effect.owner, {
            present: effect.plainBranchMembership.after,
            value: effect.after,
            ...(effect.turn === undefined ? {} : { turn: effect.turn }),
          });
        } else {
          authoredValueEffects.push(effect);
        }
      }
      const publicationPhase = new PublicationPreparation();
      const members = memberTargets.size
        ? preparePlainBranchMembers(options.tree.$, memberTargets, authoredValueEffects.filter(effect=>
            !effect.structural && effect.subjectId===undefined && effect.subjectFieldSegments===undefined &&
            !hasInlineScopedAddress(effect) && !hasInlineSubjectAddress(effect) &&
            scalarSlotRuntime?.resolveScalarSlot(effect.owner)!==undefined).map(effect=>({owner:effect.owner,after:effect.after,turn:effect.turn})), publicationPhase, 'realized')
        : undefined;
      // A scalar value an earlier turn left is superseded where a later
      // turn's member write staged its location (`withoutSupersededScalars`).
      const staged = members?.staged;
      const remainingValueEffects = members ? authoredValueEffects.filter(effect=>
        effect.structural || effect.subjectId!==undefined || effect.subjectFieldSegments!==undefined ||
        hasInlineScopedAddress(effect) || hasInlineSubjectAddress(effect) ||
        scalarSlotRuntime?.resolveScalarSlot(effect.owner)===undefined) : authoredValueEffects;
      const valueEffects = staged?.size
        ? remainingValueEffects.filter(
            (effect) =>
              effect.turn === undefined ||
              effect.structural !== undefined ||
              typeof effect.subjectId === 'number' ||
              (staged.get(effect.owner) ?? effect.turn) <= effect.turn
          )
        : remainingValueEffects;
      const detachedCompletions:Array<()=>void>=[];
      const apply = () => {
        // Prepare the remaining frame before any member is installed. All member
        // values and presence are installed before any effect is published.
        const heterogeneousFrame = valueEffects.length || ordinaryRealization(effects)?.ordinary.some(effect => !!effect.structural)
          ? planHeterogeneousFrame(
              options.tree,
              options.descriptors,
              structuralOwnerPaths,
              scalarSlotRuntime,
              physicalCommitClock,
              valueEffects,
              ordinaryRealization(effects)?.ordinary,
              publicationPhase
            )
          : undefined;
        let scalarFrame =
          !heterogeneousFrame && valueEffects.length
            ? planScalarFrame(
                options.tree,
                options.descriptors,
                structuralOwnerPaths,
                scalarSlotRuntime,
                valueEffects,
                publicationPhase
              )
            : undefined;
        // ⚠️ SLOT SCALARS NEVER TAKE THE AUTHORED WRITE. A mixed reversal whose
        // collection cannot be planned yet (it lies under a member this
        // reversal re-adds) applies effect by effect. An authored scalar write
        // under a member the reversal hides re-adds that member's path
        // (`reactivatePathOnWrite`): a jump back over a path re-add, a
        // `setAll` and an omission came back with the member present and one
        // child (v16 8g, generated jump-vs-undo histories). Membership is the
        // membership targets' to decide; the slot frame writes values only.
        let perEffect: readonly ReversalEffect[] =
          heterogeneousFrame || scalarFrame ? [] : valueEffects;
        if (perEffect.length) {
          const slotScalars = valueEffects.filter(
            (effect) =>
              effect.structural === undefined &&
              effect.subjectId === undefined &&
              effect.subjectFieldSegments === undefined &&
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
                slotScalars,
                publicationPhase
              )
            : undefined;
          if (scalarFrame) {
            const framed = new Set(slotScalars);
            perEffect = valueEffects.filter((effect) => !framed.has(effect));
          }
        }
        publicationPhase.seal();
        publicationPhase.validate();
        if (admission && admission.revision !== physicalCommitClock?.revision())
          throw new Error('Ordinary structural admission revision is stale');
        members?.install();
        if(members)detachedCompletions.push(()=>members.complete());
        // A membership-only frame has no value frame to advance the shared
        // physical clock. Publish its installed presence under a new revision.
        if (members && valueEffects.length === 0)
          physicalCommitClock?.advance();
        if (heterogeneousFrame) {
          heterogeneousFrame.commit(detachedCompletions);
        } else {
          scalarFrame?.commit(detachedCompletions);
          for (const effect of perEffect) {
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
      let failed=false,first:unknown;
      try { applyInInvalidationGroup(options.tree.$, apply,()=>{
        let failed=false,first:unknown;
        for(const complete of detachedCompletions)try{complete();}catch(error){if(!failed){failed=true;first=error;}}
        if(failed)throw first;
      }); }
      catch(error){failed=true;first=error;}
      try{releaseMembership();}catch(error){if(!failed){failed=true;first=error;}}
      if(failed)throw first;
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

/**
 * Point-only realization for scalar slots and existing entity lifetimes.
 * The caller retains admission and the encompassing invalidation group.
 * Undefined means the effects require the existing structural/member planner.
 */
/** Bounded source-owned preparation for selected top-level entity fields and scalar slots. */
/** Admission sees the complete compensation, before invoking any preparation. */
export function admitSelectedOperation<O extends {
 readonly effects:readonly ReversalEffect[];
 readonly orderDeltas:readonly unknown[];
 readonly frontiers:ReadonlyMap<number,unknown>;
 readonly structuralRequired:boolean;
}>(tree:ISignalTree<object>,operation:O):{operation:O;prepare:()=>{install():void;publish(options?:{deferCompletion?:boolean}):void;complete():void}} | undefined {
 const effects=operation.effects;
 // This bounded producer has no order, structural or frontier installer.
 // Return inapplicable for the entire description; the complete route owns it.
 if(operation.orderDeltas.length || operation.frontiers.size || operation.structuralRequired)return undefined;
 if(!effects.some(effect=>!!fieldEndpoints(effect)) || !effects.every(effect=>!effect.structural&&!effect.plainBranchMembership && (typeof effect.subjectId==='number'?effect.subjectFieldSegments?.length===1&&!!fieldEndpoints(effect):effect.subjectFieldSegments===undefined)))return undefined;
 const port = getTreeRealizationPort(tree.$) ?? getTreeRealizationPort(tree);
 const prepare = port?.prepareSelectedUnit;
 if (!prepare) return undefined;
 return {operation,prepare:()=>prepare.call(port, operation.effects)};
}
function prepareWithScalarSelections<T>(slots:NonNullable<ReturnType<typeof getTreeScalarSlotRuntime>>,effects:readonly ReversalEffect[],work:()=>T):T {
 const selections=new Map<object,import('../native-field-selection').NativeFieldEndpoint>();
 for(const effect of effects){if(effect.subjectId!==undefined)continue;const endpoint=fieldEndpoints(effect)?.after;const leaf=slots.resolveScalarLeaf(effect.owner);if(endpoint&&leaf)selections.set(leaf,endpoint);}
 return withScalarSelections(selections,work);
}
function prepareSelectedOperation(tree:ISignalTree<object>,effects:readonly ReversalEffect[],owners:StructuralOwnerIndex):{install():void;publish(options?:{deferCompletion?:boolean}):void;complete():void} {
 const descriptors=getTreeRealizationDescriptors(tree.$);
 const slots=getTreeScalarSlotRuntime(tree.$)??getTreeScalarSlotRuntime(tree);
 const clock=getPhysicalCommitClock(tree.$)??getPhysicalCommitClock(tree);
 if(!descriptors||!slots||!clock)throw new Error('Selected operation source unavailable');
 const revision=clock.revision();
 const edits:SelectedRowIntent[]=[];const deliveries:Array<()=>void>=[];const publicationPhase=new PublicationPreparation();
 const scalarEffects:ReversalEffect[]=[];const frame=slots.beginFrame();
 let active=true;
 const preparation:SelectedPreparation={stage(edit){if(!active)throw new Error('Selected preparation closed');edits.push(edit);},defer(delivery){if(!active)throw new Error('Selected preparation closed');deliveries.push(delivery);}};
 try {
   for(const effect of effects){
     if(typeof effect.subjectId!=='number'){
       const slot=slots.resolveScalarSlot(effect.owner);if(slot===undefined)throw new Error('Selected scalar slot unavailable');
       frame.set(slot,effect.after);scalarEffects.push(effect);continue;
     }
     const count=edits.length;applyEffect(tree,descriptors,owners,slots,effect,preparation);
     if(edits.length!==count+1)throw new Error('Selected continuation did not prepare exactly one operation');
   }
   const groups=new Map<object,SelectedRowIntent[]>();for(const edit of edits){let group=groups.get(edit.source);if(!group)groups.set(edit.source,group=[]);group.push(edit);}
   const plans=[...groups.values()].map(group=>group[0].prepare(group,publicationPhase));
   const prepareCommit=frame.prepareCommit;
   if(!prepareCommit)throw new Error('Selected scalar preparation unavailable');
   const installScalars=prepareWithScalarSelections(slots,scalarEffects,()=>prepareCommit.call(frame,{advanceRevision:false,publish:false,publicationPhase,admissionParticipation:'realized'}));
   publicationPhase.seal();
   if(clock.revision()!==revision)throw new Error('Selected operation preparation reentered installation');
   active=false;edits.length=0;groups.clear();let installed=false;let scalarResult:ReturnType<typeof installScalars>|undefined;
   return {
     install(){if(installed||clock.revision()!==revision)throw new Error('Selected operation revision changed');publicationPhase.validate();scalarResult=installScalars();for(const plan of plans)plan.install();clock.advance();installed=true;},
     complete(){let failed=false,first:unknown;for(const work of [()=>{if(scalarResult)completeScalarFrame(scalarResult);},...plans.map(plan=>()=>plan.complete())])try{work();}catch(error){if(!failed){failed=true;first=error;}}plans.length=0;if(failed)throw first;},
     publish(options){if(!installed||!scalarResult)throw new Error('Selected operation not installed');const installedScalars=scalarResult;let failed=false;let first:unknown;const run=(body:()=>void)=>{try{body();}catch(error){if(!failed){failed=true;first=error;}}};
       try{for(const plan of plans)run(()=>plan.invalidate());run(()=>slots.publishPrepared({...installedScalars,publication:undefined}));for(const plan of plans)run(()=>plan.publish());for(const delivery of deliveries)run(delivery);
         for(const effect of scalarEffects)run(()=>{const descriptor=descriptors.get(effect.owner);const path=resolveNotifyPath(tree,descriptor,owners,effect);if(path)getPathNotifier().notify(path,effect.after,effect.before,descriptor?.ownerPath??path,undefined,[effect.owner],scalarFrameMetadata(scalarResult,slots.resolveScalarSlot(effect.owner),{...getActiveWriteContext(),intent:'system',participation:'realized'}));});
       }finally{deliveries.length=0;scalarEffects.length=0;}
       if(!options?.deferCompletion)run(()=>this.complete());
       if(failed)throw first;
     }
   };
 } catch(error){active=false;edits.length=0;deliveries.length=0;try{frame.discard();}catch{/* prepareCommit already closed this temporary frame; retain the primary refusal. */}throw error;}
}

export function preparePointRealization(
  tree: ISignalTree<object>,
  effects: readonly ReversalEffect[]
): { install(): void; publish(options?:{deferCompletion?:boolean}): void; complete():void } | undefined {
  if (
    !effects.length ||
    !effects.some((effect) => typeof effect.subjectId === 'number')
  )
    return undefined;
  const descriptors = getTreeRealizationDescriptors(tree.$);
  const slots =
    getTreeScalarSlotRuntime(tree) ?? getTreeScalarSlotRuntime(tree.$);
  const clock = getPhysicalCommitClock(tree.$) ?? getPhysicalCommitClock(tree);
  if (!descriptors || !slots || !clock) return undefined;
  const baseRevision = clock.revision();
  const owners = effects.some(
    (effect) => effect.structural || effect.plainBranchMembership
  )
    ? indexStructuralOwnerPaths(tree.$)
    : indexPointOwnerPaths(tree.$, effects);
  const memberTargets = new Map<
    number,
    { present: boolean; value: unknown; turn?: number }
  >();
  for (const effect of effects)
    if (effect.plainBranchMembership) {
      memberTargets.delete(effect.owner);
      memberTargets.set(effect.owner, {
        present: effect.plainBranchMembership.after,
        value: effect.after,
        ...(effect.turn === undefined ? {} : { turn: effect.turn }),
      });
    }
  const publicationPhase = new PublicationPreparation();
  if (effects.some((effect) => effect.structural)) {
    const scalarEffects = effects.filter(
      (effect) =>
        !effect.plainBranchMembership &&
        !effect.structural &&
        typeof effect.subjectId !== 'number'
    );
    const members = memberTargets.size
      ? preparePlainBranchMembers(tree.$, memberTargets, scalarEffects, publicationPhase, 'realized')
      : undefined;
    const entityEffects = effects.filter(
      (effect) =>
        !effect.plainBranchMembership &&
        (!members || effect.structural || typeof effect.subjectId === 'number')
    );
    const heterogeneous = planHeterogeneousFrame(
      tree,
      descriptors,
      owners,
      slots,
      clock,
      entityEffects,
      ordinaryRealization(effects)?.ordinary,
      publicationPhase
    );
    if (!heterogeneous) return undefined;
    publicationPhase.seal();
    if (clock.revision() !== baseRevision)
      throw new Error('Point realization preparation reentered installation');
    let installed = false;
    return {
      complete(){let failed=false,first:unknown;for(const work of [()=>members?.complete(),()=>heterogeneous.complete()])try{work();}catch(error){if(!failed){failed=true;first=error;}}if(failed)throw first;},
      install(): void {
        if (installed || clock.revision() !== baseRevision)
          throw new Error('Point realization base revision is stale');
        publicationPhase.validate();
        members?.install();
        // Existing structural commits resolve anchors in their established order.
        // The surrounding invalidation group defers native delivery until all install.
        heterogeneous.install();
        installed = true;
      },
      publish(options): void {
        if (!installed)
          throw new Error('Point realization published before installation');
        let failed = false;
        let firstError: unknown;
        const run = (fn: () => void): void => {
          try {
            fn();
          } catch (error) {
            if (!failed) {
              failed = true;
              firstError = error;
            }
          }
        };
        run(() => heterogeneous.invalidate());
        if (members) run(() => members.invalidate());
        if (members) run(() => members.publish());
        run(() => heterogeneous.publish());
        if(!options?.deferCompletion)run(()=>this.complete());
        if (failed) throw firstError;
      },
    };
  }
  // The transaction producer supplies whole-row or top-level effects. Deeper
  // synthetic inputs retain the existing general adapter, without selecting an
  // ordinary missing-parent policy here. Decline before target preparation.
  const pointPaths = new Map<ReversalEffect, readonly string[]>();
  for (const effect of effects) {
    if (effect.plainBranchMembership || typeof effect.subjectId !== 'number')
      continue;
    const path = resolveSubjectFieldPath(
      descriptors.get(effect.owner),
      effect,
      getPositionRegistry(tree.$)
    );
    if (path === undefined || path.length > 1) return undefined;
    pointPaths.set(effect, path);
  }
  const rows = new Map<
    CollectionNode,
    Map<
      number,
      {
        subjectId: number;
        key: string | number;
        value: unknown;
        edits: EntityRealizationEdit[];
      }
    >
  >();
  const scalarEffects: ReversalEffect[] = [];
  const frame = slots.beginFrame();
  for (const effect of effects) {
    if (effect.plainBranchMembership) continue;
    if (typeof effect.subjectId !== 'number') {
      if (
        effect.subjectFieldSegments !== undefined ||
        hasInlineScopedAddress(effect) ||
        hasInlineSubjectAddress(effect)
      )
        return undefined;
      const slot = slots.resolveScalarSlot(effect.owner);
      if (slot === undefined) return undefined;
      frame.set(slot, effect.after);
      scalarEffects.push(effect);
      continue;
    }
    const descriptor = descriptors.get(effect.owner);
    const collection = resolveCollectionNode(tree, descriptor, owners, effect);
    if (!collection?.__preparePointValues) return undefined;
    const key = collection.__findKeyBySubjectId?.(effect.subjectId);
    if (key === undefined) return undefined;
    let bySubject = rows.get(collection);
    if (!bySubject) rows.set(collection, (bySubject = new Map()));
    let row = bySubject.get(effect.subjectId);
    if (!row) {
      row = {
        subjectId: effect.subjectId,
        key,
        value: deepClone(snapshotCollectionEntityValue(collection, key)),
        edits: [],
      };
      bySubject.set(effect.subjectId, row);
    }
    const path = pointPaths.get(effect);
    if (path === undefined) return undefined;
    // Read user-provided effect payload once. The physical target and ordered
    // ordinary edit must not alias each other or mutate the caller's payload.
    const after = deepClone(effect.after);
    const present = effect.fieldPresence?.after !== false;
    if (path.length === 0) row.edits.push({ kind: 'row', value: after });
    else
      row.edits.push({ kind: 'field', field: path[0], present, value: after, selection:fieldEndpoints(effect)?.after });
    if (path.length === 0) row.value = deepClone(after);
    else if (!present) row.value = withoutFieldAtSegments(row.value, path);
    else assignPreparedSubjectValue(row.value, path, deepClone(after));
  }
  const members = memberTargets.size
    ? preparePlainBranchMembers(tree.$, memberTargets, scalarEffects, publicationPhase, 'realized')
    : undefined;
  const collections = [...rows].map(([collection, subjects]) => {
    const prepare = collection.__preparePointValues;
    if (!prepare)
      throw new Error('Point realization preparation is unavailable');
    return prepare.call(collection, [...subjects.values()],undefined,publicationPhase);
  });
  if (!frame.prepareCommit) return undefined;
  const installScalars = members
    ? () => undefined
    : frame.prepareCommit({ advanceRevision: false, publish: false,publicationPhase,admissionParticipation:'realized' });
  publicationPhase.seal();
  if (clock.revision() !== baseRevision)
    throw new Error('Point realization preparation reentered installation');
  let result: ReturnType<typeof frame.commit> | undefined;
  let installed = false;
  return {
    complete(){let failed=false,first:unknown;for(const work of [()=>members?.complete(),()=>{if(result)completeScalarFrame(result);},...collections.map(plan=>()=>plan.complete())])try{work();}catch(error){if(!failed){failed=true;first=error;}}if(failed)throw first;},
    install(): void {
      if (installed || clock.revision() !== baseRevision)
        throw new Error('Point realization base revision is stale');
      publicationPhase.validate();
      if (members) members.install();
      else result = installScalars();
      for (const collection of collections) collection.install();
      clock.advance();
      installed = true;
    },
    publish(options): void {
      const installedScalars = result;
      if (!installed || (!members && !installedScalars))
        throw new Error('Point realization published before installation');
      // Complete all owned invalidation staging before any path or replay callback.
      let failed = false;
      let firstError: unknown;
      const run = (fn: () => void) => {
        try {
          fn();
        } catch (error) {
          if (!failed) {
            failed = true;
            firstError = error;
          }
        }
      };
      for (const collection of collections) run(() => collection.invalidate());
      if (members) run(() => members.invalidate());
      else if (installedScalars)
        run(() => slots.publishPrepared({...installedScalars,publication:undefined}));
      if (members) run(() => members.publish());
      for (const collection of collections) run(() => collection.publish());
      for (const effect of members ? [] : scalarEffects)
        run(() => {
          const descriptor = descriptors.get(effect.owner);
          const path = resolveNotifyPath(tree, descriptor, owners, effect);
          if (path)
            getPathNotifier().notify(
              path,
              effect.after,
              effect.before,
              descriptor?.ownerPath ?? path,
              undefined,
              [effect.owner],
              scalarFrameMetadata(installedScalars, slots.resolveScalarSlot(effect.owner), {
                ...(getActiveWriteContext() ?? {}),
                intent: 'system',
                participation: 'realized',
              })
            );
        });
      run(() => markOwnerInvalidatedFrom(tree as object));
      if(!options?.deferCompletion)run(()=>this.complete());
      if (failed) throw firstError;
    },
  };
}

function planHeterogeneousFrame(
  tree: ISignalTree<object>,
  descriptors: ReadonlyMap<PositionId, TreeRealizationDescriptor>,
  structuralOwnerPaths: StructuralOwnerIndex,
  scalarSlotRuntime: ReturnType<typeof getTreeScalarSlotRuntime>,
  physicalCommitClock: ReturnType<typeof getPhysicalCommitClock>,
  effects: readonly ReversalEffect[],
  ordinaryEffects?: readonly ReversalEffect[],
  outerPhase?: PublicationPreparation
):
  | { commit(detachedCompletions?:Array<()=>void>): void; validate(): void; install(): void; invalidate(): void; publish(): void; complete():void }
  | undefined {
  if (
    !(ordinaryEffects ?? effects).some(
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

  const publicationPhase=outerPhase ?? new PublicationPreparation();
  const basePhysicalRevision = physicalCommitClock?.revision();
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
  for (const [removeEffect, removedKey] of removeKeysByEffect) {
    let keys = vacatingKeysByOwner.get(removeEffect.owner);
    if (!keys) {
      keys = new Set<string | number>();
      vacatingKeysByOwner.set(removeEffect.owner, keys);
    }
    keys.add(removedKey);
  }

  // An existing entity lifetime is not a scalar slot merely because this
  // structural frame did not first revive it. Prepare its authored point edits
  // through the same lifetime-indexed port used by point-only realization.
  const liveSubjectEffects = new Set<ReversalEffect>();
  const liveRows = new Map<
    CollectionNode,
    Map<
      number,
      {
        subjectId: number;
        key: string | number;
        value: unknown;
        edits: EntityRealizationEdit[];
      }
    >
  >();
  for (const effect of scalarEffects) {
    if (
      typeof effect.subjectId !== 'number' ||
      isPreparedSubjectScalarEffect(effect, preparedContext)
    )
      continue;
    const collection = resolveCollectionNode(
      tree,
      descriptors.get(effect.owner),
      structuralOwnerPaths,
      effect
    );
    const key = collection?.__findKeyBySubjectId?.(effect.subjectId);
    const path = resolveSubjectFieldPath(
      descriptors.get(effect.owner),
      effect,
      getPositionRegistry(tree.$)
    );
    if (
      !collection?.__preparePointValues ||
      key === undefined ||
      path === undefined ||
      path.length > 1
    )
      return undefined;
    let subjects = liveRows.get(collection);
    if (!subjects) liveRows.set(collection, (subjects = new Map()));
    let row = subjects.get(effect.subjectId);
    if (!row) {
      row = {
        subjectId: effect.subjectId,
        key,
        value: deepClone(snapshotCollectionEntityValue(collection, key)),
        edits: [],
      };
      subjects.set(effect.subjectId, row);
    }
    const value = deepClone(effect.after);
    if (!path.length) {
      row.value = value;
      row.edits.push({ kind: 'row', value });
    } else {
      const present = effect.fieldPresence?.after !== false;
      row.edits.push({ kind: 'field', field: path[0], present, value, selection:fieldEndpoints(effect)?.after });
      if (present) assignPreparedSubjectValue(row.value, path, value);
      else row.value = withoutFieldAtSegments(row.value, path);
    }
    liveSubjectEffects.add(effect);
  }
  // One independently contained delivery per lifetime: a callback from one
  // row cannot starve a later row after the complete frame is installed.
  const livePointPlans = withEntityPointPublicationPreparation(()=>[...liveRows].flatMap(([collection, rows]) =>
    [...rows.values()].map(row=>{if(!collection.__preparePointValues)throw new Error('Point preparation unavailable');return collection.__preparePointValues([row],undefined,publicationPhase);})
  ));
  const preparedSubjectScalarEffects = scalarEffects.filter((effect) =>
    isPreparedSubjectScalarEffect(effect, preparedContext)
  );
  const framedScalarEffects = scalarEffects.filter(
    (effect) =>
      !liveSubjectEffects.has(effect) &&
      !isPreparedSubjectScalarEffect(effect, preparedContext)
  );
  const rekeyEffects = effects.filter(
    (effect): effect is ReversalEffect & { structural: 'rekey' } =>
      effect.structural === 'rekey'
  );
  const restoreEffects = effects.filter(
    (
      effect
    ): effect is ReversalEffect & { structural: 'add'; subjectId: number } =>
      effect.structural === 'add' && typeof effect.subjectId === 'number'
  );
  // Sequential simulation retains execution dependencies. Only installation
  // placement is ordered against the complete proposed topology.
  const placementEffects = orderPhysicalPlacements(
    tree,
    descriptors,
    structuralOwnerPaths,
    effects
  ).filter(
    (effect) =>
      effect.structural === 'add' || realizationPlacement(effect) !== undefined
  );
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
  const plannedRestores: Array<{
    effect: ReversalEffect & { structural: 'add'; subjectId: number };
    plan: {
      commit(options?: { advancePhysicalRevision?: boolean; publication?: 'physical' }): void;
      publish(metaOverride?: WriteMetadata): void;
    };
  }> = [];
  const plannedFreshAdds: Array<{
    effect: ReversalEffect & { structural: 'add'; subjectId: number };
    plan: {
      commit(options?: { advancePhysicalRevision?: boolean; publication?: 'physical' }): void;
      publish(metaOverride?: WriteMetadata): void;
    };
  }> = [];
  const plannedRekeys: Array<{
    effect: ReversalEffect & { structural: 'rekey' };
    plan: {
      readonly recipe:EntityStructureOperation;
      commit(options?: { advancePhysicalRevision?: boolean; publication?: 'physical' }): void;
      publish(metaOverride?: WriteMetadata): void;
    };
  }> = [];
  const plannedRemoves: Array<{
    effect: ReversalEffect & { structural: 'remove'; subjectId: number };
    plan: {
      commit(options?: { advancePhysicalRevision?: boolean; publication?: 'physical' }): void;
      publish(metaOverride?: WriteMetadata): void;
    };
  }> = [];

  type PhysicalPlan = {
    commit(options?: { advancePhysicalRevision?: boolean; publication?: 'physical' }): void;
    publish(metaOverride?: WriteMetadata): void;
  };
  const placementPlans = new Map<ReversalEffect, PhysicalPlan>();
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

      plannedFreshAdds.push({
        effect,
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

    plannedRestores.push({
      effect,
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
            preparedSubject.value,
            realizationPlacement(effect)?.structuralContext as
              | { beforeSubject?: number; afterSubject?: number }
              | undefined
          )
        : typeof collectionNode.__planRekey === 'function'
        ? collectionNode.__planRekey(
            effect.before as string | number,
            effect.after as string | number,
            vacatingKeysByOwner.get(effect.owner)
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

  for (const { effect, plan } of [...plannedFreshAdds, ...plannedRestores])
    placementPlans.set(effect, plan);
  for (const { effect, plan } of plannedRekeys)
    if (realizationPlacement(effect)) placementPlans.set(effect, plan);

  const ordinaryPlans = new Map<
    PositionId,
    { install(): void; complete():void; changes: readonly CommittedEntityMutation[] }
  >();
  if (ordinaryEffects) {
    const groups = new Map<PositionId, ReversalEffect[]>();
    for (const effect of ordinaryEffects) {
      if (typeof effect.subjectId !== 'number') continue;
      let group = groups.get(effect.owner);
      if (!group) groups.set(effect.owner, (group = []));
      group.push(effect);
    }
    for (const [owner, group] of groups) {
      const node = resolveCollectionNode(
        tree,
        descriptors.get(owner),
        structuralOwnerPaths,
        group[0]
      );
      if (!node?.__prepareOrdinaryRealization)
        throw new Error('Ordinary realization binding is unavailable');
      // Source-owned preparation receives the exact physical execution order;
      // ordinary authority remains the separately selected group.
      const physicalGroup = [
        ...removeEffects,
        ...placementEffects,
        ...plannedRekeys
          .filter(({ effect }) => !realizationPlacement(effect))
          .map(({ effect }) => effect),
      ].filter((effect) => effect.owner === owner);
      ordinaryPlans.set(
        owner,
        node.__prepareOrdinaryRealization(group, undefined, physicalGroup,undefined,undefined,publicationPhase)
      );
    }
  }
  // The prepared ordinary plan is stable for this unit. Index once rather than
  // scanning every lifetime's changes for each publication effect.
  const dispositionByOwner = new Map<PositionId, Map<number, CommittedEntityMutation[]>>();
  for (const [owner, plan] of ordinaryPlans) {
    const subjects = new Map<number, CommittedEntityMutation[]>();
    for (const change of plan.changes) {
      // Match the previous strict-equality filter even for malformed NaN IDs.
      if (change.subject !== change.subject) continue;
      const group = subjects.get(change.subject);
      if (group) group.push(change);
      else subjects.set(change.subject, [change]);
    }
    dispositionByOwner.set(owner, subjects);
  }
  const publicationMeta = (effect: ReversalEffect): WriteMetadata => {
    const meta: WriteMetadata = {
      ...(getActiveWriteContext() ?? {}),
      intent: 'system',
      participation: 'realized',
    };
    const plan = ordinaryPlans.get(effect.owner);
    if (!plan) return meta;
    const subjects = dispositionByOwner.get(effect.owner);
    if(!subjects)throw new Error('Prepared entity disposition missing');
    // Preserve the old per-call array identity; metadata consumers never share
    // a mutable grouping array, and same-lifetime edit order stays unchanged.
    return withSelectedEntityDisposition(meta,
      typeof effect.subjectId === 'number'
        ? subjects.get(effect.subjectId)?.slice() ?? []
        : []);

  };

  const installScalarFrame = scalarFrame?.prepareCommit?.({advanceRevision:false,publish:false,publicationPhase,admissionParticipation:'realized'});
  if (scalarFrame && !installScalarFrame) throw new Error('Scalar realization preparation unavailable');
  // One source frame sees this unit's complete ordered occupancy proposal.
  const structuralGroups = new Map<CollectionNode, EntityStructureOperation[]>();
  const physicalOrder = [...removeEffects, ...placementEffects, ...plannedRekeys.filter(({effect})=>!realizationPlacement(effect)).map(({effect})=>effect)];
  for(const effect of physicalOrder) {
    const node=resolveCollectionNode(tree,descriptors.get(effect.owner),structuralOwnerPaths,effect);
    if(!node?.__prepareStructuralUnit || typeof effect.subjectId!=='number')throw new Error('Structural source preparation unavailable');
    let group=structuralGroups.get(node);if(!group)structuralGroups.set(node,group=[]);
    if(effect.structural==='remove'){const key=removeKeysByEffect.get(effect as ReversalEffect & {structural:'remove';subjectId:number});if(key===undefined)throw new Error('Prepared removal key missing');group.push({kind:'remove',subject:effect.subjectId,key});}
    else {
      if(effect.structural==='rekey'){const recipe=plannedRekeys.find(entry=>entry.effect===effect)?.plan.recipe;if(!recipe)throw new Error('Prepared rekey recipe missing');group.push(recipe);}
      else {
        const subject=preparedContext.resolveSubject(effect,effect.subjectId);
        if(!subject)throw new Error('Prepared structural subject missing');
        const context=getStructuralAddEffect(descriptors.get(effect.owner),effect);
        if(!context)throw new Error('Prepared structural context missing');
        group.push({kind:node.__inspectSubjectResources?.(effect.subjectId)===undefined?'fresh':'restore',subject:effect.subjectId,key:effect.after as string|number,value:subject.value,beforeSubject:context.beforeSubject,afterSubject:context.afterSubject});
      }
    }
  }
  const structuralUnits=[...structuralGroups].map(([node,operations])=>{if(!node.__prepareStructuralUnit)throw new Error('Structural preparation unavailable');return node.__prepareStructuralUnit(operations,publicationPhase);});

  if(!outerPhase)publicationPhase.seal();
  if(physicalCommitClock&&physicalCommitClock.revision()!==basePhysicalRevision)throw new Error('Joint preparation reentered installation');
  let scalarCommitResult:
    | ReturnType<NonNullable<typeof scalarFrame>['commit']>
    | undefined;
  const install = (): void => {
    if (
      physicalCommitClock &&
      physicalCommitClock.revision() !== basePhysicalRevision
    ) {
      throw new Error('Heterogeneous realization base revision is stale.');
    }

    if(!outerPhase)publicationPhase.validate();
    scalarCommitResult = installScalarFrame?.();

    for (const unit of structuralUnits) unit.install();

    for (const plan of livePointPlans) plan.install();
    for (const plan of ordinaryPlans.values()) plan.install();
    physicalCommitClock?.advance();
  };
  const invalidate = (): void => {
    // All these lifetimes are already installed. A delivery failure cannot
    // abandon the remaining invalidations, including a mixed scalar frame.
    let failed = false;
    let firstError: unknown;
    const run = (fn: () => void): void => {
      try {
        fn();
      } catch (error) {
        if (!failed) {
          failed = true;
          firstError = error;
        }
      }
    };
    for (const unit of structuralUnits) run(() => unit.invalidate());
    for (const plan of livePointPlans) run(() => plan.invalidate());
    if (scalarCommitResult && scalarSlotRuntime) {
      const result=scalarCommitResult;
      run(() => scalarSlotRuntime.publishPrepared({...result,publication:undefined}));
    }
    if (failed) throw firstError;
  };
  const complete=():void=>{
    let failed=false,first:unknown;
    if(scalarCommitResult)try{completeScalarFrame(scalarCommitResult);}catch(error){failed=true;first=error;}
    for(const body of [...ordinaryPlans.values(),...livePointPlans,...structuralUnits])try{body.complete();}catch(error){if(!failed){failed=true;first=error;}}
    if(failed)throw first;
  };
  const publish = (): void => {
    let failed = false;
    let firstError: unknown;
    const run = (fn: () => void): void => {
      try {
        fn();
      } catch (error) {
        if (!failed) {
          failed = true;
          firstError = error;
        }
      }
    };

    for (const { plan, effect } of plannedRemoves) {
      run(() => plan.publish(publicationMeta(effect)));
    }

    for (const { plan, effect } of plannedRestores) {
      run(() => plan.publish(publicationMeta(effect)));
    }

    for (const { plan, effect } of plannedFreshAdds) {
      run(() => plan.publish(publicationMeta(effect)));
    }

    for (const { plan, effect } of plannedRekeys) {
      run(() => plan.publish(publicationMeta(effect)));
    }

    for (const plan of livePointPlans) run(() => plan.publish());
    for (const effect of [
      ...preparedSubjectScalarEffects,
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

      run(() =>
        getPathNotifier().notify(
          notifyPath,
          effect.after,
          effect.before,
          descriptor?.ownerPath ?? notifyPath,
          typeof effect.subjectId === 'number' ? [effect.subjectId] : undefined,
          [effect.owner],
          scalarFrameMetadata(scalarCommitResult, scalarSlotRuntime?.resolveScalarSlot(effect.owner), publicationMeta(effect))
        )
      );
    }

    run(() => markOwnerInvalidatedFrom(tree as object));
    if (failed) throw firstError;
  };
  return {
    validate:()=>publicationPhase.validate(),
    install,
    invalidate,
    publish,
    complete,
    commit(detachedCompletions?:Array<()=>void>): void {
      let installed=false;
      const commitAndPublish = () => {
        install();installed=true;
        if(detachedCompletions)detachedCompletions.push(complete);
        let failed = false;
        let firstError: unknown;
        try {
          invalidate();
        } catch (error) {
          failed = true;
          firstError = error;
        }
        try {
          publish();
        } catch (error) {
          if (!failed) {
            failed = true;
            firstError = error;
          }
        }
        if (failed) throw firstError;
      };
      const locations = getLocationRuntime(tree.$);
      let failed=false,first:unknown;
      try{
        if (locations) locations.runInvalidationGroup(commitAndPublish);
        else if (scalarSlotRuntime)scalarSlotRuntime.runInvalidationGroup(commitAndPublish);
        else commitAndPublish();
      }catch(error){failed=true;first=error;}
      if(installed&&!detachedCompletions)try{complete();}catch(error){if(!failed){failed=true;first=error;}}
      if(failed)throw first;
    },
  };
}

function planScalarFrame(
  tree: ISignalTree<object>,
  descriptors: ReadonlyMap<PositionId, TreeRealizationDescriptor>,
  structuralOwnerPaths: StructuralOwnerIndex,
  scalarSlotRuntime: ReturnType<typeof getTreeScalarSlotRuntime>,
  effects: readonly ReversalEffect[],
  outerPhase?: PublicationPreparation
): { commit(detachedCompletions?:Array<()=>void>): void } | undefined {
  void tree;
  void descriptors;
  void structuralOwnerPaths;
  if (
    effects.length === 0 ||
    effects.some(
      (effect) =>
        effect.structural ||
        effect.subjectFieldSegments !== undefined ||
        hasInlineScopedAddress(effect) ||
        hasInlineSubjectAddress(effect)
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

  const install = prepareWithScalarSelections(scalarSlotRuntime,effects,()=>frame.prepareCommit?.({publish:false,publicationPhase:outerPhase,admissionParticipation:'realized'}));
  if (!install) throw new Error('Scalar realization preparation unavailable');
  return {
    commit(detachedCompletions): void {
      const installedScalars = install();
      if(detachedCompletions)detachedCompletions.push(()=>completeScalarFrame(installedScalars));
      scalarSlotRuntime.publishPrepared({...installedScalars,...(detachedCompletions?{publication:undefined}:{})});

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
          scalarFrameMetadata(installedScalars, scalarSlotRuntime.resolveScalarSlot(effect.owner), {
            ...(getActiveWriteContext() ?? {}),
            intent: 'system',
            participation: 'realized',
          })
        );
      }
    },
  };
}

function canApplyEffect(
  tree: ISignalTree<object>,
  descriptors: ReadonlyMap<PositionId, TreeRealizationDescriptor>,
  structuralOwnerPaths: StructuralOwnerIndex,
  scalarSlotRuntime: ReturnType<typeof getTreeScalarSlotRuntime>,
  effect: ReversalEffect,
  preparedContext?: PreparedRealizationContext
): boolean {
  if (effect.plainBranchMembership)
    return canRealizePlainBranchMember(tree.$, effect.owner);
  const descriptor = descriptors.get(effect.owner);
  if (
    !descriptor &&
    !effect.structural &&
    effect.subjectFieldSegments === undefined &&
    !scalarSlotRuntime?.resolveScalarLeaf(effect.owner) &&
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
      effect,
      structuralOwnerPaths
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
        (!destinationOccupied ||
          (realizationPlacement(effect) !== undefined &&
            currentSubjectKey === effect.after))
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
  structuralOwnerPaths: StructuralOwnerIndex,
  scalarSlotRuntime: ReturnType<typeof getTreeScalarSlotRuntime>,
  effect: ReversalEffect,
  preparation?:SelectedPreparation
): void {
  const descriptor = descriptors.get(effect.owner);
  if (
    !descriptor &&
    !effect.structural &&
    effect.subjectFieldSegments === undefined &&
    !scalarSlotRuntime?.resolveScalarLeaf(effect.owner) &&
    !hasInlineSubjectAddress(effect) &&
    !hasInlineScopedAddress(effect)
  ) {
    throw new Error(
      `Missing live descriptor for owner ${String(effect.owner)}`
    );
  }

  const invoke = (target:object,value:unknown,body:()=>void):void => {
    const endpoint=fieldEndpoints(effect)?.after;
    if(!endpoint){body();return;}
    if(effect.subjectId===undefined){withScalarSelections(new Map([[target,endpoint]]),body);return;}
    const binding=getEntityPublicationBinding(target),path=effect.subjectFieldSegments;
    if(!binding||binding.subject!==effect.subjectId||path?.length!==1||binding.field!==undefined&&binding.field!==path[0])
      throw new Error('Inverse endpoint does not match resolved source field');
    const selection = Object.freeze({source:binding.source,subject:binding.subject,field:path[0],endpoint,preparation});
    if (binding.field !== undefined) replaceSelectedLocation(target as import('../cell-runtime').Location<unknown>, value, selection);
    else {
      if (!binding.replaceSelected) throw new Error('Selected row replacement has no private continuation');
      const outcome:SelectedOutcome={failed:false};
      const invocation=openSelected(value,selection,outcome);
      try{const request=consumeSelected(invocation);binding.replaceSelected(request.value,request.selection);}finally{closeSelected(invocation);outcome.error=undefined;}
    }
  };

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
        effect.subjectFieldSegments?.length
      ) {
        // The field was absent at the target endpoint: remove the key from the
        // row rather than writing undefined into it.
        const row = resolveCurrentSubjectTarget(
          tree,
          descriptor,
          effect.subjectId,
          { ...effect, subjectFieldSegments: [] },
          structuralOwnerPaths
        );
        if (isWritableEntityNode(row)) {
          const read = row as unknown as () => unknown;
          const value=withoutFieldAtSegments(read(), effect.subjectFieldSegments);
          invoke(row,value,()=>row(value));
          return;
        }
      }
      if (!effect.structural) {
        const target = resolveLiveScalarNode(
          tree,
          descriptor,
          scalarSlotRuntime,
          effect,
          structuralOwnerPaths
        );
        if (isWritableLeaf(target)) {
          invoke(target,effect.after,()=>target.set(effect.after));
          return;
        }

        if (isWritableEntityNode(target)) {
          invoke(target,effect.after,()=>target(effect.after));
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
  effect: ReversalEffect,
  structuralOwnerPaths: StructuralOwnerIndex
): unknown {
  if (typeof effect.subjectId === 'number') {
    return resolveCurrentSubjectTarget(
      tree,
      descriptor,
      effect.subjectId,
      effect,
      structuralOwnerPaths
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

  const fieldPathFromRow = resolveSubjectFieldPath(
    descriptor,
    effect,
    registry
  );
  if (!fieldPathFromRow) {
    return false;
  }

  const value = preparedSubject.value as Record<string, unknown>;
  return effect.fieldPresence?.after === true && fieldPathFromRow.length > 0
    ? isTraversableNode(
        resolveNodeAtSegments(value, fieldPathFromRow.slice(0, -1))
      )
    : resolveNodeAtSegments(value, fieldPathFromRow) !== undefined;
}

function resolveCollectionNode(
  tree: ISignalTree<object>,
  descriptor: TreeRealizationDescriptor | undefined,
  structuralOwnerPaths: StructuralOwnerIndex,
  effect: ReversalEffect
): CollectionNode | undefined {
  const owned = structuralOwnerPaths.nodes.get(effect.owner);
  if (owned) return owned;
  if (effect.subjectFieldSegments !== undefined) return undefined;
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
  structuralOwnerPaths: StructuralOwnerIndex,
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
  const reader = getEntityPreparationReader(collectionNode);
  if (reader !== undefined) return reader(key);
  const rowNode = collectionNode.byIdOrFail(key);
  return typeof rowNode === 'function' ? rowNode() : rowNode;
}

function updatePreparedRealizationContext(
  tree: ISignalTree<object>,
  descriptors: ReadonlyMap<PositionId, TreeRealizationDescriptor>,
  structuralOwnerPaths: StructuralOwnerIndex,
  preparedContext: PreparedRealizationContext,
  effect: ReversalEffect
): void {
  if (typeof effect.subjectId === 'number' && !effect.structural) {
    const descriptor = descriptors.get(effect.owner);
    const preparedSubject = preparedContext.resolveSubject(
      effect,
      effect.subjectId
    );
    const fieldPathFromRow = resolveSubjectFieldPath(
      descriptor,
      effect,
      getPositionRegistry(tree.$)
    );
    if (preparedSubject && fieldPathFromRow?.length === 0) {
      preparedSubject.value = effect.after;
    } else if (
      preparedSubject &&
      fieldPathFromRow &&
      effect.fieldPresence?.after === false
    ) {
      preparedSubject.value = withoutFieldAtSegments(
        preparedSubject.value,
        fieldPathFromRow
      );
    } else if (preparedSubject && fieldPathFromRow) {
      assignPreparedSubjectValue(
        preparedSubject.value,
        fieldPathFromRow,
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
    case 'rekey': {
      if (
        realizationPlacement(effect) &&
        !preparedContext.resolveSubject(effect, effect.subjectId)
      ) {
        const collectionNode = resolveCollectionNode(
          tree,
          descriptor,
          structuralOwnerPaths,
          effect
        );
        const path = resolveCollectionPath(
          descriptor,
          structuralOwnerPaths,
          effect
        );
        if (collectionNode && path)
          preparedContext.rememberRestoredSubject(
            effect,
            effect.subjectId,
            path,
            effect.before as string | number,
            deepClone(
              snapshotCollectionEntityValue(
                collectionNode,
                effect.before as string | number
              )
            )
          );
      }
      preparedContext.rememberRekeyedSubject(
        effect,
        effect.subjectId,
        effect.after as string | number
      );
      return;
    }
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
  structuralOwnerPaths: StructuralOwnerIndex
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
  structuralOwnerPaths: StructuralOwnerIndex,
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

function resolveSubjectFieldPath(
  descriptor: TreeRealizationDescriptor | undefined,
  effect: ReversalEffect,
  registry: PositionRegistry | undefined
): readonly string[] | undefined {
  if (typeof effect.subjectId !== 'number') return undefined;
  if (effect.subjectFieldSegments !== undefined) {
    return effect.subjectFieldSegments;
  }
  const legacy =
    deriveFieldPathFromEffect(effect, registry) ??
    descriptor?.subjectDescriptors?.get(String(effect.subjectId))
      ?.fieldPathFromRow ??
    descriptor?.fieldPathFromRow;
  return legacy === undefined
    ? undefined
    : legacy === ''
    ? []
    : legacy.split('.');
}

function assignPreparedSubjectValue(
  subjectValue: unknown,
  fieldPathFromRow: readonly string[],
  nextValue: unknown
): void {
  if (fieldPathFromRow.length === 0) {
    return;
  }

  if (!isTraversableNode(subjectValue)) {
    return;
  }

  const segments = fieldPathFromRow;
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

/** Resolve visible point owners without visiting unrelated branches. Unsupported
 * addresses retain the incumbent traversal and its omission semantics. */
function indexPointOwnerPaths(
  root: unknown,
  effects: readonly ReversalEffect[]
): StructuralOwnerIndex {
  const registry = getPositionRegistry(root);
  const owners = Object.assign(new Map<PositionId, string>(), {
    nodes: new Map<PositionId, CollectionNode>(),
  });
  for (const effect of effects) {
    if (typeof effect.subjectId !== 'number' || owners.nodes.has(effect.owner))
      continue;
    const address = registry?.addressFor(effect.owner);
    if (!address || address.length > 32) return indexStructuralOwnerPaths(root);
    let node: unknown = root;
    for (const key of address) {
      if (
        !isTraversableNode(node) ||
        key === 'set' ||
        key === 'update' ||
        key.startsWith('_')
      ) {
        return indexStructuralOwnerPaths(root);
      }
      const property = Object.getOwnPropertyDescriptor(node, key);
      if (!property?.enumerable || !('value' in property))
        return indexStructuralOwnerPaths(root);
      node = property.value;
    }
    if (
      !isCollectionNode(node) ||
      getOwnedPositionIds(node)?.[0] !== effect.owner
    ) {
      return indexStructuralOwnerPaths(root);
    }
    const path = getOwnedOwnerPath(node);
    if (path === undefined) return indexStructuralOwnerPaths(root);
    owners.set(effect.owner, path);
    owners.nodes.set(effect.owner, node);
  }
  return owners;
}

function indexStructuralOwnerPaths(root: unknown): StructuralOwnerIndex {
  const ownerPaths = Object.assign(new Map<PositionId, string>(), {
    nodes: new Map<PositionId, CollectionNode>(),
  });

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

      // Preserve the exact collection alongside its diagnostic address. This
      // index owns no entity values or retired row references.
      ownerPaths.set(positionId, ownerPath);
      ownerPaths.nodes.set(positionId, node);
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
  effect: ReversalEffect,
  structuralOwnerPaths: StructuralOwnerIndex
): unknown {
  if (effect.subjectFieldSegments !== undefined) {
    const collection = structuralOwnerPaths.nodes.get(effect.owner);
    const key = collection?.__findKeyBySubjectId?.(subjectId);
    if (!collection || key === undefined) return undefined;
    const row = collection.byIdOrFail(key);
    return resolveStructuredSubjectTarget(row, effect.subjectFieldSegments);
  }
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
  if (!collectionPath && collectionPath !== '') {
    return undefined;
  }
  const collectionNode = resolveNodeAtPath(
    tree.$ as Record<string, unknown>,
    collectionPath
  );
  if (!isCollectionNode(collectionNode)) {
    return undefined;
  }

  const currentKey = collectionNode.__findKeyBySubjectId?.(subjectId);
  if (currentKey === undefined) {
    return undefined;
  }

  const rowNode = collectionNode.byIdOrFail(currentKey);
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
  structuralOwnerPaths: StructuralOwnerIndex,
  effect: ReversalEffect
): string | undefined {
  if (hasInlineScopedAddress(effect)) {
    return effect.path;
  }

  if (typeof effect.subjectId !== 'number') {
    // A settlement can forget a scalar descriptor that restoration history
    // still needs; the effect's own path is the same location.
    return descriptor?.path ?? effect.path;
  }

  if (effect.subjectFieldSegments !== undefined) {
    const collection = structuralOwnerPaths.nodes.get(effect.owner);
    const key = collection?.__findKeyBySubjectId?.(effect.subjectId);
    const path = structuralOwnerPaths.get(effect.owner);
    if (key === undefined || path === undefined) return undefined;
    return [path, String(key), ...effect.subjectFieldSegments].join('.');
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

/** Literal property keys supplied by capture; diagnostic paths are not identities. */
export function deriveFieldSegmentsFromEffect(
  effect: ReversalEffect,
  registry: PositionRegistry | undefined
): readonly string[] | undefined {
  if (effect.subjectFieldSegments !== undefined) {
    return effect.subjectFieldSegments;
  }
  const legacy = deriveFieldPathFromEffect(effect, registry);
  return legacy === undefined
    ? undefined
    : legacy === ''
    ? []
    : legacy.split('.');
}

export function deriveFieldPathFromEffect(
  effect: ReversalEffect,
  registry: PositionRegistry | undefined
): string | undefined {
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

function resolveNodeAtSegments(
  root: unknown,
  segments: readonly string[]
): unknown {
  let cursor = root;
  for (const segment of segments) {
    if (cursor === null || cursor === undefined) return undefined;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
}

function resolveStructuredSubjectTarget(
  row: unknown,
  segments: readonly string[]
): unknown {
  if (segments.length === 0) return row;
  const direct = resolveNodeAtSegments(row, segments);
  if (isWritableLeaf(direct) || isWritableEntityNode(direct)) return direct;
  if (!isWritableEntityNode(row)) return undefined;
  const read = row as unknown as () => unknown;
  const parent = resolveNodeAtSegments(read(), segments.slice(0, -1));
  if (!isTraversableNode(parent)) return undefined;
  // Entity fields can be opaque object leaves. Realize a nested value through
  // the owned row's replacement operation rather than inventing a native leaf.
  return (value: unknown) =>
    row(replaceValueAtSegments(read(), segments, value));
}

function replaceValueAtSegments(
  value: unknown,
  segments: readonly string[],
  next: unknown
): unknown {
  if (segments.length === 0) return next;
  const [key, ...rest] = segments;
  const record = isTraversableNode(value)
    ? (value as Record<string, unknown>)
    : {};
  return { ...record, [key]: replaceValueAtSegments(record[key], rest, next) };
}

function resolveNodeAtPath(
  root: Record<string, unknown>,
  path: string
): unknown {
  if (path === '') {
    return root;
  }

  let cursor: unknown = root;
  for (const segment of path.split('.')) {
    if (cursor === null || cursor === undefined) {
      return undefined;
    }
    cursor = (cursor as Record<string, unknown>)[segment];
  }

  return cursor;
}

const rowScope = (owner: unknown, subject: unknown): string =>
  `${String(owner)}\u0000${String(subject)}`;

/** The same placement order is used by validation and installation planning. */
function orderPhysicalPlacements(
  tree: ISignalTree<object>,
  descriptors: ReadonlyMap<PositionId, TreeRealizationDescriptor>,
  ownerPaths: StructuralOwnerIndex,
  effects: readonly ReversalEffect[]
): readonly ReversalEffect[] {
  const placements = effects.filter(
    (effect): effect is ReversalEffect & { subjectId: number } =>
      typeof effect.subjectId === 'number' &&
      (effect.structural === 'add' ||
        realizationPlacement(effect) !== undefined)
  );
  if (placements.length < 2) return effects;
  const removed = new Set(
    effects
      .filter((effect) => effect.structural === 'remove')
      .map((effect) => rowScope(effect.owner, effect.subjectId))
  );
  const nodes = new Map<PositionId, CollectionNode | undefined>();
  const ordered = orderRestoresForPlacement(
    placements,
    (effect) =>
      getStructuralAddEffect(
        descriptors.get(effect.owner),
        realizationPlacement(effect) ?? effect
      ),
    (effect, subject) => {
      if (removed.has(rowScope(effect.owner, subject))) return false;
      if (!nodes.has(effect.owner))
        nodes.set(
          effect.owner,
          resolveCollectionNode(
            tree,
            descriptors.get(effect.owner),
            ownerPaths,
            effect
          )
        );
      return (
        nodes.get(effect.owner)?.__findKeyBySubjectId?.(subject) !== undefined
      );
    }
  );
  const placementSet = new Set<ReversalEffect>(placements);
  let next = 0;
  return effects.map((effect) =>
    placementSet.has(effect) ? ordered[next++] : effect
  );
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
