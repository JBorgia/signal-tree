export interface TerminalRecordPlan {
  readonly scalarAdmission?: { readonly effect:object; readonly operationEffect:object };
  readonly deletes?: readonly { readonly map: { delete(key: unknown): unknown }; readonly key: unknown }[];
  readonly writes: readonly { readonly map: { set(key: unknown, value: unknown): unknown }; readonly key: unknown; readonly value: unknown }[];
  readonly adds: readonly { readonly set: { add(value: unknown): unknown }; readonly value: unknown }[];
}
/** Apply only precomputed internal writes; callers own installation ordering. */
export function installTerminalRecord(plan: TerminalRecordPlan): void {
  for (const edit of plan.deletes ?? []) edit.map.delete(edit.key);
  for (let i = 0; i < plan.writes.length; i++) {
    const write = plan.writes[i];
    write.map.set(write.key, write.value);
  }
  for (let i = 0; i < plan.adds.length; i++) {
    const add = plan.adds[i];
    add.set.add(add.value);
  }
}
/** Combine only this installation's prepared primitive edits, never history prefixes. */
export function combineTerminalRecords(...plans: readonly (TerminalRecordPlan | undefined)[]): TerminalRecordPlan | undefined {
  const present = plans.filter((plan): plan is TerminalRecordPlan => plan !== undefined);
  if (present.length < 2) return present[0];
  return {
    writes: present.flatMap(plan => plan.writes),
    adds: present.flatMap(plan => plan.adds),
    deletes: present.flatMap(plan => plan.deletes ?? []),
  };
}

export interface PreparedPublicationUnit {
  readonly record: TerminalRecordPlan;
  readonly completion: object;
  /** Recipients whose prepared unit contains this exact contribution. */
  readonly coveredRecipients?: readonly object[];
  /** Pure private metadata finalization after all callback-capable preparation. */
  readonly finalize?: () => void;
  /** Callback-free source identity check before any operation store. */
  readonly validate?: () => void;
}
type PublicationPreparer = (mutation: IntrinsicMutation<unknown>, input?: object, native?: object) => PreparedPublicationUnit | undefined;
type PublicationInputCapture = () => object | undefined;
type PublicationInput = { readonly inputs: ReadonlyMap<PublicationPreparer, object | undefined>; readonly native?: object };
/** Optional experiment participant owned by the native source, not its recipients. */
export interface NativePublicationParticipant {
  prepare: PublicationPreparer;
  captureInput: PublicationInputCapture;
  complete: PublicationCompleter;
}
let nativePublicationFactory: ((node: object) => NativePublicationParticipant) | undefined;
export function registerNativePublicationFactory(factory: (node: object) => NativePublicationParticipant): void {
  if (nativePublicationFactory) throw new Error('Native publication authority already registered');
  nativePublicationFactory = factory;
}
const installedPublications = new WeakSet<object>();
type PublicationCompleter = (completion: object) => void;
type PublicationCompletion = { readonly parts: readonly { readonly complete: PublicationCompleter; readonly value: object }[] };

function completePublication(completion: object): void {
  if (!installedPublications.delete(completion)) return;
  let failed = false;
  let first: unknown;
  for (const part of (completion as PublicationCompletion).parts) {
    try { part.complete(part.value); }
    catch (error) { if (!failed) { failed = true; first = error; } }
  }
  if (failed) throw first;
}

type TerminalPreparer = (mutation: IntrinsicMutation<unknown>) => TerminalRecordPlan | undefined;
export interface IntrinsicMutation<T> {
  /** Classification of this prepared attempt only; never an ambient write scope. */
  readonly admissionParticipation?: 'realized';
  readonly preparedTerminal?: TerminalRecordPlan;
  /** Precomputed physical equality, separate from ordinary admission. */
  readonly physicalChanged?: boolean;
  readonly intent: 'replace' | 'derive';
  /** Operation-local predecessor chain for sibling plans prepared before installation. */
  readonly publicationPredecessors?: Map<object, object | undefined>;
  readonly deferPublicationFinalization?: boolean;
  readonly before: T;
  readonly after: T;
  readonly changed: boolean;
  readonly coveredRecipients?: readonly object[];
}

