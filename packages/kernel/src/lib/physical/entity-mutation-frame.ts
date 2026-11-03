import type { EntityPlacementStage } from './entity-placement-stage';
import type { EntityValueTransition } from '../internals/entity-value-transition';
import { installTerminalRecord } from '../internals/intrinsic-mutation';
import type { TerminalRecordPlan } from '../internals/intrinsic-mutation';
import type { CommittedEntityMutation } from '../internals/mutation-capture-runtime';
import { EntityValueStore } from './entity-value-store';
import {
  type ResolvedSubjectRestorePlacement,
  StructuralStore,
} from './structural-store';

export type PreparedValueReplacement<
  K extends string | number,
  E extends Record<string, unknown>
> = {
  kind: 'replace-value';
  readonly restoredFields?:ReadonlyMap<string,import('../internals/native-field-selection').NativeFieldEndpoint>;
  key: K;
  subjectId: number;
  nextValue: E;
  /** Required producer scope; realization is not new ordinary authorship. */
  authoredFields: readonly string[] | null | 'derive' | 'realization';
};

export type PreparedRetainedValueRetirement = {
  kind: 'retire-retained-value';
  subjectId: number;
  /**
   * Also delete the subject's lifetime record and revision, not just its value.
   *
   * ⚠️ TRIAL — see `StructuralStore.forgetSubject`. Only legal for a terminal
   * retirement on a tree with no restoration authority. Absent/false keeps the
   * shipped behaviour: retire the value, keep a permanent
   * `{active:false, restoreAllowed:false}` record.
   */
  forgetLifetime?: boolean;
};

export type PreparedKeyTransfer<K extends string | number> = {
  kind: 'transfer-key';
  /** Placement is independent of key identity; only inverse existence supplies it. */
  placement?: { beforeSubject?: number; afterSubject?: number };
  fromKey: K;
  toKey: K;
  subjectId: number;
};

export type PreparedSubjectTombstone<K extends string | number> = {
  kind: 'tombstone-subject';
  key: K;
  subjectId: number;
  restoreAllowed: boolean;
};

export type PreparedFreshSubject<
  K extends string | number,
  E extends Record<string, unknown>
> = {
  kind: 'create-fresh-subject';
  key: K;
  subjectId: number;
  nextValue: E;
};

// ProjectionReplacement / ProjectionRemoval / ProjectionAppend / ProjectionRekey
// / ProjectionRestore lived here and were DELETED in 15.0. They described the
// mutation vocabulary of the materialized entity projection, which 7896addf
// removed; the types outlived it by a release because nothing imports them by
// name and no check asked. Do not reintroduce them to describe the incremental
// path — that path speaks in PreparedSubject* terms, which are below.

export type PreparedSubjectRestore<
  K extends string | number,
  E extends Record<string, unknown>
> = {
  kind: 'restore-subject';
  key: K;
  subjectId: number;
  restoreAllowed: boolean;
  beforeSubject?: number;
  afterSubject?: number;
  realizedValue?: E;
};

export type PreparedEntityPhysicalMutation<
  K extends string | number,
  E extends Record<string, unknown>
> =
  | PreparedValueReplacement<K, E>
  | PreparedRetainedValueRetirement
  | PreparedKeyTransfer<K>
  | PreparedSubjectTombstone<K>
  | PreparedFreshSubject<K, E>
  | PreparedSubjectRestore<K, E>;

export type EntityMutationCommitResult = {
  physicallyChangedSubjectIds: readonly number[];
  allocatedSubjectIds: readonly number[];
};

type PreparedRestoreCommitInstruction<
  K extends string | number,
  E extends Record<string, unknown>
> = PreparedSubjectRestore<K, E> & {
  resolvedValue?: E;
  resolvedPlacement: ResolvedSubjectRestorePlacement<K>;
};

type PreparedCommitInstruction<
  K extends string | number,
  E extends Record<string, unknown>
> =
  | Exclude<PreparedEntityPhysicalMutation<K, E>, PreparedSubjectRestore<K, E>>
  | PreparedRestoreCommitInstruction<K, E>;

