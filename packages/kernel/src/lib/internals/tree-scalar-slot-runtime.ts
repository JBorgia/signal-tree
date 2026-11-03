import { markSnapshotInstalled } from './snapshot-installation';
import { PublicationPreparation } from './publication-preparation';
import {getActiveWriteContext} from '../write-context';
import { prepareScalarSourcePublication, prepareScalarSourceTerminal, combineTerminalRecords, completeScalarSourcePublication, installTerminalRecord } from './intrinsic-mutation';
import type { PreparedPublicationUnit, TerminalRecordPlan } from './intrinsic-mutation';
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
  readonly publication?: ScalarFramePublication;
}

export interface ScalarFramePublication {
  readonly coverage: ReadonlyMap<number, readonly object[]>;
  complete(): void;
}

/** Completion belongs to the installed frame, independently of invalidation slots. */
export function completeScalarFrame(result: ScalarSlotCommitResult): void {
  result.publication?.complete();
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
  prepareCommit(options?: { advanceRevision?: boolean; publicationPhase?: PublicationPreparation; admissionParticipation?: 'realized' }): () => ScalarSlotCommitResult;
  commit(options?: { advanceRevision?: boolean; publicationPhase?: PublicationPreparation; admissionParticipation?: 'realized' }): ScalarSlotCommitResult;
}