type IntrinsicMutationObserver<T> = (mutation: IntrinsicMutation<T>) => void;

/**
 * A mutation source, held BY THE THING THAT MUTATES rather than looked up.
 *
 * Every write used to ask a module-level `WeakMap` whether this leaf had an
 * observer, and on a tree with no inspection, capture or Studio attached the
 * answer is always no — a WeakMap probe plus a `Set.size` test per mutation
 * against a set that stays empty for the life of the process.
 *
 * A first fix short-circuited on a process-wide installed-observer count. It
 * measured well but it is the wrong ownership boundary: one observer installed
 * anywhere puts the probe back on every unrelated tree in the process. Pay for
 * use belongs at the smallest practical boundary, so the state lives here, on
 * the source, and the mutating closure keeps a direct reference to it.
 *
 * The hot path is now one field read and one branch:
 *
 * ```ts
 * const observer = source.observer;   // undefined unless THIS leaf is observed
 * if (observer) { ... }
 * ```
 *
 * `observer` is composed on install/release, never per mutation. That also
 * removes a closure allocation and an array spread that the previous version
 * performed on EVERY mutation of an observed leaf.
 */
export interface IntrinsicMutationSource<T> {
  /** `undefined` exactly when nothing observes THIS source. */
  observer: IntrinsicMutationObserver<T> | undefined;
  readonly capture?: IntrinsicMutationObserver<T>;
  readonly terminal?: IntrinsicMutationObserver<T>;
  readonly prepareTerminal?: (mutation: IntrinsicMutation<T>) => TerminalRecordPlan | undefined;
  readonly preparePublication?: (mutation: IntrinsicMutation<T>, input?: object) => PreparedPublicationUnit | undefined;
  readonly capturePublicationInput?: () => object;
  readonly completePublication?: PublicationCompleter;
}

interface SourceRecord {
  captureRecord?: SourceRecord;
  terminalRecord?: SourceRecord;
  terminalPreparer?: TerminalPreparer;
  nativePublication?: NativePublicationParticipant;
  publicationPreparers?: Map<PublicationPreparer, {complete: PublicationCompleter; captureInput?: PublicationInputCapture}>;
  publicationInputCapture?: () => object;
  publicationPreparer?: PublicationPreparer;
  /**
   * Created on first `observeIntrinsicMutations`, not at registration.
   *
   * An empty `Set` measures 161 B, and a realized entity registers two mutation
   * sources — its entity cell and its activation cell — so eager allocation
   * cost 322 B/entity of sets that never receive an observer on a tree with no
   * inspection, capture or Studio attached. Same pay-for-use rule as the
   * per-write probe above, applied to retention rather than to CPU.
   */
  observers: Set<IntrinsicMutationObserver<unknown>> | undefined;
  observer: IntrinsicMutationObserver<unknown> | undefined;
}

/**
 * Only `observeIntrinsicMutations` uses this, and only to find a source from a
 * node it was handed. Nothing on a mutation path reads it.
 */
const SOURCES = new WeakMap<object, SourceRecord>();

// Accessor functions are shared; all mutable observer and preparation state
// stays on the individual source. Per-source closures otherwise retain an
// unnecessary context and accessor functions even on an unobserved leaf.
const SOURCE_ACCESSORS: PropertyDescriptorMap = {
  capturePublicationInput: {
    get(this: SourceRecord) { return this.publicationInputCapture; },
  },
  preparePublication: {
    get(this: SourceRecord) { return this.publicationPreparer; },
  },
  completePublication: {
    get(this: SourceRecord) { return this.publicationPreparer ? completePublication : undefined; },
  },
  prepareTerminal: {
    get(this: SourceRecord) { return this.terminalPreparer; },
  },
  terminal: {
    get(this: SourceRecord) { return this.terminalRecord?.observer; },
  },
  capture: {
    get(this: SourceRecord) { return this.captureRecord?.observer; },
  },
};