export class EntityMutationFrame<
  K extends string | number,
  E extends Record<string, unknown>
> {
  /**
   * The staged instructions. Read-only after commit by membership observation
   * (`entity-membership-source.ts`), which derives point deltas from them.
   */
  readonly mutations: PreparedEntityPhysicalMutation<K, E>[] = [];

  constructor(
    private readonly valueStore: EntityValueStore<E>,
    private readonly structuralStore: StructuralStore<K>
  ) {}

  private preparedInstructions:
    | readonly PreparedCommitInstruction<K, E>[]
    | undefined;
  ordinaryOrder: readonly number[] | undefined;
  orderEndpoints:
    | { readonly before: readonly number[]; readonly after: readonly number[] }
    | undefined;
  private finalFront: readonly K[] | undefined;
  private finalOrder: readonly K[] | undefined;
  private proposedPlacement = false;
  useProposedPlacement(): void { this.proposedPlacement = true; }
  stageFinalFront(keys: readonly K[]): void {
    this.finalFront = keys;
  }
  stageFinalOrder(keys: readonly K[]): void {
    this.finalOrder = keys;
  }
  preparePlacement(): EntityPlacementStage<K> {
    const instructions = (this.preparedInstructions =
      this.prepareCommitInstructions());
    const stage = this.structuralStore.preparePlacement();
    const base = this.structuralStore.preparePlacement();
    let beforeOrder = this.ordinaryOrder ? base.snapshot() : undefined;
    for (const mutation of instructions) {
      if (mutation.kind === 'create-fresh-subject')
        stage.insert(mutation.subjectId, mutation.key);
      else if (mutation.kind === 'tombstone-subject')
        stage.remove(mutation.subjectId);
      else if (mutation.kind === 'restore-subject')
        stage.insert(
          mutation.subjectId,
          mutation.key,
          mutation.resolvedPlacement.beforeSubject,
          mutation.resolvedPlacement.afterSubject
        );
      else if (mutation.kind === 'transfer-key') {
        stage.rekey(mutation.subjectId, mutation.toKey);
        if (mutation.placement)
          stage.insert(
            mutation.subjectId,
            mutation.toKey,
            mutation.placement.beforeSubject,
            mutation.placement.afterSubject
          );
      }
    }
    // Final key order resolves against this complete private placement stage.
    // Build its lookup once; searching the patch for every key makes a full
    // setAll/prepend batch quadratic. No index is installed in live storage.
    const stagedSubjects =
      this.finalFront || this.finalOrder ? new Map<K, number>() : undefined;
    if (stagedSubjects) {
      for (const [id, row] of stage.patch) {
        // Preserve the prior strict-equality lookup (including NaN) and first
        // match while falling back to the existing committed key index.
        if (
          row.present &&
          !Number.isNaN(row.key) &&
          !stagedSubjects.has(row.key)
        )
          stagedSubjects.set(row.key, id);
      }
    }
    const subjectFor = (key: K) =>
      stagedSubjects?.get(key) ?? this.structuralStore.subjectIdForKey(key);
    let prefixOrder: readonly number[] | undefined;
    if (this.finalFront) {
      const ids = this.finalFront
        .map(subjectFor)
        .filter((id): id is number => id !== undefined);
      const existing = ids.filter((subject) => base.read(subject).present);
      let cursor = base.head;
      let moved = false;
      for (const subject of existing) {
        if (cursor !== subject) {
          moved = true;
          break;
        }
        const row = base.read(subject);
        cursor = row.present ? row.afterSubject : undefined;
      }
      if (moved) beforeOrder = base.snapshot();
      for (const id of ids) stage.remove(id);
      const after = stage.head;
      let before: number | undefined;
      for (let index = 0; index < ids.length; index++) {
        stage.insert(ids[index], this.finalFront[index], before, after);
        before = ids[index];
      }
      if (moved) this.ordinaryOrder = prefixOrder = stage.snapshot();
    }
    if (this.finalOrder)
      stage.order(
        this.finalOrder
          .map(subjectFor)
          .filter((id): id is number => id !== undefined)
      );
    if (beforeOrder)
      this.orderEndpoints = Object.freeze({
        before: beforeOrder,
        // A later full order changes the prepared stage. Otherwise the prefix
        // domain already is this exact immutable physical-after sequence.
        after: !this.finalOrder && prefixOrder ? prefixOrder : stage.snapshot(),
      });
    return stage;
  }
  stageValueReplacement(replacement: PreparedValueReplacement<K, E>): void {
    this.mutations.push(replacement);
  }

  stageRetainedValueRetirement(
    retirement: PreparedRetainedValueRetirement
  ): void {
    this.mutations.push(retirement);
  }

  stageKeyTransfer(transfer: PreparedKeyTransfer<K>): void {
    this.mutations.push(transfer);
  }

  stageSubjectTombstone(tombstone: PreparedSubjectTombstone<K>): void {
    this.mutations.push(tombstone);
  }

  stageFreshSubject(freshSubject: PreparedFreshSubject<K, E>): void {
    this.mutations.push(freshSubject);
  }

  stageSubjectRestore(restoration: PreparedSubjectRestore<K, E>): void {
    this.mutations.push(restoration);
  }

  /**
   * @param observeCommitted Supplied only when a committed-entity observer is
   * active. Receives every touched lifetime once, after EVERY prepared
   * instruction has applied and before the caller publishes or notifies, so a
   * multi-row frame is never visible to admission one row at a time. A
   * preparation failure throws before anything applies or is reported.
   */
  commit(
    observeCommitted?: (changes: readonly CommittedEntityMutation[]) => void,
    responsibility?: TerminalRecordPlan,
    structuralFrontier?: { after: unknown },
    valueTransitions?: ReadonlyMap<
      PreparedValueReplacement<K, E>,
      EntityValueTransition<E>
    >,
    installOrdinary?: () => void
  ): EntityMutationCommitResult {
    const preparedMutations =
      this.preparedInstructions ?? this.prepareCommitInstructions();
    // Before-images of touched lifetimes only. An inactive lifetime's retained
    // backing is not current truth, so it reads as absent (undefined).
    const before = observeCommitted
      ? new Map<number, { value: E | undefined; structural: boolean }>()
      : undefined;
    if (before) {
      for (const mutation of preparedMutations) {
        const previous = before.get(mutation.subjectId);
        before.set(mutation.subjectId, {
          value: previous
            ? previous.value
            : this.structuralStore.activeKeyForSubject(mutation.subjectId) ===
              undefined
            ? undefined
            : this.valueStore.backingForSubject(mutation.subjectId),
          structural:
            (previous?.structural ?? false) ||
            mutation.kind !== 'replace-value',
        });
      }
    }
    const physicallyChangedSubjectIds = new Set<number>();
    const allocatedSubjectIds: number[] = [];

    for (const mutation of preparedMutations) {
      if (mutation.kind === 'create-fresh-subject') {
        this.structuralStore.createSubject(mutation.subjectId, mutation.key);
        this.valueStore.retainSubjectValue(
          mutation.subjectId,
          mutation.nextValue
        );
        allocatedSubjectIds.push(mutation.subjectId);
        continue;
      }

      if (mutation.kind === 'restore-subject') {
        this.structuralStore.restoreSubjectAtResolvedPlacement(
          mutation.subjectId,
          mutation.key,
          mutation.resolvedPlacement,
          mutation.restoreAllowed
        );
        if (mutation.resolvedValue !== undefined) {
          this.valueStore.retainSubjectValue(
            mutation.subjectId,
            mutation.resolvedValue
          );
        }

        physicallyChangedSubjectIds.add(mutation.subjectId);
        continue;
      }

      if (mutation.kind === 'replace-value') {
        const transition = valueTransitions?.get(mutation);
        if (transition) this.valueStore.installValueTransition(transition);
        else
          this.valueStore.retainSubjectValue(
            mutation.subjectId,
            mutation.nextValue
          );
        continue;
      }

      if (mutation.kind === 'retire-retained-value') {
        const hadBacking = this.valueStore.retireSubjectValue(
          mutation.subjectId
        );
        if (mutation.forgetLifetime) {
          this.structuralStore.forgetSubject(mutation.subjectId);
        } else {
          this.structuralStore.retireSubject(mutation.subjectId);
        }
        if (hadBacking) {
          physicallyChangedSubjectIds.add(mutation.subjectId);
        }
        continue;
      }

      if (mutation.kind === 'transfer-key') {
        this.structuralStore.transferSubject(
          mutation.subjectId,
          mutation.fromKey,
          mutation.toKey
        );
        if (mutation.placement)
          this.structuralStore.placeActiveSubject(
            mutation.subjectId,
            mutation.placement.beforeSubject,
            mutation.placement.afterSubject
          );
        physicallyChangedSubjectIds.add(mutation.subjectId);
        continue;
      }

      this.structuralStore.tombstoneSubject(
        mutation.subjectId,
        mutation.key,
        mutation.restoreAllowed
      );
      physicallyChangedSubjectIds.add(mutation.subjectId);
    }

    if (this.finalFront) this.structuralStore.moveKeysToFront(this.finalFront);
    if (this.finalOrder)
      this.structuralStore.reorderActiveKeys(this.finalOrder);
    if (structuralFrontier) {
      if (structuralFrontier.after !== undefined)
        this.structuralStore.installCompensatedOrderFrontier(
          structuralFrontier.after
        );
      else
        structuralFrontier.after = this.structuralStore.activeOrderFrontier();
    }
    installOrdinary?.();
    if (responsibility) {
      installTerminalRecord(responsibility);
    }
    if (before && observeCommitted) {
      observeCommitted(
        [...before].map(([subject, entry]) => ({
          subject,
          before: entry.value,
          after:
            this.structuralStore.activeKeyForSubject(subject) === undefined
              ? undefined
              : this.valueStore.backingForSubject(subject),
          structural: entry.structural,
        }))
      );
    }

    return {
      physicallyChangedSubjectIds: [...physicallyChangedSubjectIds],
      allocatedSubjectIds,
    };
  }

  private prepareCommitInstructions(): PreparedCommitInstruction<K, E>[] {
    if (this.proposedPlacement) {
      const stage = this.structuralStore.preparePlacement();
      return this.mutations.map((mutation): PreparedCommitInstruction<K,E> => {
        if (mutation.kind==='restore-subject') {
          stage.insert(mutation.subjectId,mutation.key,mutation.beforeSubject,mutation.afterSubject);
          const row=stage.read(mutation.subjectId);
          if(!row.present)throw new Error('Prepared restore placement absent');
          return {...mutation,resolvedValue:mutation.realizedValue??this.valueStore.backingForSubject(mutation.subjectId),resolvedPlacement:{beforeSubject:row.beforeSubject,afterSubject:row.afterSubject}};
        }
        if(mutation.kind==='create-fresh-subject')stage.insert(mutation.subjectId,mutation.key);
        else if(mutation.kind==='tombstone-subject')stage.remove(mutation.subjectId);
        else if(mutation.kind==='transfer-key'){stage.rekey(mutation.subjectId,mutation.toKey);if(mutation.placement)stage.insert(mutation.subjectId,mutation.toKey,mutation.placement.beforeSubject,mutation.placement.afterSubject);}
        return mutation;
      });
    }
    return this.mutations.map((mutation) => {
      if (
        mutation.kind === 'retire-retained-value' &&
        mutation.forgetLifetime
      ) {
        const state = this.structuralStore.stateForSubject(mutation.subjectId);
        if (!state || state.active) {
          throw new Error(
            `Subject ${String(
              mutation.subjectId
            )} must be tombstoned before forgetting its lifetime.`
          );
        }
      }
      if (mutation.kind !== 'restore-subject') {
        return mutation;
      }

      return {
        ...mutation,
        resolvedValue:
          mutation.realizedValue ??
          this.valueStore.backingForSubject(mutation.subjectId),
        resolvedPlacement: this.structuralStore.resolveSubjectRestorePlacement(
          mutation.beforeSubject,
          mutation.afterSubject
        ),
      };
    });
  }
}
