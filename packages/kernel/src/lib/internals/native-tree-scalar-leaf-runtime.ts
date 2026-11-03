import { bindSnapshotInstalledReader } from './snapshot-installation';
import type {ConstructionAllocation} from './construction-allocation';
import { PublicationPreparation } from './publication-preparation';
import { completeScalarFrame } from './tree-scalar-slot-runtime';
import { reportContainedObserverError as reportFrameError } from './error-reporter';
import type { PositionId } from '../types';
import { markTreeCell } from './cell-identity';
import {
  registerIntrinsicMutationSource,
  combineTerminalRecords,
  type PreparedPublicationUnit,
  type TerminalRecordPlan,
} from './intrinsic-mutation';
import { reportContainedObserverError } from './error-reporter';
import {
  registerWritableLocationBinding,
  type WritableLocationBinding,
} from './location-runtime';
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
  MemberAbsence,
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
    let failed = false;
    let first: unknown;
    try {
      this.observation.runInvalidationGroup(() => {
        for (const slotIndex of result.changedSlots) {
          try {
            this.token(slotIndex).invalidate();
          } catch (error) {
            if (!failed) {
              failed = true;
              first = error;
            }
          }
        }
      });
    } catch (error) {
      if (!failed) {
        failed = true;
        first = error;
      }
    }
    if (failed) throw first;
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

