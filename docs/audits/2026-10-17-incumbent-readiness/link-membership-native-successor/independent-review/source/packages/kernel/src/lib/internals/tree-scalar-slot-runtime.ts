import {getActiveWriteContext} from '../write-context';
import { installTerminalRecord } from './intrinsic-mutation';
import type { TerminalRecordPlan } from './intrinsic-mutation';
import type { PositionId } from '../mutation-types';
import type { PhysicalCommitClock } from './physical-commit-clock';

import {
  PRODUCTION_SUBSTRATE_STATS_ENABLED,
  recordProductionSubstrateStat,
} from './production-substrate-stats';

type SlotIndex = number;
type SlotEqualityFn = (current: unknown, next: unknown) => boolean;

export interface ScalarSlotCommitResult {
  readonly revision: number;
  readonly changedSlots: readonly SlotIndex[];
}

export type SingleSlotCommitResult =
  | {
      readonly revision: number;
      readonly changed: false;
    }
  | {
      readonly revision: number;
      readonly changed: true;
      readonly slot: SlotIndex;
    };

export interface ScalarSlotMutationFrame {
  set(slotIndex: SlotIndex, value: unknown): void;
  update(slotIndex: SlotIndex, updater: (value: unknown) => unknown): void;
  discard(): void;
  prepareCommit(options?: { advanceRevision?: boolean }): () => ScalarSlotCommitResult;
  commit(options?: { advanceRevision?: boolean }): ScalarSlotCommitResult;
}

export interface TreeScalarSlotRuntime {
  commitRecorded<T>(slotIndex: SlotIndex, value: T, prepare?: () => TerminalRecordPlan | undefined, prepareUnchanged?: (current: T) => TerminalRecordPlan | undefined): {changed:boolean;physicalChanged:boolean};
  needsAuthorityAdmission(slotIndex:SlotIndex):boolean;
  readRecordSlot<T>(slotIndex: SlotIndex): T;
  createSlot<T>(
    initialValue: T,
    equal: (current: T, next: T) => boolean,
    positionId?: PositionId
  ): SlotIndex;
  readSlot<T>(slotIndex: SlotIndex): T;
  commitSlot<T>(slotIndex: SlotIndex, value: T): SingleSlotCommitResult;
  /**
   * The authoritative single-slot commit; `commitSlot` is a wrapper over it.
   *
   * Answers `changed` rather than allocating `{ revision, changed, slot }`,
   * because that object's `revision` has no consumer — `publishSlot` reads only
   * `changed` and `slot`, and every other caller reads `changed`. Removing the
   * allocation from the write path measured ~2 ns, decided by pairing two
   * builds of the interleaved v14/v15 control (4/4 pairs); V8 does not
   * scalar-replace it. The revision COUNTER is untouched and still has real
   * consumers — batch publication, the causal adapter, frame staleness.
   */
  commitSlotValue<T>(slotIndex: SlotIndex, value: T): boolean;
  updateSlot<T>(
    slotIndex: SlotIndex,
    updater: (value: T) => T
  ): SingleSlotCommitResult;
  beginFrame(): ScalarSlotMutationFrame;
  resolveScalarSlot(positionId: PositionId): SlotIndex | undefined;
  revision(): number;
  slotCount(): number;
}

class ScalarSlotMutationFrameImpl implements ScalarSlotMutationFrame {
  private readonly staged = new Map<SlotIndex, unknown>();
  private closed = false;

  constructor(
    private readonly baseRevision: number,
    private readonly getCommittedRevision: () => number,
    private readonly readValue: (slotIndex: SlotIndex) => unknown,
    private readonly commitValues: (
      staged: ReadonlyMap<SlotIndex, unknown>,
      options?: { advanceRevision?: boolean }
    ) => ScalarSlotCommitResult,
    private readonly assertSlotIndex: (slotIndex: SlotIndex) => void,
    private readonly prepareValues: (staged: ReadonlyMap<SlotIndex, unknown>, options?: { advanceRevision?: boolean }) => () => ScalarSlotCommitResult
  ) {}

  set(slotIndex: SlotIndex, value: unknown): void {
    this.assertOpen();
    this.assertSlotIndex(slotIndex);
    this.staged.set(slotIndex, value);
  }

  update(slotIndex: SlotIndex, updater: (value: unknown) => unknown): void {
    this.assertOpen();
    this.assertSlotIndex(slotIndex);
    const current = this.staged.has(slotIndex)
      ? this.staged.get(slotIndex)
      : this.readValue(slotIndex);
    this.staged.set(slotIndex, updater(current));
  }

  discard(): void {
    this.assertOpen();
    this.closed = true;
    this.staged.clear();
  }

  prepareCommit(options?: { advanceRevision?: boolean }): () => ScalarSlotCommitResult {
    this.assertOpen();
    this.closed = true;
    if (this.getCommittedRevision() !== this.baseRevision) throw new Error('Stale scalar preparation');
    return this.prepareValues(this.staged, options);
  }

