import { defineEntityPreparationReader } from './internals/entity-preparation-reader';
import { createPredicateChurnWarning } from './internals/predicate-churn-warning';
import { markSnapshotInstalled } from './internals/snapshot-installation';
import type { PreparedPlacementEntries } from './physical/entity-placement-stage';
import { PublicationPreparation } from './internals/publication-preparation';
import { reportContainedObserverError } from './internals/error-reporter';
import type { EntityStructureOperation, PreparedEntityStructure } from './internals/prepared-entity-structure';
import { resolveOrdinaryRestorationPlacement, type OrdinaryRestorationPlacement } from './physical/ordinary-restoration-placement';
import { ordinaryAdmissionKey } from './physical/ordinary-key-evidence';
import type {SelectedRowIntent,SelectedRowEdit} from './internals/selected-write-operation';
import {type ClaimedFieldEndpoint,type NativeFieldEndpoint} from './internals/native-field-selection';
import type { EntityProjectionSeedEntry } from './internals/entity-projection-seed';
import { EntityPublicationSource, markEntityPublicationFacts, entityPublicationFactsUnit, defineEntityPublicationBinding, currentEntityPublicationInputs, withEntityPublicationInput, withEntityPublicationUnit, type EntityPublicationEdit, type EntityPublicationStep } from './internals/entity-publication';
import { createPreparedPlacementVisibility } from './physical/prepared-placement-visibility';
import { withSelectedEntityDisposition } from './internals/selected-entity-disposition';
import { realizationPlacement } from './internals/causal-runtime/ordinary-realization';
import type { EntityPlacementStage } from './physical/entity-placement-stage';
import {
  EntityOrdinaryTopology,
  ordinaryPresenceRecord,
  type OrdinaryEntityPresence,
} from './physical/entity-ordinary-topology';
import {
  withEntityValueTransition,
  withEntityOrdinaryChanges,
  type EntityValueTransition,
  type EntityRealizationEdit,
} from './internals/entity-value-transition';
import { installTerminalRecord } from './internals/intrinsic-mutation';
import type {
  Location,
  ReadableCell,
  WritableCell,
} from './internals/cell-runtime';
import type { EpochHandle } from './internals/observation-adapter';
import {
  createWritableProjection,
  deriveLocation,
  NEUTRAL_LOCATION_RUNTIME,
  replaceLocation,
  type LocationRuntime,
} from './internals/location-runtime';
import { deepClone } from './internals/utilities/deep-clone';
import { deepEqual } from './internals/utilities/deep-equal';

import {
  EntityMutationFrame,
  type PreparedFreshSubject,
  type PreparedKeyTransfer,
  type PreparedRetainedValueRetirement,
  type PreparedSubjectRestore,
  type PreparedSubjectTombstone,
  type PreparedValueReplacement,
} from './physical/entity-mutation-frame';
import { resolveEntityHandle } from './physical/entity-handle-resolution';
import { EntityValueStore } from './physical/entity-value-store';
import {
  StructuralStore,
  type AcquiredSubjectHandle,
  type SubjectLifetimeRecord,
} from './physical/structural-store';
import { defineOwnedOwnerPath } from './internals/owned-mutation';
import {
  defineEntityMembershipSource,
  holdEntityMembershipDelivery,
  MEMBERSHIP_CLOSE,
  MEMBERSHIP_FACTS,
  MEMBERSHIP_OPEN,
  MEMBERSHIP_OPEN_ORDER,
  type EntityMembershipTap,
} from './internals/entity-membership-source';
import type { PhysicalCommitClock } from './internals/physical-commit-clock';
// Only `notify` is ever called on this — the neutral port contract, not the
// delivery engine's full surface.
import type { PathObservationPort } from './internals/path-observation-port';
import { getActiveWriteContext } from '../lib/write-context';
import { recordProductionSubstrateStat } from './internals/production-substrate-stats';
import {
  defineEntityLocationBinding,
  defineEntityProjectionSeed,
} from './internals/entity-projection-seed';
import {
  definePositionRegistry,
  getNodeAddress,
  getPositionRegistry,
} from './internals/position-registry';
import { markOwnerInvalidated } from './internals/owner-invalidation-port';
import {
  inStructuralWrite,
  isAbsentMember,
  MEMBERSHIP_CHANGED,
  reactivatePathOnWrite,
  structuralWrites,
} from './internals/member-membership';
import { physicalRows, taps } from './internals/physical-rows';
import {
  MUTATION_CAPTURE_RUNTIME,
  type CommittedEntityMutation,
  type MutationCaptureRuntime,
} from './internals/mutation-capture-runtime';
import type {
  CollectionTransitionTarget,
  CollectionTransitionTargetBinding,
} from './internals/causal-runtime/target-transition';

// Angular's global dev-mode flag (defined by the Angular CLI; undefined in
// plain test/node contexts, treated as dev there).
declare const ngDevMode: boolean | undefined;

/**
 * Wrong entityMap method names AI agents and devs reach for (from other state
 * libraries), mapped to the SignalTree equivalent. Used by a dev-mode proxy
 * guardrail to turn a cryptic "undefined is not a function" into an actionable
 * hint. Sourced from the documented cross-library hallucination table.
 */
const WRONG_ENTITY_METHODS: Record<string, string> = {
  upsert: 'upsertOne(entity) / upsertMany(entities)',
  add: 'addOne(entity) / addMany(entities)',
  insert: 'addOne(entity)',
  update: 'updateOne(id, changes) / updateMany(ids, changes)',
  remove: 'removeOne(id) / removeMany(ids)',
  delete: 'removeOne(id)',
  getAll: 'all() (a signal)',
  selectAll: 'all() (a signal)',
  selectMany: 'where(predicate)',
  selectEntity: 'byId(id)',
  addEntities: 'addMany(entities)',
  setEntities: 'setAll(entities)',
  setProps: 'set leaves directly — entityMap has no props object',
  next: 'set leaves directly — not an RxJS Subject',
  asObservable: 'use the signal directly — not an RxJS Subject',
};

type EntityPositionIdAllocator = () => number | undefined;
let nextStandaloneEntityPositionId = 1;
const standaloneEntityPositionIdAllocator: EntityPositionIdAllocator = () =>
  nextStandaloneEntityPositionId++;
let entityPositionIdAllocatorOverride: EntityPositionIdAllocator | undefined;
let entityPositionIdNotifyEnabled = true;

/** @internal Bench/test-only hook for owner PositionId allocation experiments. */
// ⚠️ NOT EXPORTED. Used only inside this module; the `export` was surplus.
// (ORPHAN sweep, 15.0. Same-file-only proves the EXPORT is unnecessary — it says
// nothing about who owns the code, and this code is live.)
function setEntityPositionIdAllocatorForTesting(
  allocator?: EntityPositionIdAllocator
): void {
  entityPositionIdAllocatorOverride = allocator;
}

/** @internal Bench/test-only hook to isolate owner-id carriage from stamping. */
// ⚠️ NOT EXPORTED. Used only inside this module; the `export` was surplus.
// (ORPHAN sweep, 15.0. Same-file-only proves the EXPORT is unnecessary — it says
// nothing about who owns the code, and this code is live.)
function setEntityPositionIdNotifyEnabledForTesting(enabled = true): void {
  entityPositionIdNotifyEnabled = enabled;
}

export type EntitySubjectPhysicalInventory<K extends string | number> = {
  subjectId: number;
  state: 'active' | 'tombstoned';
  subjectRevision: number;
  activeKey: K | undefined;
  retainedSubjectState: boolean;
  entitySignal: boolean;
  activationToken: boolean;
  nodeFacadeMaterialized: boolean;
  fieldFacadesMaterialized: readonly string[];
  positionIds: readonly PositionId[] | undefined;
  retainedValueBacking:
    | {
        kind: 'retained-entity-signal';
      }
    | undefined;
};

export type EntitySubjectReclamationResource =
  | 'subject-lifetime-record'
  | 'retained-value-backing'
  | 'subject-activation-channel'
  | 'row-facade'
  | 'field-facades'
  | 'ownership-metadata';

export type EntitySubjectReclamationUnresolved = {
  resource: EntitySubjectReclamationResource;
  reason: 'terminal-facade-dependency-unknown';
};

export type EntitySubjectReclamationPlan = {
  subjectId: number;
  eligible: boolean;
  retire: readonly EntitySubjectReclamationResource[];
  retain: readonly EntitySubjectReclamationResource[];
  unresolved: readonly EntitySubjectReclamationUnresolved[];
};

export type PreparedEntitySubjectReclamation = {
  subjectId: number;
  expectedLifetime: 'tombstoned';
  expectedSubjectRevision: number;
  retire: readonly EntitySubjectReclamationResource[];
  retain: readonly EntitySubjectReclamationResource[];
};

export type EntitySubjectReclamationPlanningOptions = {
  causallyEligible: boolean;
  /**
   * Also drop the subject's LIFETIME RECORD, not just its value bytes.
   *
   * Off by default because the two have different safety arguments. Retiring
   * the value is invisible: nothing reads `backingForSubject` on a tombstoned
   * subject, and every restorer holds its own copy. Forgetting the lifetime is
   * what makes the subject unrestorable, so it needs a caller that has
   * established nothing can still restore it.
   *
   * It is also the only half that BOUNDS retention. The value is ~132 B of the
   * measured 249 B/retired and the lifetime record is the other ~111 B, and the
   * ledger is what grows with every subject the collection has ever retired.
   * A sink that retires only the value leaves a slope — measured, after the
   * first version of this did exactly that and the inventory looked bounded
   * because `__listSubjectReclamationCandidates` only counts value-backed
   * subjects.
   */
  reclaimLifetimeRecord?: boolean;
};

export function planEntitySubjectReclamation<K extends string | number>(
  inventory: EntitySubjectPhysicalInventory<K>,
  options: EntitySubjectReclamationPlanningOptions
): EntitySubjectReclamationPlan {
  const retain: EntitySubjectReclamationResource[] = [];

  if (inventory.retainedSubjectState) {
    retain.push('subject-lifetime-record');
  }
  if (inventory.retainedValueBacking) {
    retain.push('retained-value-backing');
  }
  if (inventory.activationToken) {
    retain.push('subject-activation-channel');
  }
  if (inventory.nodeFacadeMaterialized) {
    retain.push('row-facade');
  }
  if (inventory.fieldFacadesMaterialized.length > 0) {
    retain.push('field-facades');
  }
  if ((inventory.positionIds?.length ?? 0) > 0) {
    retain.push('ownership-metadata');
  }

  if (inventory.state !== 'tombstoned') {
    return {
      subjectId: inventory.subjectId,
      eligible: false,
      retire: [],
      retain,
      unresolved: [],
    };
  }

  if (!options.causallyEligible) {
    return {
      subjectId: inventory.subjectId,
      eligible: false,
      retire: [],
      retain,
      unresolved: [],
    };
  }

  const retire: EntitySubjectReclamationResource[] = [];
  const remaining = [...retain];
  const promote = (resource: EntitySubjectReclamationResource) => {
    retire.push(resource);
    const index = remaining.indexOf(resource);
    if (index !== -1) {
      remaining.splice(index, 1);
    }
  };

  if (inventory.retainedValueBacking) {
    promote('retained-value-backing');
  }
  if (options.reclaimLifetimeRecord && inventory.retainedSubjectState) {
    promote('subject-lifetime-record');
  }

  return {
    subjectId: inventory.subjectId,
    eligible: true,
    retire,
    retain: remaining,
    unresolved: [],
  };
}

/**
 * EntitySignal Implementation (Composition Pattern)
 *
 * Map-based reactive entity collections with:
 * - Full CRUD operations (addOne, updateOne, removeOne, upsertOne)
 * - Query signals (all, count, ids, byId, where, find)
 * - Entity hooks (tap for observation)
 * - Entity interceptors (intercept for blocking/transforming)
 * - Deep signal access (tree.$.users['id'].name())
 *
 * Uses composition (closures) instead of classes to avoid
 * Proxy + class `this` binding issues.
 *
 * @internal
 */

import type {
  EntityConfig,
  EntitySignal,
  TapHandlers,
  InterceptHandlers,
  InterceptContext,
  EntityNode,
  AddOptions,
  AddManyOptions,
  WriteMetadata,
  PositionId,
  StructuralEffect,
} from '../lib/types';

/**
 * True when the subjects present at both endpoints appear in a different
 * relative order. Subjects present at only one endpoint are ignored.
 */
function survivingOrderChanged(
  before: readonly number[],
  after: readonly number[]
): boolean {
  const inAfter = new Set(after);
  const inBefore = new Set(before);
  const survivingBefore = before.filter((subject) => inAfter.has(subject));
  const survivingAfter = after.filter((subject) => inBefore.has(subject));
  return survivingBefore.some(
    (subject, index) => subject !== survivingAfter[index]
  );
}

/**
 * Creates an EntitySignal using composition pattern.
 * All state is stored in closures - no `this` binding issues possible.
 *
 * @internal
 */
export function createEntitySignal<
  E extends Record<string, unknown>,
  K extends string | number = string