export interface TreeScalarSlotRuntime {
  bindPublicationSource(slotIndex: SlotIndex, node: object): void;
  commitRecorded<T>(slotIndex: SlotIndex, value: T, prepare?: (physicalChanged?:boolean) => TerminalRecordPlan | undefined, prepareUnchanged?: (current: T,physicalChanged?:boolean) => TerminalRecordPlan | undefined): {changed:boolean;physicalChanged:boolean};
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
      options?: { advanceRevision?: boolean; publicationPhase?: PublicationPreparation; admissionParticipation?: 'realized' }
    ) => ScalarSlotCommitResult,
    private readonly assertSlotIndex: (slotIndex: SlotIndex) => void,
    private readonly prepareValues: (staged: ReadonlyMap<SlotIndex, unknown>, options?: { advanceRevision?: boolean; publicationPhase?: PublicationPreparation; admissionParticipation?: 'realized' }) => () => ScalarSlotCommitResult
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

  prepareCommit(options?: { advanceRevision?: boolean; publicationPhase?: PublicationPreparation; admissionParticipation?: 'realized' }): () => ScalarSlotCommitResult {
    this.assertOpen();
    this.closed = true;
    if (this.getCommittedRevision() !== this.baseRevision) throw new Error('Stale scalar preparation');
    return this.prepareValues(this.staged, options);
  }

  commit(options?: { advanceRevision?: boolean; publicationPhase?: PublicationPreparation; admissionParticipation?: 'realized' }): ScalarSlotCommitResult {
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
  const publicationSources: Array<object | undefined> = [];
  const inspectionBaseline = new Map<number,unknown>();
  const equalities: SlotEqualityFn[] = [];
  const slotByPositionId = new Map<PositionId, SlotIndex>();
  let revision = 0;

  const getCommittedRevision = (): number =>
    physicalCommitClock?.revision() ?? revision;

  const advanceRevision = (): number => {
    const nextRevision = physicalCommitClock?.advance() ?? ++revision;
    // Count the actual clock advance, shared by recorded and prepared installs.
    if (PRODUCTION_SUBSTRATE_STATS_ENABLED) {
      recordProductionSubstrateStat('revisionIncrements');
    }
    return nextRevision;
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
  const prepareSlots = (staged: ReadonlyMap<SlotIndex, unknown>, options?: { advanceRevision?: boolean; publicationPhase?: PublicationPreparation; admissionParticipation?: 'realized' }): (() => ScalarSlotCommitResult) => {
    // Capture this frame's classification before callback-capable equality.
    const admissionParticipation=options?.admissionParticipation;
    const base=getCommittedRevision();
    const changed=collectSlotChanges(staged);
    const physical=new Set(changed.map(x=>x.slotIndex));
    const inspection=getActiveWriteContext()?.participation==='inspection';
    const shadowPlans:Array<{slotIndex:number;keep:boolean;value:unknown}>=[];
    const units: PreparedPublicationUnit[] = [];
    const publicationPredecessors = new Map<object, object | undefined>();
    const coverage = new Map<number, readonly object[]>();
    for(const [slotIndex,nextValue] of staged){
      const has=inspectionBaseline.has(slotIndex);
      const before=has?inspectionBaseline.get(slotIndex):values[slotIndex];
      if (has && PRODUCTION_SUBSTRATE_STATS_ENABLED) {
        recordProductionSubstrateStat('equalityChecks');
      }
      const equal=has?equalities[slotIndex](before,nextValue):!physical.has(slotIndex);
      const keep=inspection&&!equal;
      if(keep!==has || keep&&!Object.is(inspectionBaseline.get(slotIndex),before))shadowPlans.push({slotIndex,keep,value:before});
      const source = publicationSources[slotIndex];
      if (source) {
        const mutation = {admissionParticipation,intent:'replace' as const, before, after:equal ? before : nextValue, changed:!equal, physicalChanged:physical.has(slotIndex), publicationPredecessors, deferPublicationFinalization:true};
        const terminal = !equal ? prepareScalarSourceTerminal(source,mutation) : undefined;
        const publication = prepareScalarSourcePublication(source,{...mutation,preparedTerminal:terminal});
        const unit = publication ? {...publication,record:combineTerminalRecords(terminal,publication.record)!} : terminal ? {record:terminal,completion:{}} : undefined;
        if (unit) { units.push(unit); coverage.set(slotIndex, unit.coveredRecipients ?? []); }
      }
    }
    if(getCommittedRevision()!==base)throw new Error('Reentrant scalar preparation');
    const seal=()=>{for(const unit of units)unit.finalize?.();if(getCommittedRevision()!==base)throw new Error('Reentrant scalar finalization');};
    const phase=options?.publicationPhase ?? new PublicationPreparation();
    phase.add(seal,()=>{for(const unit of units)unit.validate?.();});
    if(!options?.publicationPhase)phase.seal();
    if(getCommittedRevision()!==base)throw new Error('Reentrant scalar preparation');
    let used=false;
    const publication: ScalarFramePublication | undefined = units.length ? {
      coverage,
      complete() {
        const pending = units.splice(0);
        let failed = false, first: unknown;
        for (const unit of pending) {
          try { completeScalarSourcePublication(unit); }
          catch (error) { if (!failed) { failed = true; first = error; } }
        }
        if (failed) throw first;
      },
    } : undefined;
    return()=>{
      if(used)throw new Error('Prepared scalar commit already used');
      if(getCommittedRevision()!==base)throw new Error('Stale prepared scalar commit');
      if(!options?.publicationPhase)phase.validate();
      used=true;
      for (const { slotIndex, nextValue } of changed) {
        values[slotIndex] = nextValue;
        if (PRODUCTION_SUBSTRATE_STATS_ENABLED) {
          recordProductionSubstrateStat('slotWrites');
        }
      }
      for(const p of shadowPlans){if(p.keep)inspectionBaseline.set(p.slotIndex,p.value);else inspectionBaseline.delete(p.slotIndex);}
      for (const unit of units) installTerminalRecord(unit.record);
      const revision=(changed.length||shadowPlans.length)&&options?.advanceRevision!==false?advanceRevision():getCommittedRevision();
      for (const {slotIndex} of changed) {
        const source = publicationSources[slotIndex];
        if (source) markSnapshotInstalled(source);
      }
      return {revision,changedSlots:changed.map(x=>x.slotIndex),...(publication ? {publication} : {})};
    };
  };
  const commitSlots = (staged:ReadonlyMap<SlotIndex,unknown>,options?:{advanceRevision?:boolean; publicationPhase?:PublicationPreparation; admissionParticipation?:'realized'}):ScalarSlotCommitResult => prepareSlots(staged,options)();
  const commitSlotValue = <T>(slotIndex:SlotIndex,nextValue:T,options?:{advanceRevision?:boolean}):boolean => commitSlots(new Map([[slotIndex,nextValue]]),options).changedSlots.length>0;
  const commitSlot = <T>(
    slotIndex: SlotIndex,
    nextValue: T,
    options?: { advanceRevision?: boolean; publicationPhase?: PublicationPreparation }
  ): SingleSlotCommitResult => {
    const changed = commitSlotValue(slotIndex, nextValue, options);
    return changed
      ? { revision: getCommittedRevision(), changed: true, slot: slotIndex }
      : { revision: getCommittedRevision(), changed: false };
  };

  return {
    bindPublicationSource(slotIndex, node) { assertSlotIndex(slotIndex); publicationSources[slotIndex] = node; },
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
    commitRecorded<T>(slotIndex: SlotIndex, value: T, prepare?: (physicalChanged?:boolean) => TerminalRecordPlan | undefined, prepareUnchanged?: (current: T,physicalChanged?:boolean) => TerminalRecordPlan | undefined): {changed:boolean;physicalChanged:boolean} {
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
      if (shadowed && PRODUCTION_SUBSTRATE_STATS_ENABLED) {
        recordProductionSubstrateStat('equalityChecks');
      }
      const authorityEqual=shadowed?equalities[slotIndex](ordinaryBefore,value):equal;
      if(getCommittedRevision()!==base)throw new Error('Scalar authority equality reentered installation');
      const semanticChanged=inspection?!equal:!authorityEqual;
      if(equal&&!semanticChanged){
        // Publication responsibility can change without changing ordinary truth.
        // The separate hook never creates a compensation effect or value event.
        const plan = prepareUnchanged?.(ordinaryBefore as T,!equal);
        if(getCommittedRevision()!==base)throw new Error('Publication preparation reentered physical installation');
        if(plan)installTerminalRecord(plan);
        if(!inspection)inspectionBaseline.delete(slotIndex);
        return {changed:false,physicalChanged:false};
      }
      const plan=semanticChanged?prepare?.(!equal):prepareUnchanged?.(ordinaryBefore as T,!equal);
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
      const source = publicationSources[slotIndex];
      if (!equal && source) markSnapshotInstalled(source);
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
