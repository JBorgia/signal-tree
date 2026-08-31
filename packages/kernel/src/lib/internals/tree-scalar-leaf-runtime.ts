import type { PositionId } from '../types';
import { markTreeCell } from './cell-identity';
import { isDormantMember, reactivateOnWrite } from './member-membership';
import type { PhysicalCommitClock } from './physical-commit-clock';
import {
  PRODUCTION_SUBSTRATE_STATS_ENABLED,
  recordProductionSubstrateStat,
} from './production-substrate-stats';
import {
  createTreeScalarSlotRuntime as createTreeScalarSlotKernel,
  type ScalarSlotCommitResult,
  type SingleSlotCommitResult,
  type ScalarSlotMutationFrame as ScalarSlotKernelMutationFrame,
  type TreeScalarSlotRuntime as TreeScalarSlotKernel,
} from './tree-scalar-slot-runtime';
import type {
  ObservationToken,
  ScalarLeafRealization,
} from './scalar-leaf-realization';
import { NEUTRAL_SCALAR_LEAF_REALIZATION } from './scalar-leaf-realization';
import type {
  ScalarSlotMutationFrame,
  SlotIndex,
  TreeScalarLeafRuntime,
} from './tree-scalar-slot-port';
import type { WritableCell } from './cell-runtime';
import {
  getIntrinsicMutationObserver,
  registerIntrinsicMutationSource,
} from './intrinsic-mutation';
import { markSnapshotDirty } from './snapshot-authority';

/**
 * TREE-FACING SCALAR LEAF ORCHESTRATION — kernel-owned.
 *
 * SCALAR-REALIZATION-SEAM-0. Slot bookkeeping, the `!changed` publication rule,
 * production accounting, membership dormancy and reactivation are SignalTree
 * semantics; they lived in the Angular file only because that file happened to
 * construct the leaves. The framework now supplies two mechanisms
 * (`ObservationToken`, read-through leaf) and learns nothing about slots,
 * commit clocks, membership or revisions.
 *
 * Renamed while splitting: `TreeScalarSlotRuntime` used to name TWO different
 * contracts — the physical slot substrate (`createSlot`/`readSlot`) and this
 * tree-facing leaf runtime (`createLeaf`/`resolveScalarLeaf`).
 */

class ScalarSlotPublication {
  private readonly tokens: ObservationToken[] = [];
  private readonly snapshotOwners: Array<WeakRef<object> | undefined> = [];

  constructor(private readonly realization: ScalarLeafRealization) {}

  observe(slotIndex: SlotIndex): void {
    if (PRODUCTION_SUBSTRATE_STATS_ENABLED) {
      recordProductionSubstrateStat('publicationDependencyReads');
    }
    this.getToken(slotIndex).observe();
  }

  publish(result: ScalarSlotCommitResult): void {
    if (PRODUCTION_SUBSTRATE_STATS_ENABLED) {
      recordProductionSubstrateStat('publications', result.changedSlots.length);
    }
    this.realization.runInvalidationGroup(() => {
      for (const slotIndex of result.changedSlots) {
        const owner = this.snapshotOwners[slotIndex]?.deref();
        if (owner) markSnapshotDirty(owner);
        this.getToken(slotIndex).invalidate();
      }
    });
  }

  publishSlot(result: SingleSlotCommitResult): void {
    if (!result.changed) {
      return;
    }

    if (PRODUCTION_SUBSTRATE_STATS_ENABLED) {
      recordProductionSubstrateStat('publications');
    }
    const owner = this.snapshotOwners[result.slot]?.deref();
    if (owner) markSnapshotDirty(owner);
    this.getToken(result.slot).invalidate();
  }

  bindSnapshotOwner(slotIndex: SlotIndex, owner: object | undefined): void {
    this.snapshotOwners[slotIndex] = owner ? new WeakRef(owner) : undefined;
  }

  private getToken(slotIndex: SlotIndex): ObservationToken {
    const existing = this.tokens[slotIndex];
    if (existing) {
      return existing;
    }

    const token = this.realization.createToken();
    this.tokens[slotIndex] = token;
    return token;
  }
}

class ScalarSlotMutationFrameOrchestrator implements ScalarSlotMutationFrame {
  constructor(
    private readonly frame: ScalarSlotKernelMutationFrame,
    private readonly publication: ScalarSlotPublication
  ) {}

  set(slotIndex: SlotIndex, value: unknown): void {
    this.frame.set(slotIndex, value);
  }

  update(slotIndex: SlotIndex, updater: (value: unknown) => unknown): void {
    this.frame.update(slotIndex, updater);
  }

  discard(): void {
    this.frame.discard();
  }

  commit(options?: { advanceRevision?: boolean; publish?: boolean }): ScalarSlotCommitResult {
    const result = this.frame.commit({
      advanceRevision: options?.advanceRevision,
    });
    if (options?.publish !== false) {
      this.publication.publish(result);
    }
    return result;
  }
}

