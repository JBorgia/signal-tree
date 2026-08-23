import { EntityValueStore } from './entity-value-store';
import {
  type ResolvedSubjectRestorePlacement,
  StructuralStore,
} from './structural-store';

export type PreparedValueReplacement<
  K extends string | number,
  E extends Record<string, unknown>,
> = {
  kind: 'replace-value';
  key: K;
  subjectId: number;
  nextValue: E;
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
  E extends Record<string, unknown>,
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
  E extends Record<string, unknown>,
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
  E extends Record<string, unknown>,
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
  E extends Record<string, unknown>,
> = PreparedSubjectRestore<K, E> & {
  resolvedValue?: E;
  resolvedPlacement: ResolvedSubjectRestorePlacement<K>;
};

type PreparedCommitInstruction<
  K extends string | number,
  E extends Record<string, unknown>,
> =
  | Exclude<PreparedEntityPhysicalMutation<K, E>, PreparedSubjectRestore<K, E>>
  | PreparedRestoreCommitInstruction<K, E>;

export class EntityMutationFrame<
  K extends string | number,
  E extends Record<string, unknown>,
> {
  private readonly mutations: PreparedEntityPhysicalMutation<K, E>[] = [];

  constructor(
    private readonly valueStore: EntityValueStore<E>,
    private readonly structuralStore: StructuralStore<K>
  ) {}

  stageValueReplacement(replacement: PreparedValueReplacement<K, E>): void {
    this.mutations.push(replacement);
  }

  stageRetainedValueRetirement(retirement: PreparedRetainedValueRetirement): void {
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

  commit(): EntityMutationCommitResult {
    const preparedMutations = this.prepareCommitInstructions();
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

    return {
      physicallyChangedSubjectIds: [...physicallyChangedSubjectIds],
      allocatedSubjectIds,
    };
  }

  private prepareCommitInstructions(): PreparedCommitInstruction<K, E>[] {
    return this.mutations.map((mutation) => {
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
