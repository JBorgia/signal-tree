import { NEUTRAL_CELL_RUNTIME } from './internals/cell-runtime';
import { NEUTRAL_DERIVED_RUNTIME } from './internals/derived-runtime';
import type { ReadableCell, WritableCell } from './internals/cell-runtime';
import { deepClone } from '@signaltree/shared';

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
import {
  defineOwnedOwnerPath,
} from './internals/owned-mutation';
import type { PhysicalCommitClock } from './internals/physical-commit-clock';
// Only `notify` is ever called on this — the neutral port contract, not the
// delivery engine's full surface.
import type { PathObservationPort } from './internals/path-observation-port';
import { getActiveWriteContext } from '../lib/write-context';
import { recordProductionSubstrateStat } from './internals/production-substrate-stats';
import { defineEntityProjectionSeed } from './internals/entity-projection-seed';
import { markOwnerInvalidated } from './internals/owner-invalidation-port';
import { markSnapshotDirty } from './internals/snapshot-authority';
import type { CellRuntime } from './internals/cell-runtime';
import type { DerivedRuntime } from './internals/derived-runtime';
import type { MutationCaptureRuntime } from './internals/mutation-capture-runtime';
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
  setProps: 'set leaves directly — entityMap has no props (Elf pattern)',
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
function setEntityPositionIdNotifyEnabledForTesting(
  enabled = true
): void {
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
    cellRuntime?: CellRuntime;
    derivedRuntime?: DerivedRuntime;
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
  }
): EntitySignal<E, K> {
  const cellRuntime = options?.cellRuntime ?? NEUTRAL_CELL_RUNTIME;
  const derivedRuntime = options?.derivedRuntime ?? NEUTRAL_DERIVED_RUNTIME;
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
  const version = cellRuntime.createCell(0);
  const snapshotOwner: { node?: object } = {};

  const createVersionedProjection = <TValue>(
    compute: () => TValue
  ): ReadableCell<TValue> => {
    let projectedVersion = -1;
    let initialized = false;
    let value: TValue;
    return derivedRuntime.createDerived(() => {
      const currentVersion = version();
      if (!initialized || projectedVersion !== currentVersion) {
        value = compute();
        projectedVersion = currentVersion;
        initialized = true;
      }
      return value;
    });
  };

  function getProjectedEntity(id: K): E | undefined {
    const subjectId = structuralStore.subjectIdForKey(id);
    return subjectId === undefined
      ? undefined
      : valueStore.backingForSubject(subjectId);
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

  function prepareTransitionTarget(target: CollectionTransitionTarget): {
    install(): void;
    publish(options?: { advancePhysicalRevision?: boolean }): void;
  } {
    if (positionId === undefined || target.owner !== positionId) {
      throw new Error('Collection transition target owner does not match the binding');
    }

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
      target.orderFrontier
    );
    const valueTarget = valueStore.prepareTargetValues(preparedSubjects);
    const affectedSubjects = new Set([
      ...currentSubjects.keys(),
      ...preparedSubjects.map(({ subjectId }) => subjectId),
    ]);
    const preparedBySubject = new Map(
      preparedSubjects.map((subject) => [subject.subjectId, subject])
    );
    const activeIdAfter =
      activeSubjectBefore === undefined
        ? undefined
        : preparedBySubject.get(activeSubjectBefore)?.key;
    const targetNeighborBySubject = new Map(
      target.order.map((subjectId, index) => [
        subjectId,
        {
          beforeSubject: target.order[index - 1],
          afterSubject: target.order[index + 1],
        },
      ])
    );
    const publications = [...affectedSubjects].map((subjectId) => {
      const before = currentSubjects.get(subjectId);
      const after = preparedBySubject.get(subjectId);
      return {
        subjectId,
        beforeKey: before?.key,
        afterKey: after?.key,
        beforeValue: before?.value,
        valueSignal: entitySignals.get(subjectId),
        stateSignal: subjectStateSignals.get(subjectId),
        afterValue: after?.value,
        bindingChanged: !before || !after || before.key !== after.key,
        targetNeighbors: targetNeighborBySubject.get(subjectId),
      };
    });

    return {
      install(): void {
        structuralStore.installPreparedTarget(structuralTarget);
        valueStore.installPreparedTargetValues(valueTarget);
      },
      publish(options): void {
        for (const publication of publications) {
          publication.valueSignal?.set(publication.afterValue);
          if (publication.bindingChanged) {
            publication.stateSignal?.update((value) => value + 1);
          }
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
            structuralEffect
              ? createStructuralEffectMeta(structuralEffect)
              : ambientMeta()
          );
        }
        if (activeIdBefore !== activeIdAfter) {
          activeIdSignal.set(activeIdAfter);
        }
        updateSignals();
        if (options?.advancePhysicalRevision !== false) {
          physicalCommitClock?.advance();
        }
      },
    };
  }

  function readTransitionSource(): CollectionTransitionTarget {
    if (positionId === undefined) {
      throw new Error('Collection transition binding has no owner PositionId');
    }
    const subjects = structuralStore.activeKeysSnapshot().map((key) => {
      const subject = structuralStore.subjectIdForKey(key);
      const value = subject === undefined
        ? undefined
        : valueStore.backingForSubject(subject);
      if (subject === undefined || value === undefined) {
        throw new Error('Collection transition source is missing active subject truth');
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

  function commitAndProjectEntityMutationFrame(
    frame: EntityMutationFrame<K, E>,
    options?: { advancePhysicalRevision?: boolean }
  ) {
    const result = frame.commit();
    if (options?.advancePhysicalRevision !== false) {
      physicalCommitClock?.advance();
    }
    return result;
  }

  /** Reactive signals for queries — all derived, none eagerly maintained. */
  const allSignal: ReadableCell<E[]> = createVersionedProjection(() => {
    const entities = getProjectedEntities();
    // `sortComparer` gives `all`/`ids` a stable sorted order (parity with
    // @ngrx/entity); `map` keeps insertion order.
    if (config.sortComparer) entities.sort(config.sortComparer);
    return entities;
  });
  const countSignal: ReadableCell<number> = createVersionedProjection(() => {
    // O(1) — this used to be `entities.length` on a freshly built array.
    return structuralStore.activeKeyCount();
  });
  const idsSignal: ReadableCell<K[]> = createVersionedProjection(() => {
    return config.sortComparer
      ? allSignal().map((e) => selectId(e))
      : [...structuralStore.activeKeysSnapshot()];
  });
  const mapSignal: ReadableCell<ReadonlyMap<K, E>> = createVersionedProjection(() => {
    // Still a copy: callers may hold the result across mutations and must not
    // see it change underneath them. But it is paid on read, not on write.
    return new Map(getProjectedEntries());
  });

  /**
   * Per-entity signals — the body-granular reactivity layer.
   *
   * Each entity that is read via `byId()`/node access gets its own
   * `WritableCell<E | undefined>`. Per-entity field reads and `node()`
   * depend ONLY on this signal, not on the whole-collection `mapSignal`, so
   * updating one entity dirties only that entity's readers (fan-out 1) instead
   * of every entity's computeds (fan-out N). Collection queries (`all`, `map`,
   * `count`, `ids`, `where`, `find`, computed slices) still depend on the
   * collection signals and recompute on any change — which is correct.
   *
   * Materialized lazily (on first `byId`/node access) and kept O(1) per
   * mutation by only syncing the entities that actually changed.
   */
  const entitySignals = new Map<number, WritableCell<E | undefined>>();
  const structuralStore = new StructuralStore<K>();
  const valueStore = new EntityValueStore<E>();
  const subjectStateSignals = new Map<number, WritableCell<number>>();
  const ownerMetadataEnabled = options?.ownerMetadataEnabled ?? true;
  const subjectMetadataEnabled =
    options?.subjectMetadataEnabled ?? ownerMetadataEnabled;
  const positionMetadataEnabled = options?.positionMetadataEnabled ?? true;
  const hasRestorationAuthority = options?.hasRestorationAuthority ?? true;
  const ownerId = options?.ownerId;
  const physicalCommitClock = options?.physicalCommitClock;
  const mutationCaptureRuntime = options?.mutationCaptureRuntime;
  const positionId = (
    options?.positionIdAllocator ??
    (positionMetadataEnabled
      ? entityPositionIdAllocatorOverride ?? standaloneEntityPositionIdAllocator
      : undefined)
  )?.();
  let lastSubjectIds: number[] | undefined;

  type PendingStructuralEffect = StructuralEffect;
  type PendingAddStructuralEffect = Extract<PendingStructuralEffect, { kind: 'add' }>;

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
    return positionId === undefined ? undefined : [positionId];
  }

  function getPositionIdsForNotify(): number[] | undefined {
    return entityPositionIdNotifyEnabled ? getPositionIds() : undefined;
  }

  function createStructuralEffectMeta(
    effect: PendingStructuralEffect
  ): WriteMetadata {
    const meta = ambientMeta();
    return {
      ...(meta ?? {}),
      structuralEffect: effect,
    };
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
  const predicateWindows = new Map<string, { count: number; start: number }>();
  const warnedPredicates = new Set<string>();
  /** Distinct identities within {@link PREDICATE_CHURN_WINDOW_MS} to accuse. */
  const PREDICATE_CHURN_THRESHOLD = 12;
  /** ~6 identities/second is well above user-driven, well below a frame loop. */
  const PREDICATE_CHURN_WINDOW_MS = 2000;

  function warnOnPredicateChurn(
    method: 'where' | 'find',
    predicate: (entity: E) => boolean
  ): void {
    const source = String(predicate);
    // Guard against pathological state growth in a long dev session: the map is
    // only ever as large as the number of DISTINCT predicate sources.
    if (predicateWindows.size > 200 || warnedPredicates.has(source)) return;

    const now =
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    const window = predicateWindows.get(source);
    if (!window || now - window.start > PREDICATE_CHURN_WINDOW_MS) {
      // A fresh window, not an increment. This is what makes a slow drip of
      // legitimately-rebuilt predicates never accumulate to an accusation.
      predicateWindows.set(source, { count: 1, start: now });
      return;
    }
    window.count++;
    if (window.count < PREDICATE_CHURN_THRESHOLD) return;

    warnedPredicates.add(source);
    const perSecond = Math.round(
      (window.count / Math.max(now - window.start, 1)) * 1000
    );
    console.warn(
      `SignalTree: \`${method}()\` received ${window.count} DIFFERENT functions ` +
      `with identical source in ${Math.round(now - window.start)}ms ` +
      `(~${perSecond}/second) — a rate only change detection produces. ` +
      `Results are memoised per predicate IDENTITY, so an inline arrow misses ` +
      `the cache every cycle and re-scans the collection: measured at 75x a ` +
      `hoisted predicate over 1,000 entities. Hoist it to a stable reference ` +
      `(a class field or module constant) and call ` +
      `\`${method}(thePredicate)()\`. Source: ${source.slice(0, 80)} [ST2026]`
    );
  }

  /** Subjects that have moved to a new key and must not fall back to the old one. */
  const rekeyedSubjects = new Set<number>();

  function planRekey(from: K, to: K): {
    commit(options?: { advancePhysicalRevision?: boolean }): void;
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
        commit(): void {
          lastSubjectIds = [noOpSubjectId];
        },
        publish(): void {
          // no-op
        },
      };
    }
    if (structuralStore.hasActiveKey(to)) {
      throw new Error(`Cannot change id to ${String(to)}: already in use`);
    }

    const subjectId = allocateSubjectId(from);
    const structuralEffect: PendingStructuralEffect = {
      kind: 'rekey',
      subject: subjectId,
      beforeKey: from,
      afterKey: to,
    };

    return {
      commit(options?: { advancePhysicalRevision?: boolean }): void {
        const transfer: PreparedKeyTransfer<K> = {
          kind: 'transfer-key',
          fromKey: from,
          toKey: to,
          subjectId,
        };
        const frame = createEntityMutationFrame();
        frame.stageKeyTransfer(transfer);
        const result = commitAndProjectEntityMutationFrame(frame, options);
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

        if (activeIdSignal() === from) {
          activeIdSignal.set(to);
        }

        syncEntitySignal(to);
        updateSignals();
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
          {
            ...(meta ?? {}),
            structuralEffect,
          }
        );
      },
    };
  }

  function planPreparedRekey(
    from: K,
    to: K,
    subjectId: number,
    entity: E
  ): {
    commit(options?: { advancePhysicalRevision?: boolean }): void;
    publish(metaOverride?: WriteMetadata): void;
  } {
    if (from === to) {
      // Same rule as `planRekey`'s no-op branch: the interceptor fires on the
      // call, so the latch must name the addressed subject even when the
      // rekey changes nothing. RESTORATION-REKEY-CLAIM-WIDTH-0.
      return {
        commit(): void {
          lastSubjectIds = [subjectId];
        },
        publish(): void {
          // no-op
        },
      };
    }

    const structuralEffect: PendingStructuralEffect = {
      kind: 'rekey',
      subject: subjectId,
      beforeKey: from,
      afterKey: to,
    };

    return {
      commit(options?: { advancePhysicalRevision?: boolean }): void {
        const transfer: PreparedKeyTransfer<K> = {
          kind: 'transfer-key',
          fromKey: from,
          toKey: to,
          subjectId,
        };
        const frame = createEntityMutationFrame();
        frame.stageKeyTransfer(transfer);
        const result = commitAndProjectEntityMutationFrame(frame, options);
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

        if (activeIdSignal() === from) {
          activeIdSignal.set(to);
        }

        syncEntitySignal(to);
        updateSignals();
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
          {
            ...(meta ?? {}),
            structuralEffect,
          }
        );
      },
    };
  }

  /** Active-entity selection. See the `activeId`/`activeEntity` accessors. */
  const activeIdSignal = cellRuntime.createCell<K | undefined>(undefined);
  let cachedActiveEntity: ReadableCell<E | undefined> | undefined;

  /**
   * Re-orders `storage` so the given ids come first, in the order given.
   *
   * Only the map's iteration order changes; no per-entity signal is touched, so
   * prepending does not invalidate any row's consumers. The derived collection
   * signals pick the new order up from the version bump.
   */
  function moveToFront(ids: K[]): void {
    structuralStore.moveKeysToFront(ids);
    physicalCommitClock?.advance();
    updateSignals();
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
  function getEntitySignal(id: K): WritableCell<E | undefined> {
    const subjectId = resolveSubjectId(id);
    if (subjectId === undefined) {
      return cellRuntime.createCell<E | undefined>(getProjectedEntity(id));
    }

    let s = entitySignals.get(subjectId);
    if (!s) {
      s = cellRuntime.createCell<E | undefined>(valueStore.backingForSubject(subjectId));
      entitySignals.set(subjectId, s);
    }
    return s;
  }

  function getSubjectStateSignal(subjectId: number): WritableCell<number> {
    let s = subjectStateSignals.get(subjectId);
    if (!s) {
      s = cellRuntime.createCell(0);
      subjectStateSignals.set(subjectId, s);
    }
    return s;
  }

  function bumpSubjectStateSignal(subjectId: number): void {
    // Publish only to an activation token that already exists. Interning here
    // would recreate eager realization through the write path: any subject that
    // is ever mutated would acquire a token whether or not anything observes it.
    subjectStateSignals.get(subjectId)?.update((value) => value + 1);
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
    structuralStore.createSubject(subjectId, id);
    return subjectId;
  }

  function commitFreshSubjects(ids: readonly K[]): number[] {
    return ids.map((id) => commitFreshSubject(id));
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
    commit(options?: { advancePhysicalRevision?: boolean }): void;
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
        `Subject ${String(subjectId)} has retired backing and cannot be restored.`
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
      commit(options?: { advancePhysicalRevision?: boolean }): void {
        const frame = createEntityMutationFrame();
        frame.stageSubjectRestore(restoration);
        const result = commitAndProjectEntityMutationFrame(frame, options);
        for (const changedSubjectId of result.physicallyChangedSubjectIds) {
          publishSubjectPhysicalChange(changedSubjectId);
        }
        lastSubjectIds = [subjectId];
        syncEntitySignal(key);
        updateSignals();
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
      },
    };
  }

  function planFreshAdd(
    key: K,
    entity: E,
    subjectId: number
  ): {
    commit(options?: { advancePhysicalRevision?: boolean }): void;
    publish(metaOverride?: WriteMetadata): void;
  } {
    const existingState = resolveSubjectState(subjectId);
    if (existingState) {
      throw new Error(
        `Subject ${String(subjectId)} already exists and cannot be realized as fresh.`
      );
    }

    return {
      commit(options?: { advancePhysicalRevision?: boolean }): void {
        const frame = createEntityMutationFrame();
        frame.stageFreshSubject({
          kind: 'create-fresh-subject',
          key,
          subjectId,
          nextValue: entity,
        });
        commitAndProjectEntityMutationFrame(frame, options);
        lastSubjectIds = [subjectId];
        invalidateNodeCache(key);
        syncEntitySignal(key);
        updateSignals();
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
      },
    };
  }

  function planRemove(
    key: K,
    subjectId: number
  ): {
    commit(options?: { advancePhysicalRevision?: boolean }): void;
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
      commit(options?: { advancePhysicalRevision?: boolean }): void {
        const frame = createEntityMutationFrame();
        frame.stageSubjectTombstone(tombstone);
        const result = commitAndProjectEntityMutationFrame(frame, options);
        for (const changedSubjectId of result.physicallyChangedSubjectIds) {
          publishSubjectPhysicalChange(changedSubjectId);
        }
        lastSubjectIds = [subjectId];
        tombstoneSubjectSignal(subjectId);
        updateSignals();
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

        for (const handler of tapHandlers) {
          handler.onRemove?.(key, entity);
        }
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

  function assertSynchronousInterceptors(handlers: InterceptHandlers<E, K>): void {
    assertSynchronousInterceptorFunction(handlers.onAdd, 'onAdd');
    assertSynchronousInterceptorFunction(handlers.onUpdate, 'onUpdate');
    assertSynchronousInterceptorFunction(handlers.onRemove, 'onRemove');
  }

  function interceptAddedEntity(entity: E): E {
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

  function interceptUpdatedEntity(id: K, changes: Partial<E>): Partial<E> {
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

  function addOneWithStructuralEffect(
    entity: E,
    opts?: AddOptions<E, K>
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
      throw new Error(`Fresh subject planning for ${String(id)} did not produce an id.`);
    }

    const frame = createEntityMutationFrame();
    const freshSubject: PreparedFreshSubject<K, E> = {
      kind: 'create-fresh-subject',
      key: id,
      subjectId,
      nextValue: transformedEntity,
    };
    frame.stageFreshSubject(freshSubject);
    commitAndProjectEntityMutationFrame(frame);
    const structuralEffect: PendingAddStructuralEffect = {
      kind: 'add',
      subject: subjectId,
      key: id,
      value: deepClone(transformedEntity),
      beforeSubject:
        previousLastKey === undefined ? undefined : allocateSubjectId(previousLastKey),
    };
    lastSubjectIds = [subjectId];
    invalidateNodeCache(id);
    syncEntitySignal(id);
    updateSignals();

    pathNotifier.notify(
      `${basePath}.${String(id)}`,
      transformedEntity,
      undefined,
      basePath,
      [subjectId],
      getPositionIdsForNotify(),
      createStructuralEffectMeta(structuralEffect)
    );

    for (const handler of tapHandlers) {
      handler.onAdd?.(transformedEntity, id);
    }

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

    const s = entitySignals.get(subjectId);
    if (s) s.set(valueStore.backingForSubject(subjectId));
  }

  /**
   * Release one subject's entity signal on removal: notify current observers
   * that the entity is gone (set undefined). The signal itself is kept keyed by
   * SubjectId so held field references stay valid (they read undefined) and a
   * restore of the same subject re-publishes through the same signal.
   */
  function tombstoneSubjectSignal(subjectId: number): void {
    entitySignals.get(subjectId)?.set(undefined);
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
        `SignalTree entityMap${basePath ? ` at "${basePath}"` : ''
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

  /** Handlers for blocking/transforming */
  const interceptHandlers: InterceptHandlers<E, K>[] = [];

  // ==================
  // INTERNAL HELPERS
  // ==================

  /** Mark the collection dirty. O(1) — see the `version` docs above. */
  function updateSignals(): void {
    version.update((v) => v + 1);
    if (snapshotOwner.node) markSnapshotDirty(snapshotOwner.node);
    markOwnerInvalidated(ownerId);
  }

  function createEntityNode(subjectId: number, initialKey: K, entity: E): EntityNode<E> {
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

    const currentKey = (): K | undefined => {
      getSubjectStateSignal(subjectId)();
      const resolved = structuralStore.resolveSubjectHandle(handle);
      return resolved.state === 'active' ? resolved.key : undefined;
    };

    const entitySig = () => {
      const key = currentKey();
      return key === undefined ? undefined : getEntitySignal(key)();
    };

    const node = ((valueOrUpdater?: E | ((current: E) => E)): E | undefined => {
      if (valueOrUpdater === undefined) {
        return entitySig();
      }
      const key = currentKey();
      if (key === undefined) {
        throw new Error(`Entity with subject ${String(subjectId)} not found`);
      }
      const current = getProjectedEntity(key);
      if (current === undefined) {
        throw new Error(`Entity with id ${String(key)} not found`);
      }
      const next =
        typeof valueOrUpdater === 'function'
          ? (valueOrUpdater as (c: E) => E)(current)
          : (valueOrUpdater as E);
      api.replaceOne(key, next);
      return undefined;
    }) as unknown as EntityNode<E>;

    // Field properties: Option B+ computed-based shim.
    // Each field returns a getDerivedRuntime().createDerived(() => field_value) with .set()/.update()/.asReadonly()
    // attached so that isSignal() returns true and toObservable() works.
    // Writes delegate to api.updateOne which runs interceptors and tap handlers.
    for (const key of Object.keys(entity)) {
      const fieldKey = key as keyof E;
      const fieldSignal = derivedRuntime.createDerived(() => entitySig()?.[fieldKey]);

      Object.assign(fieldSignal, {
        set: (value: E[typeof fieldKey]) => {
          const key = currentKey();
          if (key === undefined) {
            throw new Error(`Entity with subject ${String(subjectId)} not found`);
          }
          api.updateOne(key, { [fieldKey]: value } as Partial<E>);
        },
        update: (
          fn: (current: E[typeof fieldKey] | undefined) => E[typeof fieldKey]
        ) => {
          const key = currentKey();
          if (key === undefined) {
            throw new Error(`Entity with subject ${String(subjectId)} not found`);
          }
          api.updateOne(key, {
            [fieldKey]: fn(entitySig()?.[fieldKey]),
          } as Partial<E>);
        },
        asReadonly: () => fieldSignal,
      });

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
        : Object.keys(node as Record<string, unknown>).filter((key) =>
          typeof (node as Record<string, unknown>)[key] === 'function'
        ).sort((left, right) => left.localeCompare(right));

    return {
      subjectId,
      state: subjectState.active ? 'active' : 'tombstoned',
      subjectRevision: getSubjectRevision(subjectId),
      activeKey: subjectState.active ? subjectState.key : undefined,
      retainedSubjectState: structuralStore.hasSubject(subjectId),
      entitySignal: entitySignals.has(subjectId),
      activationToken: subjectStateSignals.has(subjectId),
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
        `Prepared reclamation for subject ${String(prepared.subjectId)} has an unsupported expected lifetime.`
      );
    }
    if (!state) {
      throw new Error(
        `Prepared reclamation for subject ${String(prepared.subjectId)} no longer matches active lifetime state.`
      );
    }
    if (getSubjectRevision(prepared.subjectId) !== prepared.expectedSubjectRevision) {
      throw new Error(
        `Prepared reclamation for subject ${String(prepared.subjectId)} is stale.`
      );
    }
    if (state.active) {
      throw new Error(
        `Prepared reclamation for subject ${String(prepared.subjectId)} no longer matches active lifetime state.`
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
      entitySignals.delete(prepared.subjectId);
    }

    const result = commitAndProjectEntityMutationFrame(frame);
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
      if (!valueStore.hasRetainedValueBacking(subjectId)) {
        continue;
      }
      const retirement: PreparedRetainedValueRetirement = {
        kind: 'retire-retained-value',
        subjectId,
        forgetLifetime: true,
      };
      frame.stageRetainedValueRetirement(retirement);
      entitySignals.delete(subjectId);
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

  function retireSubjectRetainedValueBackingForTesting(subjectId: number): void {
    const subjectState = resolveSubjectState(subjectId);
    if (!subjectState || subjectState.active) {
      throw new Error(
        `Subject ${String(subjectId)} must be tombstoned before retiring retained value backing.`
      );
    }

    valueStore.retireSubjectValue(subjectId);
    entitySignals.delete(subjectId);
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
      if (structuralStore.hasActiveKey(id)) {
        // Present: subscribe to the PER-ENTITY signal only, so callers re-run
        // when THIS entity changes but not when others do (body-granular).
        // Materialized lazily here — bounded by the number of live entities.
        const entity = getEntitySignal(id)();
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
      return allSignal;
    },

    get count(): ReadableCell<number> {
      return countSignal;
    },

    get ids(): ReadableCell<K[]> {
      return idsSignal;
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
      return mapSignal;
    },

    // ── Active entity ───────────────────────────────────────────────────────
    get activeId(): ReadableCell<K | undefined> {
      return activeIdSignal.asReadonly();
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
      return (cachedActiveEntity ??= derivedRuntime.createDerived(() => {
        const id = activeIdSignal();
        if (id === undefined) return undefined;
        return getEntitySignal(id)();
      }));
    },

    setActiveId(id: K | undefined): void {
      // Not an error when the id is absent: selection frequently outlives the
      // row (a delete arriving from a socket while a detail pane is open), and
      // `activeEntity` already resolves to undefined in that case.
      const previous = activeIdSignal();
      activeIdSignal.set(id);
      if (!Object.is(previous, activeIdSignal())) markOwnerInvalidated(ownerId);
    },

    clearActiveId(): void {
      const previous = activeIdSignal();
      activeIdSignal.set(undefined);
      if (!Object.is(previous, activeIdSignal())) markOwnerInvalidated(ownerId);
    },

    has(id: K): ReadableCell<boolean> {
      return createVersionedProjection(() => structuralStore.hasActiveKey(id));
    },

    // Bare canonical name (the `.isEmpty` alias was removed in v11).
    get empty(): ReadableCell<boolean> {
      return (cachedEmpty ??= derivedRuntime.createDerived(() => countSignal() === 0));
    },

    where(predicate: (entity: E) => boolean): ReadableCell<E[]> {
      const cached = whereCache.get(predicate);
      if (cached) return cached;

      if (typeof ngDevMode === 'undefined' || ngDevMode) {
        warnOnPredicateChurn('where', predicate);
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
        if (config.sortComparer) return allSignal().filter(predicate);
        const out: E[] = [];
        for (const entity of getProjectedEntities()) {
          if (predicate(entity)) out.push(entity);
        }
        return out;
      });
      whereCache.set(predicate, s);
      return s;
    },

    find(predicate: (entity: E) => boolean): ReadableCell<E | undefined> {
      const cached = findCache.get(predicate);
      if (cached) return cached;

      if (typeof ngDevMode === 'undefined' || ngDevMode) {
        warnOnPredicateChurn('find', predicate);
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
        if (config.sortComparer) return allSignal().find(predicate);
        for (const entity of getProjectedEntities()) {
          if (predicate(entity)) return entity;
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

    /**
     * Insert at the FRONT, reusing `addOne` and then moving the entry.
     *
        if (structuralStore.hasActiveKey(id)) {
     * so the entry order is rebuilt — O(n) in the number of entities. That is
     * still markedly cheaper than the `setAll([entity, ...existing])` this
     * replaces, which rebuilds the storage map AND resets every per-entity
     * signal: only the newcomer's signal changes here, so held nodes survive and
     * no unrelated row's consumers are invalidated.
     *
     * Reusing `addOne` rather than duplicating it keeps duplicate-detection,
     * interceptors, notifier and tap handlers on exactly one path.
     */
    prependOne(entity: E, opts?: AddOptions<E, K>): K {
      const previousFirstKey = structuralStore.firstActiveKey();
      const { id, structuralEffect } = addOneWithStructuralEffect(entity, opts);
      moveToFront([id]);
      rewritePendingAddEffect(
        structuralEffect,
        undefined,
        previousFirstKey === undefined
          ? undefined
          : allocateSubjectId(previousFirstKey)
      );
      return id;
    },

    prependMany(entities: E[], opts?: AddManyOptions<E, K>): K[] {
      const ids = api.addMany(entities, opts);
      // Front, in the order given — so `prependMany([a, b])` reads back as
      // [a, b, ...existing], which is what the call site looks like.
      moveToFront(ids);
      return ids;
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
      const planned = planRekey(from, to);
      planned.commit();
      planned.publish();
    },

    addMany(entities: E[], opts?: AddManyOptions<E, K>): K[] {
      const mode = opts?.mode ?? 'strict';
      const previousKeys = [...structuralStore.activeKeysSnapshot()];

      // First pass: validate/filter based on mode
      const toProcess: Array<{
        entity: E;
        id: K;
        existingSubjectId?: number;
      }> = [];
      for (const entity of entities) {
        const id = deriveId(entity, opts);
        const existingSubjectId = structuralStore.subjectIdForKey(id);
        if (existingSubjectId !== undefined) {
          if (mode === 'strict') {
            throw new Error(`Entity with id ${String(id)} already exists`);
          } else if (mode === 'skip') {
            continue;
          }
          // 'overwrite': fall through — the projection helper below replaces the existing entry
        }
        toProcess.push({ entity, id, existingSubjectId });
      }

      if (toProcess.length === 0) return [];

      // Stage all add work before mutating runtime state so a later failure
      // cannot partially allocate fresh subject lifetimes.
      const stagedAdds = toProcess.map(({ entity, id, existingSubjectId }) => ({
        id,
        entity: interceptAddedEntity(entity),
        existingSubjectId,
      }));
      const plannedFreshSubjectIds = structuralStore.planFreshSubjectIds(
        stagedAdds.filter(({ existingSubjectId }) => existingSubjectId === undefined).length
      );
      let plannedFreshIndex = 0;
      const preparedAdds = stagedAdds.map(({ id, entity, existingSubjectId }) => ({
        id,
        entity,
        existingSubjectId,
        subjectId:
          existingSubjectId ?? plannedFreshSubjectIds[plannedFreshIndex++],
      }));

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
        });
      }

      commitAndProjectEntityMutationFrame(frame);
      const subjectIdsByKey = new Map<K, number>();
      for (const { id, subjectId } of preparedAdds) {
        subjectIdsByKey.set(id, subjectId);
      }

      // Process all entities without triggering per-entity signal updates
      const processedIds: K[] = [];
      const addedEntities: Array<{ id: K; entity: E; subjectId: number }> = [];

      for (const {
        entity: transformedEntity,
        id,
      } of preparedAdds) {
        const subjectId = subjectIdsByKey.get(id);
        if (subjectId === undefined) {
          throw new Error(`Entity with id ${String(id)} has no subject id`);
        }
        invalidateNodeCache(id);
        syncEntitySignal(id);
        processedIds.push(id);
        addedEntities.push({ id, entity: transformedEntity, subjectId });
      }

      // Single signal update after all entities are processed
      updateSignals();

      const subjectIdsForWrite = processedIds.map((id) => {
        const subjectId = subjectIdsByKey.get(id);
        if (subjectId === undefined) {
          throw new Error(`Entity with id ${String(id)} has no subject id`);
        }
        return subjectId;
      });
      lastSubjectIds = subjectIdsForWrite;

      // Notify PathNotifier for each processed entity
      for (let i = 0; i < addedEntities.length; i++) {
        const { id, entity } = addedEntities[i];
        const beforeKey = previousKeys.at(i + previousKeys.length - addedEntities.length);
        pathNotifier.notify(
          `${basePath}.${String(id)}`,
          entity,
          undefined,
          basePath,
          [subjectIdsForWrite[i]],
          getPositionIdsForNotify(),
          createStructuralEffectMeta({
            kind: 'add',
            subject: subjectIdsForWrite[i],
            key: id,
            value: deepClone(entity),
            beforeSubject:
              beforeKey === undefined ? undefined : allocateSubjectId(beforeKey),
          })
        );
      }

      // Run tap handlers for each processed entity
      for (const { id, entity } of addedEntities) {
        for (const handler of tapHandlers) {
          handler.onAdd?.(entity, id);
        }
      }

      return processedIds;
    },

    // ==================
    // MUTATIONS: UPDATE
    // ==================

    updateOne(id: K, changes: Partial<E>): void {
      const entity = getProjectedEntity(id);
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
      const subjectIdsForWrite = rememberSubjectIds([id]);
      const replacement: PreparedValueReplacement<K, E> = {
        kind: 'replace-value',
        key: id,
        subjectId: subjectIdsForWrite[0],
        nextValue: finalUpdated,
      };
      const frame = createEntityMutationFrame();
      frame.stageValueReplacement(replacement);
      commitAndProjectEntityMutationFrame(frame);
      syncEntitySignal(id);
      updateSignals();

      // Notify PathNotifier
      pathNotifier.notify(
        `${basePath}.${String(id)}`,
        finalUpdated,
        prev,
        basePath,
        subjectIdsForWrite,
        getPositionIdsForNotify(),
        ambientMeta()
      );

      // Run tap handlers
      for (const handler of tapHandlers) {
        handler.onUpdate?.(id, transformedChanges, finalUpdated);
      }
    },

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
    replaceOne(id: K, entity: E): void {
      const prev = getProjectedEntity(id);
      if (!prev) {
        throw new Error(`Entity with id ${String(id)} not found`);
      }

      let next = entity;
      for (const handler of interceptHandlers) {
        const ctx: InterceptContext<Partial<E>> = {
          block: (reason?: string) => {
            throw new Error(
              `Cannot replace entity: ${reason || 'blocked by interceptor'}`
            );
          },
          transform: (value: Partial<E>) => {
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

      const replacement: PreparedValueReplacement<K, E> = {
        kind: 'replace-value',
        key: id,
        subjectId,
        nextValue: next,
      };
      const frame = createEntityMutationFrame();
      frame.stageValueReplacement(replacement);
      commitAndProjectEntityMutationFrame(frame);
      syncEntitySignal(id);
      updateSignals();
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
        ambientMeta()
      );
      for (const handler of tapHandlers) {
        handler.onUpdate?.(id, next as Partial<E>, next);
      }
    },

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
        const entity = getProjectedEntity(id);
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
      for (const { id, subjectId, finalUpdated } of updatedEntities) {
        frame.stageValueReplacement({
          kind: 'replace-value',
          key: id,
          subjectId,
          nextValue: finalUpdated,
        });
      }
      commitAndProjectEntityMutationFrame(frame);

      for (const { id } of updatedEntities) {
        syncEntitySignal(id);
      }

      // Single signal update after all entities are updated
      updateSignals();

      const subjectIdsForWrite = rememberSubjectIds(ids);

      // Notify PathNotifier for each updated entity
      for (let i = 0; i < updatedEntities.length; i++) {
        const { id, prev, finalUpdated } = updatedEntities[i];
        pathNotifier.notify(
          `${basePath}.${String(id)}`,
          finalUpdated,
          prev,
          basePath,
          [subjectIdsForWrite[i]],
          getPositionIdsForNotify(),
          ambientMeta()
        );
      }

      // Run tap handlers for each updated entity
      for (const { id, transformedChanges, finalUpdated } of updatedEntities) {
        for (const handler of tapHandlers) {
          handler.onUpdate?.(id, transformedChanges, finalUpdated);
        }
      }
    },

    updateWhere(
      predicate: (entity: E) => boolean,
      changes: Partial<E>
    ): number {
      const idsToUpdate: K[] = [];
      for (const [id, entity] of getProjectedEntries()) {
        if (predicate(entity)) {
          idsToUpdate.push(id);
        }
      }
      if (idsToUpdate.length > 0) {
        api.updateMany(idsToUpdate, changes);
      }
      return idsToUpdate.length;
    },

    // ==================
    // MUTATIONS: REMOVE
    // ==================

    removeOne(id: K): void {
      const entity = getProjectedEntity(id);
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
      const result = commitAndProjectEntityMutationFrame(frame);
      for (const changedSubjectId of result.physicallyChangedSubjectIds) {
        publishSubjectPhysicalChange(changedSubjectId);
      }
      tombstoneSubjectSignal(subjectIdsForWrite[0]);
      reclaimRetiredSubjectsWithoutOwner([subjectIdsForWrite[0]]);
      updateSignals();

      // Notify PathNotifier
      pathNotifier.notify(
        `${basePath}.${String(id)}`,
        undefined,
        entity,
        basePath,
        subjectIdsForWrite,
        getPositionIdsForNotify(),
        createStructuralEffectMeta(structuralEffect)
      );

      // Run tap handlers
      for (const handler of tapHandlers) {
        handler.onRemove?.(id, entity);
      }
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
        const entity = getProjectedEntity(id);
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

      const subjectIdsForWrite = preparedRemovals.map(({ subjectId }) => subjectId);
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

      const result = commitAndProjectEntityMutationFrame(frame);
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
      updateSignals();

      // Notify PathNotifier for each removed entity
      for (let i = 0; i < preparedRemovals.length; i++) {
        const {
          id,
          entity,
          beforeSubject,
          afterSubject,
        } = preparedRemovals[i];
        pathNotifier.notify(
          `${basePath}.${String(id)}`,
          undefined,
          entity,
          basePath,
          [subjectIdsForWrite[i]],
          getPositionIdsForNotify(),
          createStructuralEffectMeta({
            kind: 'remove',
            subject: subjectIdsForWrite[i],
            key: id,
            value: deepClone(entity),
            beforeSubject,
            afterSubject,
          })
        );
      }

      // Run tap handlers for each removed entity
      for (const { id, entity } of preparedRemovals) {
        for (const handler of tapHandlers) {
          handler.onRemove?.(id, entity);
        }
      }
    },

    removeWhere(predicate: (entity: E) => boolean): number {
      const idsToRemove: K[] = [];
      for (const [id, entity] of getProjectedEntries()) {
        if (predicate(entity)) {
          idsToRemove.push(id);
        }
      }
      if (idsToRemove.length > 0) {
        api.removeMany(idsToRemove);
      }
      return idsToRemove.length;
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

      // Separate adds from updates
      const toAdd: Array<{ entity: E; id: K }> = [];
      const toUpdate: Array<{ entity: E; id: K; prev: E; subjectId: number }> = [];

      for (const entity of entities) {
        const id = deriveId(entity, opts);
        const existing = getProjectedEntity(id);
        if (existing !== undefined) {
          const subjectId = resolveSubjectId(id);
          if (subjectId === undefined) {
            throw new Error(`Entity with id ${String(id)} has no subject id`);
          }
          toUpdate.push({ entity, id, prev: existing, subjectId });
        } else {
          toAdd.push({ entity, id });
        }
      }

      const stagedAdds = toAdd.map(({ entity, id }) => ({
        id,
        entity: interceptAddedEntity(entity),
      }));

      const stagedUpdates = toUpdate.map(({ entity, id, prev, subjectId }) => {
        const transformedChanges = interceptUpdatedEntity(id, entity);
        return {
          id,
          subjectId,
          prev,
          transformedChanges,
          finalUpdated: { ...prev, ...transformedChanges },
        };
      });

      const freshSubjectIds = commitFreshSubjects(stagedAdds.map(({ id }) => id));
      const addedSubjectIdsByKey = new Map<K, number>();
      for (let i = 0; i < stagedAdds.length; i++) {
        addedSubjectIdsByKey.set(stagedAdds[i].id, freshSubjectIds[i]);
      }

      // Process adds
      const addedEntities: Array<{ id: K; entity: E; subjectId: number }> = [];
      for (const { entity: transformedEntity, id } of stagedAdds) {
        const subjectId = addedSubjectIdsByKey.get(id);
        if (subjectId === undefined) {
          throw new Error(`Entity with id ${String(id)} has no subject id`);
        }
        valueStore.retainSubjectValue(subjectId, transformedEntity);
        invalidateNodeCache(id);
        syncEntitySignal(id);
        addedEntities.push({ id, entity: transformedEntity, subjectId });
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
        valueStore.retainSubjectValue(subjectId, finalUpdated);
        syncEntitySignal(id);
        updatedEntities.push({ id, subjectId, prev, finalUpdated, transformedChanges });
      }

      // Single signal update after all entities are processed
      updateSignals();

      const addedSubjectIdsForWrite = addedEntities.map(({ subjectId }) => subjectId);
      const updatedSubjectIdsForWrite = updatedEntities.map(({ subjectId }) => subjectId);
      lastSubjectIds = [...addedSubjectIdsForWrite, ...updatedSubjectIdsForWrite];

      // Notify PathNotifier for added entities
      for (let i = 0; i < addedEntities.length; i++) {
        const { id, entity } = addedEntities[i];
        pathNotifier.notify(
          `${basePath}.${String(id)}`,
          entity,
          undefined,
          basePath,
          [addedSubjectIdsForWrite[i]],
          getPositionIdsForNotify()
        );
      }

      // Notify PathNotifier for updated entities
      for (let i = 0; i < updatedEntities.length; i++) {
        const { id, prev, finalUpdated } = updatedEntities[i];
        pathNotifier.notify(
          `${basePath}.${String(id)}`,
          finalUpdated,
          prev,
          basePath,
          [updatedSubjectIdsForWrite[i]],
          getPositionIdsForNotify()
        );
      }

      // Run tap handlers for added entities
      for (const { id, entity } of addedEntities) {
        for (const handler of tapHandlers) {
          handler.onAdd?.(entity, id);
        }
      }

      // Run tap handlers for updated entities
      for (const { id, transformedChanges, finalUpdated } of updatedEntities) {
        for (const handler of tapHandlers) {
          handler.onUpdate?.(id, transformedChanges, finalUpdated);
        }
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

      for (const { id, subjectId } of activeSubjects) {
        const currentState = resolveSubjectState(subjectId);
        structuralStore.tombstoneSubject(
          subjectId,
          id,
          currentState?.restoreAllowed ?? true
        );
        publishSubjectPhysicalChange(subjectId);
      }

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
      activeIdSignal.set(undefined);
      lastSubjectIds = activeSubjects.map(({ subjectId }) => subjectId);
      updateSignals();

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
          createStructuralEffectMeta({
            kind: 'remove',
            subject: subjectId,
            key: id,
            value: deepClone(entity),
            beforeSubject,
            afterSubject,
          })
        );
      }

      for (const { id, entity } of activeSubjects) {
        if (!entity) continue;
        for (const handler of tapHandlers) {
          handler.onRemove?.(id, entity);
        }
      }
    },

    setAll(entities: E[], opts?: AddOptions<E, K>): void {
      const currentEntries = getProjectedEntries();
      const beforeOrderFrontier = structuralStore.activeOrderFrontier();
      const beforeSubjects = currentEntries
        .map(([id]) => resolveSubjectId(id))
        .filter((subjectId): subjectId is number => subjectId !== undefined);
      const currentIds = new Set(currentEntries.map(([id]) => id));
      const stagedIncomingIds: K[] = [];
      const stagedIncomingById = new Map<K, E>();

      for (const entity of entities) {
        const id = deriveId(entity, opts);
        const transformedEntity = currentIds.has(id)
          ? (() => {
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
          })()
          : interceptAddedEntity(entity);

        if (!stagedIncomingById.has(id)) {
          stagedIncomingIds.push(id);
        }
        stagedIncomingById.set(id, transformedEntity);
      }

      const stagedRemovals = currentEntries
        .filter(([id]) => !stagedIncomingById.has(id))
        .map(([id, entity]) => {
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

          const subjectId = resolveSubjectId(id);
          if (subjectId === undefined) {
            throw new Error(`Entity with id ${String(id)} has no subject id`);
          }
          return {
            id,
            entity,
            subjectId,
          };
        });

      const stagedUpdates = stagedIncomingIds
        .filter((id) => currentIds.has(id))
        .map((id) => {
          const prev = getProjectedEntity(id);
          const entity = stagedIncomingById.get(id);
          if (prev === undefined || entity === undefined) {
            throw new Error(`Entity with id ${String(id)} not found`);
          }

          const subjectId = resolveSubjectId(id);
          if (subjectId === undefined) {
            throw new Error(`Entity with id ${String(id)} has no subject id`);
          }

          return {
            id,
            prev,
            entity,
            subjectId,
          };
        });
      const survivingOriginalIds = new Set(stagedUpdates.map(({ id }) => id));

      const stagedAdds = stagedIncomingIds
        .filter((id) => !currentIds.has(id))
        .map((id) => {
          const entity = stagedIncomingById.get(id);
          if (entity === undefined) {
            throw new Error(`Entity with id ${String(id)} not found`);
          }

          return { id, entity };
        });

      const finalIndexById = new Map(
        stagedIncomingIds.map((id, index) => [id, index] as const)
      );

      const freshSubjectIds = commitFreshSubjects(stagedAdds.map(({ id }) => id));
      const freshSubjectIdsByKey = new Map<K, number>();
      for (let index = 0; index < stagedAdds.length; index += 1) {
        freshSubjectIdsByKey.set(stagedAdds[index].id, freshSubjectIds[index]);
      }

      const stagedRemovalStructuralEffects = stagedRemovals.map(
        ({ id, entity, subjectId }) => {
          const currentIndex = currentEntries.findIndex(
            ([entryId]) => entryId === id
          );
          let beforeSubject: number | undefined;
          let afterSubject: number | undefined;

          for (let index = currentIndex - 1; index >= 0; index -= 1) {
            const neighborId = currentEntries[index]?.[0];
            if (neighborId !== undefined && survivingOriginalIds.has(neighborId)) {
              beforeSubject = resolveSubjectId(neighborId);
              break;
            }
          }

          for (
            let index = currentIndex + 1;
            index < currentEntries.length;
            index += 1
          ) {
            const neighborId = currentEntries[index]?.[0];
            if (neighborId !== undefined && survivingOriginalIds.has(neighborId)) {
              afterSubject = resolveSubjectId(neighborId);
              break;
            }
          }

          return {
            kind: 'remove' as const,
            subject: subjectId,
            key: id,
            value: deepClone(entity),
            beforeSubject,
            afterSubject,
          };
        }
      );

      for (const { id, subjectId } of stagedRemovals) {
        tombstoneSubjectSignal(subjectId);
        const currentState = resolveSubjectState(subjectId);
        structuralStore.tombstoneSubject(
          subjectId,
          id,
          currentState?.restoreAllowed ?? true
        );
        publishSubjectPhysicalChange(subjectId);
      }
      reclaimRetiredSubjectsWithoutOwner(
        stagedRemovals.map(({ subjectId }) => subjectId)
      );

      for (const { subjectId, entity } of stagedUpdates) {
        valueStore.retainSubjectValue(subjectId, entity);
      }

      const addedSubjectIds = stagedAdds.map(({ id, entity }) => {
        const subjectId = freshSubjectIdsByKey.get(id);
        if (subjectId === undefined) {
          throw new Error(`Entity with id ${String(id)} has no subject id`);
        }
        valueStore.retainSubjectValue(subjectId, entity);
        syncEntitySignal(id);
        return subjectId;
      });

      for (const { id } of stagedUpdates) {
        syncEntitySignal(id);
      }

      structuralStore.reorderActiveKeys(stagedIncomingIds);

      lastSubjectIds = [
        ...stagedRemovals.map(({ subjectId }) => subjectId),
        ...stagedUpdates.map(({ subjectId }) => subjectId),
        ...addedSubjectIds,
      ];

      const afterSubjects = stagedIncomingIds
        .map((id) => resolveSubjectId(id))
        .filter((subjectId): subjectId is number => subjectId !== undefined);
      if (
        positionId !== undefined &&
        beforeSubjects.length === afterSubjects.length &&
        beforeSubjects.every((subjectId) => afterSubjects.includes(subjectId)) &&
        beforeSubjects.some(
          (subjectId, index) => subjectId !== afterSubjects[index]
        )
      ) {
        mutationCaptureRuntime?.publishCollectionOrder?.({
          owner: positionId,
          ownerPath: basePath,
          beforeSubjects,
          afterSubjects,
          beforeFrontier: beforeOrderFrontier,
          afterFrontier: structuralStore.activeOrderFrontier(),
          meta: ambientMeta(),
        });
      }

      const stagedAddStructuralEffects = stagedAdds.map(({ id, entity }, index) => {
        const subjectId = addedSubjectIds[index];
        const finalIndex = finalIndexById.get(id) ?? -1;
        let beforeSubject: number | undefined;
        let afterSubject: number | undefined;

        for (let cursor = finalIndex - 1; cursor >= 0; cursor -= 1) {
          const neighborId = stagedIncomingIds[cursor];
          if (neighborId === undefined) {
            continue;
          }
          beforeSubject = resolveSubjectId(neighborId);
          if (beforeSubject !== undefined) {
            break;
          }
        }

        for (
          let cursor = finalIndex + 1;
          cursor < stagedIncomingIds.length;
          cursor += 1
        ) {
          const neighborId = stagedIncomingIds[cursor];
          if (neighborId === undefined) {
            continue;
          }
          afterSubject = resolveSubjectId(neighborId);
          if (afterSubject !== undefined) {
            break;
          }
        }

        return {
          kind: 'add' as const,
          subject: subjectId,
          key: id,
          value: deepClone(entity),
          beforeSubject,
          afterSubject,
        };
      });

      updateSignals();

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
          createStructuralEffectMeta(structuralEffect)
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
          ambientMeta()
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
          createStructuralEffectMeta(stagedAddStructuralEffects[i])
        );
      }

      for (const { id, entity } of stagedRemovals) {
        for (const handler of tapHandlers) {
          handler.onRemove?.(id, entity);
        }
      }

      for (const { id, entity } of stagedAdds) {
        for (const handler of tapHandlers) {
          handler.onAdd?.(entity, id);
        }
      }

      for (const { id, entity } of stagedUpdates) {
        for (const handler of tapHandlers) {
          handler.onUpdate?.(id, entity as Partial<E>, entity);
        }
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
  if (positionMetadataEnabled) {
    Object.defineProperty(api, '__positionIds', {
      get: getPositionIds,
      enumerable: false,
      configurable: true,
    });
  }
  if (ownerMetadataEnabled) {
    defineOwnedOwnerPath(api, basePath);
  }
  // ⚠️ THE PROJECTION SEED — internal, WeakMap-carried, never public.
  //
  // Built from the SAME ordered active-key snapshot `getProjectedEntries()`
  // uses, and the SAME `getProjectedEntity` row path, so a consumer's seeded
  // projection cannot drift from `all()` by construction.
  //
  // `key` is carried explicitly alongside `subjectId` because it is genuinely
  // separate information: after `changeId(1, 77)` the row payload still reads
  // `{ id: 1 }` while the address is 77, so `selectId(row)` cannot recover it.
  defineEntityProjectionSeed(api as object, () => {
    const seed: Array<{ subjectId: number; key: K; row: E }> = [];
    for (const key of structuralStore.activeKeysSnapshot()) {
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
        prepareTarget: prepareTransitionTarget,
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
      return inventory ? planEntitySubjectReclamation(inventory, options) : undefined;
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
  const warnedWrongMethods = new Set<string>();
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
        typeof prop === 'string' &&
        !(prop in (target as object)) &&
        WRONG_ENTITY_METHODS[prop] &&
        (typeof ngDevMode === 'undefined' || ngDevMode) &&
        !warnedWrongMethods.has(prop)
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
  snapshotOwner.node = proxy as object;
  return proxy;
}

Object.defineProperty(createEntitySignal, '__setPositionIdAllocatorForTesting', {
  value: setEntityPositionIdAllocatorForTesting,
  enumerable: false,
  configurable: true,
});
Object.defineProperty(createEntitySignal, '__setPositionIdNotifyEnabledForTesting', {
  value: setEntityPositionIdNotifyEnabledForTesting,
  enumerable: false,
  configurable: true,
});