/**
 * One observer must not be able to starve another after truth has committed,
 * so a throwing observer is contained — including when it is the only one.
 */
function compose(record: SourceRecord): void {
  const { observers } = record;
  if (observers === undefined || observers.size === 0) {
    record.observer = undefined;
    return;
  }
  if (observers.size === 1) {
    const only = observers.values().next()
      .value as IntrinsicMutationObserver<unknown>;
    record.observer = (mutation) => {
      try {
        only(mutation);
      } catch {
        // contained
      }
    };
    return;
  }
  // Snapshot so installing or releasing during a fan-out cannot disturb it.
  const snapshot = [...observers];
  record.observer = (mutation) => {
    for (const observer of snapshot) {
      try {
        observer(mutation);
      } catch {
        // contained
      }
    }
  };
}

/**
 * The source for a location nothing can observe.
 *
 * `SUBJECT-STATE-MINIMAL-0`. An internal cell — an entity's value cell or its
 * activation counter — is reachable only through a private `Map` inside
 * `createEntitySignal`. No caller can obtain the `Location` to pass to
 * `observeIntrinsicMutations`, so registering a per-cell `SourceRecord` and
 * WeakMap entry buys nothing: measured at 90 B per cell, and a realized entity
 * has two.
 *
 * Shared and permanently empty. `observer` stays `undefined`, so the mutating
 * closures take their existing no-observer branch unchanged, and because these
 * cells are never entered into `SOURCES`, an attempt to observe one returns
 * `undefined` rather than silently attaching to a shared record.
 */
const UNOBSERVABLE_SOURCE: IntrinsicMutationSource<never> = Object.freeze({
  observer: undefined,
});

export function unobservableMutationSource<T>(): IntrinsicMutationSource<T> {
  return UNOBSERVABLE_SOURCE as unknown as IntrinsicMutationSource<T>;
}

/**
 * Registers `node` as observable and returns the handle the mutating closure
 * should keep. Callers must hold the returned source — re-deriving it per write
 * is the cost this exists to remove.
 */
export function registerIntrinsicMutationSource<T = unknown>(
  node: object
): IntrinsicMutationSource<T> {
  const record: SourceRecord = { observers: undefined, observer: undefined };
  Object.defineProperties(record, SOURCE_ACCESSORS);
  SOURCES.set(node, record);
  record.nativePublication = nativePublicationFactory?.(node);
  if (record.nativePublication) composePublication(record);
  return record as IntrinsicMutationSource<T>;
}

export function observeIntrinsicMutations<T>(
  node: object,
  observer: IntrinsicMutationObserver<T>,
  capture: boolean | 'terminal' = false
): (() => void) | undefined {
  const source = SOURCES.get(node);
  if (!source) return undefined;
  const record = capture === 'terminal' ? (source.terminalRecord ??= {observers:undefined,observer:undefined}) : capture ? (source.captureRecord ??= {observers:undefined,observer:undefined}) : source;
  const installed = observer as IntrinsicMutationObserver<unknown>;
  (record.observers ??= new Set()).add(installed);
  compose(record);
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    record.observers?.delete(installed);
    compose(record);
  };
}

/**
 * Resolve an observer from a node rather than from a held source. This is the
 * cold path — it still costs the WeakMap probe, so it must not appear on a
 * mutation path. Kept for callers that only have the node.
 */
export function getIntrinsicMutationObserver<T>(
  node: object
): IntrinsicMutationObserver<T> | undefined {
  return SOURCES.get(node)?.observer as
    | IntrinsicMutationObserver<T>
    | undefined;
}

// Internal single-owner preparation hook, never a post-install observer.
export function prepareTerminalMutations(node: object, prepare: TerminalPreparer): (()=>void) | undefined {
  const source=SOURCES.get(node); if(!source)return;
  if(source.terminalPreparer)throw new Error('Terminal preparation already owned');
  source.terminalPreparer=prepare;
  return ()=>{if(source.terminalPreparer===prepare)source.terminalPreparer=undefined;};
}

