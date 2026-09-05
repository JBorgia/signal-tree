import type { PositionId } from '../types';
import { isDormantMember, reactivateOnWrite } from './member-membership';
import type { PhysicalCommitClock } from './physical-commit-clock';
import {
  PRODUCTION_SUBSTRATE_STATS_ENABLED,
  recordProductionSubstrateStat,
} from './production-substrate-stats';
import {
  createTreeScalarSlotRuntime as createTreeScalarSlotKernel,
  type ScalarSlotCommitResult,
  type ScalarSlotMutationFrame as ScalarSlotKernelMutationFrame,
  type TreeScalarSlotRuntime as TreeScalarSlotKernel,
} from './tree-scalar-slot-runtime';
import {
  createLocationRuntime,
  type LocationRuntime,
  type WritableLocationBinding,
} from './location-runtime';
import { NEUTRAL_OBSERVATION_ADAPTER } from './observation-adapter';
import type {
  ScalarSlotMutationFrame,
  SlotIndex,
  TreeScalarLeafRuntime,
} from './tree-scalar-slot-port';
import type { Location } from './cell-runtime';

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
  private readonly bindings: Array<
    WritableLocationBinding<unknown> | undefined
  > = [];

  constructor(private readonly locations: LocationRuntime) {}

  bind(slotIndex: SlotIndex, binding: WritableLocationBinding<unknown>): void {
    this.bindings[slotIndex] = binding;
  }

  publish(result: ScalarSlotCommitResult): void {
    if (PRODUCTION_SUBSTRATE_STATS_ENABLED) {
      recordProductionSubstrateStat('publications', result.changedSlots.length);
    }
    const publishers = result.changedSlots.flatMap((slotIndex) => {
      const binding = this.bindings[slotIndex];
      return binding ? [binding] : [];
    });
    this.locations.publish(publishers);
  }

  prepareSlot(slotIndex: SlotIndex, changed: boolean, force = false): boolean {
    if (!changed && !force) {
      return false;
    }

    if (PRODUCTION_SUBSTRATE_STATS_ENABLED) {
      recordProductionSubstrateStat('publications');
    }
    return true;
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

  commit(options?: {
    advanceRevision?: boolean;
    publish?: boolean;
  }): ScalarSlotCommitResult {
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
  locations: LocationRuntime,
  slotIndex: SlotIndex
): {
  readonly leaf: Location<T>;
  readonly binding: WritableLocationBinding<T>;
} {
  const holder: { leaf?: Location<T> } = {};

  const read = (): T => {
    if (holder.leaf !== undefined && isDormantMember(holder.leaf)) {
      return undefined as T;
    }

    return kernel.readSlot<T>(slotIndex);
  };
  const binding = locations.createWritable(read, (value) => {
    const leaf = holder.leaf as Location<T>;
    const result = kernel.commitSlot(slotIndex, value);
    const reactivated = reactivateOnWrite(leaf);
    const changed = publication.prepareSlot(
      slotIndex,
      result.changed,
      reactivated
    );
    return changed;
  });
  const leaf = binding.location as Location<T>;
  holder.leaf = leaf;
  return { leaf, binding };
}

export function createTreeScalarLeafRuntime(
  physicalCommitClock: PhysicalCommitClock | undefined,
  locations: LocationRuntime = createLocationRuntime(
    NEUTRAL_OBSERVATION_ADAPTER
  )
): TreeScalarLeafRuntime {
  const kernel = createTreeScalarSlotKernel(physicalCommitClock);
  const publication = new ScalarSlotPublication(locations);
  const leafByPositionId = new Map<PositionId, Location<unknown>>();

  return {
    createLeaf<T>(
      initialValue: T,
      equal: (current: T, next: T) => boolean,
      positionId?: PositionId
    ): Location<T> {
      const slotIndex = kernel.createSlot(initialValue, equal, positionId);
      const { leaf, binding } = createScalarLeaf<T>(
        kernel,
        publication,
        locations,
        slotIndex
      );
      publication.bind(slotIndex, binding as WritableLocationBinding<unknown>);
      if (positionId !== undefined) {
        leafByPositionId.set(positionId, leaf as Location<unknown>);
      }
      return leaf;
    },
    beginFrame(): ScalarSlotMutationFrame {
      return new ScalarSlotMutationFrameOrchestrator(
        kernel.beginFrame(),
        publication
      );
    },
    runInvalidationGroup(run: () => void): void {
      locations.runInvalidationGroup(run);
    },
    publishPrepared(result: ScalarSlotCommitResult): void {
      publication.publish(result);
    },
    resolveScalarSlot(positionId: PositionId): SlotIndex | undefined {
      return kernel.resolveScalarSlot(positionId);
    },
    resolveScalarLeaf(positionId: PositionId): Location<unknown> | undefined {
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