>(
  config: EntityConfig<E, K>,
  pathNotifier: PathObservationPort,
  basePath: string,
  options?: {
    physicalCommitClock?: PhysicalCommitClock;
    mutationCaptureRuntime?: MutationCaptureRuntime;
    positionIdAllocator?: EntityPositionIdAllocator;
    ownerMetadataEnabled?: boolean;
    subjectMetadataEnabled?: boolean;
    positionMetadataEnabled?: boolean;
    /**
     * Registry namespace of the tree this collection belongs to.
     *
     * OWNER-REPLAY-2. Collections notify the path notifier DIRECTLY rather than
     * through the owned-write wrapper, so an authored `addOne`/`removeOne`
     * reached subscribers with `ownerId: undefined` while the restoration and
     * rollback replays of the SAME operation carried it. An owner-filtered
     * observer was therefore blind to every authored collection change.
     */
    ownerId?: number;
    locationRuntime?: LocationRuntime;
    /**
     * Whether anything in this tree could restore a subject after it retires.
     *
     * Comes from the finalized build plan (`RuntimeTreePlan`) and cannot change
     * for the life of the tree. `false` is what licenses zero-owner reclamation
     * at the retirement boundary below.
     *
     * DEFAULTS TO TRUE — retain. A collection created outside `signalTree`'s
     * construction path has no plan to consult, and reclaiming a subject some
     * unseen owner could restore is unrecoverable.
     */
    hasRestorationAuthority?: boolean;
    onDispose?: (callback: () => void) => () => void;
  }
): EntitySignal<E, K> {
  const locations = options?.locationRuntime ?? NEUTRAL_LOCATION_RUNTIME;
  const physicalRowSubjects = new WeakMap<object,number>();
  // ==================
  // CLOSURE STATE (no `this` needed)
  // ==================

  // Derived materialized projection only.
  // Authoritative structural state lives in structuralStore.
  // Authoritative subject values live in valueStore.

  /**
   * Collection version. Bumped once per mutation; every collection query below
   * derives from it LAZILY.
   *
   * This replaced eager rebuilding, which made a single-entity update O(size).
   * `updateSignals()` used to run on EVERY mutation and do three full copies of
   * the collection — `Array.from(storage.values())`, `Array.from(storage.keys())`
   * and `new Map(storage)` — plus a `.set()` on each derived signal, which then
   * deep-compared them. Measured on a 50,000-row collection: 2.8ms PER
   * `updateOne`, scaling cleanly with size (38us @1k, 510us @10k). That defeats
   * the entire point of a Map-backed entity store, whose storage write is O(1).
   *
   * (It was not the deep equality: shallow comparison measured the same. It was
   * the copying.)
   *
   * Now the copies happen only when a query is actually READ, and Angular's
   * computed caches them until the next mutation — so a grid that reads `all()`
   * once per frame pays once per frame instead of once per write.
   */
  const version = locations.createCell(0);
  /**
   * `SUBJECT-EPOCH-0`. Epochs to advance when the batch flushes.
   *
   * It holds the CELLS, not subject ids, and that is load bearing. `removeOne`
   * runs `tombstoneSubjectSignal` -> `reclaimRetiredSubjectsWithoutOwner` ->
   * `updateSignals`, and the middle step deletes the registry entry. Staging an
   * id means the flush looks up an epoch that no longer exists, skips the
   * advance, and a `computed` that read this row never learns it was removed.
   * Holding the cell keeps the pending invalidation alive across its own
   * reclamation — which is exactly why the map this replaced staged `Location`
   * objects rather than keys.
   *
   * No value is staged: the value is already in `EntityValueStore` before
   * anything lands here, so a copy would be a second truth.
   */
  const pendingSubjectEpochs = new Set<EpochHandle>();

  // Source-owned install epoch makes library readers current before notifications.
  let installedReadRevision=0;
  // Construction may advance before the returned proxy identity is available.
  let snapshotIdentity: object | undefined = undefined;
  const advanceInstalledRead = (): void => {
    installedReadRevision++;
    if (snapshotIdentity) markSnapshotInstalled(snapshotIdentity);
  };
  const createVersionedProjection = <TValue>(
    compute: () => TValue
  ): ReadableCell<TValue> => {
    let projectedVersion = -1;
    let projectedInstall = -1;
    let projectedAbsent = false;
    let initialized = false;
    let value: TValue;
    return locations.createCurrentReadonly(() => {
      const currentVersion = version();
      const currentInstall = installedReadRevision;
      // Presence can install before the existing membership notification. All
      // keys belong to this attempt: callback reentry must not label its first
      // result with a newer install revision or effective presence.
      const currentAbsent = absent();
      if (
        !initialized ||
        projectedVersion !== currentVersion ||
        projectedInstall !== currentInstall ||
        projectedAbsent !== currentAbsent
      ) {
        value = compute();
        projectedAbsent = currentAbsent;
        projectedVersion = currentVersion;
        projectedInstall = currentInstall;
        initialized = true;
      }
      return value;
    });
  };

  function getProjectedEntity(id: K): E | undefined {
    const subjectId = structuralStore.subjectIdForKey(id);
    if(subjectId===undefined)return undefined;
    const row=valueStore.backingForSubject(subjectId);
    if(row && typeof row==='object')physicalRowSubjects.set(row,subjectId);
    return row;
  }

  function getProjectedEntries(): Array<readonly [K, E]> {
    const entries: Array<readonly [K, E]> = [];
    for (const id of structuralStore.activeKeysSnapshot()) {
      const entity = getProjectedEntity(id);
      if (entity !== undefined) {
        entries.push([id, entity] as const);
      }
    }
    return entries;
  }

  function getProjectedEntities(): E[] {
    return getProjectedEntries().map(([, entity]) => entity);
  }

  /**
   * ⚠️ PUBLIC READS ARE ABSENT WHILE THE COLLECTION IS (v16 8e). A collection
   * omitted itself or under an omitted member is an absent, empty collection
   * to every public read and to every write that names a row: "DORMANT
   * STORAGE MUST NOT SUPPLY THE REACTIVATED VALUE"
   * (`whole-value-membership.spec.ts` 18). Its retained rows stay physical
   * truth for restoration and transactions, which keep the `getProjected*`
   * reads. One symbol lookup on a collection that was never under an
   * omission.
   */
  const absent = (): boolean => isAbsentMember(api);
  // Row reads and row writes use physical truth only while a reversal or a
  // rollback is being applied to this collection's tree (`physicalRows`).
  // Projections never do, so nothing they cache can hold retained rows.
  // A tap reads absent-aware even inside the window, unless it started the
  // reversal itself: the window records the tap depth it opened at.
  const rowAbsent = (): boolean => {
    if (!absent()) return false;
    if (!physicalRows.length) return true;
    const registry = getPositionRegistry(api);
    return !physicalRows.some(
      ([open, depth]) => open === registry && depth === taps.depth
    );
  };
  const presentEntity = (id: K): E | undefined =>
    rowAbsent() ? undefined : getProjectedEntity(id);
  const presentEntries = (): Array<readonly [K, E]> =>
    absent() ? [] : getProjectedEntries();
  const presentEntities = (): E[] => (absent() ? [] : getProjectedEntities());

  function acquireEntityHandleForTesting(
    id: K
  ): AcquiredSubjectHandle | undefined {
    return structuralStore.acquireSubjectHandleForKey(id);
  }

  function resolveEntityHandleForTesting(handle: AcquiredSubjectHandle) {
    return resolveEntityHandle(structuralStore, valueStore, handle);
  }

  function rebuildActiveProjectionFromOwners(): ReadonlyMap<K, E> {
    return new Map(getProjectedEntries());
  }

  function createEntityMutationFrame(): EntityMutationFrame<K, E> {
    return new EntityMutationFrame(valueStore, structuralStore);
  }

  function prepareStructuralUnit(operations: readonly EntityStructureOperation[], publicationPhase?: PublicationPreparation): PreparedEntityStructure {
    const frame = createEntityMutationFrame();
    frame.useProposedPlacement();
    const stage = structuralStore.preparePlacement();
    const keys = new Map<K, number | undefined>();
    const atKey = (key: K) => {
      if (keys.has(key)) return keys.get(key);
      const subject = structuralStore.subjectIdForKey(key);
      if (subject === undefined) return undefined;
      const row = stage.read(subject);
      return row.present && row.key === key ? subject : undefined;
    };
    for (const op of operations) {
      const key = op.key as K, prior = stage.read(op.subject);
      if (op.kind === 'remove') {
        if (!prior.present || prior.key !== key) throw new Error('Prepared removal source changed');
        frame.stageSubjectTombstone({kind:'tombstone-subject',key,subjectId:op.subject,restoreAllowed:resolveSubjectState(op.subject)?.restoreAllowed ?? true});
        keys.set(key,undefined);stage.remove(op.subject);
      } else {
        const occupied = atKey(key);
        if (occupied !== undefined && occupied !== op.subject) throw new Error('Prepared destination is occupied');
        if (op.kind === 'rekey') {
          if (!prior.present || prior.key !== op.from) throw new Error('Prepared rekey source changed');
          if (op.placement && !deepEqual(valueStore.backingForSubject(op.subject), op.value))
            frame.stageValueReplacement({kind:'replace-value',key:op.from as K,subjectId:op.subject,nextValue:op.value as E,authoredFields:'realization'});
          frame.stageKeyTransfer({kind:'transfer-key',subjectId:op.subject,fromKey:op.from as K,toKey:key,placement:op.placement});
          keys.set(prior.key,undefined);stage.rekey(op.subject,key);
          if(op.placement)stage.insert(op.subject,key,op.placement.beforeSubject,op.placement.afterSubject);
        } else {
          if (prior.present) throw new Error('Prepared addition lifetime is active');
          const state=resolveSubjectState(op.subject);
          if(op.kind==='fresh') {
            if(state)throw new Error('Prepared fresh lifetime already exists');
            frame.stageFreshSubject({kind:'create-fresh-subject',subjectId:op.subject,key,nextValue:op.value as E});
          } else {
            if(state && !state.restoreAllowed)throw new Error('Prepared restoration backing retired');
            frame.stageSubjectRestore({kind:'restore-subject',subjectId:op.subject,key,realizedValue:op.value as E,restoreAllowed:state?.restoreAllowed??true,beforeSubject:op.beforeSubject,afterSubject:op.afterSubject});
          }
          stage.insert(op.subject,key,op.beforeSubject,op.afterSubject);
        }
        keys.set(key,op.subject);
      }
    }
    const prepared = prepareEntityMutationFrame(frame,{advancePhysicalRevision:false,publication:'physical'});
    const phase=publicationPhase ?? new PublicationPreparation();
    phase.add(prepared.finalize,prepared.validate);if(!publicationPhase)phase.seal();
    let result: ReturnType<typeof prepared.install> | undefined;
    return {
      install(){if(!publicationPhase)phase.validate();result=prepared.install();},
      complete(){prepared.complete();},
      invalidate(){
        if(!result)throw new Error('Structural source unit not installed');
        for(const subject of result.physicallyChangedSubjectIds)publishSubjectPhysicalChange(subject);
        for(const op of operations){
          lastSubjectIds=[op.subject];
          if(op.kind==='remove')tombstoneSubjectSignal(op.subject);
          else {
            if(op.kind==='fresh')invalidateNodeCache(op.key as K);
            if(op.kind==='rekey'){rekeyedSubjects.add(op.subject);if(activeIdValue===op.from)replaceLocation(activeIdSignal,op.key as K);}
            syncEntitySignal(op.key as K);
          }
        }
        updateSignals();
      },
    };
  }

  function prepareSelectedRows(operations: readonly SelectedRowIntent[],publicationPhase?:PublicationPreparation) {
    const rows = new Map<number,{subjectId:number;key:string|number;value:unknown;edits:EntityRealizationEdit[];transition:EntityValueTransition<E>}>();
    const steps: SelectedRowEdit[] = [];
    for (const operation of operations) {
      const previous=rows.get(operation.subject);
      const before=previous?.transition.physicalAfter ?? operation.physicalBefore;
      const after=(operation.fields===null ? {...(operation.physicalAfter as object)} : {...(before as object)}) as Record<string,unknown>;
      const edits:EntityRealizationEdit[]=[];
      if(operation.fields===null) edits.push({kind:'row',value:after});
      else for(const field of operation.fields){
        const present=Object.prototype.hasOwnProperty.call(operation.physicalAfter,field);
        const value=present?(operation.physicalAfter as Record<string,unknown>)[field]:undefined;
        if(present)Object.defineProperty(after,field,{value,enumerable:true,configurable:true,writable:true});else delete after[field];
        edits.push({kind:'field',field,present,value,selection:operation.selections.get(field)});
      }
      const transition=valueStore.prepareRealizationTransition(operation.subject,after as E,edits,previous?.transition);
      // Selected publication uses completed steps and this prepared transition.
      // No fallback edit list is consumed; retaining every prefix is unnecessary.
      rows.set(operation.subject,{subjectId:operation.subject,key:operation.key,value:after,edits:[],transition:previous?Object.freeze({...transition,physicalBefore:previous.transition.physicalBefore,ordinaryBefore:previous.transition.ordinaryBefore}):transition});
      steps.push({...operation,physicalBefore:before,physicalAfter:after,ordinaryBefore:transition.ordinaryBefore,ordinaryAfter:transition.ordinaryAfter});
    }
    return preparePointValues([...rows.values()],steps,publicationPhase);
  }
  function stageSelected(id:K, before:E, after:E, fields:readonly string[] | null, selection:ClaimedFieldEndpoint):void {
    const selections=selectedInverseField(selection,selection.subject,after,id)!;
    selection.preparation!.stage({source:entityPublication,subject:selection.subject,key:id,physicalBefore:before,physicalAfter:after,fields,selections,prepare:prepareSelectedRows});
  }

  /** Existing-lifetime value plans: all reflection precedes physical installation. */
  function preparePointValues(
    values: readonly {
      subjectId: number;
      key: string | number;
      value: unknown;
      edits: readonly EntityRealizationEdit[];
      transition?: EntityValueTransition<E>;
    }[],
    selectedSteps?: readonly SelectedRowEdit[],
    publicationPhase?: PublicationPreparation
  ): { install(): void; invalidate(): void; publish(): void; complete():void } {
    const prepared = values.map(({ subjectId, key, value, edits, transition }) => {
      if (structuralStore.activeKeyForSubject(subjectId) !== key) {
        throw new Error(
          'Point realization subject is no longer active at its key'
        );
      }
      const before = valueStore.backingForSubject(subjectId);
      const after = deepClone(value) as E;
      return {
        subjectId,
        edits,
        key: key as K,
        before,
        after,
        transition: transition ?? valueStore.prepareRealizationTransition(
          subjectId,
          after,
          edits
        ),
        changed: !deepEqual(before, after),
        epoch: subjectEpochs.get(subjectId),
      };
    });
    const ordinarySteps=selectedSteps?.map(step=>({subject:step.subject,before:step.ordinaryBefore,after:step.ordinaryAfter,fields:step.fields,restoredFields:step.selections}));
    const publication=prepareEntityPublication(
      prepared.map(row=>({subject:row.subjectId,before:row.before,after:row.after,fields:publicationFields(row.before,row.after)})),
      ordinarySteps ?? prepared.map(row=>({subject:row.subjectId,before:row.transition.ordinaryBefore,after:row.transition.ordinaryAfter,fields:publicationFields(row.transition.ordinaryBefore,row.transition.ordinaryAfter),restoredFields:new Map(row.edits.flatMap(edit=>edit.kind==='field'&&edit.selection?[[edit.field,edit.selection] as const]:[]))})),undefined,undefined,true,
      selectedSteps?.map((step,ordinal)=>({ordinal,authoredFootprint:authoredFootprint(step.fields),physical:[{subject:step.subject,before:step.physicalBefore,after:step.physicalAfter,fields:step.fields}],ordinary:[ordinarySteps![ordinal]!]}))
    );
    const phase=publicationPhase ?? new PublicationPreparation();
    phase.add(()=>publication.unit?.finalize?.(),()=>publication.unit?.validate?.());if(!publicationPhase)phase.seal();
    let completed=false;
    const complete=()=>{if(completed)return;completed=true;if(publication.unit)entityPublication.complete(publication.unit.completion);};
    return {
      complete,
      install(): void {
        if(!publicationPhase)phase.validate();
        for (const row of prepared)
          valueStore.installValueTransition(row.transition);
        if(publication.unit) installTerminalRecord(publication.unit.record);
        advanceInstalledRead();
      },
      invalidate(): void {
        let failed = false;
        let firstError: unknown;
        const stage = (fn: () => void) => {
          try {
            fn();
          } catch (error) {
            if (!failed) {
              failed = true;
              firstError = error;
            }
          }
        };
        for (const row of prepared) {
          const epoch = row.epoch;
          if (epoch) stage(() => advanceEpochHandle(epoch));
        }
        stage(() => updateSignals());
        if(!publicationPhase)stage(complete);
        if (failed) throw firstError;
      },
      publish(): void {
        let failed=false;let first:unknown;
        for (const row of prepared) {try {
          pathNotifier.notify(
            `${basePath}.${String(row.key)}`,
            row.after,
            row.before,
            basePath,
            [row.subjectId],
            getPositionIdsForNotify(),
            withEntityValueTransition(
              {
                ...(ambientMeta() ?? {}),
                intent: 'system',
                participation: 'realized',
              },
              {...row.transition,publicationUnit:publication.unit?publication.id:undefined}
            )
          );
          if (!selectedSteps && row.changed) emitTap('onUpdate', row.key, row.after, row.after);
        } catch(error){if(!failed){failed=true;first=error;}}}
        for(const step of selectedSteps??[])try{
          const delta:Record<string,unknown>={};for(const field of step.fields??Object.keys(step.physicalAfter as object))if(Object.prototype.hasOwnProperty.call(step.physicalAfter,field))Object.defineProperty(delta,field,{value:(step.physicalAfter as Record<string,unknown>)[field],enumerable:true});
          emitTap('onUpdate',step.key as K,delta as Partial<E>,step.physicalAfter as E);
        }catch(error){if(!failed){failed=true;first=error;}}
        if(failed)throw first;
      },
    };
  }

  function readTransitionSource(): CollectionTransitionTarget {
    if (positionId === undefined) {
      throw new Error('Collection transition binding has no owner PositionId');
    }
    const subjects = structuralStore.activeKeysSnapshot().map((key) => {
      const subject = structuralStore.subjectIdForKey(key);
      const value =
        subject === undefined
          ? undefined
          : valueStore.backingForSubject(subject);
      if (subject === undefined || value === undefined) {
        throw new Error(
          'Collection transition source is missing active subject truth'
        );
      }
      return { subject, key, value };
    });
    return {
      owner: positionId,
      subjects,
      order: subjects.map(({ subject }) => subject),
      orderFrontier: structuralStore.activeOrderFrontier(),
    };
  }

  /** Validate semantic endpoints against the effective ordinary view, before
   * physical address substitution. This stage has no install or callbacks. */
  function validateOrdinaryStructure(
    effects: readonly import('./internals/causal-runtime/causal-types').ReversalEffect[]
  ): boolean {
    const base = ordinaryTopology.preparePlacement(structuralStore.preparePlacement());
    type Presence = { present: false } | { present: true; key: K };
    const subjects = new Map<number, Presence>();
    const keys = new Map<K, number | undefined>();
    const read = (subject: number): Presence => subjects.get(subject) ?? base.read(subject);
    const atKey = (key: K): number | undefined => {
      if (keys.has(key)) return keys.get(key);
      const subject = ordinaryTopology.atKey(key) ?? structuralStore.subjectIdForKey(key);
      if (subject === undefined) return undefined;
      const state = read(subject);
      // A physical candidate can occupy an inspection-only address. Recheck
      // its effective ordinary key; sparse exceptions alone are not a view.
      return state.present && state.key === key ? subject : undefined;
    };
    const write = (subject: number, next: Presence): void => {
      const prior = read(subject);
      if (prior.present) keys.set(prior.key, undefined);
      subjects.set(subject, next);
      if (next.present) keys.set(next.key, subject);
    };
    for (const effect of effects) {
      if (!effect.structural || typeof effect.subjectId !== 'number') continue;
      const subject = effect.subjectId, prior = read(subject);
      if (effect.structural === 'remove') {
        // Existing removal semantics resolve by lifetime, not recorded key.
        if (!prior.present) return false;
        write(subject, { present: false });
      } else if (effect.structural === 'rekey') {
        if (!prior.present || prior.key !== effect.before || atKey(effect.after as K) !== undefined) return false;
        write(subject, { present: true, key: effect.after as K });
      } else {
        if (prior.present || atKey(effect.after as K) !== undefined) return false;
        write(subject, { present: true, key: effect.after as K });
      }
    }
    return true;
  }

  function prepareOrdinaryRealization(
    effects: readonly import('./internals/causal-runtime/causal-types').ReversalEffect[],
    physicalAfter?: ReadonlyMap<number, unknown>,
    physicalEffects: readonly import('./internals/causal-runtime/causal-types').ReversalEffect[] = effects,
    physicalPlacement?: EntityPlacementStage<K>,
    ordinaryOrder?: readonly number[],
    publicationPhase?: PublicationPreparation
  ) {
    type Presence = OrdinaryEntityPresence<K, E>;
    const physical = physicalPlacement ?? structuralStore.preparePlacement();
    if (!physicalPlacement)
      for (const effect of physicalEffects) {
        if (typeof effect.subjectId !== 'number') continue;
        const id = effect.subjectId;
        const placement = realizationPlacement(effect) ?? effect,
          context = placement.structuralContext;
        if (effect.structural === 'remove') physical.remove(id);
        else if (effect.structural === 'add')
          physical.insert(
            id,
            effect.after as K,
            context && context.kind !== 'rekey'
              ? context.beforeSubject
              : undefined,
            context && context.kind !== 'rekey'
              ? context.afterSubject
              : undefined
          );
        else if (effect.structural === 'rekey') {
          physical.rekey(id, effect.after as K);
          if (realizationPlacement(effect))
            physical.insert(
              id,
              effect.after as K,
              context && context.kind !== 'rekey'
                ? context.beforeSubject
                : undefined,
              context && context.kind !== 'rekey'
                ? context.afterSubject
                : undefined
            );
        }
      }
    const placement = ordinaryTopology.preparePlacement(
      structuralStore.preparePlacement()
    );
    const orderBefore = ordinaryOrder ? placement.snapshot() : undefined;
    const episodes = new Map<number, OrdinaryRestorationPlacement>();
    const staged = new Map<number, Presence>();
    const physicalValues = new Map<number, E>();
    const changes: CommittedEntityMutation[] = [];
    const read = (subject: number): Presence => {
      const row = placement.read(subject);
      if (!row.present) return { present: false };
      const known = staged.get(subject);
      return {
        ...row,
        value: known?.present
          ? known.value
          : (valueStore.ordinaryForSubject(subject) as E),
      };
    };
    for (const effect of effects) {
      if (typeof effect.subjectId !== 'number') continue;
      const subject = effect.subjectId;
      const previous = read(subject);
      const storedContext = effect.structuralContext;
      let context =
        effect.structural === 'add' || effect.structural === 'remove'
          ? storedContext && storedContext.kind !== 'rekey'
            ? {
                ...storedContext,
                kind: effect.structural,
                key: (effect.structural === 'add'
                  ? effect.after
                  : effect.before) as K,
              }
            : undefined
          : effect.structural === 'rekey'
          ? {
              kind: 'rekey' as const,
              subject,
              beforeKey: effect.before as K,
              afterKey: effect.after as K,
            }
          : undefined;
      if (context?.kind === 'remove') {
        episodes.delete(subject);
        placement.remove(subject);
        staged.set(subject, { present: false });
        changes.push({
          subject,
          before: previous.present ? previous.value : context.value,
          after: undefined,
          structural: true,
          path: `${basePath}.${String(context.key)}`,
          structuralRecord: context,
        });
      } else if (context?.kind === 'add') {
        // Replace the last surviving episode without moving any value operation.
        episodes.delete(subject);
        episodes.set(subject, { subject, beforeSubject: context.beforeSubject, afterSubject: context.afterSubject });
        const value = deepClone(context.value) as E;
        placement.insert(
          subject,
          context.key as K,
          context.beforeSubject,
          context.afterSubject
        );
        const resolved = placement.read(subject);
        if (resolved.present)
          context = {
            ...context,
            beforeSubject: resolved.beforeSubject,
            afterSubject: resolved.afterSubject,
          };
        staged.set(subject, {
          present: true,
          key: context.key as K,
          value,
          beforeSubject: context.beforeSubject,
          afterSubject: context.afterSubject,
        });
        physicalValues.set(
          subject,
          (physicalAfter?.get(subject) ??
            (structuralStore.activeKeyForSubject(subject) === undefined
              ? value
              : valueStore.backingForSubject(subject))) as E
        );
        changes.push({
          subject,
          before: undefined,
          after: value,
          structural: true,
          path: `${basePath}.${String(context.key)}`,
          structuralRecord: { ...context, value },
        });
      } else if (context?.kind === 'rekey') {
        if (!previous.present)
          throw new Error('Ordinary rekey realization lacks its lifetime');
        placement.rekey(subject, context.afterKey as K);
        staged.set(subject, { ...previous, key: context.afterKey as K });
        changes.push({
          subject,
          before: previous.value,
          after: previous.value,
          structural: true,
          path: `${basePath}.${String(context.beforeKey)}`,
          structuralRecord: context,
        });
      } else if (!effect.structural) {
        if (!previous.present)
          throw new Error('Ordinary field realization lacks its lifetime');
        const segments = effect.subjectFieldSegments;
        if (segments === undefined || segments.length > 1)
          throw new Error(
            'Ordinary realization requires an explicit top-level field address'
          );
        let value: E;
        if (segments.length === 0) value = deepClone(effect.after) as E;
        else {
          value = { ...previous.value };
          if (effect.fieldPresence?.after !== false)
            Object.defineProperty(value, segments[0], {
              value: deepClone(effect.after),
              enumerable: true,
              configurable: true,
              writable: true,
            });
          else delete value[segments[0]];
        }
        staged.set(subject, { ...previous, value });
        const beforeP =
          physicalValues.get(subject) ?? valueStore.backingForSubject(subject);
        let afterP = physicalAfter?.get(subject) as E | undefined;
        if (afterP === undefined) {
          if (segments.length === 0) afterP = value;
          else {
            afterP = { ...beforeP } as E;
            if (effect.fieldPresence?.after !== false)
              Object.defineProperty(afterP, segments[0], {
                value: deepClone(effect.after),
                enumerable: true,
                configurable: true,
                writable: true,
              });
            else delete afterP[segments[0]];
          }
        }
        physicalValues.set(subject, afterP);
        changes.push({
          subject,
          before: previous.value,
          after: value,
          structural: false,
          path: `${basePath}.${String(previous.key)}`,
        });
      }
    }
    const valueTransitions: EntityValueTransition<E>[] = [];
    for (const [subject, state] of staged) {
      if (!state.present) continue;
      const physical = (physicalAfter?.get(subject) ??
        physicalValues.get(subject) ??
        valueStore.backingForSubject(subject)) as E;
      valueTransitions.push(
        Object.freeze({
          subject,
          physicalBefore: valueStore.backingForSubject(subject),
          physicalAfter: physical,
          ordinaryBefore: valueStore.ordinaryForSubject(subject),
          ordinaryAfter: state.value,
          retainDivergence: !deepEqual(state.value, physical),
        })
      );
    }
    const ordinaryPlacements = resolveOrdinaryRestorationPlacement(placement, episodes);
    if (ordinaryOrder) placement.orderDomain(ordinaryOrder);
    const installPlacement = ordinaryTopology.prepareInstall(
      placement,
      physical
    );
    const ordinaryEndpoints =
      ordinaryOrder && orderBefore
        ? Object.freeze({
            before: Object.freeze(
              orderBefore.filter((subject) => ordinaryOrder.includes(subject))
            ),
            after: Object.freeze([...ordinaryOrder]),
            domain: ordinaryOrder,
          })
        : undefined;
    const publication=prepareEntityPublication(
      physicalEffects.flatMap(effect=>typeof effect.subjectId==='number'?[{subject:effect.subjectId,before:effect.before,after:effect.after,fields:effect.subjectFieldSegments?.length===0?null:effect.subjectFieldSegments??[],structural:effect.structuralContext}]:[]),
      changes.map(change=>({...change,fields:change.structural?null:publicationFields(change.before,change.after),structural:change.structuralRecord})),
      undefined,ordinaryEndpoints?.after,false,undefined,undefined,undefined,ordinaryPlacements
    );
    if(publication.unit)markEntityPublicationFacts(changes,publication.id);
    const finalize=()=>publication.unit?.finalize?.();
    const phase=publicationPhase ?? new PublicationPreparation();
    phase.add(finalize,()=>publication.unit?.validate?.());if(!publicationPhase)phase.seal();
    let completed=false;
    const complete=()=>{if(completed)return;completed=true;if(publication.unit)entityPublication.complete(publication.unit.completion);};
    return {
      complete,
      changes,
      ordinaryEndpoints,
      interval: installPlacement.interval,
      install: () => {
        if(!publicationPhase)phase.validate();
        // Both realization callers install the complete physical unit first.
        // Preserve its backing; this plan installs only ordinary authority.
        for (const transition of valueTransitions)
          valueStore.installOrdinaryValueTransition(transition);
        for (const [subject, state] of staged)
          if (!state.present) valueStore.dischargeOrdinaryValue(subject);
        installPlacement();
        if(publication.unit)installTerminalRecord(publication.unit.record);
        advanceInstalledRead();
        if(!publicationPhase)complete();
      },
    };
  }

  type OrdinaryPointPreparation = {
    changes: CommittedEntityMutation[];
    install: ReturnType<typeof ordinaryTopology.prepareInstall>;
    interval: ReturnType<typeof ordinaryTopology.prepareInstall>['interval'];
    ordinaryEndpoints: {
      readonly before: readonly number[];
      readonly after: readonly number[];
      readonly domain?: readonly number[];
    } | undefined;
  };
  type OrdinaryRichPreparation = OrdinaryPointPreparation & {
    byPhysicalSubject: Map<number, readonly CommittedEntityMutation[]>;
    byStep: Array<readonly CommittedEntityMutation[]>;
  };
  function prepareOrdinaryTopology(
    demand: 'point',
    changes: readonly CommittedEntityMutation[],
    physical?: ReturnType<typeof structuralStore.preparePlacement>,
    authoredOrder?: readonly number[],
    authoredDomain?: readonly number[],
    physicalEntries?: PreparedPlacementEntries<K>
  ): OrdinaryPointPreparation;
  function prepareOrdinaryTopology(
    demand: 'rich',
    changes: readonly CommittedEntityMutation[],
    physical?: ReturnType<typeof structuralStore.preparePlacement>,
    authoredOrder?: readonly number[],
    authoredDomain?: readonly number[],
    physicalEntries?: PreparedPlacementEntries<K>
  ): OrdinaryRichPreparation;
  function prepareOrdinaryTopology(
    demand: 'point' | 'rich',
    changes: readonly CommittedEntityMutation[],
    physical = structuralStore.preparePlacement(),
    authoredOrder?: readonly number[],
    authoredDomain?: readonly number[],
    physicalEntries?: PreparedPlacementEntries<K>
  ): OrdinaryPointPreparation | OrdinaryRichPreparation {
    const placement = ordinaryTopology.preparePlacement(
      structuralStore.preparePlacement()
    );
    // Query-only index over the fixed physical preparation; ordinary membership
    // remains sequential and is updated after every private occupancy edit.
    let visibility:
      | ReturnType<typeof createPreparedPlacementVisibility<K>>
      | undefined;
    const inspection = ambientMeta()?.participation === 'inspection';
    const orderBefore =
      !inspection && authoredOrder ? placement.snapshot() : undefined;
    type Presence = OrdinaryEntityPresence<K, E>;
    type Present = Extract<Presence, { present: true }>;
    // These overlays describe the complete prepared ordinary unit. Explicit
    // vacancy must shadow both the installed exception and physical fallback.
    const staged = new Map<number, Presence>();
    const keys = new Map<K, number | undefined>();
    const selected: CommittedEntityMutation[] = [];
    // Only the rich frame consumer needs these per-step/per-subject indexes.
    // Point writes still prepare the same completed ordinary changes and install.
    const byStep: Array<readonly CommittedEntityMutation[]> | undefined =
      demand === 'rich' ? [] : undefined;
    const byPhysicalSubject = demand === 'rich'
      ? new Map<number, readonly CommittedEntityMutation[]>()
      : undefined;
    const read = (subject: number): Presence => {
      const row = placement.read(subject);
      if (!row.present) return { present: false };
      const known = staged.get(subject);
      return {
        ...row,
        value: known?.present
          ? known.value
          : (valueStore.ordinaryForSubject(subject) as E),
      };
    };
    const atKey = (key: K): number | undefined => {
      if (keys.has(key)) return keys.get(key);
      const subject =
        ordinaryTopology.atKey(key) ?? structuralStore.subjectIdForKey(key);
      if (subject === undefined) return undefined;
      const state = read(subject);
      return state.present && state.key === key ? subject : undefined;
    };
    const write = (subject: number, next: Presence): void => {
      const previous = read(subject);
      if (previous.present) keys.set(previous.key, undefined);
      if (!next.present) placement.remove(subject);
      else if (!previous.present)
        placement.insert(
          subject,
          next.key,
          next.beforeSubject,
          next.afterSubject
        );
      else if (previous.key !== next.key) placement.rekey(subject, next.key);
      staged.set(subject, next);
      if (next.present) keys.set(next.key, subject);
      visibility?.setVisible(subject, next.present);
    };
    const record = (
      kind: 'add' | 'remove',
      subject: number,
      state: Present
    ): CommittedEntityMutation => ({
      subject,
      before: kind === 'remove' ? state.value : undefined,
      after: kind === 'add' ? state.value : undefined,
      structural: true,
      path: `${basePath}.${String(state.key)}`,
      structuralRecord: ordinaryPresenceRecord(kind, subject, state),
    });
    for (const change of changes) {
      const effect = change.structuralRecord;
      const ordinary = read(change.subject);
      const group: CommittedEntityMutation[] = [];
      if (inspection) {
        // Freeze pre-install ordinary occupancy, including explicit absence.
        // Physical edits never grant authority over an ordinary destination.

        group.push(change);
      } else if (change.after === undefined) {
        if (ordinary.present)
          group.push(record('remove', change.subject, ordinary));
        write(change.subject, { present: false });
      } else {
        const binds =
          !ordinary.present ||
          effect?.kind === 'add' ||
          effect?.kind === 'rekey';
        if (binds) {
          // Source record or prepared placement proves presence independently
          // of the raw key value; do not replace an explicit nullish key.
          const key = ordinaryAdmissionKey(
            effect,
            physical.read(change.subject)
          ) as K;
          const displaced = atKey(key);
          if (displaced !== undefined && displaced !== change.subject) {
            const state = read(displaced);
            if (!state.present)
              throw new Error(
                'Ordinary occupancy index disagrees with lifetime'
              );
            group.push(record('remove', displaced, state));
            write(displaced, { present: false });
          }
          const resolveAnchor = (
            subject: number | undefined,
            direction: 'beforeSubject' | 'afterSubject'
          ): number | undefined => {
            visibility ??= createPreparedPlacementVisibility(
              physical,
              (id) => placement.read(id).present,
              physicalEntries
            );
            return visibility.resolve(
              subject,
              direction === 'beforeSubject' ? 'before' : 'after',
              change.subject
            );
          };
          const physicalRow = physical.read(change.subject);
          const before =
            effect?.kind === 'add'
              ? effect.beforeSubject
              : physicalRow.present
              ? physicalRow.beforeSubject
              : undefined;
          const after =
            effect?.kind === 'add'
              ? effect.afterSubject
              : physicalRow.present
              ? physicalRow.afterSubject
              : undefined;
          const next: Present = ordinary.present
            ? { ...ordinary, key }
            : {
                present: true,
                key,
                value: deepClone(change.after) as E,
                beforeSubject: resolveAnchor(before, 'beforeSubject'),
                afterSubject: resolveAnchor(after, 'afterSubject'),
              };
          if (!ordinary.present) {
            placement.insert(
              change.subject,
              next.key,
              next.beforeSubject,
              next.afterSubject
            );
            const resolved = placement.read(change.subject);
            if (resolved.present) Object.assign(next, resolved);
            group.push(record('add', change.subject, next));
          } else if (ordinary.key !== key)
            group.push({
              subject: change.subject,
              before: ordinary.value,
              after: ordinary.value,
              structural: true,
              path: `${basePath}.${String(ordinary.key)}`,
              structuralRecord: {
                kind: 'rekey',
                subject: change.subject,
                beforeKey: ordinary.key,
                afterKey: key,
              },
            });
          write(change.subject, next);
        } else {
          group.push({ ...change, before: ordinary.value });
          write(change.subject, { ...ordinary, value: change.after as E });
        }
      }
      if (byPhysicalSubject) {
        const previous = byPhysicalSubject.get(change.subject);
        byPhysicalSubject.set(
          change.subject,
          previous === undefined ? group : [...previous, ...group]
        );
      }
      byStep?.push(group);
      selected.push(...group);
    }
    let ordinaryEndpoints:
      | {
          readonly before: readonly number[];
          readonly after: readonly number[];
          readonly domain?: readonly number[];
        }
      | undefined;
    if (!inspection && authoredOrder) {
      // Explicit order changes permute their admitted domain; omitted ordinary
      // lifetimes retain their slots and are not implicitly removed/adopted.
      const ordered = authoredOrder.filter(
        (subject) => placement.read(subject).present
      );
      const orderAfter = placement.orderDomain(ordered);
      if (orderBefore)
        ordinaryEndpoints = Object.freeze({
          before: orderBefore,
          after: orderAfter,
          domain: Object.freeze([
            ...new Set([
              ...(authoredDomain ?? authoredOrder),
              ...authoredOrder,
            ]),
          ]),
        });
    }
    const installPlacement = ordinaryTopology.prepareInstall(
      placement,
      physical
    );
    const completedChanges = new Map<
      CommittedEntityMutation,
      CommittedEntityMutation
    >();
    const completeChange = (
      change: CommittedEntityMutation
    ): CommittedEntityMutation => {
      const known = completedChanges.get(change);
      if (known) return known;
      const record = change.structuralRecord;
      if (!record || record.kind === 'rekey') return change;
      const state =
        record.kind === 'add'
          ? placement.read(change.subject)
          : placement.base(change.subject);
      if (!state.present) return change;
      const completed = {
        ...change,
        structuralRecord: {
          ...record,
          beforeSubject: state.beforeSubject,
          afterSubject: state.afterSubject,
        },
      };
      completedChanges.set(change, completed);
      return completed;
    };
    if (byPhysicalSubject)
      for (const [subject, group] of byPhysicalSubject)
        byPhysicalSubject.set(subject, group.map(completeChange));
    const completed = selected.map(completeChange);
    if (byPhysicalSubject && byStep) return {
      changes: completed,
      byPhysicalSubject,
      byStep: byStep.map((group) => group.map(completeChange)),
      install: installPlacement,
      interval: installPlacement.interval,
      ordinaryEndpoints,
    };
    return {
      changes: completed,
      install: installPlacement,
      interval: installPlacement.interval,
      ordinaryEndpoints,
    };
  }

  function commitAndProjectEntityMutationFrame(
    frame: EntityMutationFrame<K, E>,
    options?: { advancePhysicalRevision?: boolean; publication?: 'physical' },
    deferCompletion=false
  ) {
    const prepared = prepareEntityMutationFrame(frame, options);
    prepared.finalize();
    prepared.validate();
    const result = prepared.install();
    if(!deferCompletion)prepared.complete();
    return {...result,complete:prepared.complete};
  }

  function prepareEntityMutationFrame(
    frame: EntityMutationFrame<K, E>,
    options?: { advancePhysicalRevision?: boolean; publication?: 'physical' }
  ) {
    const revision = physicalCommitClock?.revision();
    const changes: Array<
      import('./internals/mutation-capture-runtime').CommittedEntityMutation
    > = [];
    const valueTransitions = new Map<
      PreparedValueReplacement<K, E>,
      EntityValueTransition<E>
    >();
    const valueResults = new Map<number, EntityValueTransition<E>>();
    for (const mutation of frame.mutations) {
      if (mutation.kind !== 'replace-value') continue;
      const previous = valueResults.get(mutation.subjectId);
      const prepared = valueStore.prepareValueTransition(
        mutation.subjectId,
        mutation.nextValue,
        mutation.authoredFields === 'realization' ? undefined : mutation.authoredFields,
        previous
      );
      valueTransitions.set(mutation, prepared);
      valueResults.set(
        mutation.subjectId,
        previous
          ? Object.freeze({
              ...prepared,
              physicalBefore: previous.physicalBefore,
              ordinaryBefore: previous.ordinaryBefore,
            })
          : prepared
      );
    }
    // Only fresh subjects need the pre-install tail. Preserve the sampling
    // boundary before record cloning, using the existing constant-time index.
    const hasFreshSubjects = frame.mutations.some(
      (mutation) => mutation.kind === 'create-fresh-subject'
    );
    const tailKey = hasFreshSubjects
      ? structuralStore.lastActiveKey()
      : undefined;
    let tail =
      tailKey === undefined
        ? undefined
        : structuralStore.subjectIdForKey(tailKey);
    const changeIndexByMutation = new Map<unknown, number>();
    const physicalValuesByStep=new Map<number,EntityValueTransition<E>>();
    const restoredByStep = new Map<number,ReadonlyMap<string,NativeFieldEndpoint>>();
    const authoredByStep = new Map<number, import('./internals/entity-publication').EntityAuthoredFootprint>();
    for (const m of frame.mutations) {
      changeIndexByMutation.set(m, changes.length);
      const key =
        'key' in m ? m.key : structuralStore.activeKeyForSubject(m.subjectId);
      const before = valueStore.backingForSubject(m.subjectId);
      const path = `${basePath}.${String(key)}`;
      if (m.kind === 'replace-value') {
        authoredByStep.set(changes.length, authoredFootprint(m.authoredFields));
        if(m.restoredFields)restoredByStep.set(changes.length,m.restoredFields);
        const transition = valueTransitions.get(m)!;
        physicalValuesByStep.set(changes.length,transition);
        changes.push({
          subject: m.subjectId,
          before: transition.ordinaryBefore,
          after: transition.ordinaryAfter,
          structural: false,
          path,
        });
      } else if (m.kind === 'create-fresh-subject') {
        changes.push({
          subject: m.subjectId,
          before: undefined,
          after: m.nextValue,
          structural: true,
          path,
          structuralRecord: {
            kind: 'add',
            subject: m.subjectId,
            key: m.key,
            value: deepClone(m.nextValue),
            beforeSubject: tail,
          },
        });
        tail = m.subjectId;
      } else if (m.kind === 'tombstone-subject') {
        const neighbors = getNeighborSubjects(m.key);
        changes.push({
          subject: m.subjectId,
          before,
          after: undefined,
          structural: true,
          path,
          structuralRecord: {
            kind: 'remove',
            subject: m.subjectId,
            key: m.key,
            value: deepClone(before),
            ...neighbors,
          },
        });
      } else if (m.kind === 'transfer-key') {
        changes.push({
          subject: m.subjectId,
          before,
          after: before,
          structural: true,
          path: `${basePath}.${String(m.fromKey)}`,
          structuralRecord: {
            kind: 'rekey',
            subject: m.subjectId,
            beforeKey: m.fromKey,
            afterKey: m.toKey,
          },
        });
      }
    }
    const physicalPlacement = frame.preparePlacement();
    // Capture after all placement edits; both consumers use this exact stage.
    const physicalEntries = physicalPlacement.capturePatch();
    for (let index = 0; index < changes.length; index++) {
      const change = changes[index];
      if (change.structuralRecord?.kind !== 'add') continue;
      const row = physicalPlacement.read(change.subject);
      if (row.present)
        changes[index] = {
          ...change,
          structuralRecord: {
            ...change.structuralRecord,
            beforeSubject: row.beforeSubject,
            afterSubject: row.afterSubject,
          },
        };
    }
    const ordinaryPlan = prepareOrdinaryTopology(
      'rich',
      changes,
      physicalPlacement,
      frame.ordinaryOrder,
      frame.orderEndpoints?.before,
      physicalEntries
    );
    const valueResultsByStep = frame.mutations.map((mutation) => {
      if (mutation.kind !== 'replace-value') return undefined;
      const transition = valueTransitions.get(mutation)!;
      return Object.freeze({
        ...transition,
        ordinaryChanges:
          ordinaryPlan.byStep[changeIndexByMutation.get(mutation)!],
      });
    });
    for (const [subject, transition] of valueResults) {
      valueResults.set(
        subject,
        Object.freeze({
          ...transition,
          ordinaryChanges: ordinaryPlan.byPhysicalSubject.get(subject),
        })
      );
    }
    // Constant-size evidence paired with membership responsibility, not a
    // snapshot of the collection or a new ordering authority.
    const structuralFrontier =
      physicalPlacement.patch.size > 0 &&
      !frame.mutations.some((mutation) => mutation.kind === 'restore-subject')
        ? {
            before: structuralStore.activeOrderFrontier(),
            after: undefined as unknown,
          }
        : undefined;
    const physicalInterval =
      ordinaryTopology.prepareInterval(physicalPlacement, physicalEntries);
    const physicalBeforeToken = structuralStore.activeOrderFrontier();
    const topologyUnit = Object.freeze({
      id: Object.freeze({}),
      order: frame.orderEndpoints
        ? Object.freeze({
            beforeSubjects: frame.orderEndpoints.before,
            afterSubjects: frame.orderEndpoints.after,
            ordinaryEndpoints: ordinaryPlan.ordinaryEndpoints
              ? Object.freeze({
                  ...ordinaryPlan.ordinaryEndpoints,
                  beforeToken: ordinaryPlan.interval.before,
                  afterToken: ordinaryPlan.interval.after,
                })
              : undefined,
          })
        : undefined,
      physical: Object.freeze({
        ...physicalInterval,
        before: physicalBeforeToken,
        after: physicalInterval.pairs.length ? {} : physicalBeforeToken,
      }),
      ordinary: ordinaryPlan.interval,
    });
    if (structuralFrontier)
      structuralFrontier.after = topologyUnit.physical.after;
    // Whole replacement offers equal supplied fields to native endpoint selection.
    // This publication domain does not change native value effects or physical diffs.
    const ordinaryPublicationByChange = new Map<
      import('./internals/mutation-capture-runtime').CommittedEntityMutation,
      EntityPublicationEdit
    >();
    const publicationSteps = changes.map((change, ordinal) => {
      const footprint = authoredByStep.get(ordinal);
      return {
        ordinal,
        authoredFootprint: footprint,
        authoredRemoval: options?.publication !== 'physical' && change.structuralRecord?.kind === 'remove'
          ? {...change, fields:null, structural:change.structuralRecord} : undefined,
        ordinary: (ordinaryPlan.byStep[ordinal] ?? []).map(effect => {
          const changedFields = effect.structural ? null : publicationFields(effect.before, effect.after);
          const fields = !effect.structural && footprint?.kind === 'whole'
            ? Object.freeze([...new Set([...(changedFields ?? []), ...Object.keys(effect.after ?? {})])])
            : changedFields;
          const edit = {...effect, restoredFields:restoredByStep.get(ordinal), fields, structural:effect.structuralRecord};
          ordinaryPublicationByChange.set(effect, edit);
          return edit;
        }),
      };
    });
    const publication=prepareEntityPublication(
      changes.map((change,ordinal)=>{const physical=physicalValuesByStep.get(ordinal);return {...change,before:physical?physical.physicalBefore:change.before,after:physical?physical.physicalAfter:change.after,fields:change.structural?null:publicationFields(physical?physical.physicalBefore:change.before,physical?physical.physicalAfter:change.after),structural:change.structuralRecord};}),
      ordinaryPlan.changes.map(change=>ordinaryPublicationByChange.get(change)??({...change,fields:change.structural?null:publicationFields(change.before,change.after),structural:change.structuralRecord})),
      frame.orderEndpoints?.after,ordinaryPlan.ordinaryEndpoints?.after,false,
      publicationSteps,
      entityPublication.requestsSeed()?(()=>{
        const fresh=new Map(frame.mutations.flatMap(mutation=>mutation.kind==='create-fresh-subject'?[[mutation.subjectId,mutation.nextValue] as const]:[]));
        return physicalPlacement.snapshot().map(subjectId=>{
          const placement=physicalPlacement.read(subjectId);if(!placement.present)throw new Error('Prepared acquisition seed is absent');
          const row=valueResults.get(subjectId)?.physicalAfter??fresh.get(subjectId)??valueStore.backingForSubject(subjectId);
          return {subjectId,key:placement.key,row};
        });
      })():undefined,
      prepareResponsibilityCapture(ordinaryPlan.changes, topologyUnit, structuralFrontier)
    );
    if(publication.unit){
      markEntityPublicationFacts(ordinaryPlan.changes,publication.id);
      markEntityPublicationFacts(topologyUnit,publication.id);
      for(const facts of ordinaryPlan.byPhysicalSubject.values())markEntityPublicationFacts(facts,publication.id);
      for(const facts of ordinaryPlan.byStep)markEntityPublicationFacts(facts,publication.id);
    }
    for(const [subject,transition] of valueResults) valueResults.set(subject,Object.freeze({...transition,publicationUnit:publication.unit?publication.id:undefined}));
    for(let i=0;i<valueResultsByStep.length;i++){const transition=valueResultsByStep[i];if(transition)valueResultsByStep[i]=Object.freeze({...transition,publicationUnit:publication.unit?publication.id:undefined});}
    const responsibility = undefined;
    if (physicalCommitClock?.revision() !== revision)
      throw new Error(
        'Entity frame responsibility preparation reentered installation'
      );
    const observe = committedEntityObserver(
      structuralFrontier,
      ordinaryPlan.changes,
      topologyUnit
    );

    let installed = false;
    let consumed = false;
    let completed = false;
    let releaseMembership: (() => void) | undefined;
    const observations: Array<() => void> = [];
    const resultOf = (result: ReturnType<typeof frame.commit>) => ({
      ...result, valueResults, valueResultsByStep,
      ordinaryChanges: ordinaryPlan.byPhysicalSubject,
      ordinaryEndpoints: ordinaryPlan.ordinaryEndpoints,
      topologyUnit, orderEndpoints: frame.orderEndpoints,
    });
    return {
      validate(){publication.unit?.validate?.();if(physicalCommitClock?.revision()!==revision)throw new Error('Entity prepared source revision changed');},
      finalize(){publication.unit?.finalize?.();if(physicalCommitClock?.revision()!==revision)throw new Error('Entity finalization reentered installation');},
      install() {
        if (consumed || physicalCommitClock?.revision() !== revision)
          throw new Error('Prepared entity source is stale or consumed');
        consumed = true;
        const result = frame.commit(
          observe ? () => observe(ordinaryPlan.changes, delivery => observations.push(delivery)) : undefined,
          responsibility, structuralFrontier, valueTransitions,
          () => { ordinaryPlan.install(); if (publication.unit) installTerminalRecord(publication.unit.record); advanceInstalledRead(); installed = true; }
        );
        if (options?.advancePhysicalRevision !== false) physicalCommitClock?.advance();
        // Capture installed facts inside their actual bulk unit. Delivery belongs
        // to detached completion, so sibling facts precede listener reentry.
        if (membershipTap) {
          releaseMembership = holdEntityMembershipDelivery(api);
          membershipTap(MEMBERSHIP_FACTS, frame.mutations, frame.orderEndpoints);
        }
        return resultOf(result);
      },
      complete() {
        if (!installed || completed) return;
        completed = true;
        let failed = false; let first: unknown;
        const attempt = (body: () => void) => { try { body(); } catch (error) { if (!failed) { failed = true; first = error; } } };
        try {
          for (const delivery of observations) attempt(delivery);
          attempt(() => { if (publication.unit) entityPublication.complete(publication.unit.completion); });
          for (const mutation of frame.mutations) {
            if (mutation.kind === 'retire-retained-value' && mutation.forgetLifetime) {
              const subject = mutation.subjectId;
              entityPublication.requestRetirement(subject, () => resolveSubjectState(subject) === undefined && !ordinaryTopology.retains(subject));
            }
          }
          const removed = [...new Set(frame.mutations.filter(mutation => mutation.kind === 'tombstone-subject').map(mutation => mutation.subjectId))];
          attempt(() => reclaimRetiredSubjectsWithoutOwner(removed));
        } finally {
          observations.length = 0;
          attempt(() => releaseMembership?.());
          releaseMembership = undefined;
        }
        if (failed) throw first;
      },
    };
  }

  function withSuppliedEntityRow<T>(row:E, body:()=>T):T {
    return withEntityPublicationInput(entityPublication,physicalRowSubjects.get(row),undefined,body);
  }
  function nativePredicate(predicate:(row:E)=>boolean,row:E):boolean {
    return withSuppliedEntityRow(row,()=>predicate(row));
  }
  /** Reactive signals for queries — all derived, none eagerly maintained. */
  const computeAll = (): E[] => {
    const entities = presentEntities();
    // `sortComparer` gives `all`/`ids` a stable sorted order (parity with
    // @ngrx/entity); `map` keeps insertion order.
    if (config.sortComparer) {const compare=config.sortComparer;entities.sort((a,b)=>withSuppliedEntityRow(a,()=>withSuppliedEntityRow(b,()=>compare(a,b))));}
    return entities;
  };
  const allSignal: ReadableCell<E[]> = createVersionedProjection(computeAll);
  // O(1) — this used to be `entities.length` on a freshly built array.
  const computeCount = (): number =>
    absent() ? 0 : structuralStore.activeKeyCount();
  const countSignal: ReadableCell<number> =
    createVersionedProjection(computeCount);
  /**
   * ⚠️ INSIDE A TAP, A PROJECTION IS READ FRESH (v16 8f). A tap runs inside
   * its write, and inside a grouped write (a transaction, a reversal) the
   * cached projections hear of it only when the group ends: read through them,
   * a tap saw the collection as it was before the group. While a tap runs, a
   * projection is handed out as an uncached reader of the same computation.
   * It still reads `version`, so a derived computed inside a tap (a snapshot,
   * an adapter's computed) depends on the collection as the cached projection
   * would. Outside taps this is one comparison per access.
   */
  const fresh = <T>(read: () => T): ReadableCell<T> => {
    const current = (): T => {
      version();
      return read();
    };
    return locations.createCurrentReadonly(current);
  };
  const inTap = <T>(cell: ReadableCell<T>, read: () => T): ReadableCell<T> =>
    taps.depth ? fresh(read) : cell;
  // Identity-stable across value-only writes: the key snapshot is shared until
  // the list or a key changes, so the copy (and every consumer) is reused.
  let idsSource: readonly K[] | undefined;
  let idsValue: K[] = [];
  // `all` is the cached projection or, in a tap, the fresh one (v16 8f).
  const computeIds = (all: () => E[]): K[] => {
    if (absent()) return [];
    if (config.sortComparer) return all().map((e) => selectId(e));
    const keys = structuralStore.activeKeysSnapshot();
    if (keys !== idsSource) {
      idsSource = keys;
      idsValue = [...keys];
    }
    return idsValue;
  };
  const idsSignal: ReadableCell<K[]> = createVersionedProjection(() =>
    computeIds(allSignal)
  );
  // Still a copy: callers may hold the result across mutations and must not
  // see it change underneath them. But it is paid on read, not on write.
  const computeMap = (): ReadonlyMap<K, E> => new Map(presentEntries());
  const mapSignal: ReadableCell<ReadonlyMap<K, E>> =
    createVersionedProjection(computeMap);

  /**
   * Per-entity signals — the body-granular reactivity layer.
   *
   * Each entity that is read via `byId()`/node access gets its own
   * `Location<E | undefined>`. Per-entity field reads and `node()` depend ONLY
   * on this location, not on the whole-collection `mapSignal`, so
   * updating one entity dirties only that entity's readers (fan-out 1) instead
   * of every entity's computeds (fan-out N). Collection queries (`all`, `map`,
   * `count`, `ids`, `where`, `find`, computed slices) still depend on the
   * collection signals and recompute on any change — which is correct.
   *
   * Materialized lazily (on first `byId`/node access) and kept O(1) per
   * mutation by only syncing the entities that actually changed.
   */
  /**
   * `SUBJECT-EPOCH-0`. One stable reactive anchor per REALIZED subject, held
   * strongly and deliberately.
   *
   * This replaces `entitySignals`, a full `Location<E>` per subject holding a
   * copy of the entity. That copy was never the durable record —
   * `getEntitySignal` seeded every cell from
   * `valueStore.backingForSubject(subjectId)` — so it was authority duplicated
   * into the framework. Reads now take a dependency here and then read
   * `EntityValueStore` directly, which is the only copy.
   *
   * STRONG on purpose, and that is the design. `ENTITY-SIGNAL-SEMANTIC-0`
   * proved a weakly held carrier is unsafe: a non-live Angular `computed` does
   * not retain its producers, so `computed(() => rows.byId(k)?.()?.x)` loses
   * its carrier to a collection and silently freezes. An epoch is cheap enough
   * to simply keep — 562 B/entity against 1,248 B for the `Location` it
   * replaces — so reachability is guaranteed by retention rather than hoped
   * for.
   */
  const subjectEpochs = new Map<number, EpochHandle>();
  /**
   * `ANGULAR-NATIVE-EPOCH-0`. Advance through the RUNTIME, never by writing the
   * handle. A framework-supplied handle belongs to its adapter; the kernel
   * assuming it could write one is what left Vue's epoch permanently dead.
   */
  const advanceEpochHandle = (handle: EpochHandle): void => {
    locations.advanceEpoch?.(handle);
  };
  const structuralStore = new StructuralStore<K>();
  /**
   * Membership observation seam (`entityMembershipReader`, internals only):
   * undefined until a reader first observes this collection. Each structural
   * operation then reports its facts once (see `entity-membership-source.ts`);
   * nothing is derived, retained or delivered here.
   */
  let membershipTap: EntityMembershipTap | undefined;
  /** One observed unit for a compound operation (prepend = add + move). */
  function withMembershipGroup<R>(run: () => R): R {
    const tap = membershipTap;
    tap?.(MEMBERSHIP_OPEN);
    try {
      return run();
    } finally {
      tap?.(MEMBERSHIP_CLOSE);
    }
  }
  const valueStore = new EntityValueStore<E>();
  const ordinaryTopology = new EntityOrdinaryTopology<K>();
  /**
   * `SUBJECT-STATE-SEMANTIC-0`. Held WEAKLY.
   *
   * This carrier has no durable semantic value. Its number is a nonce: nothing
   * reads it, `currentKey` only subscribes to it, and the durable truth it
   * stands for is `structuralStore.subjectRevision`. So there is nothing here
   * to persist — only a carrier to FIND while something is still listening.
   *
   * Strongly held, it was the single largest item in the released residue: a
   * full `Location<number>` per realized subject, measured at 1,249 B/entity of
   * a 2,709 B residue. Weak, a released subject keeps a `WeakRef` and a `Map`
   * entry instead.
   *
   * THE INVARIANT. Every public dependency on subject structural state also
   * depends on a SECOND, permanently retained reactive path, so invalidation
   * reaches an observer that holds nothing here. That path is now
   * [[subjectEpochs]]: `tombstoneSubjectSignal` stages an epoch advance, and
   * the epoch is strong.
   *
   * It is NOT true that live consumers retain this carrier. Angular does not
   * give that property: measured across a forced GC, a `computed` closing over
   * the node retains its carrier, but `computed(() => rows.byId(k)?.()?.x)` —
   * an equally live observer that re-resolves each evaluation — does NOT, and
   * its carrier is collected. `ENTITY-SIGNAL-SEMANTIC-0` records the attempt
   * that proved it, by removing the stable path and watching that exact shape
   * freeze.
   *
   * So this stays safe only while the epoch stays strong, and the entry here is
   * replaced only when `deref()` comes back empty.
   */
  const subjectStateSignals = new Map<number, WeakRef<Location<number>>>();
  const ownerMetadataEnabled = options?.ownerMetadataEnabled ?? true;
  const subjectMetadataEnabled =
    options?.subjectMetadataEnabled ?? ownerMetadataEnabled;
  const positionMetadataEnabled = options?.positionMetadataEnabled ?? true;
  const hasRestorationAuthority = options?.hasRestorationAuthority ?? true;
  const ownerId = options?.ownerId;
  const entityPublication = new EntityPublicationSource();
  options?.onDispose?.(() => entityPublication.dispose());
  const physicalCommitClock = options?.physicalCommitClock;
  const mutationCaptureRuntime = options?.mutationCaptureRuntime;
  let positionId = (
    options?.positionIdAllocator ??
    (positionMetadataEnabled
      ? entityPositionIdAllocatorOverride ?? standaloneEntityPositionIdAllocator
      : undefined)
  )?.();
  let lastSubjectIds: number[] | undefined;

  type PendingStructuralEffect = StructuralEffect;
  type PendingAddStructuralEffect = Extract<
    PendingStructuralEffect,
    { kind: 'add' }
  >;

  // Callable intent belongs to this producer's egress footprint. Do not stamp
  // generic causal metadata: that would change transaction dependency policy.
  let callableWriteIntent: 'replace' | 'derive' | undefined;
  function withCallableWriteIntent(
    intent: 'replace' | 'derive',
    write: () => void
  ): void {
    const previous = callableWriteIntent;
    callableWriteIntent = intent;
    try {
      write();
    } finally {
      callableWriteIntent = previous;
    }
  }
  function consumeCallableWriteIntent(): 'replace' | 'derive' | undefined {
    const intent = callableWriteIntent;
    callableWriteIntent = undefined;
    return intent;
  }

  /**
   * The ambient write context, ALWAYS carrying this collection's owning tree.
   *
   * Every meta this file builds goes through here rather than calling
   * `ambientMeta()` directly, so a new notification site cannot
   * silently omit the namespace — which is how OWNER-REPLAY-2's defect existed
   * across eighteen sites at once.
   */
  function ambientMeta(): WriteMetadata | undefined {
    const active = getActiveWriteContext();
    if (ownerId === undefined) return active;
    return { ...(active ?? {}), ownerId };
  }

  function getPositionIds(): number[] | undefined {
    if (positionId === undefined) {
      const registry = getPositionRegistry(api);
      if (registry) {
        const allocated = registry.allocate();
        registry.registerCollectionPath(allocated, basePath);
        const address = getNodeAddress(proxy);
        if (address) registry.registerPositionAddress(allocated, address);
        positionId = allocated;
      }
    }
    return positionId === undefined ? undefined : [positionId];
  }

  function getPositionIdsForNotify(): number[] | undefined {
    return entityPositionIdNotifyEnabled &&
      (positionId !== undefined || mutationCaptureRuntime?.isCaptureActive())
      ? getPositionIds()
      : undefined;
  }

  function createStructuralEffectMeta(
    effect: PendingStructuralEffect,
    ordinaryChanges?: readonly CommittedEntityMutation[]
  ): WriteMetadata {
    const meta = ambientMeta();
    const physical = { ...(meta ?? {}), structuralEffect: effect };
    return ordinaryChanges === undefined
      ? physical
      : withEntityOrdinaryChanges(physical, ordinaryChanges);
  }

  /**
   * ST2026 — the inline-predicate trap, caught in dev.
   *
   * `where`/`find` memoise per predicate IDENTITY, so the natural template form
   *
   *     @for (row of tree.$.rows.where(r => !r.done)(); track row.id) { … }
   *
   * allocates a NEW arrow on every change-detection cycle, misses the cache
   * every time, and re-filters the whole collection. Measured over 1,000
   * entities: 0.27ms with a hoisted predicate against 20.54ms inline — **75x**.
   *
   * It is not a leak (the cache is a `WeakMap`; 50,000 inline calls retain ~0MB
   * after forced GC) which is exactly why it needs a diagnostic: nothing grows,
   * nothing breaks, the app is simply slow forever.
   *
   * Detection is by SOURCE TEXT plus RATE, and the rate half is load-bearing.
   *
   * Byte-identical source across many distinct identities is necessary but NOT
   * sufficient: `v => v.x > threshold`, rebuilt whenever `threshold` changes, has
   * identical source too. Counting identities alone cannot tell the two apart,
   * and it eventually accuses BOTH — the first version of this warned after 12
   * distinct identities however long they took to accumulate, so a legitimately
   * dynamic predicate warned during any long session, and the advice it gave
   * ("hoist it") was actively wrong for that shape, because the closure really
   * does differ each time.
   *
   * Rate separates them cleanly, and it is derivable rather than guessed. The
   * trap is driven by CHANGE DETECTION, so it produces a new identity every CD
   * cycle — tens per second. A predicate rebuilt from user input or a filter
   * control produces one per interaction, which is orders of magnitude slower.
   * Anything above ~6/second is a frame loop; nothing a user does reaches it.
   */
  // Initialize only when a development-only call is actually made. This also
  // supports enabling diagnostics after a collection has been constructed.
  let warnOnPredicateChurn: ReturnType<typeof createPredicateChurnWarning<E>> | undefined;

  /** Subjects that have moved to a new key and must not fall back to the old one. */
  const rekeyedSubjects = new Set<number>();

  function planRekey(
    from: K,
    to: K,
    vacatingKeys?: ReadonlySet<K>
  ): {
    readonly recipe: EntityStructureOperation;
    commit(options?: { advancePhysicalRevision?: boolean; publication?: 'physical' }): void;
    publish(metaOverride?: WriteMetadata): void;
  } {
    const entity = getProjectedEntity(from);
    if (!entity) {
      throw new Error(`Entity with id ${String(from)} not found`);
    }
    if (from === to) {
      // A no-op rekey still ADDRESSES this subject, and the leaf-signal
      // interceptor fires on every mutator call — including one that changes
      // nothing. Every sibling mutator narrows the latch unconditionally, so
      // the no-op must too: leaving the latch at the previous write's
      // participation set lets a no-op rekey re-publish a bulk write's
      // subject inventory into the capture bucket of whatever designated
      // write shares the tick. RESTORATION-REKEY-CLAIM-WIDTH-0.
      const noOpSubjectId = allocateSubjectId(from);
      return {
        recipe:{kind:'rekey',subject:noOpSubjectId,from,key:to,value:entity},
        commit(): void {
          lastSubjectIds = [noOpSubjectId];
        },
        publish(): void {
          // no-op
        },
      };
    }
    if (structuralStore.hasActiveKey(to) && !vacatingKeys?.has(to)) {
      throw new Error(`Cannot change id to ${String(to)}: already in use`);
    }

    return planPreparedRekey(from, to, allocateSubjectId(from), entity);
  }

  function planPreparedRekey(
    from: K,
    to: K,
    subjectId: number,
    entity: E,
    placement?: { beforeSubject?: number; afterSubject?: number }
  ): {
    readonly recipe: EntityStructureOperation;
    commit(options?: { advancePhysicalRevision?: boolean; publication?: 'physical' }): void;
    publish(metaOverride?: WriteMetadata): void;
  } {
    if (from === to && !placement) {
      // Same rule as `planRekey`'s no-op branch: the interceptor fires on the
      // call, so the latch must name the addressed subject even when the
      // rekey changes nothing. RESTORATION-REKEY-CLAIM-WIDTH-0.
      return {
        recipe:{kind:'rekey',subject:subjectId,from,key:to,value:entity,placement},
        commit(): void {
          lastSubjectIds = [subjectId];
        },
        publish(): void {
          // no-op
        },
      };
    }

    let ordinaryChanges: readonly CommittedEntityMutation[] | undefined;
    const structuralEffect: PendingStructuralEffect = {
      kind: 'rekey',
      subject: subjectId,
      beforeKey: from,
      afterKey: to,
    };

    return {
      recipe:{kind:'rekey',subject:subjectId,from,key:to,value:entity,placement},
      commit(options?: { advancePhysicalRevision?: boolean; publication?: 'physical' }): void {
        const transfer: PreparedKeyTransfer<K> = {
          kind: 'transfer-key',
          placement,
          fromKey: from,
          toKey: to,
          subjectId,
        };
        const frame = createEntityMutationFrame();
        if (
          placement &&
          !deepEqual(valueStore.backingForSubject(subjectId), entity)
        )
          frame.stageValueReplacement({
            kind: 'replace-value',
            key: from,
            subjectId,
            nextValue: entity,
            authoredFields: 'realization',
          });
        frame.stageKeyTransfer(transfer);
        const result = commitAndProjectEntityMutationFrame(frame, options, true);
        ordinaryChanges = result.ordinaryChanges.get(subjectId);
        for (const changedSubjectId of result.physicallyChangedSubjectIds) {
          publishSubjectPhysicalChange(changedSubjectId);
        }
        rekeyedSubjects.add(subjectId);
        // Narrow last-write participation to the one rekeyed subject. The
        // leaf-signal interceptor re-reads `__subjectIds` after `changeId`
        // returns; without this it reports every subject of the prior
        // collection write as a participant, and restoration then retains a
        // claim per live subject. Sibling mutators all narrow this latch.
        // RESTORATION-REKEY-CLAIM-WIDTH-0.
        lastSubjectIds = [subjectId];

        if (activeIdValue === from) {
          replaceLocation(activeIdSignal, to);
        }

        syncEntitySignal(to);
        updateSignals(result.complete);
      },
      publish(metaOverride?: WriteMetadata): void {
        const meta = metaOverride ?? ambientMeta();
        pathNotifier.notify(
          `${basePath}.${String(to)}`,
          entity,
          entity,
          basePath,
          [subjectId],
          getPositionIdsForNotify(),
          ordinaryChanges === undefined
            ? { ...meta, structuralEffect }
            : withEntityOrdinaryChanges(
                { ...meta, structuralEffect },
                ordinaryChanges
              )
        );
      },
    };
  }

  /** Active-entity selection. See the `activeId`/`activeEntity` accessors. */
  // Keep the source-owned selection readable while grouped publication is held.
  // The realization still controls dependency tracking and observer delivery.
  let activeIdValue: K | undefined;
  const activeIdSignal = locations.createWritable<K | undefined>(
    () => activeIdValue,
    (next) => {
      if (Object.is(activeIdValue, next)) return false;
      activeIdValue = next;
      return true;
    }
  ).location;
  const readActiveId = (): K | undefined => {
    activeIdSignal();
    return activeIdValue;
  };
  let cachedActiveEntity: ReadableCell<E | undefined> | undefined;

  function publishOrderChange(
    beforeSubjects: readonly number[],
    afterSubjects: readonly number[],
    beforeFrontier: unknown,
    afterFrontier: unknown = structuralStore.activeOrderFrontier(),
    ordinaryEndpoints?: {
      readonly before: readonly number[];
      readonly after: readonly number[];
      readonly domain?: readonly number[];
    },
    selectedDisposition = false,
    topologyUnit?: import('./internals/mutation-capture-runtime').CompletedTopologyUnit
  ): void {
    if (positionId === undefined) return;
    mutationCaptureRuntime?.publishCollectionOrder?.({
      owner: positionId,
      ownerPath: basePath,
      beforeSubjects,
      afterSubjects,
      beforeFrontier,
      afterFrontier,
      ordinaryEndpoints:
        ordinaryEndpoints && topologyUnit
          ? {
              ...ordinaryEndpoints,
              beforeToken: topologyUnit.ordinary.before,
              afterToken: topologyUnit.ordinary.after,
            }
          : ordinaryEndpoints,
      topologyUnit,
      meta: (()=>{const meta=selectedDisposition?withSelectedEntityDisposition(ambientMeta(),[]):ambientMeta();const unit=topologyUnit&&entityPublicationFactsUnit(topologyUnit);return unit?withEntityPublicationUnit(meta,unit):meta;})(),
    });
  }

  function resolveSubjectId(id: K): number | undefined {
    return structuralStore.subjectIdForKey(id);
  }

  function resolveSubjectState(
    subjectId: number
  ): SubjectLifetimeRecord<K> | undefined {
    return structuralStore.stateForSubject(subjectId);
  }

  function getSubjectRevision(subjectId: number): number {
    return structuralStore.subjectRevision(subjectId);
  }

  function bumpSubjectRevision(subjectId: number): void {
    structuralStore.bumpSubjectRevision(subjectId);
  }

  /** Get (or lazily create) the per-entity signal, seeded from storage. */
  /** Stage an advance only for a subject something has actually realized. */
  function stageSubjectEpoch(subjectId: number): void {
    const epoch = subjectEpochs.get(subjectId);
    if (epoch) pendingSubjectEpochs.add(epoch);
  }

  /** Materialized lazily: a subject nobody has read has no epoch. */
  function getSubjectEpoch(subjectId: number): EpochHandle {
    let epoch = subjectEpochs.get(subjectId);
    if (!epoch) {
      epoch = locations.createEpoch ? locations.createEpoch() : neutralEpoch();
      subjectEpochs.set(subjectId, epoch);
    }
    return epoch;
  }

  function neutralEpoch(): EpochHandle {
    const cell = locations.createCell(0);
    const epoch = (() => cell()) as WritableCell<number>;
    epoch.set = (value: number) => cell(value);
    epoch.update = (fn: (current: number) => number) => cell(fn);
    epoch.asReadonly = () => cell;
    return epoch as unknown as EpochHandle;
  }

  /**
   * Take the stable dependency, then read the ONE copy of the value.
   *
   * Order matters: canonical stores are written by `install()` before
   * `publish()` advances any epoch, so a reader can observe a new value before
   * its invalidation, but never an invalidation before its value.
   */
  function readSubjectEntity(subjectId: number): E | undefined {
    getSubjectEpoch(subjectId)();
    return rowAbsent() ? undefined : valueStore.backingForSubject(subjectId);
  }

  function readEntityByKey(id: K): E | undefined {
    const subjectId = resolveSubjectId(id);
    if (subjectId === undefined) return presentEntity(id);
    return readSubjectEntity(subjectId);
  }

  function getSubjectStateSignal(subjectId: number): Location<number> {
    const existing = subjectStateSignals.get(subjectId)?.deref();
    if (existing) return existing;
    // Starting a replacement back at 0 is sound precisely because the value is
    // a nonce: every observer that could have compared against the old count
    // was retaining the old carrier, which is why this branch was not taken.
    const created = locations.createCell(0);
    subjectStateSignals.set(subjectId, new WeakRef(created));
    return created;
  }

  function bumpSubjectStateSignal(subjectId: number): void {
    // Publish only to an activation token that already exists. Interning here
    // would recreate eager realization through the write path: any subject that
    // is ever mutated would acquire a token whether or not anything observes it.
    const signal = subjectStateSignals.get(subjectId)?.deref();
    if (signal) deriveLocation(signal, (value) => value + 1);
  }

  function publishSubjectPhysicalChange(subjectId: number): void {
    bumpSubjectRevision(subjectId);
    bumpSubjectStateSignal(subjectId);
  }

  function allocateSubjectId(id: K): number {
    const existing = structuralStore.subjectIdForKey(id);
    if (existing !== undefined) {
      return existing;
    }

    return commitFreshSubject(id);
  }

  function commitFreshSubject(id: K): number {
    const subjectId = structuralStore.allocateFreshSubjectId();
    // This internal identity fallback can install physical membership. It has
    // no authored ordinary footprint; preserve ordinary answers before links move.
    const physical = structuralStore.preparePlacement();
    const ordinary = ordinaryTopology.preparePlacement(
      structuralStore.preparePlacement()
    );
    physical.insert(subjectId, id);
    const installOrdinary = ordinaryTopology.prepareInstall(ordinary, physical);
    structuralStore.createSubject(subjectId, id);
    installOrdinary();
    physicalCommitClock?.advance();
    return subjectId;
  }

  /**
   * `UPDATEONE-FAST-0`. The single-subject form of `rememberSubjectIds`, which
   * allocates twice for one id — once for the caller's `[id]` literal and once
   * for `.map`.
   */
  function rememberSubjectId(id: K): number {
    const resolved = allocateSubjectId(id);
    lastSubjectIds = [resolved];
    return resolved;
  }

  /**
   * The value-replacement commit for a subject that already exists.
   *
   * NOT yet a single shared implementation, and the distinction matters.
   * `valueStore.retainSubjectValue` IS the true primitive and both routes call
   * it; what is duplicated is the REVISION advance, which happens here for the
   * fast path and in `commitAndProjectEntityMutationFrame` for the frame path.
   * Behaviour is equivalent and pinned by
   * `entity-update-one-equivalence.spec.ts`, which runs against both — but two
   * call sites advance the physical clock, so a change to revision semantics
   * has to find both.
   *
   * CLEANUP OWED: have `EntityMutationFrame`'s `replace-value` instruction go
   * through this function, or move the advance into `retainSubjectValue`, so
   * there is one place that decides what a value replacement costs.
   *
   * Admissible ONLY when the mutation is exactly one value replacement with no
   * structural consequence: the subject exists, keeps its SubjectId and
   * lifetime, does not change key, ordering, membership or structural owner,
   * and nothing is created, restored or retired. `updateOne` is that case by
   * construction — it stages one `replace-value` and nothing else — which is
   * why it can call this directly rather than testing for it.
   *
   * Profiled: the frame path cost `entity-mutation-frame.commit` 20.3% of
   * `updateOne` plus 9.4% GC, because `commit()` allocates a prepared-
   * instruction array, a `Set` and an id array per mutation regardless of size.
   * For a one-field update that machinery is the mutation.
   */
  function updateOnePrivate(id: K, changes: Partial<E>, inverseClaim?: ClaimedFieldEndpoint): void {
    validateSelectedEntry(inverseClaim, structuralStore.subjectIdForKey(id));
      const callableIntent = consumeCallableWriteIntent();
      const entity = presentEntity(id);
      if (!entity) {
        throw new Error(`Entity with id ${String(id)} not found`);
      }

      const prev = entity;

      // Run interceptors
      let transformedChanges = changes;
      for (const handler of interceptHandlers) {
        const ctx: InterceptContext<Partial<E>> = {
          block: (reason?: string) => {
            throw new Error(
              `Cannot update entity: ${reason || 'blocked by interceptor'}`
            );
          },
          transform: (value: Partial<E>) => {
            transformedChanges = value;
          },
          blocked: false,
          blockReason: undefined,
        };
        assertSynchronousInterceptorResult(
          handler.onUpdate?.(id, changes, ctx),
          'onUpdate'
        );
      }

      const finalUpdated = { ...entity, ...transformedChanges };
      if(inverseClaim?.preparation){stageSelected(id,prev,finalUpdated,Object.keys(transformedChanges),inverseClaim);return;}
      // One value replacement, no structural consequence — commit it directly.
      // See `commitExistingSubjectValue` for why this is the whole case.
      const subjectIdForWrite = rememberSubjectId(id);
      const transition = commitExistingSubjectValue(
        subjectIdForWrite,
        finalUpdated,
        Object.keys(transformedChanges),
        selectedInverseField(inverseClaim,subjectIdForWrite,finalUpdated,id)
      );
      syncEntitySignal(id);
      updateSignals(transition.complete);

      // Notify PathNotifier
      pathNotifier.notify(
        `${basePath}.${String(id)}`,
        finalUpdated,
        prev,
        basePath,
        lastSubjectIds,
        getPositionIdsForNotify(),
        withEntityValueTransition(ambientMeta(), transition),
        undefined,
        (callableIntent ?? getActiveWriteContext()?.mutationIntent) === 'derive'
          ? undefined
          : Object.keys(transformedChanges)
      );

      // Run tap handlers
      emitTap('onUpdate', id, transformedChanges, finalUpdated);
  }
  function replaceOnePrivate(id: K, entity: E, inverseClaim?: ClaimedFieldEndpoint): void {
    validateSelectedEntry(inverseClaim, structuralStore.subjectIdForKey(id));
      const callableIntent = consumeCallableWriteIntent();
      const prev = presentEntity(id);
      if (!prev) {
        throw new Error(`Entity with id ${String(id)} not found`);
      }

      let next = entity;
      let interceptorReplaced = false;
      for (const handler of interceptHandlers) {
        const ctx: InterceptContext<Partial<E>> = {
          block: (reason?: string) => {
            throw new Error(
              `Cannot replace entity: ${reason || 'blocked by interceptor'}`
            );
          },
          transform: (value: Partial<E>) => {
            interceptorReplaced = true;
            next = value as E;
          },
          blocked: false,
          blockReason: undefined,
        };
        assertSynchronousInterceptorResult(
          handler.onUpdate?.(id, entity as Partial<E>, ctx),
          'onUpdate'
        );
      }

      const subjectId = structuralStore.subjectIdForKey(id);
      if (subjectId === undefined) {
        throw new Error(`Entity with id ${String(id)} has no subject id`);
      }

      if(inverseClaim?.preparation){
        const materialized={...next};
        // Row-shaped certified removal is not whole authorship. An explicit
        // public replacement transform retains its whole authored domain.
        const fields=interceptorReplaced ? null : [inverseClaim.field];
        stageSelected(id,prev,materialized,fields,inverseClaim);return;
      }
      const mutationIntent =
        callableIntent ?? getActiveWriteContext()?.mutationIntent;
      const replacement: PreparedValueReplacement<K, E> = {
        kind: 'replace-value',
        key: id,
        subjectId,
        nextValue: next,
        authoredFields: mutationIntent === 'derive' ? 'derive' : null,
        restoredFields:selectedInverseField(inverseClaim,subjectId,next,id),
      };
      const frame = createEntityMutationFrame();
      frame.stageValueReplacement(replacement);
      const committed = commitAndProjectEntityMutationFrame(frame, undefined, true);
      const transition = committed.valueResults.get(subjectId);
      // Derive preparation stages accessors once; every subsequent consumer
      // observes that same physical value rather than reevaluating the input.
      next = transition?.physicalAfter ?? next;
      syncEntitySignal(id);
      updateSignals(committed.complete);
      pathNotifier.notify(
        `${basePath}.${String(id)}`,
        next,
        prev,
        basePath,
        // REPLACE-ONE-SUBJECT-1. This was `undefined`, and it was the ONLY
        // entity notification in this file that dropped subject identity —
        // `updateOne`, `updateMany` and `removeOne` all pass theirs. The id
        // above is DATA; `subjectId` is IDENTITY, and it was already resolved
        // from `structuralStore` a few lines up, so nothing new is looked up
        // here.
        //
        // Without it, reversal effects arrive with `subjectId: undefined`,
        // `hasInlineSubjectAddress` is false, no inline subject address is
        // derived, and no fallback descriptor can be keyed — so rollback and
        // undo both REFUSE, at TOP level as well as nested.
        [subjectId],
        getPositionIdsForNotify(),
        withEntityValueTransition(
          ambientMeta(),
          committed.valueResults.get(subjectId)
        ),
        undefined,
        (callableIntent ?? getActiveWriteContext()?.mutationIntent) === 'derive'
          ? undefined
          : null
      );
      emitTap('onUpdate', id, next as Partial<E>, next);
  }
  function validateSelectedEntry(selection: ClaimedFieldEndpoint | undefined, subject: number | undefined, field?: string): void {
    if (selection && (selection.source !== entityPublication || selection.subject !== subject || field !== undefined && selection.field !== field))
      throw new Error('Selected replacement does not match intended source lifetime/field');
  }
  function selectedInverseField(claim:ClaimedFieldEndpoint|undefined,subject:number,value:E,key:K):ReadonlyMap<string,NativeFieldEndpoint>|undefined {
    if(!claim)return undefined;
    if(claim.source!==entityPublication||claim.subject!==subject||Object.prototype.hasOwnProperty.call(value,claim.field)!==claim.endpoint.present||claim.endpoint.present&&!deepEqual(value[claim.field],claim.endpoint.value))
      throw new Error('Inverse endpoint changed during setter preparation');
    // Equality can evaluate user getters; revalidate the active lifetime afterwards.
    validateSelectedEntry(claim, structuralStore.subjectIdForKey(key));
    return new Map([[claim.field,claim.endpoint]]);
  }
  function authoredFootprint(scope: readonly string[] | null | 'derive' | 'realization'): import('./internals/entity-publication').EntityAuthoredFootprint {
    if (scope === null) return Object.freeze({kind:'whole'});
    if (scope === 'derive') return Object.freeze({kind:'derive'});
    if (scope === 'realization') return Object.freeze({kind:'realization'});
    return Object.freeze({kind:'fields',fields:Object.freeze([...scope])});
  }
  function publicationFields(before: unknown, after: unknown, explicit?: readonly string[] | null): readonly string[] | null {
    if(explicit !== undefined) return explicit;
    const a=before && typeof before==='object'?before as Record<string,unknown>:{};
    const b=after && typeof after==='object'?after as Record<string,unknown>:{};
    return Object.freeze([...new Set([...Object.keys(a),...Object.keys(b)])].filter(key=>Object.prototype.hasOwnProperty.call(a,key)!==Object.prototype.hasOwnProperty.call(b,key)||!Object.is(a[key],b[key])));
  }
  function prepareResponsibilityCapture(
    changes: readonly CommittedEntityMutation[],
    topologyUnit: import('./internals/mutation-capture-runtime').CompletedTopologyUnit,
    structuralFrontier?: import('./internals/mutation-capture-runtime').StructuralFrontierInterval
  ): import('./internals/mutation-capture-runtime').CommittedEntityCapture | undefined {
    // Publication support is always prepared. Its optional responsibility
    // consumer alone needs this owner-bearing capture; rich observers acquire
    // their own capture through committedEntityObserver below.
    if (!mutationCaptureRuntime?.prepareEntityResponsibility) return undefined;
    const owner = getPositionIds()?.[0];
    if (owner === undefined) return undefined;
    return { owner, ownerPath: basePath, meta: ambientMeta(), changes, topologyUnit, structuralFrontier };
  }

  function prepareEntityPublication(physical: readonly EntityPublicationEdit[], ordinary: readonly EntityPublicationEdit[], physicalOrder?: readonly number[], ordinaryOrder?: readonly number[], point=false, steps?: readonly EntityPublicationStep[],seed?:readonly EntityProjectionSeedEntry<K,E|undefined>[],capture?:import('./internals/mutation-capture-runtime').CommittedEntityCapture,ordinaryPlacements?:readonly OrdinaryRestorationPlacement[]) {
    const id=Object.freeze({});
    const unit=(point?entityPublication.preparePoint.bind(entityPublication):entityPublication.prepare.bind(entityPublication))({id,owner:ownerId??-1,ordinaryPlacements,meta:ambientMeta(),prepareResponsibility:capture?fieldSelections=>mutationCaptureRuntime?.prepareEntityResponsibility?.({...capture,fieldSelections}):undefined,seed,physical,steps:ambientMeta()?.participation==='inspection'?undefined:steps?.map(step=>({...step,physical:step.physical??physical.slice(step.ordinal,step.ordinal+1)})),ordinary:ambientMeta()?.participation==='inspection'?[]:ordinary,physicalOrder,ordinaryOrder:ambientMeta()?.participation==='inspection'?undefined:ordinaryOrder,inputs:currentEntityPublicationInputs()});
    return {id,unit};
  }
  function commitExistingSubjectValue(
    subjectId: number,
    nextValue: E,
    fields: readonly string[] | null,
    restoredFields?:ReadonlyMap<string,NativeFieldEndpoint>
  ): EntityValueTransition<E> & {complete():void} {
    const revision = physicalCommitClock?.revision();
    const transition = valueStore.prepareValueTransition(
      subjectId,
      nextValue,
      fields
    );
    const ordinaryPlan = prepareOrdinaryTopology('point', [
      {
        subject: subjectId,
        before: transition.ordinaryBefore,
        after: transition.ordinaryAfter,
        structural: false,
        path: `${basePath}.${String(
          structuralStore.activeKeyForSubject(subjectId)
        )}`,
      },
    ]);
    const currentPhysicalToken = structuralStore.activeOrderFrontier();
    const topologyUnit = Object.freeze({
      id: Object.freeze({}),
      physical: Object.freeze({
        before: currentPhysicalToken,
        after: currentPhysicalToken,
        pairs: Object.freeze([]),
      }),
      ordinary: ordinaryPlan.interval,
    });
    const publication = prepareEntityPublication(
      [{subject:subjectId,before:transition.physicalBefore,after:transition.physicalAfter,fields:publicationFields(transition.physicalBefore,transition.physicalAfter,fields)}],
      ordinaryPlan.changes.map(change=>({...change,restoredFields,fields:publicationFields(transition.physicalBefore,transition.physicalAfter,fields),structural:change.structuralRecord})),
      undefined,undefined,false,[{ordinal:0,authoredFootprint:authoredFootprint(fields),ordinary:ordinaryPlan.changes.map(change=>({...change,restoredFields,fields:publicationFields(transition.physicalBefore,transition.physicalAfter,fields),structural:change.structuralRecord}))}],undefined,prepareResponsibilityCapture(ordinaryPlan.changes, topologyUnit)
    );
    const capture = committedEntityObserver(
      undefined,
      ordinaryPlan.changes,
      topologyUnit
    );
    const plan = undefined;
    if (physicalCommitClock?.revision() !== revision)
      throw new Error(
        'Entity responsibility preparation reentered installation'
      );
    publication.unit?.finalize?.();
    publication.unit?.validate?.();
    valueStore.installValueTransition(transition);
    ordinaryPlan.install();
    if (plan) installTerminalRecord(plan);
    if(publication.unit) installTerminalRecord(publication.unit.record);
    advanceInstalledRead();
    const observations:Array<()=>void>=[];
    capture?.(ordinaryPlan.changes,delivery=>observations.push(delivery));
    physicalCommitClock?.advance();
    let completed=false;
    const complete=()=>{if(completed)return;completed=true;let failed=false,first:unknown;
      for(const deliver of [...observations,()=>{if(publication.unit)entityPublication.complete(publication.unit.completion);}])try{deliver();}catch(error){if(!failed){failed=true;first=error;}}
      observations.length=0;if(failed)throw first;
    };
    return Object.freeze({
      complete,
      ...transition,
      publicationUnit: publication.unit?publication.id:undefined,
      ordinaryChanges: ordinaryPlan.changes,
    });
  }

  /**
   * Source-owned committed evidence for open transaction/restoration capture.
   *
   * Runs after the physical write it describes and before this collection
   * notifies the path notifier for the operation, so an observer re-entering
   * from notifier delivery of the first row cannot find a later row of the
   * same operation unclaimed. Frame commits and single-row writes report once,
   * after every touched row has applied. The batch writers (`upsertMany`,
   * `clear`, `setAll`) report row by row, interleaved only with staged epoch
   * and state-token publications, which a transaction callback's invalidation
   * group defers until the callback returns. Attribution is frozen here,
   * before any callback can change the ambient write context. Pay-for-use:
   * undefined unless an observer is active.
   */
  function committedEntityObserver(
    structuralFrontier?: import('./internals/mutation-capture-runtime').StructuralFrontierInterval,
    preparedChanges?: readonly CommittedEntityMutation[],
    topologyUnit?: import('./internals/mutation-capture-runtime').CompletedTopologyUnit
  ): ((changes: readonly CommittedEntityMutation[], deferObservation?: (delivery: () => void) => void) => void) | undefined {
    if (
      !mutationCaptureRuntime?.hasCommittedEntityObservers?.() &&
      !(
        (structuralFrontier ||
          (topologyUnit &&
            (topologyUnit.physical.before !== topologyUnit.physical.after ||
              topologyUnit.ordinary.before !== topologyUnit.ordinary.after))) &&
        mutationCaptureRuntime?.hasStructuralBoundaryObservers?.()
      )
    )
      return undefined;
    const owner = getPositionIds()?.[0];
    if (owner === undefined) return undefined;
    const meta = ambientMeta();
    // Prepare topology facts before physical installation. Payloads are not
    // retained by order composition; only identities and placement are needed.
    const structuralRecords = structuralFrontier
      ? preparedChanges?.flatMap<
          import('./internals/mutation-capture-runtime').StructuralPlacementEvidence
        >((change) => {
          const record = change.structuralRecord;
          if (!record) return [];
          if (record.kind === 'rekey') return [record];
          const { value: _value, ...placement } = record;
          return [placement];
        })
      : undefined;
    return (changes, deferObservation) =>
      mutationCaptureRuntime.publishCommittedEntity?.({
        topologyUnit,
        owner,
        ownerPath: basePath,
        changes,
        structuralFrontier,
        structuralRecords,
        meta,
      }, deferObservation);
  }

  function rememberSubjectIds(ids: K[]): number[] {
    const resolved = ids.map((id) => allocateSubjectId(id));
    lastSubjectIds = resolved;
    return resolved;
  }

  function findKeyBySubjectId(subjectId: number): K | undefined {
    return structuralStore.activeKeyForSubject(subjectId);
  }

  function getNeighborSubjects(id: K): {
    beforeSubject?: number;
    afterSubject?: number;
  } {
    return structuralStore.neighborSubjectsForKey(id);
  }

  function restoreOne(
    key: K,
    entity: E,
    subjectId: number,
    beforeSubject?: number,
    afterSubject?: number
  ): void {
    const planned = planRestore(
      key,
      entity,
      subjectId,
      beforeSubject,
      afterSubject
    );
    planned.commit();
    planned.publish();
  }

  function planRestore(
    key: K,
    entity: E,
    subjectId: number,
    beforeSubject?: number,
    afterSubject?: number,
    /**
     * Keys the caller's frame will vacate before this restore commits.
     * RESTORE-P0 P0-D: the frame's own removals commit BEFORE its restores, so
     * a key listed here is free by the time this plan runs even though it is
     * occupied right now.
     */
    vacatingKeys?: ReadonlySet<string | number>
  ): {
    commit(options?: { advancePhysicalRevision?: boolean; publication?: 'physical' }): void;
    publish(metaOverride?: WriteMetadata): void;
  } {
    // The occupancy check answers "is this key free?" — but the honest question
    // is "will this key be free when I commit?". Undoing a turn that removed
    // 'a' and re-added 'a' produces two effects on two DIFFERENT subjects (a
    // removed key is tombstoned, so re-adding mints a new subject). Reversing
    // them frees 'a' and reclaims it in one frame, and asking the pre-frame
    // question turned a correct undo into a crash.
    if (structuralStore.hasActiveKey(key) && !vacatingKeys?.has(key)) {
      throw new Error(`Entity with id ${String(key)} already exists`);
    }

    const state = resolveSubjectState(subjectId);
    if (state && !state.restoreAllowed) {
      throw new Error(
        `Subject ${String(
          subjectId
        )} has retired backing and cannot be restored.`
      );
    }

    const restoration: PreparedSubjectRestore<K, E> = {
      kind: 'restore-subject',
      key,
      subjectId,
      restoreAllowed: state?.restoreAllowed ?? true,
      beforeSubject,
      afterSubject,
      realizedValue: entity,
    };

    return {
      commit(options?: { advancePhysicalRevision?: boolean; publication?: 'physical' }): void {
        const frame = createEntityMutationFrame();
        frame.stageSubjectRestore(restoration);
        const result = commitAndProjectEntityMutationFrame(frame, options, true);
        for (const changedSubjectId of result.physicallyChangedSubjectIds) {
          publishSubjectPhysicalChange(changedSubjectId);
        }
        lastSubjectIds = [subjectId];
        syncEntitySignal(key);
        updateSignals(result.complete);
      },
      publish(metaOverride?: WriteMetadata): void {
        // A restored lifetime re-enters collection membership. Value-only
        // delivery cannot reinsert it into an observer's collection topology
        // (a Link's egress projection drops a value for an absent subject).
        pathNotifier.notify(
          `${basePath}.${String(key)}`,
          entity,
          undefined,
          basePath,
          [subjectId],
          getPositionIdsForNotify(),
          {
            ...(metaOverride ?? ambientMeta() ?? {}),
            structuralEffect: {
              kind: 'add',
              subject: subjectId,
              key,
              value: deepClone(entity),
              beforeSubject,
              afterSubject,
            },
          }
        );
        emitTap('onAdd', entity, key);
      },
    };
  }

  function planFreshAdd(
    key: K,
    entity: E,
    subjectId: number
  ): {
    commit(options?: { advancePhysicalRevision?: boolean; publication?: 'physical' }): void;
    publish(metaOverride?: WriteMetadata): void;
  } {
    const existingState = resolveSubjectState(subjectId);
    if (existingState) {
      throw new Error(
        `Subject ${String(
          subjectId
        )} already exists and cannot be realized as fresh.`
      );
    }

    return {
      commit(options?: { advancePhysicalRevision?: boolean; publication?: 'physical' }): void {
        const frame = createEntityMutationFrame();
        frame.stageFreshSubject({
          kind: 'create-fresh-subject',
          key,
          subjectId,
          nextValue: entity,
        });
        const committed=commitAndProjectEntityMutationFrame(frame, options,true);
        lastSubjectIds = [subjectId];
        invalidateNodeCache(key);
        syncEntitySignal(key);
        updateSignals(committed.complete);
      },
      publish(metaOverride?: WriteMetadata): void {
        pathNotifier.notify(
          `${basePath}.${String(key)}`,
          entity,
          undefined,
          basePath,
          [subjectId],
          getPositionIdsForNotify(),
          metaOverride
        );
        emitTap('onAdd', entity, key);
      },
    };
  }

  function planRemove(
    key: K,
    subjectId: number
  ): {
    commit(options?: { advancePhysicalRevision?: boolean; publication?: 'physical' }): void;
    publish(metaOverride?: WriteMetadata): void;
  } {
    const entity = getProjectedEntity(key);
    if (!entity) {
      throw new Error(`Entity with id ${String(key)} not found`);
    }

    const { beforeSubject, afterSubject } = getNeighborSubjects(key);
    const structuralEffect: PendingStructuralEffect = {
      kind: 'remove',
      subject: subjectId,
      key,
      value: deepClone(entity),
      beforeSubject,
      afterSubject,
    };
    const currentState = resolveSubjectState(subjectId);
    const tombstone: PreparedSubjectTombstone<K> = {
      kind: 'tombstone-subject',
      key,
      subjectId,
      restoreAllowed: currentState?.restoreAllowed ?? true,
    };

    return {
      commit(options?: { advancePhysicalRevision?: boolean; publication?: 'physical' }): void {
        const frame = createEntityMutationFrame();
        frame.stageSubjectTombstone(tombstone);
        const result = commitAndProjectEntityMutationFrame(frame, options, true);
        for (const changedSubjectId of result.physicallyChangedSubjectIds) {
          publishSubjectPhysicalChange(changedSubjectId);
        }
        lastSubjectIds = [subjectId];
        tombstoneSubjectSignal(subjectId);
        updateSignals(result.complete);
      },
      publish(metaOverride?: WriteMetadata): void {
        pathNotifier.notify(
          `${basePath}.${String(key)}`,
          undefined,
          entity,
          basePath,
          [subjectId],
          getPositionIdsForNotify(),
          {
            ...(metaOverride ?? ambientMeta() ?? {}),
            structuralEffect,
          }
        );

        emitTap('onRemove', key, entity);
      },
    };
  }

  function rewritePendingAddEffect(
    effect: PendingAddStructuralEffect,
    beforeSubject?: number,
    afterSubject?: number
  ): void {
    effect.beforeSubject = beforeSubject;
    effect.afterSubject = afterSubject;
  }

  function assertSynchronousInterceptorFunction(
    handler: unknown,
    hookName: string
  ): void {
    if (
      typeof handler === 'function' &&
      handler.constructor?.name === 'AsyncFunction'
    ) {
      throw new Error(
        `SignalTree: ${hookName} interceptors must be synchronous. ` +
          `Async interceptors cannot safely block a synchronous mutation path. [ST2033]`
      );
    }
  }

  function assertSynchronousInterceptorResult(
    result: void | Promise<void> | undefined,
    hookName: string
  ): void {
    if (result && typeof result.then === 'function') {
      void result.catch(() => undefined);
      throw new Error(
        `SignalTree: ${hookName} interceptors must be synchronous. ` +
          `Async interceptors cannot safely block a synchronous mutation path. [ST2033]`
      );
    }
  }

  function assertSynchronousInterceptors(
    handlers: InterceptHandlers<E, K>
  ): void {
    assertSynchronousInterceptorFunction(handlers.onAdd, 'onAdd');
    assertSynchronousInterceptorFunction(handlers.onUpdate, 'onUpdate');
    assertSynchronousInterceptorFunction(handlers.onRemove, 'onRemove');
  }

  function interceptAddedEntity(entity: E): E {
    // Already run for this call (a re-adding write, below).
    if (interceptsSuppressed) return entity;
    let transformedEntity = entity;
    for (const handler of interceptHandlers) {
      const ctx: InterceptContext<E> = {
        block: (reason?: string) => {
          throw new Error(
            `Cannot add entity: ${reason || 'blocked by interceptor'}`
          );
        },
        transform: (value: E) => {
          transformedEntity = value;
        },
        blocked: false,
        blockReason: undefined,
      };
      assertSynchronousInterceptorResult(handler.onAdd?.(entity, ctx), 'onAdd');
    }

    return transformedEntity;
  }

  /** `setAll`'s whole-row replacement interceptor (a transform replaces it). */
  function interceptReplacedEntity(id: K, entity: E): E {
    // Already run for this call (a re-adding write, below).
    if (interceptsSuppressed) return entity;
    let replacement = entity;
    for (const handler of interceptHandlers) {
      const ctx: InterceptContext<Partial<E>> = {
        block: (reason?: string) => {
          throw new Error(
            `Cannot replace entity: ${reason || 'blocked by interceptor'}`
          );
        },
        transform: (value: Partial<E>) => {
          replacement = value as E;
        },
        blocked: false,
        blockReason: undefined,
      };
      assertSynchronousInterceptorResult(
        handler.onUpdate?.(id, entity as Partial<E>, ctx),
        'onUpdate'
      );
    }
    return replacement;
  }

  function interceptUpdatedEntity(id: K, changes: Partial<E>): Partial<E> {
    // Already run for this call (a re-adding write, below).
    if (interceptsSuppressed) return changes;
    let transformedChanges = changes;
    for (const handler of interceptHandlers) {
      const ctx: InterceptContext<Partial<E>> = {
        block: (reason?: string) => {
          throw new Error(
            `Cannot update entity: ${reason || 'blocked by interceptor'}`
          );
        },
        transform: (value: Partial<E>) => {
          transformedChanges = value;
        },
        blocked: false,
        blockReason: undefined,
      };
      assertSynchronousInterceptorResult(
        handler.onUpdate?.(id, changes, ctx),
        'onUpdate'
      );
    }

    return transformedChanges;
  }

  /** Shared admission/install path; prepend finishes topology before delivery. */
  function addManyInOrder(
    entities: E[],
    opts?: AddManyOptions<E, K>,
    prepend = false
  ): K[] {
    const mode = opts?.mode ?? 'strict';

    // addMany appends: an added row's predecessor is the previous added row,
    // or for the first one the last row before the call. Only that key is
    // needed, not a copy of every key.
    const lastPreviousKey = structuralStore.lastActiveKey();

    // First pass: validate/filter based on mode. The rows apply as if one
    // at a time, so an earlier copy of an id in this call counts as
    // existing: strict throws (before anything is intercepted or written),
    // skip keeps the first copy, overwrite keeps the last in the first
    // copy's place. Two rows under one key was the result in every mode
    // before (v15 778f86ef and e02238f4, carried in v16 8f): prependMany
    // then linked the row to itself and the next read never ended.
    const toProcess: Array<{
      entity: E;
      id: K;
      existingSubjectId?: number;
    }> = [];
    // Every copy that applies, in input order.
    const copies: Array<[(typeof toProcess)[number], E]> = [];
    const earlier = new Map<K, (typeof toProcess)[number]>();
    for (const entity of entities) {
      const id = deriveId(entity, opts);
      const existingSubjectId = structuralStore.subjectIdForKey(id);
      let processed = earlier.get(id);
      if (existingSubjectId !== undefined || processed) {
        if (mode === 'strict') {
          throw new Error(`Entity with id ${String(id)} already exists`);
        } else if (mode === 'skip') {
          continue;
        }
        // 'overwrite': fall through — the projection helper below replaces the existing entry
      }
      if (!processed) {
        processed = { entity, id, existingSubjectId };
        earlier.set(id, processed);
        toProcess.push(processed);
      }
      copies.push([processed, entity]);
    }

    if (toProcess.length === 0) return [];

    // Interceptors run once per applied copy, in input order, as successive
    // single calls would; the last intercepted value wins. Staged before
    // mutating runtime state so a block cannot partially allocate fresh
    // subject lifetimes.
    for (const [processed, entity] of copies) {
      processed.entity = interceptAddedEntity(entity);
    }
    const stagedAdds = toProcess;
    const plannedFreshSubjectIds = structuralStore.planFreshSubjectIds(
      stagedAdds.filter(
        ({ existingSubjectId }) => existingSubjectId === undefined
      ).length
    );
    let plannedFreshIndex = 0;
    const preparedAdds = stagedAdds.map(
      ({ id, entity, existingSubjectId }) => ({
        id,
        entity,
        existingSubjectId,
        // A replacement retains its lifetime; capture what it replaces
        // before the physical frame installs the new value.
        prev:
          existingSubjectId === undefined
            ? undefined
            : valueStore.backingForSubject(existingSubjectId),
        subjectId:
          existingSubjectId ?? plannedFreshSubjectIds[plannedFreshIndex++],
      })
    );

    const beforeFrontier = structuralStore.activeOrderFrontier();
    const frame = createEntityMutationFrame();
    for (const {
      id,
      entity: transformedEntity,
      existingSubjectId,
      subjectId,
    } of preparedAdds) {
      if (existingSubjectId === undefined) {
        frame.stageFreshSubject({
          kind: 'create-fresh-subject',
          key: id,
          subjectId,
          nextValue: transformedEntity,
        });
        continue;
      }

      frame.stageValueReplacement({
        kind: 'replace-value',
        key: id,
        subjectId: existingSubjectId,
        nextValue: transformedEntity,
        authoredFields: null,
      });
    }

    if (prepend) frame.stageFinalFront(preparedAdds.map((row) => row.id));
    const committed = commitAndProjectEntityMutationFrame(frame, undefined, true);
    const subjectIdsByKey = new Map<K, number>();
    for (const { id, subjectId } of preparedAdds) {
      subjectIdsByKey.set(id, subjectId);
    }

    // Process all entities without triggering per-entity signal updates
    const processedIds: K[] = [];
    const addedEntities: Array<{ id: K; entity: E; subjectId: number }> = [];

    for (const { entity: transformedEntity, id } of preparedAdds) {
      const subjectId = subjectIdsByKey.get(id);
      if (subjectId === undefined) {
        throw new Error(`Entity with id ${String(id)} has no subject id`);
      }
      invalidateNodeCache(id);
      syncEntitySignal(id);
      processedIds.push(id);
      addedEntities.push({ id, entity: transformedEntity, subjectId });
    }

    // Finish the compound topology before path observers or taps can copy
    // metadata or flush history. No shared collector or later backpatching.
    updateSignals(committed.complete);
    if (committed.orderEndpoints) {
      if (mutationCaptureRuntime?.isCaptureActive()) getPositionIds();
      publishOrderChange(
        committed.orderEndpoints.before,
        committed.orderEndpoints.after,
        beforeFrontier,
        undefined,
        committed.ordinaryEndpoints,
        false,
        committed.topologyUnit
      );
    }

    const subjectIdsForWrite = processedIds.map((id) => {
      const subjectId = subjectIdsByKey.get(id);
      if (subjectId === undefined) {
        throw new Error(`Entity with id ${String(id)} has no subject id`);
      }
      return subjectId;
    });
    lastSubjectIds = subjectIdsForWrite;

    // Notify PathNotifier for each processed entity.
    //
    // Reproduced on 15.3.1: indexing the pre-add key list at
    // `i + previous - added` anchored [x, y] after k4 and k5 instead of after
    // k5 and x, so redo reinserted them out of order. A fresh row's
    // predecessor is the previous FRESH row of this call, else the last row
    // before it: an 'overwrite' replacement stays where it was, so it is not
    // an anchor for the rows appended after it (v16 refinement of 7463f4eb,
    // which anchored to the previous processed row).
    let previousAppendedSubject =
      lastPreviousKey === undefined
        ? undefined
        : allocateSubjectId(lastPreviousKey);
    for (let i = 0; i < addedEntities.length; i++) {
      const { id, entity } = addedEntities[i];
      const beforeSubject = previousAppendedSubject;
      if (preparedAdds[i].existingSubjectId === undefined) {
        previousAppendedSubject = subjectIdsForWrite[i];
      }
      pathNotifier.notify(
        `${basePath}.${String(id)}`,
        entity,
        preparedAdds[i].prev,
        basePath,
        [subjectIdsForWrite[i]],
        getPositionIdsForNotify(),
        preparedAdds[i].existingSubjectId === undefined
          ? createStructuralEffectMeta(
              {
                kind: 'add',
                subject: subjectIdsForWrite[i],
                key: id,
                value: deepClone(entity),
                ...(prepend ? getNeighborSubjects(id) : { beforeSubject }),
              },
              committed.ordinaryChanges.get(subjectIdsForWrite[i])
            )
          : withEntityValueTransition(
              ambientMeta(),
              committed.valueResults.get(subjectIdsForWrite[i])
            )
      );
    }

    // Run tap handlers for each processed entity
    for (const { id, entity } of addedEntities) {
      emitTap('onAdd', entity, id);
    }

    return processedIds;
  }

  function addOneWithStructuralEffect(
    entity: E,
    opts?: AddOptions<E, K>,
    prepend = false
  ): { id: K; structuralEffect: PendingAddStructuralEffect } {
    const id = deriveId(entity, opts);
    const previousLastKey = structuralStore.lastActiveKey();
    recordProductionSubstrateStat('publicAddPreviousTailReads');

    if (structuralStore.hasActiveKey(id)) {
      throw new Error(`Entity with id ${String(id)} already exists`);
    }

    const transformedEntity = interceptAddedEntity(entity);
    const subjectId = structuralStore.planFreshSubjectIds(1)[0];
    if (subjectId === undefined) {
      throw new Error(
        `Fresh subject planning for ${String(id)} did not produce an id.`
      );
    }

    const frame = createEntityMutationFrame();
    const freshSubject: PreparedFreshSubject<K, E> = {
      kind: 'create-fresh-subject',
      key: id,
      subjectId,
      nextValue: transformedEntity,
    };
    frame.stageFreshSubject(freshSubject);
    if (prepend) frame.stageFinalFront([id]);
    const committed = commitAndProjectEntityMutationFrame(frame, undefined, true);
    const structuralEffect: PendingAddStructuralEffect = {
      kind: 'add',
      subject: subjectId,
      key: id,
      value: deepClone(transformedEntity),
      beforeSubject:
        previousLastKey === undefined
          ? undefined
          : allocateSubjectId(previousLastKey),
    };
    if (prepend) {
      // Complete placement before notifying or invoking onAdd: nested writes
      // must observe the finished outer operation and survive its return.

      const neighbors = getNeighborSubjects(id);
      rewritePendingAddEffect(
        structuralEffect,
        neighbors.beforeSubject,
        neighbors.afterSubject
      );
    }
    lastSubjectIds = [subjectId];
    invalidateNodeCache(id);
    syncEntitySignal(id);
    updateSignals(committed.complete);

    pathNotifier.notify(
      `${basePath}.${String(id)}`,
      transformedEntity,
      undefined,
      basePath,
      [subjectId],
      getPositionIdsForNotify(),
      createStructuralEffectMeta(
        structuralEffect,
        committed.ordinaryChanges.get(subjectId)
      )
    );

    emitTap('onAdd', transformedEntity, id);

    return { id, structuralEffect };
  }

  /**
   * Sync one entity's signal from storage after a mutation. No-op if the
   * entity was never materialized (nothing is observing it yet), keeping
   * single-entity writes O(1) regardless of collection size.
   */
  function syncEntitySignal(id: K): void {
    const subjectId = resolveSubjectId(id);
    if (subjectId === undefined) {
      return;
    }

    stageSubjectEpoch(subjectId);
  }

  /**
   * Release one subject's entity signal on removal: notify current observers
   * that the entity is gone (set undefined). The signal itself is kept keyed by
   * SubjectId so held field references stay valid (they read undefined) and a
   * restore of the same subject re-publishes through the same signal.
   */
  function tombstoneSubjectSignal(subjectId: number): void {
    stageSubjectEpoch(subjectId);
  }

  // TOMBSTONE: `resetEntitySignals()` — a bulk `forEach(set(undefined))` +
  // `clear()` of the signal map, once called by `clear()`. It is gone because
  // dropping the MAP ENTRY is what made `clear()` un-undoable: a held reference
  // reads through the signal it was given, and a restore into a fresh signal is
  // a different subject wearing the same key. `clear()` now tombstones
  // per-subject exactly as `removeOne` does. Do not reintroduce a bulk reset as
  // a memory optimization — reclamation at the retirement boundary already
  // sheds zero-owner entries, and it sheds only the ones nothing can restore.

  /**
   * Cache for entity nodes (deep access proxies), held WEAKLY.
   *
   * `byId()` materialises a per-entity node so that row can be bound and
   * written independently — the whole point of granular reactivity. It used to
   * be a strong `Map`, which meant READING permanently allocated: entries were
   * removed on mutation or removal, but nothing bounded growth from reads.
   *
   * Measured at 10,000 entities: 315 B/entity for the collection, and
   * **4,149 B/entity once `byId()` has been called on every row** — 3.0 MB
   * against 39.6 MB, 46x the data. That is the documented pattern for granular
   * updates, so the recommended usage was the expensive one, and on a low-end
   * device it is the shape that runs a list out of memory.
   *
   * A node should live exactly as long as someone holds it. A `WeakRef` gives
   * that: a node no component retains becomes collectable, and a node nobody
   * holds cannot observe its own identity changing, so the next `byId()` simply
   * builds a fresh one. The `FinalizationRegistry` sweeps the dead map entry so
   * the Map itself does not grow with empty refs.
   *
   * ⚠️ A HELD reference must still survive churn — see
   * entity-granular-reactivity.spec.ts, which pins that a node held across
   * remove -> re-add keeps working. Weakness must not weaken THAT: while a
   * caller holds the node, the WeakRef cannot be cleared, so the existing
   * behaviour is unchanged for every reference anyone can actually observe.
   */
  const nodeCache = new Map<number, WeakRef<EntityNode<E>>>();
  const nodeFinalizer =
    typeof FinalizationRegistry === 'function'
      ? new FinalizationRegistry<number>((subjectId) => {
          // Only drop the slot if it is still the dead ref — a later byId()
          // may already have installed a live replacement.
          if (nodeCache.get(subjectId)?.deref() === undefined) {
            nodeCache.delete(subjectId);
          }
        })
      : null;

  function invalidateNodeCache(id: K): void {
    const subjectId = resolveSubjectId(id);
    if (subjectId !== undefined) {
      nodeCache.delete(subjectId);
    }
  }

  /** Cached `empty` computed — created on first access. */
  let cachedEmpty: ReadableCell<boolean> | null = null;

  /** Function to extract key from entity */
  const selectId: (entity: E) => K =
    config.selectId ??
    ((entity: E) => (entity as unknown as Record<string, K>)['id']);

  // Dev-mode guard state: warn once if entities resolve to a null/undefined id.
  let warnedMissingId = false;

  /**
   * Resolve an entity's id (per-call selectId override → config selectId →
   * default `.id`). Dev-mode guardrail: a null/undefined id means the entity
   * has no `id` field and no `selectId` was provided, so every such entity
   * collides under one key — a common mistake (especially in AI-generated
   * code). Warn once with an actionable fix.
   */
  function deriveId(entity: E, opts?: { selectId?: (e: E) => K }): K {
    const id = opts?.selectId?.(entity) ?? selectId(entity);
    if (
      id == null &&
      (typeof ngDevMode === 'undefined' || ngDevMode) &&
      !warnedMissingId
    ) {
      warnedMissingId = true;
      console.warn(
        `SignalTree entityMap${
          basePath ? ` at "${basePath}"` : ''
        }: an entity ` +
          `resolved to id=${String(
            id
          )}. Entities need a stable key — give them ` +
          `an \`id\` field or pass entityMap({ selectId: (e) => e.yourKey }). ` +
          `Without it, entities collide under a single key. [ST2001]`
      );
    }
    return id;
  }

  /** Handlers for observation */
  const tapHandlers: TapHandlers<E, K>[] = [];
  /**
   * Run every tap's `method`. A tap reads collections as any consumer does:
   * absent-aware, even while a reversal is applied to their tree and its own
   * row writes read hidden rows physically (`taps`, v16 8f).
   */
  const emitTap = <M extends keyof TapHandlers<E, K>>(
    method: M,
    ...args: Parameters<NonNullable<TapHandlers<E, K>[M]>>
  ): void => {
    // A re-adding write re-adds its path before anyone hears of its rows: a
    // tap reads the collection present, as on an empty one (v16 8f review).
    if (pendingReAdd) {
      pendingReAdd = false;
      reactivatePathOnWrite(api);
    }
    // A tap's own writes are ordinary writes: interceptors run for them, even
    // inside a re-adding write that already ran its own (v16 8f review).
    const suppressed = interceptsSuppressed;
    const nested = reAdding;
    interceptsSuppressed = 0;
    reAdding = false;
    taps.depth++;
    try {
      for (const handler of tapHandlers)
        (handler[method] as ((...input: unknown[]) => void) | undefined)?.(
          ...args
        );
    } finally {
      taps.depth--;
      interceptsSuppressed = suppressed;
      reAdding = nested;
    }
  };
  /** A re-adding write already ran this call's interceptors (v16 8f). */
  let interceptsSuppressed = 0;
  /** A re-adding write is running on this collection (v16 8f). */
  let reAdding = false;
  /** It has written its rows and not yet re-added its path. */
  let pendingReAdd = false;
  /** A re-adding write's removal of retained rows: no tap sees it (v16 8e). */
  let silentClear = 0;

  /** Handlers for blocking/transforming */
  const interceptHandlers: InterceptHandlers<E, K>[] = [];

  // ==================
  // INTERNAL HELPERS
  // ==================

  /** Mark the collection dirty. O(1) — see the `version` docs above. */
  function updateSignals(complete?:()=>void): void {
    const pending = [...pendingSubjectEpochs];
    pendingSubjectEpochs.clear();
    // An absent collection reads empty before and after: nothing a consumer
    // reads changed. Its membership hook wakes them when it comes back, so a
    // reversal writing its hidden rows re-runs nobody while those rows are
    // read physically (v16 8e).
    let failed=false,first:unknown;
    const deliver=(run:()=>void)=>{try{run();}catch(error){if(!failed){failed=true;first=error;}}};
    deliver(()=>{if(!absent())locations.runInvalidationGroup(() => {
      for (const epoch of pending) deliver(()=>advanceEpochHandle(epoch));
      deliver(()=>deriveLocation(version, (value) => value + 1));
      deliver(()=>markOwnerInvalidated(ownerId));
    });});
    try{complete?.();}catch(error){if(!failed){failed=true;first=error;}else reportContainedObserverError({error,operation:'notify:subscriber'});}
    if(failed)throw first;
  }

  function createEntityNode(
    subjectId: number,
    initialKey: K,
    entity: E
  ): EntityNode<E> {
    // Entity-level callable:
    //   node()           → reads current entity (reactive via mapSignal)
    //   node(value)      → full entity REPLACE (throws if entity removed)
    //   node(updater)    → replace with the updater's return (throws if removed)
    //
    // These replace, and they always claimed to. Until 14.1.1 they delegated to
    // `updateOne`, which spreads (`{ ...entity, ...changes }`) — so the docs said
    // replace and the code merged. The updater form was the worse half: the
    // updater returns a full `E`, it was spread as `Partial<E>`, so an updater
    // that REMOVED a key left the old value in place and nothing said so.
    //
    // Fixed by changing the CODE, not the comment, and the updater form is why
    // there was no other choice: an updater returns a full `E`, so under merge
    // semantics it is IMPOSSIBLE to express removing a key — the spread puts the
    // old value straight back. Merge cannot host this signature. Either the
    // callable replaces or the updater form has to be deleted.
    //
    // Not `setOne(entity)`: that would derive the key via `selectId(entity)`, and
    // `changeId` can leave `entity.id` disagreeing with the storage key, so it has
    // a silent wrong-slot write built in. The explicit form is `replaceOne(id, next)`,
    // which is public and is what this delegates to.
    //
    // MERGE is still available and still positional: `updateOne(id, changes)` for
    // a patch, or `byId(id).field.set(v)` for one field.
    // Resolve the per-entity signal on EVERY read rather than capturing it
    // once. Capturing it made a held node reference permanently dead across a
    // remove -> re-add of the same id: `removeEntitySignal` deletes the signal
    // from the map, the re-add creates a NEW one, and the captured reference
    // kept reading the orphaned signal — `undefined` forever, while a fresh
    // `byId()` worked. Holding a reference to a nested position is the
    // capability this library has and its competitors do not, so it must
    // survive the collection churning underneath it.
    //
    // Subject reachability is now independent from subject retention. A
    // removed subject becomes structurally unreachable by clearing its active
    // key binding, while the retained subject id, signal, and cached node can
    // survive until a separate restoration or reclamation decision.
    const handle = acquireEntityHandleForTesting(initialKey);
    if (handle === undefined || handle.subjectId !== subjectId) {
      throw new Error(
        `Entity with id ${String(initialKey)} has no acquired subject handle`
      );
    }

    // `SUBJECT-STATE-SEMANTIC-0`. The registry is weak, so THIS closure is what
    // keeps the activation carrier alive: while a caller holds this node, its
    // carrier cannot be collected out from under a pending bump. Captured on
    // first read rather than at node creation, so `byId` alone still realizes
    // nothing.
    let activationCarrier: Location<number> | undefined;
    const currentKey = (): K | undefined => {
      (activationCarrier ??= getSubjectStateSignal(subjectId))();
      const resolved = structuralStore.resolveSubjectHandle(handle);
      return resolved.state === 'active' ? resolved.key : undefined;
    };

    const entitySig = () => {
      const key = currentKey();
      return key === undefined ? undefined : readEntityByKey(key);
    };

    const writeRow = (valueOrUpdater?: E | ((current: E) => E), selection?: ClaimedFieldEndpoint): E | undefined => {
      validateSelectedEntry(selection, subjectId);
      if (valueOrUpdater === undefined) {
        return entitySig();
      }
      const key = currentKey();
      if (key === undefined) {
        throw new Error(`Entity with subject ${String(subjectId)} not found`);
      }
      const current = presentEntity(key);
      if (current === undefined) {
        throw new Error(`Entity with id ${String(key)} not found`);
      }
      const write = () => {
        const next = typeof valueOrUpdater === 'function' ? (valueOrUpdater as (c:E)=>E)(current) : valueOrUpdater;
        withCallableWriteIntent(typeof valueOrUpdater === 'function'?'derive':'replace',()=>replaceOnePrivate(key,next,selection));
      };
      if(typeof valueOrUpdater==='function') withEntityPublicationInput(entityPublication,subjectId,undefined,write);
      else write();
      return undefined;
    };
    const node = ((valueOrUpdater?: E | ((current: E) => E)) => writeRow(valueOrUpdater)) as unknown as EntityNode<E>;

    // A retained row/field belongs to a lifetime, not its mutable storage key.
    // Carry only identities; binding metadata must not retain retired values.
    const registry = getPositionRegistry(api);
    const owner = registry ? getPositionIds()?.[0] : undefined;
    const bindLocation = (location: object, fieldKey?: string): void => {
      if (!registry || owner === undefined) return;
      definePositionRegistry(location, registry);
      defineEntityLocationBinding(location, { owner, subjectId, fieldKey });
      defineEntityPublicationBinding(location,{source:entityPublication,subject:subjectId,field:fieldKey,
        replaceSelected: fieldKey === undefined ? (value, selection) => { writeRow(value as E, selection); } : undefined});
      if (mutationCaptureRuntime) {
        Object.defineProperty(location, MUTATION_CAPTURE_RUNTIME, {
          value: mutationCaptureRuntime,
        });
      }
    };
    bindLocation(node);

    // Field projections derive their read from the subject-owned entity location.
    // Public and selected writes share updateOnePrivate, including interceptors and taps.
    for (const key of Object.keys(entity)) {
      const fieldKey = key as keyof E;
      const computeField = () => {
        const current = entitySig();
        return current &&
          Object.prototype.hasOwnProperty.call(current, fieldKey)
          ? current[fieldKey]
          : undefined;
      };
      const writeField = (
        value: E[typeof fieldKey] | undefined,
        intent: 'replace' | 'derive',
        selection?: ClaimedFieldEndpoint
      ) => {
        validateSelectedEntry(selection, subjectId, String(fieldKey));
        const key = currentKey();
        if (key === undefined) {
          throw new Error(`Entity with subject ${String(subjectId)} not found`);
        }
        withCallableWriteIntent(intent, () =>
          updateOnePrivate(key, { [fieldKey]: value } as Partial<E>, selection)
        );
      };
      const fieldSignal = locations.createWritableProjection
        ? locations.createWritableProjection(computeField, writeField)
        : createWritableProjection(
            locations.createDerived(computeField),
            writeField
          );
      bindLocation(fieldSignal, key);

      if (ownerMetadataEnabled) {
        Object.defineProperty(fieldSignal, '__ownerPath', {
          get: () => {
            const key = currentKey();
            return key === undefined ? undefined : `${basePath}.${String(key)}`;
          },
          enumerable: false,
          configurable: true,
        });
      }
      if (subjectMetadataEnabled) {
        Object.defineProperty(fieldSignal, '__subjectIds', {
          get: () => [subjectId],
          enumerable: false,
          configurable: true,
        });
      }
      if (positionMetadataEnabled) {
        Object.defineProperty(fieldSignal, '__positionIds', {
          get: getPositionIds,
          enumerable: false,
          configurable: true,
        });
      }

      Object.defineProperty(node, key, {
        get: () => fieldSignal,
        enumerable: true,
        configurable: true,
      });
    }

    return node;
  }

  function getOrCreateNode(id: K, entity: E): EntityNode<E> {
    const subjectId = resolveSubjectId(id);
    if (subjectId === undefined) {
      throw new Error(`Entity with id ${String(id)} has no subject id`);
    }

    let node = nodeCache.get(subjectId)?.deref();
    if (!node) {
      node = createEntityNode(subjectId, id, entity);
      nodeCache.set(subjectId, new WeakRef(node));
      nodeFinalizer?.register(node, subjectId);
    }
    return node;
  }

  function inspectSubjectResources(
    subjectId: number
  ): EntitySubjectPhysicalInventory<K> | undefined {
    const subjectState = resolveSubjectState(subjectId);
    if (!subjectState) {
      return undefined;
    }

    const node = nodeCache.get(subjectId)?.deref();
    const fieldFacadesMaterialized =
      node === undefined
        ? []
        : Object.keys(node as Record<string, unknown>)
            .filter(
              (key) =>
                typeof (node as Record<string, unknown>)[key] === 'function'
            )
            .sort((left, right) => left.localeCompare(right));

    return {
      subjectId,
      state: subjectState.active ? 'active' : 'tombstoned',
      subjectRevision: getSubjectRevision(subjectId),
      activeKey: subjectState.active ? subjectState.key : undefined,
      retainedSubjectState: structuralStore.hasSubject(subjectId),
      entitySignal: subjectEpochs.has(subjectId),
      activationToken:
        subjectStateSignals.get(subjectId)?.deref() !== undefined,
      nodeFacadeMaterialized: node !== undefined,
      fieldFacadesMaterialized,
      positionIds: getPositionIds(),
      retainedValueBacking: valueStore.hasRetainedValueBacking(subjectId)
        ? { kind: 'retained-entity-signal' }
        : undefined,
    };
  }

  function listSubjectReclamationCandidates(): readonly number[] {
    return structuralStore
      .tombstonedSubjectsSnapshot()
      .filter((subjectId) => valueStore.hasRetainedValueBacking(subjectId));
  }

  function prepareSubjectReclamation(
    subjectId: number,
    options: EntitySubjectReclamationPlanningOptions
  ): PreparedEntitySubjectReclamation | undefined {
    const inventory = inspectSubjectResources(subjectId);
    if (!inventory) {
      return undefined;
    }

    const plan = planEntitySubjectReclamation(inventory, options);
    if (!plan.eligible) {
      return undefined;
    }

    return {
      subjectId,
      expectedLifetime: 'tombstoned',
      expectedSubjectRevision: inventory.subjectRevision,
      retire: plan.retire,
      retain: plan.retain,
    };
  }

  function applyPreparedSubjectReclamation(
    prepared: PreparedEntitySubjectReclamation
  ): void {
    const state = resolveSubjectState(prepared.subjectId);
    if (prepared.expectedLifetime !== 'tombstoned') {
      throw new Error(
        `Prepared reclamation for subject ${String(
          prepared.subjectId
        )} has an unsupported expected lifetime.`
      );
    }
    if (!state) {
      throw new Error(
        `Prepared reclamation for subject ${String(
          prepared.subjectId
        )} no longer matches active lifetime state.`
      );
    }
    if (
      getSubjectRevision(prepared.subjectId) !==
      prepared.expectedSubjectRevision
    ) {
      throw new Error(
        `Prepared reclamation for subject ${String(
          prepared.subjectId
        )} is stale.`
      );
    }
    if (state.active) {
      throw new Error(
        `Prepared reclamation for subject ${String(
          prepared.subjectId
        )} no longer matches active lifetime state.`
      );
    }

    const frame = createEntityMutationFrame();
    const forgetLifetime = prepared.retire.includes('subject-lifetime-record');
    const retiresValue = prepared.retire.includes('retained-value-backing');
    if (forgetLifetime || retiresValue) {
      // ONE mutation covers both: `retire-retained-value` deletes the value and
      // then either `retireSubject` (keep a `{active:false,
      // restoreAllowed:false}` record) or `forgetSubject` (drop it entirely).
      // Staging it even when there is no value left is what lets a subject
      // whose bytes went earlier still lose its ledger entry.
      const retirement: PreparedRetainedValueRetirement = {
        kind: 'retire-retained-value',
        subjectId: prepared.subjectId,
        forgetLifetime,
      };
      frame.stageRetainedValueRetirement(retirement);
      subjectEpochs.delete(prepared.subjectId);
    }

    const result = commitAndProjectEntityMutationFrame(frame);
    // Shared installed-frame completion requests publication retirement.
    for (const changedSubjectId of result.physicallyChangedSubjectIds) {
      if (forgetLifetime && changedSubjectId === prepared.subjectId) {
        // NO PUBLISH for a forgotten subject, and this is load-bearing rather
        // than an optimization. `publishSubjectPhysicalChange` ->
        // `bumpSubjectRevision` does `subjectRevisions.set(id, ...)`, which
        // RE-INTERNS the entry `forgetSubject` just deleted. Deleting from a
        // Map does not stay deleted if a later step in the same operation
        // interns by the same key.
        //
        // `reclaimRetiredSubjectsWithoutOwner` documents this as the 79 B
        // versus 6 B measurement, and the sink reintroduced it here: with the
        // publish in place `subjectRevisions` grew to one entry per subject
        // ever created — 64,200 at 320 rounds while every other structure sat
        // at 4,200 — and it was the whole remaining retention slope.
        //
        // Nothing is left to notify either: the entity signal was deleted
        // above, and the activation channel is interned lazily, so a subject
        // nobody read has none.
        continue;
      }
      publishSubjectPhysicalChange(changedSubjectId);
    }
  }

  /**
   * ZERO-OWNER RECLAMATION — the only reclamation that runs automatically.
   *
   * When the tree has no restoration authority, a tombstoned subject's retained
   * value backing is unreachable: nothing can undo, roll back, or re-project it,
   * so the bytes are held against a restore that cannot be requested. This
   * releases them at the moment of retirement.
   *
   * ## Why this needs no causal assessment
   *
   * `runPhysicalMaintenance` exists for the hard case and asks a real question —
   * is any turn, pending turn, applied-restoration history entry or redo entry still
   * referencing this subject? Answering it requires a `TurnStore` and an
   * `AppliedTurnProjection`, which a tree without `causal-runtime` does not have. That
   * absence is not a gap to work around; it IS the answer. With no owner there
   * are no turns, so there is nothing a turn could be holding.
   *
   * This is therefore NOT a bypass of the coordinator, and must not grow into
   * one. The moment a tree has restoration authority this function returns
   * immediately, and reclaiming there stays the coordinator's problem — it needs
   * history-aware eligibility, which is a separate piece of work.
   *
   * ## What it reclaims: EVERYTHING physical, the lifetime ledger included
   *
   * The value backing, the entity signal, the subject lifetime record and the
   * revision entry. Retention is 6 B per retired subject, down from 249 B before
   * any reclamation and 117 B when the ledger was kept — and it no longer grows
   * with the number of retirements at all.
   *
   * Keeping the ledger was believed to be what stale-handle isolation rested on.
   * It is not, and that was FALSIFIED rather than assumed: every semantic gate,
   * including the four GC-dependent properties in
   * `check-signal-identity-durability.mjs`, passes with it deleted.
   *
   * Isolation is anchored in SUBJECT identity, not key identity. `nextSubjectId`
   * only increases and `tombstoneSubject` already removed the key -> subject
   * mapping, so a re-add of the same business key is a different subject by
   * construction. A held reference keeps reading `undefined` because the
   * CONSUMER holds the orphaned signal and, with the map entry gone, nothing can
   * ever write to it again.
   *
   * The price, both on internal surfaces: `resolveSubjectHandle` reports
   * `missing` rather than `tombstoned` for a forgotten subject, and the subject
   * leaves `__listSubjectReclamationCandidates` — correct, since it has nothing
   * left to reclaim. `entity-lifetime-ledger-null.spec.ts` pins both.
   *
   * ⚠️ `planRestore`'s "has retired backing and cannot be restored" guard loses
   * its input for a forgotten subject. Acceptable ONLY because a tree with no
   * restoration authority has no reachable restore at all, so the guard becomes
   * unreachable rather than unenforced. If a restorer can exist, none of this
   * runs.
   *
   * See docs/architecture/retired-subject-churn.md and
   * docs/architecture/restoration-ownership-inventory.md.
   */
  function reclaimRetiredSubjectsWithoutOwner(
    subjectIds: readonly number[]
  ): void {
    if (hasRestorationAuthority || subjectIds.length === 0) {
      return;
    }

    const frame = createEntityMutationFrame();
    let staged = 0;
    for (const subjectId of subjectIds) {
      const state = resolveSubjectState(subjectId);
      // Still active means this was not a retirement after all. A missing state
      // means the subject is already gone. Neither is reclaimable.
      if (!state || state.active) {
        continue;
      }
      if (ordinaryTopology.retains(subjectId)) continue;
      if (!valueStore.hasRetainedValueBacking(subjectId)) {
        continue;
      }
      const retirement: PreparedRetainedValueRetirement = {
        kind: 'retire-retained-value',
        subjectId,
        forgetLifetime: true,
      };
      frame.stageRetainedValueRetirement(retirement);
      subjectEpochs.delete(subjectId);
      staged += 1;
    }

    if (staged === 0) {
      return;
    }

    commitAndProjectEntityMutationFrame(frame);

    // DELIBERATELY NO PUBLISH, and this is load-bearing rather than an omission.
    // `publishSubjectPhysicalChange` -> `bumpSubjectRevision` writes
    // `subjectRevisions.set(id, 1)`, which RESURRECTS the entry the forget just
    // deleted — measured at 79 B/retired instead of 6 B until it was found.
    // Deleting from a Map does not stay deleted if a later step in the same
    // operation interns by the same key.
    //
    // There is also nothing left to notify: the entity signal was deleted in the
    // loop above, and the activation token is interned lazily, so a subject
    // nobody read has none.
  }

  function retireSubjectRetainedValueBackingForTesting(
    subjectId: number
  ): void {
    const subjectState = resolveSubjectState(subjectId);
    if (!subjectState || subjectState.active) {
      throw new Error(
        `Subject ${String(
          subjectId
        )} must be tombstoned before retiring retained value backing.`
      );
    }

    valueStore.retireSubjectValue(subjectId);
    subjectEpochs.delete(subjectId);
  }

  // ==================
  // API OBJECT
  // ==================

  // Caches for predicate-based queries. Uses WeakMap keyed by function
  // reference so callers that pass the same function object will receive the
  // same computed Signal instance (reduces redundant computed creation).
  // NOTE: This only works reliably when callers pass stable, named
  // predicate references. Inline anonymous predicates will not be cached.
  const whereCache: WeakMap<
    (entity: E) => boolean,
    ReadableCell<E[]>
  > = new WeakMap();
  const findCache: WeakMap<
    (entity: E) => boolean,
    ReadableCell<E | undefined>
  > = new WeakMap();

  const api = {
    // ==================
    // EXPLICIT ACCESS
    // ==================

    byId(id: K): EntityNode<E> | undefined {
      if (!rowAbsent() && structuralStore.hasActiveKey(id)) {
        // Present: subscribe to the PER-ENTITY signal only, so callers re-run
        // when THIS entity changes but not when others do (body-granular).
        // Materialized lazily here — bounded by the number of live entities.
        const entity = readEntityByKey(id);
        return entity ? getOrCreateNode(id, entity) : undefined;
      }
      // Absent: subscribe to the shared ids signal for "appears later"
      // reactivity WITHOUT materializing a permanent per-entity signal for an
      // id that may never exist (which would leak one signal per probed id).
      idsSignal();
      return undefined;
    },

    byIdOrFail(id: K): EntityNode<E> {
      const node = api.byId(id);
      if (!node) {
        throw new Error(`Entity with id ${String(id)} not found`);
      }
      return node;
    },

    // ==================
    // QUERIES (return Signals)
    // ==================

    get all(): ReadableCell<E[]> {
      return inTap(allSignal, computeAll);
    },

    get count(): ReadableCell<number> {
      return inTap(countSignal, computeCount);
    },

    get ids(): ReadableCell<K[]> {
      return inTap(idsSignal, () => computeIds(computeAll));
    },

    /**
     * The collection as a `ReadonlyMap`, keyed by id.
     *
     * Named `asMap` since 14.1.1. It was `map`, which read as a PROJECTION beside
     * `all()` — every JS developer expects `.map(fn)` to transform elements, and an
     * agent or newcomer reaching for that is a documented failure class (see
     * `WRONG_ENTITY_METHODS`). `asMap` says what it returns.
     */
    get asMap(): ReadableCell<ReadonlyMap<K, E>> {
      return inTap(mapSignal, computeMap);
    },

    // ── Active entity ───────────────────────────────────────────────────────
    get activeId(): ReadableCell<K | undefined> {
      return inTap(activeIdSignal.asReadonly(), readActiveId);
    },

    /**
     * Resolved through the per-entity signal, NOT through `mapSignal`.
     *
     * That is the whole reason to build this here rather than leave it to the
     * app: a hand-rolled `getDerivedRuntime().createDerived(() => all().find(e => id(e) === activeId()))`
     * depends on the entire collection, so it recomputes when ANY row changes.
     * This depends on the active row's own signal, so it recomputes only when
     * that row changes — which is what `byId` exists for.
     */
    get activeEntity(): ReadableCell<E | undefined> {
      const read = () => {
        const id = taps.depth ? readActiveId() : activeIdSignal();
        if (id === undefined) return undefined;
        // A selection names a key even while no subject occupies it. Keep the
        // membership edge only while absent; a present selection stays scoped
        // to its subject, and dependency cleanup drops the old edge on reentry.
        if (resolveSubjectId(id) === undefined) idsSignal();
        return readEntityByKey(id);
      };
      if (taps.depth) return fresh(read);
      return (cachedActiveEntity ??= locations.createDerived(read));
    },

    setActiveId(id: K | undefined): void {
      // Not an error when the id is absent: selection frequently outlives the
      // row (a delete arriving from a socket while a detail pane is open), and
      // `activeEntity` already resolves to undefined in that case.
      const previous = activeIdValue;
      replaceLocation(activeIdSignal, id);
      if (!Object.is(previous, activeIdValue)) markOwnerInvalidated(ownerId);
    },

    clearActiveId(): void {
      const previous = activeIdValue;
      replaceLocation(activeIdSignal, undefined);
      if (!Object.is(previous, activeIdValue)) markOwnerInvalidated(ownerId);
    },

    has(id: K): ReadableCell<boolean> {
      const read = () => !absent() && structuralStore.hasActiveKey(id);
      return taps.depth ? fresh(read) : createVersionedProjection(read);
    },

    // Bare canonical name (the `.isEmpty` alias was removed in v11).
    get empty(): ReadableCell<boolean> {
      if (taps.depth) return fresh(() => computeCount() === 0);
      return (cachedEmpty ??= locations.createDerived(
        () => countSignal() === 0
      ));
    },

    where(predicate: (entity: E) => boolean): ReadableCell<E[]> {
      if (taps.depth) return fresh(() => computeAll().filter(row=>nativePredicate(predicate,row)));
      const cached = whereCache.get(predicate);
      if (cached) return cached;

      if (typeof ngDevMode === 'undefined' || ngDevMode) {
        (warnOnPredicateChurn ??= createPredicateChurnWarning<E>())('where', predicate);
      }
      // Filter DURING iteration rather than materialising `all` and discarding
      // most of it. `allSignal()` builds an array of every entity; `.filter()`
      // then walks it again and keeps a few. Iterating `storage.values()`
      // straight into the result array skips the intermediate entirely.
      //
      // MEASURED in situ, one process per arm, updateOne baseline subtracted.
      // Ranges because the spread across runs is wide — quote the shape, not a
      // point figure:
      //     N=100      1.2us -> 1.3us   (neutral; not worth it at this size)
      //     N=1,000    6.9us -> 2.6us
      //     N=10,000  67-73us -> 24-47us
      //     N=100,000  826us -> 328us
      // So roughly 2-3x from N=1,000 up, and nothing below a few hundred.
      //
      // ⚠️ Measured on a machine running other work. Alternating order
      // (after/before/after) held the ordering and the two `after` runs
      // agreed, so the DIRECTION is sound and the ranges do not overlap —
      // but treat the magnitudes as indicative and re-measure quiet before
      // publishing any of them.
      //
      // Only valid WITHOUT `sortComparer`. With one, `allSignal()` sorts, so
      // bypassing it would silently return insertion order instead of sorted
      // order — a behaviour change, not an optimisation. Without one,
      // `allSignal()` is `Array.from(storage.values())`, so the fast path is
      // order-IDENTICAL rather than merely order-equivalent.
      //
      // `version()` is read directly for the same invalidation `allSignal()`
      // has; the sorted branch gets it transitively.
      const s = createVersionedProjection(() => {
        if (config.sortComparer) return allSignal().filter(row=>nativePredicate(predicate,row));
        const out: E[] = [];
        for (const entity of presentEntities()) {
          if (nativePredicate(predicate,entity)) out.push(entity);
        }
        return out;
      });
      whereCache.set(predicate, s);
      return s;
    },

    find(predicate: (entity: E) => boolean): ReadableCell<E | undefined> {
      if (taps.depth) return fresh(() => computeAll().find(row=>nativePredicate(predicate,row)));
      const cached = findCache.get(predicate);
      if (cached) return cached;

      if (typeof ngDevMode === 'undefined' || ngDevMode) {
        (warnOnPredicateChurn ??= createPredicateChurnWarning<E>())('find', predicate);
      }
      // Same bypass as `where`, and the win here is algorithmic rather than a
      // constant factor: `allSignal().find()` builds the WHOLE array before
      // looking at the first element, so a match at index 5 of 10,000 still
      // costs O(N). Iterating stops at the match.
      //
      // MEASURED in situ at 10k, updateOne baseline subtracted:
      //     match at the END    52-61us -> 12-20us   (~3-5x)
      //     match at index 5      13.6us -> 0.2us    (~50x)
      // The second is the point: `find` goes from O(N) ALWAYS to O(position).
      // The first is the same intermediate-array saving as `where`.
      //
      // Sorted collections keep the old path: `find` returns the FIRST match,
      // which is order-dependent, so with a `sortComparer` the sorted array is
      // the only correct thing to scan. See the note on `where` above.
      const s = createVersionedProjection(() => {
        if (config.sortComparer) return allSignal().find(row=>nativePredicate(predicate,row));
        for (const entity of presentEntities()) {
          if (nativePredicate(predicate,entity)) return entity;
        }
        return undefined;
      });
      findCache.set(predicate, s);
      return s;
    },

    // ==================
    // MUTATIONS: ADD
    // ==================

    addOne(entity: E, opts?: AddOptions<E, K>): K {
      return addOneWithStructuralEffect(entity, opts).id;
    },

    /** Insert at the front before notification and lifecycle callbacks. */
    prependOne(entity: E, opts?: AddOptions<E, K>): K {
      return withMembershipGroup(
        () => addOneWithStructuralEffect(entity, opts, true).id
      );
    },

    prependMany(entities: E[], opts?: AddManyOptions<E, K>): K[] {
      return withMembershipGroup(() => addManyInOrder(entities, opts, true));
    },

    /**
     * Change an entity's id in place — the missing half of optimistic creation.
     *
     * Insert with a temp id, then adopt the id the server assigned. Everything
     * keyed by the old id moves together: storage (keeping list position), the
     * per-entity signal, the node cache, and the active-entity selection.
     *
     * Held row/field references follow the rekey by SUBJECT identity rather than
     * by the old key. The old lookup disappears, but already-materialized row
     * state, metadata, and field signals remain attached to the same subject.
     * That keeps list position, active selection, and row-local reactivity while
     * still allowing the freed id to be reused by a different subject.
     */
    changeId(from: K, to: K): void {
      // An absent collection has no row to rekey (v16 8e).
      if (rowAbsent())
        throw new Error(`Entity with id ${String(from)} not found`);
      const planned = planRekey(from, to);
      planned.commit();
      planned.publish();
    },

    addMany(entities: E[], opts?: AddManyOptions<E, K>): K[] {
      return addManyInOrder(entities, opts);
    },

    // ==================
    // MUTATIONS: UPDATE
    // ==================

    updateOne(id: K, changes: Partial<E>): void { updateOnePrivate(id, changes); },


    /**
     * Replace, not merge — and the write path behind `byId(id)(next)`.
     *
     * Identical to `updateOne` except the one line that matters: assign the whole
     * entity instead of spreading it over the current one. That single difference
     * is the only way to REMOVE a key, which `updateOne` cannot express at all.
     *
     * **Why `replaceOne(id, entity)` and not `setOne(entity)`.** The id comes from
     * the caller on purpose. A `setOne` deriving it via `selectId(entity)` writes
     * to whatever slot the entity's own id field names — and `changeId` can leave
     * `entity.id` disagreeing with the storage key, so that form has a silent
     * wrong-slot write built into it. This one cannot drift.
     */
    replaceOne(id: K, entity: E): void { replaceOnePrivate(id, entity); },


    updateMany(ids: K[], changes: Partial<E>): void {
      if (ids.length === 0) return;

      // Collect entities and run interceptors first
      const updatedEntities: Array<{
        id: K;
        subjectId: number;
        prev: E;
        finalUpdated: E;
        transformedChanges: Partial<E>;
      }> = [];

      for (const id of ids) {
        const entity = presentEntity(id);
        if (!entity) {
          throw new Error(`Entity with id ${String(id)} not found`);
        }
        const prev = entity;

        // Run interceptors
        let transformedChanges = changes;
        for (const handler of interceptHandlers) {
          const ctx: InterceptContext<Partial<E>> = {
            block: (reason?: string) => {
              throw new Error(
                `Cannot update entity: ${reason || 'blocked by interceptor'}`
              );
            },
            transform: (value: Partial<E>) => {
              transformedChanges = value;
            },
            blocked: false,
            blockReason: undefined,
          };
          assertSynchronousInterceptorResult(
            handler.onUpdate?.(id, changes, ctx),
            'onUpdate'
          );
        }

        const finalUpdated = { ...entity, ...transformedChanges };

        const subjectId = structuralStore.subjectIdForKey(id);
        if (subjectId === undefined) {
          throw new Error(`Entity with id ${String(id)} has no subject id`);
        }

        updatedEntities.push({
          id,
          subjectId,
          prev,
          finalUpdated,
          transformedChanges,
        });
      }

      const frame = createEntityMutationFrame();
      for (const {
        id,
        subjectId,
        finalUpdated,
        transformedChanges,
      } of updatedEntities) {
        frame.stageValueReplacement({
          kind: 'replace-value',
          key: id,
          subjectId,
          nextValue: finalUpdated,
          authoredFields: Object.keys(transformedChanges),
        });
      }
      const committed = commitAndProjectEntityMutationFrame(frame, undefined, true);

      for (const { id } of updatedEntities) {
        syncEntitySignal(id);
      }

      // Single signal update after all entities are updated
      updateSignals(committed.complete);

      const subjectIdsForWrite = rememberSubjectIds(ids);

      // Notify PathNotifier for each updated entity
      for (let i = 0; i < updatedEntities.length; i++) {
        const { id, prev, finalUpdated, transformedChanges } =
          updatedEntities[i];
        pathNotifier.notify(
          `${basePath}.${String(id)}`,
          finalUpdated,
          prev,
          basePath,
          [subjectIdsForWrite[i]],
          getPositionIdsForNotify(),
          withEntityValueTransition(
            ambientMeta(),
            committed.valueResultsByStep[i]
          ),
          undefined,
          getActiveWriteContext()?.mutationIntent === 'derive'
            ? undefined
            : Object.keys(transformedChanges)
        );
      }

      // Run tap handlers for each updated entity
      for (const { id, transformedChanges, finalUpdated } of updatedEntities) {
        emitTap('onUpdate', id, transformedChanges, finalUpdated);
      }
    },

    updateWhere(
      predicate: (entity: E) => boolean,
      changes: Partial<E>
    ): number {
      return withEntityPublicationInput(entityPublication,undefined,undefined,()=>{
      const idsToUpdate: K[] = [];
      for (const [id, entity] of presentEntries()) {
        if (predicate(entity)) {
          idsToUpdate.push(id);
        }
      }
      if (idsToUpdate.length > 0) {
        api.updateMany(idsToUpdate, changes);
      }
      return idsToUpdate.length;
      });
    },

    // ==================
    // MUTATIONS: REMOVE
    // ==================

    removeOne(id: K): void {
      const entity = presentEntity(id);
      if (!entity) {
        throw new Error(`Entity with id ${String(id)} not found`);
      }
      const { beforeSubject, afterSubject } = getNeighborSubjects(id);

      // Run interceptors
      for (const handler of interceptHandlers) {
        const ctx: InterceptContext<void> = {
          block: (reason?: string) => {
            throw new Error(
              `Cannot remove entity: ${reason || 'blocked by interceptor'}`
            );
          },
          transform: () => {
            // void transform - no transformation possible
          },
          blocked: false,
          blockReason: undefined,
        };
        assertSynchronousInterceptorResult(
          handler.onRemove?.(id, entity, ctx),
          'onRemove'
        );
      }

      // Delete and update signals
      const subjectIdsForWrite = rememberSubjectIds([id]);
      const structuralEffect: PendingStructuralEffect = {
        kind: 'remove',
        subject: subjectIdsForWrite[0],
        key: id,
        value: deepClone(entity),
        beforeSubject,
        afterSubject,
      };
      const currentState = resolveSubjectState(subjectIdsForWrite[0]);
      const tombstone: PreparedSubjectTombstone<K> = {
        kind: 'tombstone-subject',
        key: id,
        subjectId: subjectIdsForWrite[0],
        restoreAllowed: currentState?.restoreAllowed ?? true,
      };
      const frame = createEntityMutationFrame();
      frame.stageSubjectTombstone(tombstone);
      const result = commitAndProjectEntityMutationFrame(frame, undefined, true);
      for (const changedSubjectId of result.physicallyChangedSubjectIds) {
        publishSubjectPhysicalChange(changedSubjectId);
      }
      tombstoneSubjectSignal(subjectIdsForWrite[0]);
      reclaimRetiredSubjectsWithoutOwner([subjectIdsForWrite[0]]);
      updateSignals(result.complete);

      // Notify PathNotifier
      pathNotifier.notify(
        `${basePath}.${String(id)}`,
        undefined,
        entity,
        basePath,
        subjectIdsForWrite,
        getPositionIdsForNotify(),
        createStructuralEffectMeta(
          structuralEffect,
          result.ordinaryChanges.get(subjectIdsForWrite[0])
        )
      );

      // Run tap handlers
      emitTap('onRemove', id, entity);
    },

    removeMany(ids: K[]): void {
      if (ids.length === 0) return;

      // Collect entities and run interceptors first
      const preparedRemovals: Array<{
        id: K;
        entity: E;
        subjectId: number;
        beforeSubject?: number;
        afterSubject?: number;
      }> = [];
      for (const id of ids) {
        const entity = presentEntity(id);
        if (!entity) {
          throw new Error(`Entity with id ${String(id)} not found`);
        }
        const subjectId = resolveSubjectId(id);
        if (subjectId === undefined) {
          throw new Error(`Entity with id ${String(id)} has no subject id`);
        }
        const { beforeSubject, afterSubject } = getNeighborSubjects(id);

        // Run interceptors
        for (const handler of interceptHandlers) {
          const ctx: InterceptContext<void> = {
            block: (reason?: string) => {
              throw new Error(
                `Cannot remove entity: ${reason || 'blocked by interceptor'}`
              );
            },
            transform: () => {
              // void transform - no transformation possible
            },
            blocked: false,
            blockReason: undefined,
          };
          assertSynchronousInterceptorResult(
            handler.onRemove?.(id, entity, ctx),
            'onRemove'
          );
        }

        preparedRemovals.push({
          id,
          entity,
          subjectId,
          beforeSubject,
          afterSubject,
        });
      }

      const subjectIdsForWrite = preparedRemovals.map(
        ({ subjectId }) => subjectId
      );
      lastSubjectIds = subjectIdsForWrite;

      const frame = createEntityMutationFrame();

      for (const { id, subjectId } of preparedRemovals) {
        const currentState = resolveSubjectState(subjectId);
        frame.stageSubjectTombstone({
          kind: 'tombstone-subject',
          key: id,
          subjectId,
          restoreAllowed: currentState?.restoreAllowed ?? true,
        });
      }

      const result = commitAndProjectEntityMutationFrame(frame, undefined, true);
      for (const changedSubjectId of result.physicallyChangedSubjectIds) {
        publishSubjectPhysicalChange(changedSubjectId);
      }

      for (const { subjectId } of preparedRemovals) {
        tombstoneSubjectSignal(subjectId);
      }
      reclaimRetiredSubjectsWithoutOwner(
        preparedRemovals.map(({ subjectId }) => subjectId)
      );

      // Single signal update after all entities are removed
      updateSignals(result.complete);

      // Notify PathNotifier for each removed entity
      for (let i = 0; i < preparedRemovals.length; i++) {
        const { id, entity, beforeSubject, afterSubject } = preparedRemovals[i];
        pathNotifier.notify(
          `${basePath}.${String(id)}`,
          undefined,
          entity,
          basePath,
          [subjectIdsForWrite[i]],
          getPositionIdsForNotify(),
          createStructuralEffectMeta(
            {
              kind: 'remove',
              subject: subjectIdsForWrite[i],
              key: id,
              value: deepClone(entity),
              beforeSubject,
              afterSubject,
            },
            result.ordinaryChanges.get(subjectIdsForWrite[i])
          )
        );
      }

      // Run tap handlers for each removed entity
      for (const { id, entity } of preparedRemovals) {
        emitTap('onRemove', id, entity);
      }
    },

    removeWhere(predicate: (entity: E) => boolean): number {
      return withEntityPublicationInput(entityPublication,undefined,undefined,()=>{
      const idsToRemove: K[] = [];
      for (const [id, entity] of presentEntries()) {
        if (predicate(entity)) {
          idsToRemove.push(id);
        }
      }
      if (idsToRemove.length > 0) {
        api.removeMany(idsToRemove);
      }
      return idsToRemove.length;
      });
    },

    // ==================
    // MUTATIONS: UPSERT
    // ==================

    upsertOne(entity: E, opts?: AddOptions<E, K>): K {
      const id = deriveId(entity, opts);
      if (structuralStore.hasActiveKey(id)) {
        api.updateOne(id, entity);
      } else {
        api.addOne(entity, opts);
      }
      return id;
    },

    upsertMany(entities: E[], opts?: AddOptions<E, K>): K[] {
      if (entities.length === 0) return [];
      const lastPreviousKey = structuralStore.lastActiveKey();

      // Upserted one at a time, as successive upsertOne calls would be: every
      // id is resolved first (nothing intercepted or written yet), then the
      // interceptors run once per COPY, in input order: onAdd for a new id's
      // first copy, onUpdate for each later copy (the raw copy), merged over
      // the running value. Each key is announced and tapped once, with its
      // final value (v15 778f86ef and e02238f4, carried in v16 8f).
      type Upsert = {
        id: K;
        prev?: E;
        subjectId?: number;
        /** The running value: the stored row, then each intercepted copy. */
        entity?: E;
        changes?: Partial<E>;
      };
      const toAdd: Upsert[] = [];
      const toUpdate: Upsert[] = [];
      const copies: Array<[Upsert, E]> = [];
      const earlier = new Map<K, Upsert>();
      for (const entity of entities) {
        const id = deriveId(entity, opts);
        let row = earlier.get(id);
        if (!row) {
          const prev = getProjectedEntity(id);
          if (prev === undefined) row = { id };
          else {
            const subjectId = resolveSubjectId(id);
            if (subjectId === undefined) {
              throw new Error(`Entity with id ${String(id)} has no subject id`);
            }
            row = { id, prev, entity: prev, subjectId };
          }
          (prev === undefined ? toAdd : toUpdate).push(row);
          earlier.set(id, row);
        }
        copies.push([row, entity]);
      }
      for (const [row, entity] of copies) {
        if (row.entity === undefined) {
          row.entity = interceptAddedEntity(entity);
        } else {
          const changes = interceptUpdatedEntity(row.id, entity);
          row.changes = { ...row.changes, ...changes };
          row.entity = { ...row.entity, ...changes };
        }
      }

      const stagedAdds = toAdd as Array<{ id: K; entity: E }>;
      const stagedUpdates = toUpdate.map(
        ({ id, subjectId, prev, entity, changes }) => ({
          id,
          subjectId: subjectId as number,
          prev: prev as E,
          transformedChanges: changes as Partial<E>,
          finalUpdated: entity as E,
        })
      );

      // One observed membership unit; a throw still closes it.
      let ordinaryChanges: ReadonlyMap<
        number,
        readonly CommittedEntityMutation[]
      > = new Map();
      let valueResults: ReadonlyMap<
        number,
        EntityValueTransition<E>
      > = new Map();
      let completePublication: (()=>void)|undefined;
      const membershipUnit = membershipTap;
      membershipUnit?.(MEMBERSHIP_OPEN_ORDER);
      const addedEntities: Array<{ id: K; entity: E; subjectId: number }> = [];
      try {
        const freshSubjectIds = structuralStore.planFreshSubjectIds(
          stagedAdds.length
        );
        const frame = createEntityMutationFrame();
        for (let i = 0; i < stagedAdds.length; i++)
          frame.stageFreshSubject({
            kind: 'create-fresh-subject',
            key: stagedAdds[i].id,
            subjectId: freshSubjectIds[i],
            nextValue: stagedAdds[i].entity,
          });
        for (const row of stagedUpdates)
          frame.stageValueReplacement({
            kind: 'replace-value',
            key: row.id,
            subjectId: row.subjectId,
            nextValue: row.finalUpdated,
            authoredFields: Object.keys(row.transformedChanges),
          });
        const committed = commitAndProjectEntityMutationFrame(frame, undefined, true);
        completePublication = committed.complete;
        valueResults = committed.valueResults;
        ordinaryChanges = committed.ordinaryChanges;
        const addedSubjectIdsByKey = new Map<K, number>();
        for (let i = 0; i < stagedAdds.length; i++) {
          addedSubjectIdsByKey.set(stagedAdds[i].id, freshSubjectIds[i]);
        }

        // Process adds
        for (const { entity: transformedEntity, id } of stagedAdds) {
          const subjectId = addedSubjectIdsByKey.get(id);
          if (subjectId === undefined) {
            throw new Error(`Entity with id ${String(id)} has no subject id`);
          }

          invalidateNodeCache(id);
          syncEntitySignal(id);
          addedEntities.push({ id, entity: transformedEntity, subjectId });
        }
      } finally {
        membershipUnit?.(MEMBERSHIP_CLOSE);
      }

      const updatedEntities: Array<{
        id: K;
        subjectId: number;
        prev: E;
        finalUpdated: E;
        transformedChanges: Partial<E>;
      }> = [];
      for (const {
        id,
        subjectId,
        prev,
        finalUpdated,
        transformedChanges,
      } of stagedUpdates) {
        syncEntitySignal(id);
        updatedEntities.push({
          id,
          subjectId,
          prev,
          finalUpdated,
          transformedChanges,
        });
      }

      // Single signal update after all entities are processed
      updateSignals(completePublication);

      const addedSubjectIdsForWrite = addedEntities.map(
        ({ subjectId }) => subjectId
      );
      const updatedSubjectIdsForWrite = updatedEntities.map(
        ({ subjectId }) => subjectId
      );
      lastSubjectIds = [
        ...addedSubjectIdsForWrite,
        ...updatedSubjectIdsForWrite,
      ];

      // Fresh lifetimes require an add effect, not a whole-row value write.
      // Each appended row follows the previous fresh row of this call.
      let beforeSubject =
        lastPreviousKey === undefined
          ? undefined
          : allocateSubjectId(lastPreviousKey);
      for (let i = 0; i < addedEntities.length; i++) {
        const { id, entity } = addedEntities[i];
        const subject = addedSubjectIdsForWrite[i];
        pathNotifier.notify(
          `${basePath}.${String(id)}`,
          entity,
          undefined,
          basePath,
          [subject],
          getPositionIdsForNotify(),
          createStructuralEffectMeta(
            {
              kind: 'add',
              subject,
              key: id,
              value: deepClone(entity),
              beforeSubject,
            },
            ordinaryChanges.get(subject)
          )
        );
        beforeSubject = subject;
      }

      // Notify PathNotifier for updated entities
      for (let i = 0; i < updatedEntities.length; i++) {
        const { id, prev, finalUpdated, transformedChanges } =
          updatedEntities[i];
        pathNotifier.notify(
          `${basePath}.${String(id)}`,
          finalUpdated,
          prev,
          basePath,
          [updatedSubjectIdsForWrite[i]],
          getPositionIdsForNotify(),
          withEntityValueTransition(
            ambientMeta(),
            valueResults.get(updatedSubjectIdsForWrite[i])
          ),
          undefined,
          getActiveWriteContext()?.mutationIntent === 'derive'
            ? undefined
            : Object.keys(transformedChanges)
        );
      }

      // Run tap handlers for added entities
      for (const { id, entity } of addedEntities) {
        emitTap('onAdd', entity, id);
      }

      // Run tap handlers for updated entities
      for (const { id, transformedChanges, finalUpdated } of updatedEntities) {
        emitTap('onUpdate', id, transformedChanges, finalUpdated);
      }

      return [...toAdd.map((a) => a.id), ...toUpdate.map((u) => u.id)];
    },

    // ==================
    // MUTATIONS: CLEAR/RESET
    // ==================

    clear(): void {
      // AUTHORS THE SAME STRUCTURAL REMOVALS `removeMany` DOES, and that is the
      // whole fix. Until 15.0 this tombstoned subjects and told the notifier
      // nothing, so the turn restoration recorded carried no structural effect:
      // `canUndo()` reported true, the first undo silently restored nothing, and
      // the next threw "Unsupported scoped undo effect at structural-drift".
      // Removing the same rows one at a time and undoing worked correctly, which
      // is what made it a defect rather than a limitation — see
      // `clear-not-undoable.spec.ts`.
      //
      // The entity VALUES and the neighbour subjects have to be captured BEFORE
      // anything is tombstoned: a `remove` effect carries the value it removed
      // and where it sat, and after the tombstone neither is reachable.
      const activeIds = structuralStore.activeKeysSnapshot();
      const activeSubjects = activeIds.map((id) => {
        const subjectId = resolveSubjectId(id);
        if (subjectId === undefined) {
          throw new Error(`Entity with id ${String(id)} has no subject id`);
        }
        const entity = getProjectedEntity(id);
        const { beforeSubject, afterSubject } = getNeighborSubjects(id);
        return { id, subjectId, entity, beforeSubject, afterSubject };
      });

      let ordinaryChanges: ReadonlyMap<
        number,
        readonly CommittedEntityMutation[]
      > = new Map();
      let completePublication: (()=>void)|undefined;
      const membershipUnit = membershipTap;
      membershipUnit?.(MEMBERSHIP_OPEN_ORDER);
      try {
        const frame = createEntityMutationFrame();
        for (const { id, subjectId } of activeSubjects)
          frame.stageSubjectTombstone({
            kind: 'tombstone-subject',
            key: id,
            subjectId,
            restoreAllowed:
              resolveSubjectState(subjectId)?.restoreAllowed ?? true,
          });
        const committed=commitAndProjectEntityMutationFrame(frame,undefined,true);
        ordinaryChanges=committed.ordinaryChanges;
        completePublication=committed.complete;
      } finally {
        // Observed once every row is tombstoned, before reactive publication.
        membershipUnit?.(MEMBERSHIP_CLOSE);
      }
      for (const { subjectId } of activeSubjects)
        publishSubjectPhysicalChange(subjectId);

      // Per-subject, exactly as `removeOne` does — never a bulk reset (see the
      // tombstone above). A held reference has to keep reading through the SAME
      // signal so an undo re-publishes into it, which is the property
      // `check-signal-identity-durability.mjs` pins for `removeOne`. Zero-owner
      // trees still shed the entries, one line below.
      for (const { subjectId } of activeSubjects) {
        tombstoneSubjectSignal(subjectId);
      }
      reclaimRetiredSubjectsWithoutOwner(
        activeSubjects.map(({ subjectId }) => subjectId)
      );
      replaceLocation(activeIdSignal, undefined);
      lastSubjectIds = activeSubjects.map(({ subjectId }) => subjectId);
      updateSignals(completePublication);

      for (const {
        id,
        subjectId,
        entity,
        beforeSubject,
        afterSubject,
      } of activeSubjects) {
        if (!entity) continue;
        pathNotifier.notify(
          `${basePath}.${String(id)}`,
          undefined,
          entity,
          basePath,
          [subjectId],
          getPositionIdsForNotify(),
          createStructuralEffectMeta(
            {
              kind: 'remove',
              subject: subjectId,
              key: id,
              value: deepClone(entity),
              beforeSubject,
              afterSubject,
            },
            ordinaryChanges.get(subjectId)
          )
        );
      }

      for (const { id, entity } of activeSubjects) {
        if (!entity || silentClear) continue;
        emitTap('onRemove', id, entity);
      }
    },

    setAll(entities: E[], opts?: AddOptions<E, K>): void {
      // Pre-state from ONE walk of the structural order: each row's key and
      // subject come off its node, so nothing below re-resolves a current row
      // or searches the pre-state for a removed row's position.
      const currentKeys: K[] = [];
      const currentSubjects: number[] = [];
      structuralStore.snapshotActiveOrder(currentKeys, currentSubjects);
      const beforeOrderFrontier = structuralStore.activeOrderFrontier();

      // The incoming order, deduplicated (first position, last value), in
      // index-aligned arrays. `incomingSubjects` holds an update's existing
      // subject and receives each add's fresh subject once it exists.
      const incomingIndex = new Map<K, number>();
      const incomingIds: K[] = [];
      const incomingEntities: E[] = [];
      const incomingSubjects: Array<number | undefined> = [];
      for (const entity of entities) {
        const id = deriveId(entity, opts);
        const existing = structuralStore.subjectIdForKey(id);
        const transformedEntity =
          existing !== undefined
            ? interceptReplacedEntity(id, entity)
            : interceptAddedEntity(entity);

        const index = incomingIndex.get(id);
        if (index === undefined) {
          incomingIndex.set(id, incomingIds.length);
          incomingIds.push(id);
          incomingEntities.push(transformedEntity);
          incomingSubjects.push(existing);
          continue;
        }
        incomingEntities[index] = transformedEntity;
      }

      const stagedRemovals: Array<{
        id: K;
        entity: E;
        subjectId: number;
        /** Position in the pre-state order, for the removal's neighbours. */
        index: number;
      }> = [];
      for (let index = 0; index < currentKeys.length; index += 1) {
        const id = currentKeys[index];
        if (incomingIndex.has(id)) continue;
        const subjectId = currentSubjects[index];
        const entity = valueStore.backingForSubject(subjectId);
        if (entity === undefined) continue;
        for (const handler of interceptHandlers) {
          const ctx: InterceptContext<void> = {
            block: (reason?: string) => {
              throw new Error(
                `Cannot remove entity: ${reason || 'blocked by interceptor'}`
              );
            },
            transform: () => {
              // void transform - no transformation possible
            },
            blocked: false,
            blockReason: undefined,
          };
          assertSynchronousInterceptorResult(
            handler.onRemove?.(id, entity, ctx),
            'onRemove'
          );
        }
        stagedRemovals.push({ id, entity, subjectId, index });
      }

      // An interceptor or selector may have changed membership, keys or order.
      // Those completed writes stand, but this operation must not commit its
      // now-stale topology plan (an applied rekey would otherwise be undone by
      // the reorder below, or a removal recorded against a moved neighbour).
      if (
        structuralStore.activeOrderFrontier() !== beforeOrderFrontier ||
        currentKeys.some(
          (key, index) =>
            structuralStore.subjectIdForKey(key) !== currentSubjects[index]
        )
      ) {
        throw new Error(
          'Cannot setAll: collection topology changed during staging'
        );
      }

      const stagedUpdates: Array<{
        id: K;
        prev: E;
        entity: E;
        subjectId: number;
      }> = [];
      const stagedAdds: Array<{ id: K; entity: E; index: number }> = [];
      for (let index = 0; index < incomingIds.length; index += 1) {
        const id = incomingIds[index];
        const entity = incomingEntities[index];
        const subjectId = incomingSubjects[index];
        if (subjectId === undefined) {
          stagedAdds.push({ id, entity, index });
          continue;
        }
        // Read after every callback: a field-only reentrant write is the
        // value this replacement supersedes.
        const prev = valueStore.backingForSubject(subjectId);
        if (prev === undefined) {
          throw new Error(`Entity with id ${String(id)} not found`);
        }
        stagedUpdates.push({ id, prev, entity, subjectId });
      }

      // From the first fresh subject to the order capture is one membership
      // unit; a throw still closes it.
      let ordinaryChanges: ReadonlyMap<
        number,
        readonly CommittedEntityMutation[]
      > = new Map();
      let valueResults: ReadonlyMap<
        number,
        EntityValueTransition<E>
      > = new Map();
      let completePublication: (()=>void)|undefined;
      const membershipUnit = membershipTap;
      membershipUnit?.(MEMBERSHIP_OPEN_ORDER);
      let addedSubjectIds: readonly number[];
      let afterSubjects: number[];
      const stagedRemovalStructuralEffects: PendingStructuralEffect[] = [];
      try {
        // Index-aligned with `stagedAdds`.
        addedSubjectIds = structuralStore.planFreshSubjectIds(
          stagedAdds.length
        );
        for (let k = 0; k < stagedAdds.length; k += 1) {
          incomingSubjects[stagedAdds[k].index] = addedSubjectIds[k];
        }
        // Every incoming row now has its subject: this IS the after-order.
        afterSubjects = incomingSubjects as number[];

        // Immediate pre-state neighbours, removed or surviving, exactly as
        // clear() and removeMany() record them. Anchoring only to survivors left
        // adjacent removals with identical anchors, so their reversal order
        // depended on replay order: [a,b,c] -> [q,a] rolled back to [a,c,b], and
        // replacing every row undid to [c,b,a].
        for (const { id, entity, subjectId, index } of stagedRemovals) {
          stagedRemovalStructuralEffects.push({
            kind: 'remove',
            subject: subjectId,
            key: id,
            value: deepClone(entity),
            beforeSubject: index > 0 ? currentSubjects[index - 1] : undefined,
            afterSubject: currentSubjects[index + 1],
          });
        }

        const frame = createEntityMutationFrame();
        for (const { id, subjectId } of stagedRemovals)
          frame.stageSubjectTombstone({
            kind: 'tombstone-subject',
            key: id,
            subjectId,
            restoreAllowed:
              resolveSubjectState(subjectId)?.restoreAllowed ?? true,
          });
        for (const { id, subjectId, entity } of stagedUpdates)
          frame.stageValueReplacement({
            kind: 'replace-value',
            key: id,
            subjectId,
            nextValue: entity,
            authoredFields: null,
          });
        for (let k = 0; k < stagedAdds.length; k++)
          frame.stageFreshSubject({
            kind: 'create-fresh-subject',
            key: stagedAdds[k].id,
            subjectId: addedSubjectIds[k],
            nextValue: stagedAdds[k].entity,
          });
        frame.stageFinalOrder(incomingIds);
        if (survivingOrderChanged(currentSubjects, afterSubjects))
          frame.ordinaryOrder = afterSubjects;
        const committed = commitAndProjectEntityMutationFrame(frame, undefined, true);
        completePublication = committed.complete;
        valueResults = committed.valueResults;
        ordinaryChanges = committed.ordinaryChanges;
        for (const { subjectId } of stagedRemovals)
          tombstoneSubjectSignal(subjectId);
        for (const { id } of stagedAdds) syncEntitySignal(id);

        for (const { id } of stagedUpdates) {
          syncEntitySignal(id);
        }

        lastSubjectIds = [
          ...stagedRemovals.map(({ subjectId }) => subjectId),
          ...stagedUpdates.map(({ subjectId }) => subjectId),
          ...addedSubjectIds,
        ];

        if (mutationCaptureRuntime?.isCaptureActive()) getPositionIds();
        // Captured whenever SURVIVING subjects change relative order, not only
        // for a pure reorder. Neighbour hints on the structural effects cannot
        // restore survivors that moved: reversing [a,b,c] -> [c,a] yielded
        // [b,c,a]. The order delta carries both endpoints, including subjects
        // present at only one of them. Membership-only changes keep relying on
        // the structural effects.
        if (
          positionId !== undefined &&
          mutationCaptureRuntime?.publishCollectionOrder &&
          survivingOrderChanged(currentSubjects, afterSubjects)
        ) {
          publishOrderChange(
            currentSubjects,
            afterSubjects,
            beforeOrderFrontier,
            undefined,
            committed.ordinaryEndpoints,
            false,
            committed.topologyUnit
          );
        }
      } finally {
        // The whole replacement has installed (or stopped): the observed
        // membership unit closes before the removed rows' reactive publication.
        membershipUnit?.(MEMBERSHIP_CLOSE);
      }
      for (const { subjectId } of stagedRemovals)
        publishSubjectPhysicalChange(subjectId);
      reclaimRetiredSubjectsWithoutOwner(
        stagedRemovals.map(({ subjectId }) => subjectId)
      );

      // Every incoming row is active by now, so the nearest neighbour with a
      // subject is the adjacent one in the after-order.
      const stagedAddStructuralEffects: PendingStructuralEffect[] = [];
      for (let k = 0; k < stagedAdds.length; k += 1) {
        const { id, entity, index } = stagedAdds[k];
        stagedAddStructuralEffects.push({
          kind: 'add',
          subject: addedSubjectIds[k],
          key: id,
          value: deepClone(entity),
          beforeSubject: index > 0 ? afterSubjects[index - 1] : undefined,
          afterSubject: afterSubjects[index + 1],
        });
      }

      updateSignals(completePublication);

      for (let index = 0; index < stagedRemovals.length; index += 1) {
        const { id, entity, subjectId } = stagedRemovals[index];
        const structuralEffect = stagedRemovalStructuralEffects[index];
        pathNotifier.notify(
          `${basePath}.${String(id)}`,
          undefined,
          entity,
          basePath,
          [subjectId],
          getPositionIdsForNotify(),
          createStructuralEffectMeta(
            structuralEffect,
            ordinaryChanges.get(structuralEffect.subject)
          )
        );
      }

      for (const { id, prev, entity, subjectId } of stagedUpdates) {
        pathNotifier.notify(
          `${basePath}.${String(id)}`,
          entity,
          prev,
          basePath,
          subjectId === undefined ? undefined : [subjectId],
          getPositionIdsForNotify(),
          withEntityValueTransition(ambientMeta(), valueResults.get(subjectId)),
          undefined,
          getActiveWriteContext()?.mutationIntent === 'derive'
            ? undefined
            : null
        );
      }

      for (let i = 0; i < stagedAdds.length; i++) {
        const { id, entity } = stagedAdds[i];
        pathNotifier.notify(
          `${basePath}.${String(id)}`,
          entity,
          undefined,
          basePath,
          [addedSubjectIds[i]],
          getPositionIdsForNotify(),
          createStructuralEffectMeta(
            stagedAddStructuralEffects[i],
            ordinaryChanges.get(stagedAddStructuralEffects[i].subject)
          )
        );
      }

      for (const { id, entity } of stagedRemovals) {
        emitTap('onRemove', id, entity);
      }

      for (const { id, entity } of stagedAdds) {
        emitTap('onAdd', entity, id);
      }

      for (const { id, entity } of stagedUpdates) {
        emitTap('onUpdate', id, entity as Partial<E>, entity);
      }
    },

    // ==================
    // HOOKS
    // ==================

    tap(handlers: TapHandlers<E, K>): () => void {
      tapHandlers.push(handlers);
      return () => {
        const idx = tapHandlers.indexOf(handlers);
        if (idx > -1) tapHandlers.splice(idx, 1);
      };
    },

    intercept(handlers: InterceptHandlers<E, K>): () => void {
      assertSynchronousInterceptors(handlers);
      interceptHandlers.push(handlers);
      return () => {
        const idx = interceptHandlers.indexOf(handlers);
        if (idx > -1) interceptHandlers.splice(idx, 1);
      };
    },
  };

  // HISTORY SCOPE — removed in 15.0 with `recordHistory`. A collection is no
  // longer excludable from history by location; eligibility belongs to the
  // authored operation. See `undoable()` and the tombstone in utils.ts.
  if (subjectMetadataEnabled) {
    Object.defineProperty(api, '__subjectIds', {
      get: () => lastSubjectIds,
      enumerable: false,
      configurable: true,
    });
  }
  Object.defineProperty(api, '__positionIds', {
    get: getPositionIds,
    enumerable: false,
    configurable: true,
  });
  defineOwnedOwnerPath(api, basePath);

  // ⚠️ A ROW-ADDING WRITE TO AN ABSENT COLLECTION RE-ADDS ITS PATH, CARRYING
  // ONLY THE WRITTEN ROWS (v16 8e). The collection reads empty while it is
  // absent, so the write applies to an empty collection:
  // 1. it is validated and intercepted as on an empty collection, before
  //    anything changes, so a block or bad input changes nothing (v16 8f;
  //    8e intercepted after the removal below, which then stayed);
  // 2. the retained rows are removed through the ordinary `clear()`, which
  //    records them, so a reversal restores them; no tap sees it;
  // 3. the write runs with the rows already intercepted, interceptors
  //    suppressed, so each runs exactly once;
  // 4. every omitted member on its path comes back with only that path
  //    (`reactivatePathOnWrite`).
  // Retained rows never resurface, and undo, redo, jumpTo and rollback
  // reverse all of it. Writes that name an existing row refuse instead, as on
  // an empty collection. Only a structural write on this collection's own
  // tree (the whole value hydrating it, a reversal) writes it as it is.
  const clearRetained = api.clear;
  /**
   * The call's rows after its interceptors, as the write would intercept them
   * on an empty collection: ids resolved first (a strict duplicate throws
   * before any interceptor runs), then once per applied copy in input order —
   * `onAdd` for a key's first copy; for upserts, `onUpdate` with each later
   * raw copy, merged; otherwise the last copy wins in the first copy's place.
   * Ids stay those the raw rows give (`selectId`), as the write would key them.
   */
  const interceptAsEmpty = (
    name: string,
    args: unknown[]
  ): [unknown, AddManyOptions<E, K>] => {
    const opts = args[1] as AddManyOptions<E, K> | undefined;
    const many = name.endsWith('Many') || name === 'setAll';
    const input = (many ? args[0] : [args[0]]) as E[];
    const upsert = name.startsWith('upsert');
    const mode =
      name === 'addMany' || name === 'prependMany'
        ? opts?.mode ?? 'strict'
        : 'overwrite';
    const copies: Array<[K, E]> = [];
    const firsts = new Set<K>();
    for (const row of input) {
      const id = deriveId(row, opts);
      if (firsts.has(id)) {
        if (mode === 'strict')
          throw new Error(`Entity with id ${String(id)} already exists`);
        if (mode === 'skip') continue;
      }
      firsts.add(id);
      copies.push([id, row]);
    }
    const rows = new Map<K, E>();
    for (const [id, row] of copies) {
      const running = rows.get(id);
      rows.set(
        id,
        upsert && running !== undefined
          ? { ...running, ...interceptUpdatedEntity(id, row) }
          : interceptAddedEntity(row)
      );
    }
    const keys = new Map<E, K>();
    const out: E[] = [];
    for (const [id, row] of rows) {
      // One object for two ids (an interceptor that returns a shared object):
      // each id writes its own copy, keyed as the interceptors were.
      const own = keys.has(row) ? ({ ...row } as E) : row;
      keys.set(own, id);
      out.push(own);
    }
    const resolved = {
      ...opts,
      selectId: (row: E) => keys.get(row) ?? deriveId(row, opts),
    };
    return [many ? out : out[0], resolved];
  };
  for (const name of [
    'addOne',
    'prependOne',
    'addMany',
    'prependMany',
    'upsertOne',
    'upsertMany',
    'setAll',
    'clear',
  ] as const) {
    const write = api[name] as (...args: unknown[]) => unknown;
    (api as Record<string, unknown>)[name] = (...args: unknown[]) => {
      if (reAdding || !absent() || inStructuralWrite(proxy))
        return write(...args);
      const prepared = name === 'clear' ? [] : interceptAsEmpty(name, args);
      const writePrepared = () => {
        interceptsSuppressed++;
        try {
          return write(...prepared);
        } finally {
          interceptsSuppressed--;
        }
      };
      // An interceptor that wrote this collection may have re-added it; and
      // a call that adds nothing (`addMany([])`) changes nothing, as on an
      // empty collection. Either way the write is an ordinary one now, its
      // interceptors already run (v16 8f review).
      if (
        !absent() ||
        (name !== 'setAll' &&
          Array.isArray(prepared[0]) &&
          !(prepared[0] as unknown[]).length)
      )
        return writePrepared();
      reAdding = pendingReAdd = true;
      try {
        // The retained rows were never visible, so their removal is no row
        // change to observe: taps do not see it (`silentClear`).
        silentClear++;
        try {
          clearRetained();
        } finally {
          silentClear--;
        }
        const result = writePrepared();
        // Re-added already if a tap was told of a row (`emitTap`).
        if (pendingReAdd) {
          pendingReAdd = false;
          reactivatePathOnWrite(api);
        }
        return result;
      } finally {
        reAdding = pendingReAdd = false;
      }
    };
  }
  // Its presence changed (it, or a member above it, was omitted or re-added):
  // every query and every held row re-reads (`republishMembers`).
  const wake = () =>
    locations.runInvalidationGroup(() => {
      for (const epoch of subjectEpochs.values()) advanceEpochHandle(epoch);
      deriveLocation(version, (value) => value + 1);
      markOwnerInvalidated(ownerId);
    });
  // Inside a structural write it wakes them once, after the write has closed
  // (`structuralWrites.end`, chained in order): a reversal being applied reads
  // rows physically (`physicalRows`), so a consumer re-run inside it would
  // cache what storage holds rather than the collection's absence. Installed
  // by the first such change, so a tree without collections carries none of
  // this. Every queued wake runs even if an earlier one throws.
  let wakeQueued = false;
  Object.defineProperty(api, MEMBERSHIP_CHANGED, {
    value: () => {
      if (!structuralWrites.depth) return wake();
      if (wakeQueued) return;
      wakeQueued = true;
      const earlier = structuralWrites.end;
      structuralWrites.end = (failed) => {
        structuralWrites.end = undefined;
        wakeQueued = false;
        // Every queued wake runs; the first consumer error is kept.
        let caught: { error: unknown } | undefined;
        for (const run of [() => earlier?.(failed), wake]) {
          try {
            run();
          } catch (error) {
            caught ??= { error };
          }
        }
        if (!caught) return;
        // Closing a reversal that threw: its own error is what surfaces, and
        // a consumer's is reported asynchronously.
        if (!failed) throw caught.error;
        const { error } = caught;
        queueMicrotask(() => {
          throw error;
        });
      };
    },
  });
  // Membership observation attaches its tap here on first use.
  defineEntityMembershipSource(api, (tap) => {
    membershipTap = tap;
    return structuralStore;
  });
  // ⚠️ THE PROJECTION SEED — internal, WeakMap-carried, never public.
  //
  // Built from the SAME ordered active-key snapshot `getProjectedEntries()`
  // uses, and the SAME `getProjectedEntity` row path, so a consumer's seeded
  // projection cannot drift from `all()` by construction.
  //
  // `key` is carried explicitly alongside `subjectId` because it is genuinely
  // separate information: after `changeId(1, 77)` the row payload still reads
  // `{ id: 1 }` while the address is 77, so `selectId(row)` cannot recover it.
  defineEntityPreparationReader(api as object, (requestedKey) => {
    const key = requestedKey as K;
    // Preserve byId's lookup/dependency phase before acquiring a lifetime:
    // native epoch initialization and reads can reenter the collection.
    if (rowAbsent() || !structuralStore.hasActiveKey(key)) {
      idsSignal();
      throw new Error(`Entity with id ${String(key)} not found`);
    }
    const entity = readEntityByKey(key);
    if (!entity) {
      throw new Error(`Entity with id ${String(key)} not found`);
    }
    const subjectId = resolveSubjectId(key);
    if (subjectId === undefined) {
      throw new Error(`Entity with id ${String(key)} has no subject id`);
    }
    const handle = structuralStore.acquireSubjectHandleForKey(key);
    if (handle === undefined || handle.subjectId !== subjectId) {
      throw new Error(`Entity with id ${String(key)} has no acquired subject handle`);
    }
    // Facade binding lazily initializes the shared collection owner before
    // activation. Retain that obligation without constructing row/field nodes.
    if (getPositionRegistry(api)) getPositionIds();
    getSubjectStateSignal(subjectId)();
    const resolved = structuralStore.resolveSubjectHandle(handle);
    // Activation initialization may rekey or retire this lifetime. Follow the
    // acquired lifetime, never a replacement at the originally requested key.
    return resolved.state === 'active' ? readEntityByKey(resolved.key) : undefined;
  });

  defineEntityProjectionSeed(api as object, () => {
    const seed: Array<{ subjectId: number; key: K; row: E }> = [];
    // An absent collection seeds an empty projection, as `all()` reads.
    for (const key of absent() ? [] : structuralStore.activeKeysSnapshot()) {
      const subjectId = structuralStore.subjectIdForKey(key);
      if (subjectId === undefined) continue;
      const row = getProjectedEntity(key);
      if (row === undefined) continue;
      seed.push({ subjectId, key, row });
    }
    return seed as readonly {
      subjectId: number;
      key: string | number;
      row: unknown;
    }[];
  });

  Object.defineProperty(api, '__findKeyBySubjectId', {
    value: findKeyBySubjectId,
    enumerable: false,
    configurable: true,
  });
  Object.defineProperty(api, '__validateOrdinaryStructure', {
    value: validateOrdinaryStructure,
    enumerable: false,
  });
  Object.defineProperty(api, '__prepareOrdinaryRealization', {
    value: prepareOrdinaryRealization,
    enumerable: false,
    configurable: true,
  });
  Object.defineProperty(api, '__prepareStructuralUnit', { value: prepareStructuralUnit });
  Object.defineProperty(api, '__preparePointValues', {
    value: preparePointValues,
    enumerable: false,
    configurable: true,
  });
  Object.defineProperty(api, '__planFreshAdd', {
    value: planFreshAdd,
    enumerable: false,
    configurable: true,
  });
  Object.defineProperty(api, '__restoreOne', {
    value: restoreOne,
    enumerable: false,
    configurable: true,
  });
  Object.defineProperty(api, '__planRekey', {
    value: planRekey,
    enumerable: false,
    configurable: true,
  });
  Object.defineProperty(api, '__planPreparedRekey', {
    value: planPreparedRekey,
    enumerable: false,
    configurable: true,
  });
  Object.defineProperty(api, '__planRemove', {
    value: planRemove,
    enumerable: false,
    configurable: true,
  });
  Object.defineProperty(api, '__planRestore', {
    value: planRestore,
    enumerable: false,
    configurable: true,
  });
  if (positionId !== undefined) {
    Object.defineProperty(api, '__prepareTransitionTarget', {
      value: {
        owner: positionId,
        ownerPath: basePath,
        readSource: readTransitionSource,
        readOrderFrontier: () => structuralStore.activeOrderFrontier(),
        installCompensatedOrderFrontier: (frontier: unknown) =>
          structuralStore.installCompensatedOrderFrontier(frontier),
        prepareTarget: (target, prepare) =>
          prepare(
            {
              positionId,
              structuralStore,
              valueStore,
              ordinaryTopology,
              prepareOrdinaryRealization,
              activeIdSignal,
              subjectEpochs,
              subjectStateSignals,
              get membershipTap() {
                return membershipTap;
              },
              advanceEpochHandle,
              updateSignals,
              physicalCommitClock,
              pathNotifier,
              basePath,
              getPositionIdsForNotify,
              createStructuralEffectMeta,
              ambientMeta,
              emitTap,
              publishOrderChange(
                before,
                after,
                beforeFrontier,
                afterFrontier,
                ordinaryEndpoints,
                selectedDisposition
              ) {
                if (
                  survivingOrderChanged(before, after) ||
                  ordinaryEndpoints !== undefined
                )
                  publishOrderChange(
                    before,
                    after,
                    beforeFrontier,
                    afterFrontier,
                    ordinaryEndpoints,
                    selectedDisposition
                  );
              },
            },
            target
          ),
      } satisfies CollectionTransitionTargetBinding,
      enumerable: false,
      configurable: true,
    });
  }
  Object.defineProperty(api, '__inspectSubjectResources', {
    value: inspectSubjectResources,
    enumerable: false,
    configurable: true,
  });
  Object.defineProperty(api, '__listSubjectReclamationCandidates', {
    value: listSubjectReclamationCandidates,
    enumerable: false,
    configurable: true,
  });
  Object.defineProperty(api, '__acquireEntityHandleForTesting', {
    value: acquireEntityHandleForTesting,
    enumerable: false,
    configurable: true,
  });
  Object.defineProperty(api, '__resolveEntityHandleForTesting', {
    value: resolveEntityHandleForTesting,
    enumerable: false,
    configurable: true,
  });
  Object.defineProperty(api, '__rebuildActiveProjectionFromOwnersForTesting', {
    value: rebuildActiveProjectionFromOwners,
    enumerable: false,
    configurable: true,
  });
  Object.defineProperty(api, '__planSubjectReclamation', {
    value: (
      subjectId: number,
      options: EntitySubjectReclamationPlanningOptions
    ) => {
      const inventory = inspectSubjectResources(subjectId);
      return inventory
        ? planEntitySubjectReclamation(inventory, options)
        : undefined;
    },
    enumerable: false,
    configurable: true,
  });
  Object.defineProperty(api, '__prepareSubjectReclamation', {
    value: prepareSubjectReclamation,
    enumerable: false,
    configurable: true,
  });
  Object.defineProperty(api, '__applyPreparedSubjectReclamation', {
    value: applyPreparedSubjectReclamation,
    enumerable: false,
    configurable: true,
  });
  Object.defineProperty(api, '__retireSubjectRetainedValueBackingForTesting', {
    value: retireSubjectRetainedValueBackingForTesting,
    enumerable: false,
    configurable: true,
  });

  // ==================
  // PROXY FOR BRACKET NOTATION
  // ==================

  // The Proxy only handles bracket notation access (signal[id])
  // All methods are direct properties on api - no binding needed
  let warnedWrongMethods: Set<string> | undefined;
  const proxy = new Proxy(api as unknown as EntitySignal<E, K>, {
    get: (target: EntitySignal<E, K>, prop: string | symbol) => {
      // Handle string/number bracket access: signal[123] or signal['abc']
      if (typeof prop === 'string' && !isNaN(Number(prop))) {
        return api.byId(Number(prop) as K);
      }
      // Dev-mode guardrail: a known wrong-method name from another state
      // library → actionable hint instead of a later "undefined is not a
      // function". Only fires for names that are NOT real api members.
      if (
        (typeof ngDevMode === 'undefined' || ngDevMode) &&
        typeof prop === 'string' &&
        !(prop in (target as object)) &&
        WRONG_ENTITY_METHODS[prop] &&
        !(warnedWrongMethods ??= new Set<string>()).has(prop)
      ) {
        warnedWrongMethods.add(prop);
        console.warn(
          `SignalTree entityMap has no \`.${prop}()\`. Did you mean: ` +
            `${WRONG_ENTITY_METHODS[prop]}? [ST2002]`
        );
      }
      // All other access goes directly to api
      return (target as unknown as Record<string | symbol, unknown>)[prop];
    },
  });
  // The materializer stamps the returned collection identity, not its raw
  // proxy target. Source enrollment must retain that same identity.
  snapshotIdentity = proxy;
  defineEntityPublicationBinding(proxy as object, { source: entityPublication });
  return proxy;
}

Object.defineProperty(
  createEntitySignal,
  '__setPositionIdAllocatorForTesting',
  {
    value: setEntityPositionIdAllocatorForTesting,
    enumerable: false,
    configurable: true,
  }
);
Object.defineProperty(
  createEntitySignal,
  '__setPositionIdNotifyEnabledForTesting',
  {
    value: setEntityPositionIdNotifyEnabledForTesting,
    enumerable: false,
    configurable: true,
  }
);