function createNativeScalarLeaf<T>(
  kernel: TreeScalarSlotRuntime,
  publication: NativeScalarSlotPublication,
  observation: ObservationAdapter,
  slotIndex: SlotIndex,
  liveness: { absence?: MemberAbsence }
): {leaf:Location<T>;token:ObservationToken;attach(nextKernel:TreeScalarSlotRuntime,nextPublication:NativeScalarSlotPublication,nextSlot:SlotIndex,nextLiveness:{absence?:MemberAbsence}):void} {
  const holder: { leaf?: Location<T> } = {};
  const realized = observation.createWritableCell?.(() => {
    // Absent when this leaf or a member above it is omitted (v16 8d). One
    // empty slot until this tree's first omission (v16 8e).
    if (liveness.absence?.isAbsent(holder.leaf)) return undefined as T;
    return kernel.readSlot<T>(slotIndex);
  });
  if (!realized) throw new Error('Expected a native writable cell realization');

  const native = realized.cell;
  publication.bind(slotIndex, realized.token);
  const leaf = markTreeCell(native as unknown as Location<T>);
  holder.leaf = leaf;
  bindSnapshotInstalledReader(leaf, () => liveness.absence?.isAbsent(leaf) ? undefined : kernel.readSlot<T>(slotIndex));
  const mutationSource = registerIntrinsicMutationSource<T>(leaf as object);

  // `reAdd` re-adds and announces an absent leaf's path, and says whether it
  // did (`reactivatePathOnWrite`). No per-leaf closure: the slot is read
  // inline (v16 8e).
  const publishResult = (
    result: ReturnType<TreeScalarSlotRuntime['commitSlot']>
  ): void => {
    const reAdded = liveness.absence?.reAdd(leaf) === true;
    publication.publishSlot(
      reAdded && !result.changed
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
    const reAdded = liveness.absence?.reAdd(leaf) === true;
    if (!changed && !reAdded) return;
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
    needsAuthorityAdmission: () =>
      kernel.needsAuthorityAdmission(slotIndex) ||
      liveness.absence?.needsAdmission?.(leaf) === true,
    notify: () => publication.publishSlot({ changed: true, slot: slotIndex }),
    replace: (value) => {
      const observer = mutationSource.observer,
        capture = mutationSource.capture;
      const publicationPrepare = mutationSource.preparePublication;
      const publicationComplete = mutationSource.completePublication;
      const observing = observer || capture;
      const dormant = observing
        ? liveness.absence?.isAbsent(leaf) === true
        : false;
      const before =
        observing || publicationPrepare
          ? kernel.readRecordSlot<T>(slotIndex)
          : undefined;
      let unit: PreparedPublicationUnit | undefined;
      let terminal: TerminalRecordPlan | undefined;
      const preparePublication = (
        changed: boolean,
        retained: T = before as T,
        physicalChanged=changed
      ) => {
        unit = publicationPrepare?.({
          intent: 'replace',
          before: before as T,
          after: changed ? value : retained,
          changed,
          physicalChanged,preparedTerminal:terminal,
        });
        return unit?.record;
      };
      let failed = false;
      let first: unknown;
      try {
        const resultCommit = kernel.commitRecorded(
          slotIndex,
          value,
          physicalChanged =>
            combineTerminalRecords(
              terminal = mutationSource.prepareTerminal?.({
                intent: 'replace',
                before: before as T,
                after: value,
                changed: true,
              }),
              preparePublication(true,before as T,physicalChanged)
            ),
          publicationPrepare
            ? (current,physicalChanged) => preparePublication(false, current,physicalChanged)
            : undefined
        );
        const changed = resultCommit.changed;
        const mutation = observing
          ? {
              intent: 'replace' as const,
              before: before as T,
              after: changed || dormant ? value : (before as T),
              changed: changed || dormant,
              coveredRecipients: unit?.coveredRecipients,
            }
          : undefined;
        if (mutation) capture?.(mutation);
        publishChanged(resultCommit.physicalChanged, { value });
        if (mutation) observer?.(mutation);
      } catch (error) {
        failed = true;
        first = error;
      } finally {
        if (unit && publicationComplete) {
          try {
            publicationComplete(unit.completion);
          } catch (error) {
            if (!failed) { failed = true; first = error; }
            else reportContainedObserverError({
              error,
              operation: 'notify:subscriber',
            });
          }
        }
      }
      if (failed) throw first;
    },
    derive: (update) => {
      const observer = mutationSource.observer,
        capture = mutationSource.capture;
      const publicationPrepare = mutationSource.preparePublication;
      const publicationComplete = mutationSource.completePublication;
      const dormant = liveness.absence?.isAbsent(leaf) === true;
      const publicationInput = mutationSource.capturePublicationInput?.();
      const current = dormant ? kernel.readSlot<T>(slotIndex) : realized.peek();
      const before = kernel.readRecordSlot<T>(slotIndex);
      const next = update(dormant ? (undefined as T) : current);
      let unit: PreparedPublicationUnit | undefined;
      let terminal: TerminalRecordPlan | undefined;
      const preparePublication = (
        changed: boolean,
        retained: T = before as T,
        physicalChanged=changed
      ) => {
        unit = publicationPrepare?.(
          {
            intent: 'derive',
            before,
            after: changed ? next : retained,
            changed,
            physicalChanged,preparedTerminal:terminal,
          },
          publicationInput
        );
        return unit?.record;
      };
      let failed = false;
      let first: unknown;
      try {
        const resultCommit = kernel.commitRecorded(
          slotIndex,
          next,
          physicalChanged =>
            combineTerminalRecords(
              terminal = mutationSource.prepareTerminal?.({
                intent: 'derive',
                before,
                after: next,
                changed: true,
              }),
              preparePublication(true,before as T,physicalChanged)
            ),
          publicationPrepare
            ? (current,physicalChanged) => preparePublication(false, current,physicalChanged)
            : undefined
        );
        const changed = resultCommit.changed;
        const mutation = {
          intent: 'derive' as const,
          before,
          after: changed || dormant ? next : before,
          changed: changed || dormant,
              coveredRecipients: unit?.coveredRecipients,
        };
        capture?.(mutation);
        publishResult(
          resultCommit.physicalChanged
            ? { revision: kernel.revision(), changed: true, slot: slotIndex }
            : { revision: kernel.revision(), changed: false }
        );
        observer?.(mutation);
      } catch (error) {
        failed = true;
        first = error;
      } finally {
        if (unit && publicationComplete) {
          try {
            publicationComplete(unit.completion);
          } catch (error) {
            if (!failed) { failed = true; first = error; }
            else reportContainedObserverError({
              error,
              operation: 'notify:subscriber',
            });
          }
        }
      }
      if (failed) throw first;
    },
  };
  registerWritableLocationBinding(binding);
  native.set = binding.replace;
  native.update = binding.derive;
  return {leaf,token:realized.token,attach(nextKernel,nextPublication,nextSlot,nextLiveness){kernel=nextKernel;publication=nextPublication;slotIndex=nextSlot;liveness=nextLiveness;}};
}

export function createNativeTreeScalarLeafRuntime(
  physicalCommitClock: PhysicalCommitClock | undefined,
  observation: ObservationAdapter
): TreeScalarLeafRuntime {
  const kernel = createTreeScalarSlotRuntime(physicalCommitClock);
  const publication = new NativeScalarSlotPublication(observation);
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
        const detached=createTreeScalarSlotRuntime();
        const localPublication=new NativeScalarSlotPublication(observation);
        const localSlot=detached.createSlot(initialValue,equal);
        const prepared=createNativeScalarLeaf<T>(detached,localPublication,observation,localSlot,{});
        allocation.add(()=>{
          const slot=kernel.createSlot(initialValue,equal,positionId);
          kernel.bindPublicationSource(slot,prepared.leaf);
          publication.bind(slot,prepared.token);
          if(positionId!==undefined)leafByPositionId.set(positionId,prepared.leaf as Location<unknown>);
          prepared.attach(kernel,publication,slot,liveness);
        },()=>{ /* No cancellation work is registered for this scalar allocation. */ },()=>{if(detached.revision()!==0)throw new Error('Detached member changed during preparation');});
        return prepared.leaf;
      }
      const slotIndex = kernel.createSlot(initialValue, equal, positionId);
      const {leaf} = createNativeScalarLeaf<T>(
        kernel,
        publication,
        observation,
        slotIndex,
        liveness
      );
      kernel.bindPublicationSource(slotIndex, leaf);
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
