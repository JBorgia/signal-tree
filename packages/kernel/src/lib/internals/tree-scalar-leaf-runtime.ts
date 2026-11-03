import type {ConstructionAllocation} from './construction-allocation';
import { PublicationPreparation } from './publication-preparation';
import { completeScalarFrame } from './tree-scalar-slot-runtime';
import { reportContainedObserverError as reportFrameError } from './error-reporter';
import type { PositionId } from '../types';
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
  MemberAbsence,
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
    let failed = false;
    let first: unknown;
    try { this.invalidate(result); }
    catch (error) { failed = true; first = error; }
    finally {
      try { completeScalarFrame(result); }
      catch (error) {
        if (!failed) { failed = true; first = error; }
        else reportFrameError({error,operation:'notify:subscriber'});
      }
    }
    // Completion must run even when the primary thrown value is undefined.
    if (failed) throw first;
  }

  private invalidate(result: ScalarSlotCommitResult): void {
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

  prepareCommit(options?: {
    advanceRevision?: boolean; publicationPhase?: PublicationPreparation; admissionParticipation?: 'realized';
    publish?: boolean;
  }): () => ScalarSlotCommitResult {
    const install = this.frame.prepareCommit({
      advanceRevision: options?.advanceRevision, publicationPhase: options?.publicationPhase, admissionParticipation: options?.admissionParticipation,
    });
    return () => {
      const result = install();
      if (options?.publish !== false) this.publication.publish(result);
      return result;
    };
  }

  commit(options?: {
    advanceRevision?: boolean; publicationPhase?: PublicationPreparation; admissionParticipation?: 'realized';
    publish?: boolean;
  }): ScalarSlotCommitResult {
    const result = this.frame.commit({
      advanceRevision: options?.advanceRevision, publicationPhase: options?.publicationPhase, admissionParticipation: options?.admissionParticipation,
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
  slotIndex: SlotIndex,
  liveness: { absence?: MemberAbsence }
): {
  readonly leaf: Location<T>;
  readonly binding: WritableLocationBinding<T>;
  attach(nextKernel:TreeScalarSlotKernel,nextPublication:ScalarSlotPublication,nextSlot:SlotIndex,nextLiveness:{absence?:MemberAbsence}):void;
} {
  const holder: { leaf?: Location<T> } = {};

  const read = (stored?: boolean): T => {
    // Absent when this leaf or a member above it is omitted (v16 8d). One
    // empty slot until this tree's first omission (v16 8e). `stored` reads
    // storage regardless, for a write's recorded before value.
    if (!stored && liveness.absence?.isAbsent(holder.leaf)) {
      return undefined as T;
    }

    return stored
      ? kernel.readRecordSlot<T>(slotIndex)
      : kernel.readSlot<T>(slotIndex);
  };
  const binding = locations.createWritable(
    read,
    (value, _intent, prepare, prepareUnchanged) => {
      const changedValue = kernel.commitRecorded(
        slotIndex,
        value,
        prepare,
        prepareUnchanged
      );
      const result = { changed: changedValue.physicalChanged };
      const reAdded = liveness.absence?.reAdd(holder.leaf) === true;
      const changed = publication.prepareSlot(
        slotIndex,
        result.changed,
        reAdded
      );
      return {
        changed: changedValue.changed || reAdded,
        physicalChanged: changed,
      };
    }
  );
  binding.needsAuthorityAdmission = () =>
    kernel.needsAuthorityAdmission(slotIndex) ||
    liveness.absence?.needsAdmission?.(holder.leaf) === true;
  const leaf = binding.location as Location<T>;
  holder.leaf = leaf;
  return { leaf, binding, attach(nextKernel,nextPublication,nextSlot,nextLiveness){kernel=nextKernel;publication=nextPublication;slotIndex=nextSlot;liveness=nextLiveness;} };
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
  const liveness: { absence?: MemberAbsence } = {};

  return {
    enableAbsence(absence: MemberAbsence): void {
      liveness.absence = absence;
    },
    disableAbsence(): void {
      liveness.absence = undefined;
    },
    createLeaf<T>(
      initialValue: T,
      equal: (current: T, next: T) => boolean,
      positionId?: PositionId,
      allocation?: ConstructionAllocation
    ): Location<T> {
      if(allocation){
        const detached=createTreeScalarSlotKernel();
        const localPublication=new ScalarSlotPublication(locations);
        const localSlot=detached.createSlot(initialValue,equal);
        const prepared=createScalarLeaf<T>(detached,localPublication,locations,localSlot,{});
        localPublication.bind(localSlot,prepared.binding as WritableLocationBinding<unknown>);
        allocation.add(()=>{
          const slot=kernel.createSlot(initialValue,equal,positionId);
          kernel.bindPublicationSource(slot,prepared.leaf);
          publication.bind(slot,prepared.binding as WritableLocationBinding<unknown>);
          if(positionId!==undefined)leafByPositionId.set(positionId,prepared.leaf as Location<unknown>);
          prepared.attach(kernel,publication,slot,liveness);
        },()=>{ /* No cancellation work is registered for this scalar allocation. */ },()=>{if(detached.revision()!==0)throw new Error('Detached member changed during preparation');});
        return prepared.leaf;
      }
      const slotIndex = kernel.createSlot(initialValue, equal, positionId);
      const { leaf, binding } = createScalarLeaf<T>(
        kernel,
        publication,
        locations,
        slotIndex,
        liveness
      );
      publication.bind(slotIndex, binding as WritableLocationBinding<unknown>);
      kernel.bindPublicationSource(slotIndex, leaf);
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
