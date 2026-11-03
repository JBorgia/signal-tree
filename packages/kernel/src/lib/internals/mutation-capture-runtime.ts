import {
  getPositionRegistry,
  type PositionRegistry,
} from './position-registry';
import type { TerminalRecordPlan } from './intrinsic-mutation';
import { isTraversableNode } from '../utils';
import { reportContainedObserverError } from './error-reporter';
import type { StructuralEffect } from '../mutation-types';
import type { WriteMetadata } from '../mutation-types';

export type TopologyPlacement = Readonly<
  | { present: false }
  | {
      present: true;
      key: string | number;
      beforeSubject?: number;
      afterSubject?: number;
    }
>;
export type TopologyPlacementPair = Readonly<{
  subject: number;
  before: TopologyPlacement;
  after: TopologyPlacement;
}>;
export type TopologyViewInterval = Readonly<{
  before: unknown;
  after: unknown;
  pairs: readonly TopologyPlacementPair[];
}>;
export type CompletedTopologyUnit = Readonly<{
  id: object;
  order?: Readonly<{
    beforeSubjects: readonly number[];
    afterSubjects: readonly number[];
    ordinaryEndpoints?: CollectionOrderCapture['ordinaryEndpoints'];
  }>;
  physical: TopologyViewInterval;
  ordinary: TopologyViewInterval;
}>;

export type CollectionOrderCapture = {
  readonly owner: number;
  readonly ownerPath: string;
  readonly beforeSubjects: readonly number[];
  readonly afterSubjects: readonly number[];
  readonly beforeFrontier: unknown;
  readonly afterFrontier: unknown;
  /** Prepared source ordinary order, distinct from physical order/frontier. */
  readonly topologyUnit?: CompletedTopologyUnit;
  readonly ordinaryEndpoints?: {
    readonly before: readonly number[];
    readonly after: readonly number[];
    readonly domain?: readonly number[];
    readonly beforeToken?: unknown;
    readonly afterToken?: unknown;
  };
  readonly meta?: WriteMetadata;
};

/**
 * Transient committed source evidence; consumers retain their own authority.
 *
 * Published by an entity collection after a mutation's physical application
 * and before any notifier enqueue or delivery, so admission can see every row
 * of a multi-row commit before an observer of the first row can re-enter.
 */
export type CommittedEntityMutation = {
  readonly subject: number;
  /** Actual row values; undefined means the lifetime is not a current member. */
  readonly before: unknown;
  readonly after: unknown;
  /** Membership/key changes claim the lifetime, rather than just value fields. */
  readonly structural: boolean;
  readonly path?: string;
  readonly structuralRecord?: StructuralEffect;
};

/** Prepared before installation; completed before paired responsibility installs. */
export type StructuralFrontierInterval = {
  readonly before: unknown;
  after: unknown;
};

export type StructuralPlacementEvidence = StructuralEffect extends infer E
  ? E extends StructuralEffect
    ? Omit<E, 'value'>
    : never
  : never;

export type CommittedEntityCapture = {
  readonly fieldSelections?: import('./native-field-selection').NativeFieldSelections;
  readonly topologyUnit?: CompletedTopologyUnit;
  readonly structuralRecords?: readonly StructuralPlacementEvidence[];
  readonly structuralFrontier?: StructuralFrontierInterval;
  readonly owner: number;
  readonly ownerPath: string;
  readonly changes: readonly CommittedEntityMutation[];
  readonly meta?: WriteMetadata;
};

export const MUTATION_CAPTURE_RUNTIME = Symbol.for(
  'SignalTree:MutationCaptureRuntime'
);

/** Existing scalar authority producer; ordinary source attachment owns routing only. */
export type ScalarResponsibilityPreparer = (
 path:string,next:unknown,prev:unknown,meta?:WriteMetadata,ownerPath?:string,
 subjectIds?:number[],positionIds?:number[]
) => TerminalRecordPlan | undefined;

export interface MutationCaptureRuntime {
  prepareScalarResponsibility?: ScalarResponsibilityPreparer;
  /** Prepared ordinary membership responsibility; installed without delivery. */
  prepareMemberResponsibility?: (
    branch: object,
    key: string,
    child: object,
    presence?: Readonly<{ before: boolean; after: boolean }>
  ) => TerminalRecordPlan | undefined;
  prepareEntityResponsibility?: (
    capture: CommittedEntityCapture
  ) => TerminalRecordPlan | undefined;
  /** Pay-for-use: producers build committed evidence only when this is true. */
  hasCommittedEntityObservers?(): boolean;
  /** Structural endpoint evidence does not enable ordinary field observation. */
  hasStructuralBoundaryObservers?(): boolean;
  subscribeStructuralBoundary?(
    listener: (capture: CommittedEntityCapture) => void
  ): () => void;
  publishCommittedEntity?(capture: CommittedEntityCapture, deferObservation?: (delivery: () => void) => void): void;
  subscribeEntityWitness?(listener: (capture: CommittedEntityCapture) => void): () => void;
  subscribeStructuralWitness?(listener: (capture: CommittedEntityCapture) => void): () => void;
  subscribeCommittedEntity?(
    listener: (capture: CommittedEntityCapture) => void
  ): () => void;
  isCaptureActive(): boolean;
  activateCapture(): () => void;
  publishCollectionOrder?(capture: CollectionOrderCapture): void;
  subscribeCollectionOrder?(
    listener: (capture: CollectionOrderCapture) => void
  ): () => void;
}