/** Recipient enrollment composes with the optional source-owned admission participant. */
export function preparePublicationMutations(
  node: object,
  prepare: PublicationPreparer,
  complete: PublicationCompleter,
  captureInput?: PublicationInputCapture
): (() => void) | undefined {
  const source = SOURCES.get(node);
  if (!source) return undefined;
  const preparers = source.publicationPreparers ??= new Map();
  if (preparers.has(prepare)) throw new Error('Publication preparation already registered');
  preparers.set(prepare, {complete,captureInput});
  composePublication(source);
  return () => { if (preparers.delete(prepare)) composePublication(source); };
}

/** No source registration is reachable until the producer installs this record. */
export function stagePublicationMutations(node: object, prepare: PublicationPreparer,
 complete: PublicationCompleter, captureInput?: PublicationInputCapture) {
 if(!SOURCES.has(node))throw new Error('Prepared descendant lacks native publication source');
 let release:(()=>void)|undefined;
 return {install:()=>{release=preparePublicationMutations(node,prepare,complete,captureInput);},
 release:()=>{release?.();release=undefined;}};
}

function composePublication(source: SourceRecord): void {
  const native = source.nativePublication;
  const snapshot = [...(source.publicationPreparers ?? [])];
  if (!native && !snapshot.length) {
    source.publicationPreparer = undefined;
    source.publicationInputCapture = undefined;
    source.publicationPreparers = undefined;
    return;
  }
  source.publicationInputCapture = () => ({
    native: native?.captureInput(),
    inputs: new Map(snapshot.map(([prepare, entry]) => [prepare, entry.captureInput?.()])),
  });
  const publicationPreparer: PublicationPreparer = (mutation, input) => {
    const captured = input as PublicationInput | undefined;
    const nativeUnit = native?.prepare(mutation, captured?.native);
    const plans: TerminalRecordPlan[] = nativeUnit ? [nativeUnit.record] : [];
    const coveredRecipients:object[]=[];
    const finalizers: (() => void)[] = nativeUnit?.finalize ? [nativeUnit.finalize] : [];
    const parts: Array<{ complete: PublicationCompleter; value: object }> = nativeUnit && native
      ? [{ complete: native.complete, value: nativeUnit.completion }] : [];
    for (const [prepare, entry] of snapshot) {
      const unit = prepare(mutation, captured?.inputs.get(prepare), nativeUnit?.completion);
      if (unit) { plans.push(unit.record); parts.push({ complete: entry.complete, value: unit.completion }); if (unit.finalize) finalizers.push(unit.finalize); coveredRecipients.push(...unit.coveredRecipients??[]); }
    }
    // Every private unit finalizes after all callback-capable preparation.
    let sealed=false;
    const validate=()=>{nativeUnit?.validate?.();if(source.publicationPreparer!==publicationPreparer)throw new Error('Scalar publication enrollment changed before installation');};
    const finalize=()=>{if(sealed)return;sealed=true;validate();for(const seal of finalizers)seal();validate();};
    if(!mutation.deferPublicationFinalization)finalize();
    const record = combineTerminalRecords(...plans);
    if (!record) return undefined;
    const completion = { parts };
    return { record: combineTerminalRecords(record, { writes: [], adds: [{ set: installedPublications, value: completion }] })!, completion,coveredRecipients,finalize,validate };
  };
  source.publicationPreparer = publicationPreparer;
}

