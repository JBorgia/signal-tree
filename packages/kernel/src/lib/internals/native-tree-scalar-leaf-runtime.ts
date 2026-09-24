import type { PositionId } from '../types';
import { markTreeCell } from './cell-identity';
import { registerIntrinsicMutationSource } from './intrinsic-mutation';
import {
  registerWritableLocationBinding,
  type WritableLocationBinding,
} from './location-runtime';
import { isDormantMember, reactivateOnWrite } from './member-membership';
import type {
  ObservationAdapter,
  ObservationToken,
} from './observation-adapter';
import type { PhysicalCommitClock } from './physical-commit-clock';
import {
  PRODUCTION_SUBSTRATE_STATS_ENABLED,
  recordProductionSubstrateStat,
} from './production-substrate-stats';
import type { Location } from './cell-runtime';
import type {
  ScalarSlotMutationFrame,
  SlotIndex,
  TreeScalarLeafRuntime,
} from './tree-scalar-slot-port';
import {
  createTreeScalarSlotRuntime,
  type ScalarSlotCommitResult,
  type ScalarSlotMutationFrame as ScalarSlotKernelMutationFrame,
  type TreeScalarSlotRuntime,
} from './tree-scalar-slot-runtime';

class NativeScalarSlotPublication {
  private readonly tokens: Array<ObservationToken | undefined> = [];

  constructor(private readonly observation: ObservationAdapter) {}

  bind(slotIndex: SlotIndex, token: ObservationToken): void {
    this.tokens[slotIndex] = token;
  }

  publish(result: ScalarSlotCommitResult): void {
    if (PRODUCTION_SUBSTRATE_STATS_ENABLED) {
      recordProductionSubstrateStat('publications', result.changedSlots.length);
    }
    this.observation.runInvalidationGroup(() => {
      for (const slotIndex of result.changedSlots) {
        this.token(slotIndex).invalidate();
      }
    });
  }

  publishSlot(result: {
    readonly changed: boolean;
    readonly slot?: SlotIndex;
  }): void {
    if (!result.changed || result.slot === undefined) return;
    if (PRODUCTION_SUBSTRATE_STATS_ENABLED) {
      recordProductionSubstrateStat('publications');
    }
    this.token(result.slot).invalidate();
  }

  private token(slotIndex: SlotIndex): ObservationToken {
    return (this.tokens[slotIndex] ??= this.observation.createToken());
  }
}

class NativeScalarSlotMutationFrame implements ScalarSlotMutationFrame {
  constructor(
    private readonly frame: ScalarSlotKernelMutationFrame,
    private readonly publication: NativeScalarSlotPublication
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

function createNativeScalarLeaf<T>(
  kernel: TreeScalarSlotRuntime,
  publication: NativeScalarSlotPublication,
  observation: ObservationAdapter,
  slotIndex: SlotIndex
): Location<T> {
  const holder: { leaf?: Location<T> } = {};
  const realized = observation.createWritableCell?.(() => {
    const leaf = holder.leaf;
    if (leaf && isDormantMember(leaf)) return undefined as T;
    return kernel.readSlot<T>(slotIndex);
  });
  if (!realized) throw new Error('Expected a native writable cell realization');

  const native = realized.cell;
  publication.bind(slotIndex, realized.token);
  const leaf = markTreeCell(native as unknown as Location<T>);
  holder.leaf = leaf;
  const mutationSource = registerIntrinsicMutationSource<T>(leaf as object);

  const publishResult = (
    result: ReturnType<TreeScalarSlotRuntime['commitSlot']>
  ): void => {
    const reactivated = reactivateOnWrite(leaf);
    publication.publishSlot(
      reactivated && !result.changed
        ? { ...result, changed: true, slot: slotIndex }
        : result
    );
  };

  /**
   * `NATIVE-STORAGE-0`. When the adapter can accept a committed value, publish
   * it directly instead of invalidating a token that immediately calls back
   * into `kernel.readSlot` for the value this call already has.
   *
   * `committed` is passed only by paths that know it. A dormant member reads as
   * `undefined` through the cell's own closure, so reactivation without a known
   * value still goes the invalidate route.
   */
  const commitNative = realized.commit;
  const publishChanged = (changed: boolean, committed?: { value: T }): void => {
    const reactivated = reactivateOnWrite(leaf);
    if (!changed && !reactivated) return;
    if (committed !== undefined && commitNative !== undefined) {
      commitNative(committed.value);
      if (PRODUCTION_SUBSTRATE_STATS_ENABLED) {
        recordProductionSubstrateStat('publications');
      }
      return;
    }
    publication.publishSlot({ changed: true, slot: slotIndex });
  };

  const binding: WritableLocationBinding<T> = {
    location: leaf,
    notify: () => publication.publishSlot({ changed: true, slot: slotIndex }),
    replace: (value) => {
      const observer = mutationSource.observer;
      const dormant = observer ? isDormantMember(leaf) : false;
      const before = observer ? realized.peek() : undefined;
      // The authoritative commit primitive: no result object on the hot path.
      const changed = kernel.commitSlotValue(slotIndex, value);
      publishChanged(changed, { value });
      if (observer) {
        observer({
          intent: 'replace',
          before: before as T,
          after: changed || dormant ? value : (before as T),
          changed: changed || dormant,
        });
      }
    },
    derive: (update) => {
      if (isDormantMember(leaf)) {
        const next = update(undefined as T);
        const result = kernel.commitSlot(slotIndex, next);
        publishResult(result);
        mutationSource.observer?.({
          intent: 'derive',
          before: undefined as T,
          after: kernel.readSlot<T>(slotIndex),
          // Membership changed even when the retained slot value did not.
          changed: true,
        });
        return;
      }
      const observer = mutationSource.observer;
      if (!observer) {
        publishResult(kernel.updateSlot(slotIndex, update));
        return;
      }
      const before = realized.peek();
      const next = update(before);
      const result = kernel.commitSlot(slotIndex, next);
      publishResult(result);
      observer({
        intent: 'derive',
        before,
        after: result.changed ? next : before,
        changed: result.changed,
      });
    },
  };
  registerWritableLocationBinding(binding);
  native.set = binding.replace;
  native.update = binding.derive;
  return leaf;
}

export function createNativeTreeScalarLeafRuntime(
  physicalCommitClock: PhysicalCommitClock | undefined,
  observation: ObservationAdapter
): TreeScalarLeafRuntime {
  const kernel = createTreeScalarSlotRuntime(physicalCommitClock);
  const publication = new NativeScalarSlotPublication(observation);
  const leafByPositionId = new Map<PositionId, Location<unknown>>();

  return {
    createLeaf<T>(
      initialValue: T,
      equal: (current: T, next: T) => boolean,
      positionId?: PositionId
    ): Location<T> {
      const slotIndex = kernel.createSlot(initialValue, equal, positionId);
      const leaf = createNativeScalarLeaf<T>(
        kernel,
        publication,
        observation,
        slotIndex
      );
      if (positionId !== undefined) {
        leafByPositionId.set(positionId, leaf as Location<unknown>);
      }
      return leaf;
    },
    beginFrame(): ScalarSlotMutationFrame {
      return new NativeScalarSlotMutationFrame(
        kernel.beginFrame(),
        publication
      );
    },
    runInvalidationGroup(run: () => void): void {
      observation.runInvalidationGroup(run);
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