export function createMutationCaptureRuntime(): MutationCaptureRuntime {
  let activeCount = 0;
  const entityWitnesses = new Set<(capture: CommittedEntityCapture) => void>();
  const structuralWitnesses = new Set<(capture: CommittedEntityCapture) => void>();
  const entityListeners = new Set<(capture: CommittedEntityCapture) => void>();
  const structuralBoundaryListeners = new Set<
    (capture: CommittedEntityCapture) => void
  >();
  const collectionOrderListeners = new Set<
    (capture: CollectionOrderCapture) => void
  >();

  return {
    hasCommittedEntityObservers(): boolean {
      return activeCount > 0 && (entityListeners.size > 0 || entityWitnesses.size > 0);
    },
    hasStructuralBoundaryObservers(): boolean {
      return activeCount > 0 && (structuralBoundaryListeners.size > 0 || structuralWitnesses.size > 0);
    },
    subscribeStructuralBoundary(listener): () => void {
      structuralBoundaryListeners.add(listener);
      return () => {
        structuralBoundaryListeners.delete(listener);
      };
    },
    subscribeEntityWitness(listener) { entityWitnesses.add(listener); return () => { entityWitnesses.delete(listener); }; },
    subscribeStructuralWitness(listener) { structuralWitnesses.add(listener); return () => { structuralWitnesses.delete(listener); }; },
    publishCommittedEntity(capture, deferObservation): void {
      if (activeCount === 0) return;
      const structural = Boolean(
        capture.structuralFrontier ||
        (capture.topologyUnit &&
          (capture.topologyUnit.physical.before !==
            capture.topologyUnit.physical.after ||
            capture.topologyUnit.ordinary.before !==
              capture.topologyUnit.ordinary.after))
);
      const invoke = (listeners: readonly ((capture: CommittedEntityCapture) => void)[]) => {
        for (const listener of listeners) try { listener(capture); }
        catch (error) { const report=()=>reportContainedObserverError({ error, operation: 'transaction:listener' }); if(deferObservation)deferObservation(report);else report(); }
      };
      // Internal admission stays synchronous and precedes arbitrary observation.
      invoke(structural ? [...entityWitnesses, ...structuralWitnesses] : [...entityWitnesses]);
      const listeners = structural ? [...entityListeners, ...structuralBoundaryListeners] : [...entityListeners];
      if (listeners.length) {
        const deliver = () => invoke(listeners);
        if (deferObservation) deferObservation(deliver); else deliver();
      }
    },
    subscribeCommittedEntity(listener): () => void {
      entityListeners.add(listener);
      return () => {
        entityListeners.delete(listener);
      };
    },
    isCaptureActive(): boolean {
      return activeCount > 0;
    },
    activateCapture(): () => void {
      activeCount += 1;
      let released = false;

      return () => {
        if (released) {
          return;
        }

        released = true;
        activeCount = Math.max(0, activeCount - 1);
      };
    },
    publishCollectionOrder(capture): void {
      if (activeCount === 0) {
        return;
      }
      for (const listener of [...collectionOrderListeners]) {
        listener(capture);
      }
    },
    subscribeCollectionOrder(listener): () => void {
      collectionOrderListeners.add(listener);
      return () => collectionOrderListeners.delete(listener);
    },
  };
}

const runtimesByRegistry = new WeakMap<
  PositionRegistry,
  MutationCaptureRuntime
>();
export function bindMutationCaptureRegistry(
  registry: PositionRegistry,
  runtime: MutationCaptureRuntime
): () => void {
  runtimesByRegistry.set(registry, runtime);
  return () => {
    if (runtimesByRegistry.get(registry) === runtime)
      runtimesByRegistry.delete(registry);
  };
}
export function getMutationCaptureRuntime(
  node: unknown
): MutationCaptureRuntime | undefined {
  if (!isTraversableNode(node)) {
    return undefined;
  }

  return (
    (node as Record<symbol, MutationCaptureRuntime | undefined>)[
      MUTATION_CAPTURE_RUNTIME
    ] ??
    (getPositionRegistry(node)
      ? runtimesByRegistry.get(getPositionRegistry(node)!)
      : undefined)
  );
}