/** Optional ordinary-membership admission; producers retain descriptor authority. */
export interface MembershipPublicationEdit {
  readonly preparedOccurrences?: readonly import('./native-occurrence').NativeOccurrence[];
  readonly registry: object;
  readonly branch: object;
  readonly address: readonly string[];
  readonly key: string;
  readonly child: object;
  readonly present: boolean;
  /** Prepared source ordinary values; never reconstructed from physical delivery. */
  readonly ordinary?: Readonly<{
    before: Readonly<{ present: false }> | Readonly<{ present: true; value: unknown }>;
    after: Readonly<{ present: false }> | Readonly<{ present: true; value: unknown }>;
  }>;
}
type MembershipPublicationPreparer = (edit: MembershipPublicationEdit) => PreparedPublicationUnit | undefined;
export let membershipPublicationPreparer: MembershipPublicationPreparer | undefined;
const membershipParticipants = new Map<MembershipPublicationPreparer, PublicationCompleter>();
/** Registration order is preparation/completion order; removal affects only that participant. */
export function registerMembershipPublication(
  prepare: MembershipPublicationPreparer,
  complete: PublicationCompleter
): () => void {
  if (membershipParticipants.has(prepare)) throw new Error('Membership publication preparation already registered');
  membershipParticipants.set(prepare, complete);
  const compose = () => {
    const participants = [...membershipParticipants];
    membershipPublicationPreparer = participants.length ? edit => {
      const units: PreparedPublicationUnit[] = [];
      const parts: Array<{ complete: PublicationCompleter; value: object }> = [];
      for (const [prepare, complete] of participants) {
        const unit = prepare(edit);
        if (unit) { units.push(unit); parts.push({ complete, value: unit.completion }); }
      }
      // Never rerun optional preparation after reentry. Only native metadata has
      // a pure finalizer, and no record is reachable until the producer installs.
      for (const unit of units) unit.finalize?.();
      if (!units.length) return;
      const completion = { parts };
      return { record: combineTerminalRecords(...units.map(unit => unit.record),
        { writes: [], adds: [{ set: installedPublications, value: completion }] })!, completion };
    } : undefined;
  };
  compose();
  return () => { if (membershipParticipants.delete(prepare)) compose(); };
}
export { completePublication as completePreparedPublication };

/** Optional native branch-updater input scope; never a state/settlement owner. */
export let beginBranchPublicationInput: ((node: object, supplied?: unknown) => object | undefined) | undefined;
export let endBranchPublicationInput: ((token: object) => void) | undefined;
export function registerBranchPublicationInputs(
  begin: (node: object, supplied?: unknown) => object | undefined,
  end: (token: object) => void
): () => void {
  if (beginBranchPublicationInput) throw new Error('Branch publication input capture already registered');
  beginBranchPublicationInput = begin;
  endBranchPublicationInput = end;
  return () => {
    if (beginBranchPublicationInput === begin) {
      beginBranchPublicationInput = undefined;
      endBranchPublicationInput = undefined;
    }
  };
}

/** Cold equality fast path: only enrolled sources need support-only admission. */
export function hasPublicationPreparation(node: object): boolean {
  // This query gates recipient-specific equal-setter admission. Native fact
  // recording alone is not a live publication recipient.
  return (SOURCES.get(node)?.publicationPreparers?.size ?? 0) > 0;
}

/** Private builder correspondence: records the actual plain snapshot, never replaces it. */
export let recordPublicationSnapshot: ((node: object, value: object) => void) | undefined;
export function registerPublicationSnapshots(record: (node: object, value: object) => void): void {
  if (recordPublicationSnapshot) throw new Error('Publication snapshot recorder already registered');
  recordPublicationSnapshot = record;
}

/** Frame ownership uses the same source participant as the direct setter. */
export function prepareScalarSourcePublication(node: object, mutation: IntrinsicMutation<unknown>): PreparedPublicationUnit | undefined {
  return SOURCES.get(node)?.publicationPreparer?.(mutation);
}
export function completeScalarSourcePublication(unit: PreparedPublicationUnit): void {
  completePublication(unit.completion);
}

/** Shared frame path uses the same prepared scalar recorder as direct leaves. */
export function prepareScalarSourceTerminal(node:object,mutation:IntrinsicMutation<unknown>):TerminalRecordPlan|undefined{return SOURCES.get(node)?.terminalPreparer?.(mutation);}