function createScalarLeaf<T>(
  kernel: TreeScalarSlotKernel,
  publication: ScalarSlotPublication,
  realization: ScalarLeafRealization,
  slotIndex: SlotIndex
): WritableCell<T> {
  const holder: { leaf?: WritableCell<T> } = {};

  const leaf = markTreeCell(
    realization.createLeaf<T>(() => {
      // ⚠️ THE DEPENDENCY EDGE IS ESTABLISHED HERE, ON THE FIRST COMPUTATION.
      // That is what makes membership invalidation free: the per-slot publication
      // token already exists and is already depended upon, so a membership
      // transition needs no new reactive state and has no first-transition
      // problem. A LAZILY created membership signal would NOT be a dependency of
      // a computation that had already run.
      publication.observe(slotIndex);

      // A DESCENDANT ABSENT FROM ITS PARENT'S CURRENT VALUE IS SEMANTICALLY
      // ABSENT EVEN IF ITS PHYSICAL LOCATION IS RETAINED. The slot below still
      // holds its value; reading it here would publish a second observable truth
      // for this location, disagreeing with the parent's snapshot.
      if (holder.leaf !== undefined && isDormantMember(holder.leaf)) {
        return undefined as T;
      }

      return kernel.readSlot<T>(slotIndex);
    })
  ) as WritableCell<T>;

  holder.leaf = leaf;
  registerIntrinsicMutationSource(leaf as object);

  const commitThenActivate = (result: SingleSlotCommitResult) => {
    const reactivated = reactivateOnWrite(leaf);
    if (reactivated) {
      publication.publishSlot({
        revision: result.revision,
        changed: true,
        slot: slotIndex,
      });
      return;
    }
    publication.publishSlot(result);
  };

  leaf.set = (value: T) => {
    const observer = getIntrinsicMutationObserver<T>(leaf as object);
    const before = observer ? leaf() : undefined;
    const result = kernel.commitSlot(slotIndex, value);
    commitThenActivate(result);
    if (observer) {
      observer({
        intent: 'replace',
        before: before as T,
        after: result.changed ? value : (before as T),
        changed: result.changed,
      });
    }
  };

  leaf.update = (updater: (value: T) => T) => {
    if (isDormantMember(leaf)) {
      const next = updater(undefined as T);
      commitThenActivate(kernel.commitSlot(slotIndex, next));
      return;
    }
    const observer = getIntrinsicMutationObserver<T>(leaf as object);
    if (!observer) {
      publication.publishSlot(kernel.updateSlot(slotIndex, updater));
      return;
    }
    const before = leaf();
    const next = updater(before);
    const result = kernel.commitSlot(slotIndex, next);
    publication.publishSlot(result);
    observer({
      intent: 'derive',
      before,
      after: result.changed ? next : before,
      changed: result.changed,
    });
  };

  return leaf;
}

export function createTreeScalarLeafRuntime(
  physicalCommitClock: PhysicalCommitClock | undefined,
  realization: ScalarLeafRealization = NEUTRAL_SCALAR_LEAF_REALIZATION
): TreeScalarLeafRuntime {
  const kernel = createTreeScalarSlotKernel(physicalCommitClock);
  const publication = new ScalarSlotPublication(realization);
  const leafByPositionId = new Map<PositionId, WritableCell<unknown>>();

  return {
    createLeaf<T>(
      initialValue: T,
      equal: (current: T, next: T) => boolean,
      positionId?: PositionId,
      snapshotOwner?: object
    ): WritableCell<T> {
      const slotIndex = kernel.createSlot(initialValue, equal, positionId);
      publication.bindSnapshotOwner(slotIndex, snapshotOwner);
      const leaf = createScalarLeaf<T>(kernel, publication, realization, slotIndex);
      if (positionId !== undefined) {
        leafByPositionId.set(positionId, leaf as WritableCell<unknown>);
      }
      return leaf;
    },
    beginFrame(): ScalarSlotMutationFrame {
      return new ScalarSlotMutationFrameOrchestrator(kernel.beginFrame(), publication);
    },
    runInvalidationGroup(run: () => void): void {
      realization.runInvalidationGroup(run);
    },
    publishPrepared(result: ScalarSlotCommitResult): void {
      publication.publish(result);
    },
    resolveScalarSlot(positionId: PositionId): SlotIndex | undefined {
      return kernel.resolveScalarSlot(positionId);
    },
    resolveScalarLeaf(positionId: PositionId): WritableCell<unknown> | undefined {
      if (PRODUCTION_SUBSTRATE_STATS_ENABLED) {
        recordProductionSubstrateStat('positionResolutions');
      }
      return leafByPositionId.get(positionId);
    },
    revision(): number {
      return kernel.revision();
    },
    slotCount(): number {
      return kernel.slotCount();
    },
  };
}