  commit(options?: { advanceRevision?: boolean }): ScalarSlotCommitResult {
    this.assertOpen();
    this.closed = true;

    if (this.getCommittedRevision() !== this.baseRevision) {
      throw new Error('ScalarSlotMutationFrame base revision is stale.');
    }

    if (this.staged.size > 0) {
      return this.commitValues(this.staged, options);
    }

    return {
      revision: this.getCommittedRevision(),
      changedSlots: [],
    };
  }

  private assertOpen(): void {
    if (this.closed) {
      throw new Error('ScalarSlotMutationFrame is already closed.');
    }
  }
}

export function createTreeScalarSlotRuntime(
  physicalCommitClock?: PhysicalCommitClock
): TreeScalarSlotRuntime {
  const values: unknown[] = [];
  const inspectionBaseline = new Map<number,unknown>();
  const equalities: SlotEqualityFn[] = [];
  const slotByPositionId = new Map<PositionId, SlotIndex>();
  let revision = 0;

  const getCommittedRevision = (): number =>
    physicalCommitClock?.revision() ?? revision;

  const advanceRevision = (): number => {
    const nextRevision = physicalCommitClock?.advance();
    if (nextRevision !== undefined) {
      return nextRevision;
    }

    revision += 1;
    return revision;
  };

  const assertSlotIndex = (slotIndex: SlotIndex): void => {
    if (
      !Number.isInteger(slotIndex) ||
      slotIndex < 0 ||
      slotIndex >= values.length
    ) {
      throw new Error(`Scalar slot index ${slotIndex} is out of bounds.`);
    }
  };

  // Shared validation/equality pass; the two installation contracts stay distinct.
  const collectSlotChanges = (
    staged: ReadonlyMap<SlotIndex, unknown>
  ): Array<{ slotIndex: SlotIndex; nextValue: unknown }> => {
    const changed: Array<{ slotIndex: SlotIndex; nextValue: unknown }> = [];
    for (const [slotIndex, nextValue] of staged) {
      assertSlotIndex(slotIndex);
      if (PRODUCTION_SUBSTRATE_STATS_ENABLED) {
        recordProductionSubstrateStat('equalityChecks');
      }
      if (!equalities[slotIndex](values[slotIndex], nextValue)) {
        changed.push({ slotIndex, nextValue });
      }
    }
    return changed;
  };

  // Research-only preparation: run equality before any target installs.
  const prepareSlots = (staged: ReadonlyMap<SlotIndex, unknown>, options?: { advanceRevision?: boolean }): (() => ScalarSlotCommitResult) => {
    const base=getCommittedRevision();
    const changed=collectSlotChanges(staged);
    const physical=new Set(changed.map(x=>x.slotIndex));
    const inspection=getActiveWriteContext()?.participation==='inspection';
    const shadowPlans:Array<{slotIndex:number;keep:boolean;value:unknown}>=[];
    for(const [slotIndex,nextValue] of staged){
      const has=inspectionBaseline.has(slotIndex);
      const before=has?inspectionBaseline.get(slotIndex):values[slotIndex];
      const equal=has?equalities[slotIndex](before,nextValue):!physical.has(slotIndex);
      const keep=inspection&&!equal;
      if(keep!==has || keep&&!Object.is(inspectionBaseline.get(slotIndex),before))shadowPlans.push({slotIndex,keep,value:before});
    }
    if(getCommittedRevision()!==base)throw new Error('Reentrant scalar preparation');
    let used=false;
    return()=>{
      if(used)throw new Error('Prepared scalar commit already used');
      if(getCommittedRevision()!==base)throw new Error('Stale prepared scalar commit');
      used=true;
      for(const {slotIndex,nextValue}of changed)values[slotIndex]=nextValue;
      for(const p of shadowPlans){if(p.keep)inspectionBaseline.set(p.slotIndex,p.value);else inspectionBaseline.delete(p.slotIndex);}
      const revision=(changed.length||shadowPlans.length)&&options?.advanceRevision!==false?advanceRevision():getCommittedRevision();
      return {revision,changedSlots:changed.map(x=>x.slotIndex)};
    };
  };
  const commitSlots = (staged:ReadonlyMap<SlotIndex,unknown>,options?:{advanceRevision?:boolean}):ScalarSlotCommitResult => prepareSlots(staged,options)();
  const commitSlotValue = <T>(slotIndex:SlotIndex,nextValue:T,options?:{advanceRevision?:boolean}):boolean => commitSlots(new Map([[slotIndex,nextValue]]),options).changedSlots.length>0;
  const commitSlot = <T>(
    slotIndex: SlotIndex,
    nextValue: T,
    options?: { advanceRevision?: boolean }
  ): SingleSlotCommitResult => {
    const changed = commitSlotValue(slotIndex, nextValue, options);
    return changed
      ? { revision: getCommittedRevision(), changed: true, slot: slotIndex }
      : { revision: getCommittedRevision(), changed: false };
  };

  return {
    createSlot<T>(
      initialValue: T,
      equal: (current: T, next: T) => boolean,
      positionId?: PositionId
    ): SlotIndex {
      const slotIndex = values.length;
      values.push(initialValue);
      equalities.push(equal as SlotEqualityFn);

      if (positionId !== undefined) {
        slotByPositionId.set(positionId, slotIndex);
      }

      return slotIndex;
    },
    readSlot<T>(slotIndex: SlotIndex): T {
      assertSlotIndex(slotIndex);
      if (PRODUCTION_SUBSTRATE_STATS_ENABLED) {
        recordProductionSubstrateStat('slotReads');
      }
      return values[slotIndex] as T;
    },
    needsAuthorityAdmission(slotIndex:SlotIndex):boolean{return inspectionBaseline.has(slotIndex)&&getActiveWriteContext()?.participation!=='inspection';},
    readRecordSlot<T>(slotIndex: SlotIndex):T { return (getActiveWriteContext()?.participation!=='inspection' && inspectionBaseline.has(slotIndex) ? inspectionBaseline.get(slotIndex) : values[slotIndex]) as T; },
    commitRecorded<T>(slotIndex: SlotIndex, value: T, prepare?: () => TerminalRecordPlan | undefined, prepareUnchanged?: (current: T) => TerminalRecordPlan | undefined): {changed:boolean;physicalChanged:boolean} {
      assertSlotIndex(slotIndex);
      const base=getCommittedRevision();
      if (PRODUCTION_SUBSTRATE_STATS_ENABLED) {
        recordProductionSubstrateStat('equalityChecks');
      }
      const equal=equalities[slotIndex](values[slotIndex],value);
      if(getCommittedRevision()!==base)throw new Error('Scalar equality reentered physical installation');
      const inspection=getActiveWriteContext()?.participation==='inspection';
      const shadowed=inspectionBaseline.has(slotIndex);
      const ordinaryBefore=shadowed?inspectionBaseline.get(slotIndex):values[slotIndex];
      const authorityEqual=shadowed?equalities[slotIndex](ordinaryBefore,value):equal;
      if(getCommittedRevision()!==base)throw new Error('Scalar authority equality reentered installation');
      const semanticChanged=inspection?!equal:!authorityEqual;
      if(equal&&!semanticChanged){
        // Publication responsibility can change without changing ordinary truth.
        // The separate hook never creates a compensation effect or value event.
        const plan = prepareUnchanged?.(ordinaryBefore as T);
        if(getCommittedRevision()!==base)throw new Error('Publication preparation reentered physical installation');
        if(plan)installTerminalRecord(plan);
        if(!inspection)inspectionBaseline.delete(slotIndex);
        return {changed:false,physicalChanged:false};
      }
      const plan=semanticChanged?prepare?.():prepareUnchanged?.(ordinaryBefore as T);
      if(getCommittedRevision()!==base)throw new Error('Terminal preparation reentered physical installation');
      // Prepared internal data only below. No returned closure, value reflection,
      // equality, observer, or record sink between value and evidence installation.
      if(inspection){if(authorityEqual)inspectionBaseline.delete(slotIndex);else if(!shadowed)inspectionBaseline.set(slotIndex,ordinaryBefore);}else inspectionBaseline.delete(slotIndex);
      values[slotIndex]=value;
      if (PRODUCTION_SUBSTRATE_STATS_ENABLED) {
        recordProductionSubstrateStat('slotWrites');
      }
      if(plan){
        installTerminalRecord(plan);
      }
      advanceRevision();
      if (PRODUCTION_SUBSTRATE_STATS_ENABLED) {
        recordProductionSubstrateStat('revisionIncrements');
      }
      return {changed:semanticChanged,physicalChanged:!equal};
    },
    commitSlot<T>(slotIndex: SlotIndex, value: T): SingleSlotCommitResult {
      return commitSlot(slotIndex, value);
    },
    commitSlotValue<T>(slotIndex: SlotIndex, value: T): boolean {
      return commitSlotValue(slotIndex, value);
    },
    updateSlot<T>(
      slotIndex: SlotIndex,
      updater: (value: T) => T
    ): SingleSlotCommitResult {
      assertSlotIndex(slotIndex);
      return commitSlot(slotIndex, updater(values[slotIndex] as T));
    },
    beginFrame(): ScalarSlotMutationFrame {
      return new ScalarSlotMutationFrameImpl(
        getCommittedRevision(),
        getCommittedRevision,
        (slotIndex) => values[slotIndex],
        commitSlots,
        assertSlotIndex,
        prepareSlots
      );
    },
    resolveScalarSlot(positionId: PositionId): SlotIndex | undefined {
      if (PRODUCTION_SUBSTRATE_STATS_ENABLED) {
        recordProductionSubstrateStat('positionResolutions');
      }
      return slotByPositionId.get(positionId);
    },
    revision(): number {
      return getCommittedRevision();
    },
    slotCount(): number {
      return values.length;
    },
  };
}
