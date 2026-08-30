#!/usr/bin/env node
/**
 * Regenerates the SUBJECT column from the census and re-applies recorded
 * rulings. Subjects are never hand-written; rulings are never inferred.
 *
 * ⚠️ OWNERSHIP IS NOT INFERRED FROM MECHANICAL FACTS. The first generator
 * assigned 94 rows to KERNEL from two inferences — "bare reachable" and "the
 * symbol name lacks Entity/Subject". Both are invalid:
 *
 *     REACHABILITY IS EVIDENCE ABOUT COST, NOT EVIDENCE ABOUT OWNERSHIP.
 *     A SYMBOL'S NAME DOES NOT CHOOSE ITS OWNER.
 *
 * PathNotifier was bare-reachable and that WAS the ownership error, worth
 * 1.42 KB. A census can establish that a module is reachable, that an export
 * has no consumer, that a file imports Angular. It cannot turn those facts into
 * "therefore KERNEL" without a previously frozen rule proving the implication.
 *
 * Only two mechanical classifications survive, because the evidence itself
 * settles them:
 *     specs-only        -> TEST-SEAM   (a spec is the consumer; that is the job)
 *     doc-comment-only  -> RETIRED     (nothing can reach it)
 * Even `same-file-only` proves ONLY that the export is unnecessary — it says
 * nothing about who owns the code.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
execSync(`node ${ROOT}/tools/kernel-ownership-census.mjs`, { stdio: 'pipe' });
const c = JSON.parse(
  readFileSync(`${ROOT}/tools/kernel-ownership-census.json`, 'utf8')
);

/**
 * RULINGS. owner + action, both explicit. A known owner is not a converged
 * implementation — `defineStore` is decisively FRAMEWORK-ADAPTER and is still
 * sitting inside what we intend to call a neutral kernel.
 *
 *     KNOWN OWNER DOES NOT MEAN CONVERGED IMPLEMENTATION.
 */
const RULINGS = {
  // ── S1 — the ordinary-leaf carrier port ──────────────────────────────────
  'bare-module:core/lib/internals/cell-runtime.ts': [
    'KERNEL',
    'CONVERGED',
    'BM-A: the neutral leaf-carrier contract; bare-required and imports no framework',
  ],
  // ── C6 / SERIALIZATION-REACTIVE-CLASSIFICATION-0 ─────────────────────────
  'angular-type:enhancers/serialization/serialization.ts': [
    'OPTIONAL-CAPABILITY',
    'CONVERGED',
    'its only Angular VALUE import (isSignal) now routes through the realization port; the remaining Signal/WritableSignal references are type-position and erase',
  ],
  // ── C6 / S2b-1 ───────────────────────────────────────────────────────────
  'angular-type:lib/internals/merge-derived.ts': [
    'KERNEL',
    'CONVERGED',
    'S2b-1 replaced its only Angular VALUE import (isSignal) with the neutral realization predicate; the remaining `Signal` reference is type-position and erases',
  ],
  // ── C6.2/S3 — the tracking-suppression port ──────────────────────────────
  'angular-type:lib/internals/owned-mutation.ts': [
    'KERNEL',
    'CONVERGED',
    'S3 removed its only Angular VALUE import (untracked -> withoutTracking); the remaining WritableSignal reference is type-position and erases',
  ],
  'bare-module:core/lib/internals/tracking-suppression.ts': [
    'KERNEL',
    'CONVERGED',
    'BM-A: the neutral suppression port; bare-required and imports no framework',
  ],
  // ── C6.4 — bare mixed-ownership dispositions, ADJUDICATED not mechanical ──
  // The derivation used `owners.length > 1 -> SPLIT`, which turned five modules
  // into five proposed file surgeries the moment corrected state provenance
  // revealed their diagnostic and framework bindings.
  //
  //     MULTIPLE SEMANTIC OWNERS IN ONE FILE ARE EVIDENCE TO INSPECT A
  //     BOUNDARY, NOT PROOF THAT A PHYSICAL SPLIT IS REQUIRED.
  //
  //     SPLIT WHEN CO-LOCATION CREATES DEPENDENCY, AUTHORITY, OR MATERIAL COST
  //     — NOT TO MAKE THE OWNERSHIP TABLE MONOCHROME.
  //
  // Evidence used: emitted runtime Angular imports per module, and whether the
  // co-located non-kernel job is ngDevMode-guarded (and so absent from shipped
  // builds) rather than a real dependency.
  'bare-module:core/lib/utils.ts': [
    'KERNEL',
    'SPLIT',
    'SPLIT HELD: emits runtime signal/computed/isSignal AND Angular DI (effect, Injector, runInInjectionContext). The DI work is a genuinely different job from the bare-required kernel utilities beside it — a dependency boundary, not aesthetics',
  ],
  'bare-module:core/lib/signal-tree.ts': [
    'KERNEL',
    'REIMPLEMENT',
    'NOT split for diagnostics: its 32 ngDevMode guards are dev-only and its Angular coupling belongs to the kernel job itself (signal/isSignal/untracked/computed), so the fix is the C6 realization boundary, not file surgery',
  ],
  'bare-module:core/lib/internals/merge-derived.ts': [
    'KERNEL',
    'REIMPLEMENT',
    'NOT split: its only runtime framework coupling is isSignal, which the neutral isReactiveNode contract should absorb — re-evaluate after S2b',
  ],
  'bare-module:core/lib/internals/materialize-markers.ts': [
    'KERNEL',
    'CONVERGED',
    'DIAGNOSTIC + KERNEL co-location with NO runtime Angular import and 8 ngDevMode-guarded sites; co-location alone is not a defect and no cost or coupling discriminator says otherwise',
  ],
  'bare-module:core/lib/constants.ts': [
    'KERNEL',
    'REIMPLEMENT',
    'DEV-ENV: no runtime Angular import; the mix is build/dev policy (ngDevMode) feeding diagnostic message tables. Fix the S4 convergence point, then re-evaluate — do not split first',
  ],
  // ── C6.0 — type-only Angular consumers, reclassified ─────────────────────
  // These were `angular-value:*` / REIMPLEMENT until the census learned to
  // classify by VALUE-POSITION USE. All three emit no `@angular/core` import
  // (builder-types is not emitted at all): their Angular references are
  // `Signal`/`WritableSignal` in type position, which erase. They are not C6
  // runtime debt. If a later S1 convergence replaces those type names with
  // neutral ones, fine — that is not a reason to carry an action today.
  'angular-type:lib/types.ts': [
    'KERNEL',
    'CONVERGED',
    'names Signal/WritableSignal in type position only; erases at build',
  ],
  'angular-type:lib/internals/builder-types.ts': [
    'KERNEL',
    'CONVERGED',
    'pure type module; not emitted at all',
  ],
  'angular-type:lib/internals/derived-types.ts': [
    'KERNEL',
    'CONVERGED',
    'names Signal/WritableSignal in type position only; erases at build',
  ],
  // ── BATCH 4B — bare-reachable modules, RE-DERIVED from EXPLICIT state rows ─
  // Keys are normalized SOURCE PATHS. Owners aggregate the jobs adjudicated
  // INSIDE each module — and this is the second re-derivation, because the
  // Batch 4A rows it reads were themselves corrected twice.
  'bare-module:core/lib/internals/tree-scalar-slot-runtime.ts': [
    'KERNEL',
    'CONVERGED',
    'BM-A: lib/internals/tree-scalar-slot-runtime.ts has no separately adjudicated job beyond kernel construction; the bare tree requires it',
  ],
  'bare-module:core/lib/internals/tree-scalar-slot-angular-runtime.ts': [
    'FRAMEWORK-ADAPTER',
    'REIMPLEMENT',
    'BM-C: every adjudicated job in lib/internals/tree-scalar-slot-angular-runtime.ts is framework runtime yet it is bare-reachable — the C6 handoff',
  ],
  'bare-module:shared/lib/deep-equal.ts': [
    'KERNEL',
    'CONVERGED',
    'BM-A: @signaltree/shared kernel utility; outside the CORE census file universe by construction, required by the bare tree',
  ],
  'bare-module:core/lib/internals/owned-mutation.ts': [
    'KERNEL',
    'REIMPLEMENT',
    'BM-A: every adjudicated job in lib/internals/owned-mutation.ts is KERNEL; the bare tree requires it',
  ],
  'bare-module:core/lib/internals/member-membership.ts': [
    'KERNEL',
    'CONVERGED',
    'BM-A: every adjudicated job in lib/internals/member-membership.ts is KERNEL; the bare tree requires it',
  ],
  'bare-module:shared/lib/is-built-in-object.ts': [
    'KERNEL',
    'CONVERGED',
    'BM-A: @signaltree/shared kernel utility; outside the CORE census file universe by construction, required by the bare tree',
  ],
  'bare-module:core/enhancers/index.ts': [
    'KERNEL',
    'CONVERGED',
    'BM-A: enhancers/index.ts has no separately adjudicated job beyond kernel construction; the bare tree requires it',
  ],
  'bare-module:core/lib/internals/enhancer-requirements.ts': [
    'KERNEL',
    'CONVERGED',
    'BM-A: every adjudicated job in lib/internals/enhancer-requirements.ts is KERNEL; the bare tree requires it',
  ],
  'bare-module:core/lib/internals/tree-capabilities.ts': [
    'KERNEL',
    'CONVERGED',
    'BM-A: every adjudicated job in lib/internals/tree-capabilities.ts is KERNEL; the bare tree requires it',
  ],
  'bare-module:core/lib/internals/position-registry.ts': [
    'KERNEL',
    'CONVERGED',
    'BM-A: every adjudicated job in lib/internals/position-registry.ts is KERNEL; the bare tree requires it',
  ],
  'bare-module:core/lib/internals/observation-substrate.ts': [
    'KERNEL',
    'CONVERGED',
    'BM-A: every adjudicated job in lib/internals/observation-substrate.ts is KERNEL; the bare tree requires it',
  ],
  'bare-module:core/lib/internals/owned-metadata.ts': [
    'KERNEL',
    'CONVERGED',
    'BM-A: every adjudicated job in lib/internals/owned-metadata.ts is KERNEL; the bare tree requires it',
  ],
  'bare-module:core/lib/internals/physical-commit-clock.ts': [
    'KERNEL',
    'CONVERGED',
    'BM-A: every adjudicated job in lib/internals/physical-commit-clock.ts is KERNEL; the bare tree requires it',
  ],
  'bare-module:core/lib/internals/mutation-capture-runtime.ts': [
    'KERNEL',
    'CONVERGED',
    'BM-A: every adjudicated job in lib/internals/mutation-capture-runtime.ts is KERNEL; the bare tree requires it',
  ],
  'bare-module:core/lib/internals/node-shape.ts': [
    'KERNEL',
    'CONVERGED',
    'BM-A: every adjudicated job in lib/internals/node-shape.ts is KERNEL; the bare tree requires it',
  ],
  'bare-module:core/lib/internals/runtime-tree-plan.ts': [
    'KERNEL',
    'CONVERGED',
    'BM-A: every adjudicated job in lib/internals/runtime-tree-plan.ts is KERNEL; the bare tree requires it',
  ],
  'bare-module:core/lib/internals/path-observation-port.ts': [
    'KERNEL',
    'CONVERGED',
    'BM-A: every adjudicated job in lib/internals/path-observation-port.ts is KERNEL; the bare tree requires it',
  ],
  'bare-module:shared/lib/is-traversable-node.ts': [
    'KERNEL',
    'CONVERGED',
    'BM-A: @signaltree/shared kernel utility; outside the CORE census file universe by construction, required by the bare tree',
  ],
  'bare-module:core/lib/internals/materialization-realization.ts': [
    'FRAMEWORK-ADAPTER',
    'REIMPLEMENT',
    'BM-C: every adjudicated job in lib/internals/materialization-realization.ts is framework runtime yet it is bare-reachable — the C6 handoff',
  ],
  'bare-module:core/lib/internals/root-source.ts': [
    'KERNEL',
    'CONVERGED',
    'BM-A: every adjudicated job in lib/internals/root-source.ts is KERNEL; the bare tree requires it',
  ],
  'bare-module:core/lib/enhancer-types.ts': [
    'KERNEL',
    'CONVERGED',
    'BM-A: every adjudicated job in lib/enhancer-types.ts is KERNEL; the bare tree requires it',
  ],
  'bare-module:core/lib/write-context.ts': [
    'KERNEL',
    'CONVERGED',
    'BM-A: every adjudicated job in lib/write-context.ts is KERNEL; the bare tree requires it',
  ],
  // ── BATCH 4A — module state (120 subjects), EXPLICIT PROVENANCE ──────────
  // Generated by tools/state-ownership-registry.mjs. Every row is EXPLICIT:
  // adjudicated per subject from its retained fact and its actual READERS
  // (`readerLocationsInFile`), which the evidence tool was extended to record.
  //
  // Two derivations were tried and both withdrawn:
  //   path regex + KERNEL fallback  — the prohibited direction outright
  //   module job inheritance        — detects a KNOWN mixed module, but cannot
  //                                   detect a binding that IS the module's
  //                                   undiscovered minority job
  //
  //     A MODULE'S OWNER IS THE RESULT OF ITS JOBS. A JOB'S OWNER CANNOT BE
  //     DERIVED FROM THE MODULE OWNER IT HELPS CREATE.
  //
  // `lib/signal-tree.ts` is the proof both were wrong: inheritance made all
  // twelve of its bindings KERNEL; nine are read only by `warnEntityArrayLeaf`,
  // `warnMarkerInContainer` or noop-warn paths and are DIAGNOSTIC.
  'state:enhancers/batching/batching.types.ts:_neutralTest': [
    'TEST-SEAM',
    'CONVERGED',
    'EXPLICIT: compile-time assertion that BatchingEnhancer extends Enhancer<BatchingMethods>',
  ],
  'state:enhancers/devtools/devtools-impl.ts:devToolsConnections': [
    'DIAGNOSTIC',
    'CONVERGED',
    'EXPLICIT: read by initBrowserDevTools',
  ],
  'state:enhancers/devtools/devtools-impl.ts:devToolsGroups': [
    'DIAGNOSTIC',
    'CONVERGED',
    'EXPLICIT: read by getOrCreateDevToolsGroup',
  ],
  'state:enhancers/devtools/devtools-impl.ts:GLOBAL_CONNECTIONS_KEY': [
    'DIAGNOSTIC',
    'CONVERGED',
    'EXPLICIT: read by getGlobalDevToolsConnections',
  ],
  'state:enhancers/devtools/devtools-impl.ts:GLOBAL_GROUPS_KEY': [
    'DIAGNOSTIC',
    'CONVERGED',
    'EXPLICIT: read by getGlobalDevToolsGroups',
  ],
  'state:enhancers/devtools/devtools-impl.ts:GLOBAL_MARKER_KEY': [
    'DIAGNOSTIC',
    'CONVERGED',
    'EXPLICIT: read by ensureGlobalMarker',
  ],
  'state:enhancers/devtools/devtools-impl.ts:ngDevMode': [
    'FRAMEWORK-ADAPTER',
    'CONVERGED',
    'EXPLICIT: build-tool global declaration',
  ],
  'state:enhancers/devtools/devtools.ts:devToolsImpl': [
    'DIAGNOSTIC',
    'CONVERGED',
    'EXPLICIT: lazily-held devTools implementation',
  ],
  'state:enhancers/devtools/devtools.ts:ngDevMode': [
    'FRAMEWORK-ADAPTER',
    'CONVERGED',
    'EXPLICIT: build-tool global declaration',
  ],
  'state:enhancers/restoration/restoration.ts:HISTORY_RETAINED_POINTER_BUDGET':
    [
      'OPTIONAL-CAPABILITY',
      'CONVERGED',
      'EXPLICIT: read by checkHistoryRetention — history retention bound',
    ],
  'state:enhancers/restoration/restoration.ts:MAX_OBSERVED_BATCHES': [
    'OPTIONAL-CAPABILITY',
    'CONVERGED',
    'EXPLICIT: read by observeBatch — observation bound',
  ],
  'state:enhancers/restoration/restoration.ts:RETENTION_CHECK_INTERVAL': [
    'OPTIONAL-CAPABILITY',
    'CONVERGED',
    'EXPLICIT: read by buildTurn — how often retention is checked',
  ],
  'state:enhancers/restoration/restoration.ts:warnedHistoryRetention': [
    'DIAGNOSTIC',
    'CONVERGED',
    'EXPLICIT: read by checkHistoryRetention — warn-once dedupe for the retention warning',
  ],
  'state:enhancers/restoration/restoration.ts:withRestoration': [
    'OPTIONAL-CAPABILITY',
    'CONVERGED',
    'EXPLICIT: the restoration enhancer itself',
  ],
  'state:enhancers/serialization/constants.ts:TYPE_MARKERS': [
    'OPTIONAL-CAPABILITY',
    'CONVERGED',
    'EXPLICIT: serialization type markers, read at 27 sites',
  ],
  'state:enhancers/serialization/serialization.ts:DEFAULT_CONFIG': [
    'OPTIONAL-CAPABILITY',
    'CONVERGED',
    'EXPLICIT: read by persistenceFn',
  ],
  'state:enhancers/serialization/serialization.ts:isSignal': [
    'OPTIONAL-CAPABILITY',
    'CONVERGED',
    'EXPLICIT: the local reactive-cell predicate persistence asks with; routed through the realization port by SERIALIZATION-REACTIVE-CLASSIFICATION-0 (answer A)',
  ],
  'state:enhancers/serialization/serialization.ts:ngDevMode': [
    'FRAMEWORK-ADAPTER',
    'CONVERGED',
    'EXPLICIT: build-tool global declaration',
  ],
  'state:enhancers/serialization/serialization.ts:restoreSpecialTypes': [
    'OPTIONAL-CAPABILITY',
    'CONVERGED',
    'EXPLICIT: read by applyJSON — special type revival',
  ],
  'state:enhancers/serialization/serialization.ts:SNAPSHOT_FORMAT_VERSION': [
    'OPTIONAL-CAPABILITY',
    'CONVERGED',
    'EXPLICIT: read by encodeSnapshot; documented write-now/enforce-later token',
  ],
  'state:enhancers/transactions/transactions.ts:createRollbackError': [
    'OPTIONAL-CAPABILITY',
    'CONVERGED',
    'EXPLICIT: read by rollback paths',
  ],
  'state:enhancers/transactions/transactions.ts:explainRollbackFailure': [
    'OPTIONAL-CAPABILITY',
    'CONVERGED',
    'EXPLICIT: read by createRollbackError',
  ],
  'state:enhancers/transactions/transactions.ts:INTERNAL_TRANSACTION_RUNTIME': [
    'OPTIONAL-CAPABILITY',
    'CONVERGED',
    'EXPLICIT: read by getOrCreateInternalTransactionRuntime',
  ],
  'state:enhancers/transactions/transactions.ts:ROLLBACK_ERROR_MESSAGE': [
    'OPTIONAL-CAPABILITY',
    'CONVERGED',
    'EXPLICIT: read by explainRollbackFailure',
  ],
  'state:lib/constants.ts:_isDev': [
    'DIAGNOSTIC',
    'CONVERGED',
    'EXPLICIT: build-mode discrimination for message selection',
  ],
  'state:lib/constants.ts:_isProdByEnv': [
    'DIAGNOSTIC',
    'CONVERGED',
    'EXPLICIT: build-mode discrimination for message selection',
  ],
  'state:lib/constants.ts:DEV_MESSAGES': [
    'DIAGNOSTIC',
    'CONVERGED',
    'EXPLICIT: development message catalogue',
  ],
  'state:lib/constants.ts:ngDevMode': [
    'FRAMEWORK-ADAPTER',
    'CONVERGED',
    'EXPLICIT: build-tool global declaration',
  ],
  'state:lib/constants.ts:PROD_MESSAGES': [
    'DIAGNOSTIC',
    'CONVERGED',
    'EXPLICIT: production message catalogue',
  ],
  'state:lib/constants.ts:SIGNAL_TREE_MESSAGES': [
    'DIAGNOSTIC',
    'CONVERGED',
    'EXPLICIT: the frozen message table, read by 3 modules',
  ],
  'state:lib/enhancer-types.ts:ENHANCER_META': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: enhancer metadata key, read by 10 modules — the construction contract',
  ],
  'state:lib/entity-signal.ts:entityPositionIdAllocatorOverride': [
    'TEST-SEAM',
    'CONVERGED',
    'EXPLICIT: read by createEntitySignal; written only by a ForTesting setter',
  ],
  'state:lib/entity-signal.ts:entityPositionIdNotifyEnabled': [
    'DOMAIN-SPECIALIZATION',
    'CONVERGED',
    'EXPLICIT: read by getPositionIdsForNotify — entity notify participation',
  ],
  'state:lib/entity-signal.ts:nextStandaloneEntityPositionId': [
    'DOMAIN-SPECIALIZATION',
    'CONVERGED',
    'EXPLICIT: read by standaloneEntityPositionIdAllocator — entity position allocation',
  ],
  'state:lib/entity-signal.ts:ngDevMode': [
    'FRAMEWORK-ADAPTER',
    'CONVERGED',
    'EXPLICIT: build-tool global declaration',
  ],
  'state:lib/entity-signal.ts:standaloneEntityPositionIdAllocator': [
    'DOMAIN-SPECIALIZATION',
    'CONVERGED',
    'EXPLICIT: read by createEntitySignal — entity position allocation',
  ],
  'state:lib/entity-signal.ts:WRONG_ENTITY_METHODS': [
    'DIAGNOSTIC',
    'CONVERGED',
    'EXPLICIT: wrong-method error message table',
  ],
  'state:lib/internals/acquire-projection.ts:EXTERNAL_ACQUISITION': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: external acquisition descriptor',
  ],
  'state:lib/internals/acquire-projection.ts:isRealizableSubject': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: realizability predicate for acquisition',
  ],
  'state:lib/internals/causal-runtime/confirmed-redo.ts:defaultDependencies': [
    'OPTIONAL-CAPABILITY',
    'CONVERGED',
    'EXPLICIT: default dependency bag for confirmed redo',
  ],
  'state:lib/internals/causal-runtime/confirmed-undo.ts:defaultDependencies': [
    'OPTIONAL-CAPABILITY',
    'CONVERGED',
    'EXPLICIT: read by undoConfirmedAt — default dependency bag for confirmed undo',
  ],
  'state:lib/internals/causal-runtime/transaction-lifecycle.ts:TRANSACTION_LIFECYCLE':
    [
      'OPTIONAL-CAPABILITY',
      'CONVERGED',
      'EXPLICIT: transaction lifecycle channel key',
    ],
  'state:lib/internals/causal-runtime/transaction-lifecycle.ts:TRANSACTION_LIFECYCLE_OWNER':
    [
      'OPTIONAL-CAPABILITY',
      'CONVERGED',
      'EXPLICIT: transaction lifecycle owner-presence key',
    ],
  'state:lib/internals/causal-runtime/tree-realization-adapter.ts:TREE_REALIZATION_DESCRIPTORS':
    [
      'OPTIONAL-CAPABILITY',
      'CONVERGED',
      'EXPLICIT: read by define/getTreeRealizationDescriptors',
    ],
  'state:lib/internals/causal-runtime/tree-realization-adapter.ts:TREE_REALIZATION_PORT':
    [
      'OPTIONAL-CAPABILITY',
      'CONVERGED',
      'EXPLICIT: read by define/getTreeRealizationPort',
    ],
  'state:lib/internals/causal-runtime/tree-realization-adapter.ts:WHOLE_SUBJECT':
    [
      'OPTIONAL-CAPABILITY',
      'CONVERGED',
      'EXPLICIT: read by deriveSubjectAddress',
    ],
  'state:lib/internals/cell-runtime.ts:installed': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: S1 — the installed ordinary-leaf carrier factory; undefined until a realization installs one, and signal-tree keeps a working fallback so leaf allocation never becomes contingent on an optional adapter',
  ],
  'state:lib/internals/commit-consequence.ts:heldByKey': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: read by scheduleDurableConsequence/settleCommitScope',
  ],
  'state:lib/internals/commit-consequence.ts:openScopesByKey': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: read by hasOpen/openCommitScope/settleCommitScope',
  ],
  'state:lib/internals/commit-consequence.ts:scopesByOwner': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: read by openCommitScope/deferCommitConsequence/settleCommitScope',
  ],
  'state:lib/internals/commit-consequence.ts:settleListenersByKey': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: read by settleCommitScope/onCommitScopesSettled',
  ],
  'state:lib/internals/diagnostics/diagnostic-journal.ts:DEFAULT_MAX_EVENTS': [
    'DIAGNOSTIC',
    'CONVERGED',
    'EXPLICIT: journal retention bound — what makes the journal bounded',
  ],
  'state:lib/internals/diagnostics/diagnostic-journal.ts:DEFAULT_MAX_TURNS': [
    'DIAGNOSTIC',
    'CONVERGED',
    'EXPLICIT: journal turn retention bound',
  ],
  'state:lib/internals/enhancer-requirements.ts:describe': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: requirement description for construction-time validation messages',
  ],
  'state:lib/internals/entity-projection-seed.ts:SEED': [
    'DOMAIN-SPECIALIZATION',
    'CONVERGED',
    'EXPLICIT: entity projection seed key',
  ],
  'state:lib/internals/error-reporter.ts:listeners': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: onTreeError listener set — the frozen tree error boundary',
  ],
  'state:lib/internals/materialization-realization.ts:installed': [
    'FRAMEWORK-ADAPTER',
    'REIMPLEMENT',
    'EXPLICIT: the installed realization boundary — a named C6 action',
  ],
  'state:lib/internals/materialize-markers.ts:applyMemberValue': [
    'KERNEL',
    'REIMPLEMENT',
    'EXPLICIT: member value application hook — a named convergence action',
  ],
  'state:lib/internals/materialize-markers.ts:KEY_INDEX': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: read by attachKeyIndex/materializeMember',
  ],
  'state:lib/internals/materialize-markers.ts:MARKER_PROCESSORS': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: read by isRegisteredMarker/registerProcessor/materializeMarkers',
  ],
  'state:lib/internals/materialize-markers.ts:MEMBER_MATERIALIZER': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: read by materializeMember/materializeKeyedAware',
  ],
  'state:lib/internals/materialize-markers.ts:NODE_STORE_SYMBOL': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: read by materializeMember/materializeMarkers',
  ],
  'state:lib/internals/materialize-markers.ts:ORDINARY_STATE': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: read by ordinaryBranch/isOrdinaryStateRequest',
  ],
  'state:lib/internals/materialize-markers.ts:PROCESSOR_STAMP': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: read by getNodeProcessor/materializeMarkers',
  ],
  'state:lib/internals/materialize-markers.ts:SNAPSHOT_MEMO': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: read by snapshotMarkerNode — a derivation cache, not a second observable state',
  ],
  'state:lib/internals/materialize-markers.ts:treesConstructedCount': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: read by registerProcessor/_recordTreeConstruction — construction bookkeeping',
  ],
  'state:lib/internals/materialize-markers.ts:warnedWriteOnly': [
    'DIAGNOSTIC',
    'CONVERGED',
    'EXPLICIT: read only by warnWriteOnlyMarker — dev warning dedupe',
  ],
  'state:lib/internals/member-membership.ts:DORMANT': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: read by memberBinding/deactivateOne — dormancy membership state',
  ],
  'state:lib/internals/member-membership.ts:HAS_DORMANT': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: read by hasDormantMembers/markHasDormant',
  ],
  'state:lib/internals/member-membership.ts:NODE_ACCESSOR_PEER': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: read by peerOf',
  ],
  'state:lib/internals/member-membership.ts:NODE_STORE_SYMBOL': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: read by peerOf',
  ],
  'state:lib/internals/merge-derived.ts:ngDevMode': [
    'FRAMEWORK-ADAPTER',
    'CONVERGED',
    'EXPLICIT: build-tool global declaration',
  ],
  'state:lib/internals/mutation-capture-runtime.ts:MUTATION_CAPTURE_RUNTIME': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: capture runtime attachment key',
  ],
  'state:lib/internals/node-shape.ts:CALLABLE_SIGNAL_SYMBOL': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: callable-signal protocol key',
  ],
  'state:lib/internals/observation-substrate.ts:ARM': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: read by installDormantObservation/claimLeaf',
  ],
  'state:lib/internals/observation-substrate.ts:OBSERVATION': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: read by installDormantObservation/claimLeaf',
  ],
  'state:lib/internals/owned-metadata.ts:OWNED_NODE_METADATA': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: read by getOwnedPositionIds/getOwnedOwnerPath/getOwnedOwnerId/hasIntrinsicMutationEmitter',
  ],
  'state:lib/internals/path-observation-port.ts:PORT': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: the stable delegating facade the kernel holds; allocated once, holds no state',
  ],
  'state:lib/internals/path-observation-port.ts:runtime': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: the nullable delivery runtime; null until an optional consumer installs one',
  ],
  'state:lib/internals/physical-commit-clock.ts:PHYSICAL_COMMIT_CLOCK': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: read by define/getPhysicalCommitClock',
  ],
  'state:lib/internals/position-registry.ts:nextRegistryId': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: registry namespace allocator — the ownerId that scopes non-global position ids',
  ],
  'state:lib/internals/position-registry.ts:POSITION_REGISTRY_SYMBOL': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: position registry attachment key',
  ],
  'state:lib/internals/position-registry.ts:treeIdBrand': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: TreeId brand carrier',
  ],
  'state:lib/internals/production-substrate-stats.prod.ts:PRODUCTION_SUBSTRATE_STATS_ENABLED':
    [
      'DIAGNOSTIC',
      'CONVERGED',
      'EXPLICIT: the shipped no-op variant: false, so substrate counters cost nothing in production',
    ],
  'state:lib/internals/production-substrate-stats.ts:activeStats': [
    'DIAGNOSTIC',
    'CONVERGED',
    'EXPLICIT: read by recordProductionSubstrateStat',
  ],
  'state:lib/internals/production-substrate-stats.ts:PRODUCTION_SUBSTRATE_STATS_ENABLED':
    [
      'DIAGNOSTIC',
      'CONVERGED',
      'EXPLICIT: read at 13 cross-file sites to gate substrate counters',
    ],
  'state:lib/internals/restoration-eligibility.ts:designated': [
    'OPTIONAL-CAPABILITY',
    'CONVERGED',
    'EXPLICIT: restoration designation flag',
  ],
  'state:lib/internals/root-source.ts:ROOT_TREES': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: root tree registry',
  ],
  'state:lib/internals/runtime-tree-plan.ts:RESTORATION_CAPABILITIES': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: capability set a restoration request implies, consumed by the build plan',
  ],
  'state:lib/internals/subject-reclamation-sink.ts:SUBJECT_PHYSICAL_OWNERS_SYMBOL':
    [
      'OPTIONAL-CAPABILITY',
      'CONVERGED',
      'EXPLICIT: physical owner registry key for reclamation',
    ],
  'state:lib/internals/subject-reclamation-sink.ts:SUBJECT_RECLAMATION_SINK_SYMBOL':
    [
      'OPTIONAL-CAPABILITY',
      'CONVERGED',
      'EXPLICIT: reclamation sink attachment key',
    ],
  'state:lib/internals/subject-restoration-claims.ts:SUBJECT_RESTORATION_CLAIMS_SYMBOL':
    [
      'OPTIONAL-CAPABILITY',
      'CONVERGED',
      'EXPLICIT: tree-scoped restoration claim index key',
    ],
  'state:lib/internals/tracking-suppression.ts:installed': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: the installed tracking-suppression implementation; undefined until a realization installs one, and the undefined default is correct for a runtime with no dependency tracking',
  ],
  'state:lib/internals/tree-capabilities.ts:canonicalizeCapabilities': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: capability set canonicalization for the build plan',
  ],
  'state:lib/internals/tree-capabilities.ts:TREE_CAPABILITY_DEPENDENCIES': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: capability implication table',
  ],
  'state:lib/internals/tree-capabilities.ts:TREE_CAPABILITY_ORDER': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: capability ordering table',
  ],
  'state:lib/internals/tree-location.ts:FUNCTION_VALUE': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: callable-value marker for the location grammar',
  ],
  'state:lib/internals/tree-scalar-slot-angular-runtime.ts:TREE_SCALAR_SLOT_RUNTIME':
    [
      'FRAMEWORK-ADAPTER',
      'CONVERGED',
      'EXPLICIT: read by define/getTreeScalarSlotRuntime in the Angular adapter module',
    ],
  'state:lib/path-notifier.ts:globalPathNotifier': [
    'OPTIONAL-CAPABILITY',
    'CONVERGED',
    'EXPLICIT: delivery engine singleton, installed through the port and never linked by the bare kernel',
  ],
  'state:lib/path-notifier.ts:materializeDeliveryMeta': [
    'OPTIONAL-CAPABILITY',
    'CONVERGED',
    'EXPLICIT: delivery-side meta materialization',
  ],
  'state:lib/readonly-readers.ts:ENTITY_READERS': [
    'DOMAIN-SPECIALIZATION',
    'CONVERGED',
    'EXPLICIT: entity-aware reader table for the readonly projection',
  ],
  'state:lib/signal-tree.ts:ENTITY_ARRAY_MIN_LENGTH': [
    'DIAGNOSTIC',
    'CONVERGED',
    'EXPLICIT: read only by warnEntityArrayLeaf — a dev warning heuristic threshold',
  ],
  'state:lib/signal-tree.ts:ENTITY_ARRAY_SAMPLE': [
    'DIAGNOSTIC',
    'CONVERGED',
    'EXPLICIT: read only by warnEntityArrayLeaf/warnMarkerInContainer — dev warning sampling',
  ],
  'state:lib/signal-tree.ts:ENTITY_ARRAY_WARN_CAP': [
    'DIAGNOSTIC',
    'CONVERGED',
    'EXPLICIT: read only by warnEntityArrayLeaf — the cap that bounds the warn set',
  ],
  'state:lib/signal-tree.ts:ENTITY_ARRAY_WARNED': [
    'DIAGNOSTIC',
    'CONVERGED',
    'EXPLICIT: read only by warnEntityArrayLeaf — warn-once dedupe, bounded by ENTITY_ARRAY_WARN_CAP',
  ],
  'state:lib/signal-tree.ts:ENTITY_ID_KEYS': [
    'DIAGNOSTIC',
    'CONVERGED',
    'EXPLICIT: read only by warnEntityArrayLeaf — dev warning id-key heuristic',
  ],
  'state:lib/signal-tree.ts:isRealizedNode': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: the neutral realization predicate the kernel ASKS with; narrows to object rather than to a framework type so the coupling is not reintroduced in the type system (S2b-2)',
  ],
  'state:lib/signal-tree.ts:looksLikeMarker': [
    'DIAGNOSTIC',
    'CONVERGED',
    'EXPLICIT: read only by warnMarkerInContainer — dev warning predicate',
  ],
  'state:lib/signal-tree.ts:MARKER_IN_ARRAY_WARNED': [
    'DIAGNOSTIC',
    'CONVERGED',
    'EXPLICIT: read only by warnMarkerInContainer — warn-once dedupe',
  ],
  'state:lib/signal-tree.ts:NODE_ACCESSOR_PEER': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: read by makeNodeAccessor — accessor peer link',
  ],
  'state:lib/signal-tree.ts:NODE_ACCESSOR_SYMBOL': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: read by isNodeAccessor/makeNodeAccessor/create/createBuilder — the accessor protocol',
  ],
  'state:lib/signal-tree.ts:NODE_STORE_SYMBOL': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: read by makeNodeAccessor — node store attachment',
  ],
  'state:lib/signal-tree.ts:warnedNoopCopyPaths': [
    'DIAGNOSTIC',
    'CONVERGED',
    'EXPLICIT: warn-once dedupe behind the same ngDevMode guard',
  ],
  'state:lib/signal-tree.ts:warnedNoopPaths': [
    'DIAGNOSTIC',
    'CONVERGED',
    'EXPLICIT: read by recursiveUpdate behind an ngDevMode guard — warn-once dedupe that cannot grow in a shipped build',
  ],
  'state:lib/types.ts:ENTITY_MAP_BRAND': [
    'DOMAIN-SPECIALIZATION',
    'CONVERGED',
    'EXPLICIT: the entityMap marker brand',
  ],
  'state:lib/utils.ts:DERIVED_STAMP': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: derived-slice stamp key',
  ],
  'state:lib/utils.ts:MATERIALIZED': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: per-node materialization record',
  ],
  'state:lib/utils.ts:MEMBERSHIP_REVISION': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: membership revision counter per node',
  ],
  'state:lib/utils.ts:ngDevMode': [
    'FRAMEWORK-ADAPTER',
    'CONVERGED',
    'EXPLICIT: the build-tool global declaration used to gate dev-only code',
  ],
  'state:lib/utils.ts:NODE_STORE_SYMBOL': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: node store protocol key',
  ],
  'state:lib/utils.ts:TREE_STORES': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: per-tree store registry',
  ],
  'state:lib/write-context.ts:activeContext': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: ambient authored-write context',
  ],
  'state:lib/write-participation.ts:getWriteParticipation': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: write participation classifier, read by 11 modules',
  ],
  'state:lib/write-participation.ts:isInspectionWrite': [
    'KERNEL',
    'CONVERGED',
    'EXPLICIT: inspection-write predicate, read by 7 modules',
  ],
  // ── PIPELINE-DENOMINATOR-STABILITY-0 — eleven newly VISIBLE pipelines ─────
  // These are not new code. `detectPipelineFns` required `^export function`, so
  // every internal behavioural pipeline in the kernel was invisible to the
  // denominator — and de-exporting two helpers made the defect observable by
  // deleting live subjects. Repairing export-sensitivity surfaced eleven more
  // that had never been counted. Ruled on the same basis as Batch 3A: the
  // module's semantic domain.
  'pipeline-candidate:lib/signal-tree.ts:materializeOrdinaryBranch': [
    'KERNEL',
    'CONVERGED',
    'branch materialization during construction',
  ],
  'pipeline-candidate:lib/signal-tree.ts:materializeTreeMarkers': [
    'KERNEL',
    'CONVERGED',
    'marker materialization entry during construction',
  ],
  'pipeline-candidate:lib/signal-tree.ts:republishMembers': [
    'KERNEL',
    'CONVERGED',
    'republishes members after structural change',
  ],
  'pipeline-candidate:lib/utils.ts:materialized': [
    'KERNEL',
    'CONVERGED',
    'materialization state read',
  ],
  'pipeline-candidate:lib/internals/materialize-markers.ts:materializeKeyedAware':
    ['KERNEL', 'CONVERGED', 'keyed-aware materialization path'],
  'pipeline-candidate:lib/internals/member-membership.ts:activateOne': [
    'KERNEL',
    'CONVERGED',
    'membership activation half; setMemberPresence owns both physical halves',
  ],
  'pipeline-candidate:lib/internals/member-membership.ts:deactivateOne': [
    'KERNEL',
    'CONVERGED',
    'membership deactivation half; same single owner',
  ],
  'pipeline-candidate:lib/internals/causal-runtime/tree-realization-adapter.ts:resolveNotifyPath':
    [
      'OPTIONAL-CAPABILITY',
      'CONVERGED',
      'address resolution for replay delivery',
    ],
  'pipeline-candidate:lib/internals/causal-runtime/confirmed-undo.ts:getRestoredStructuralResource':
    [
      'OPTIONAL-CAPABILITY',
      'CONVERGED',
      'restored resource lookup on confirmed undo',
    ],
  'pipeline-candidate:lib/internals/causal-runtime/pending-rollback.ts:getRestoredStructuralResource':
    [
      'OPTIONAL-CAPABILITY',
      'CONVERGED',
      'restored resource lookup on pending rollback',
    ],
  'pipeline-candidate:enhancers/transactions/transactions.ts:cloneTurnRecord': [
    'OPTIONAL-CAPABILITY',
    'CONVERGED',
    'turn record cloning for transaction bookkeeping',
  ],
  // ── BATCH 3 — pipelines / Angular boundary / orphans ─────────────────────
  // Angular rows are the important ones. Owner is derived from each module's
  // SEMANTIC DOMAIN, never from the fact that it imports Angular — a framework
  // import is evidence about coupling, not about ownership. The split that
  // matters is type-only vs runtime: four modules import Angular TYPES, which
  // erase at build and cost nothing, while twelve import runtime signal
  // primitives. The latter keep their domain owner and carry REIMPLEMENT,
  // because C6 (the framework handoff) has not happened yet.
  //
  //     KNOWN OWNER DOES NOT MEAN CONVERGED IMPLEMENTATION.
  'pipeline-candidate:lib/internals/commit-consequence.ts:openCommitScope': [
    'KERNEL',
    'CONVERGED',
    'POST-commit consequence scope. deferCommitConsequence returns "accepted into a scope", and its false paths are claimant/ownership checks — it cannot prevent a commit, so AN OBSERVER MAY REACT TO A COMMIT; ONLY PRECOMMIT AUTHORITY MAY PREVENT ONE still holds',
  ],
  'pipeline-candidate:lib/internals/commit-consequence.ts:deferCommitConsequence':
    [
      'KERNEL',
      'CONVERGED',
      'POST-commit consequence scope. deferCommitConsequence returns "accepted into a scope", and its false paths are claimant/ownership checks — it cannot prevent a commit, so AN OBSERVER MAY REACT TO A COMMIT; ONLY PRECOMMIT AUTHORITY MAY PREVENT ONE still holds',
    ],
  'pipeline-candidate:lib/internals/commit-consequence.ts:settleCommitScope': [
    'KERNEL',
    'CONVERGED',
    'POST-commit consequence scope. deferCommitConsequence returns "accepted into a scope", and its false paths are claimant/ownership checks — it cannot prevent a commit, so AN OBSERVER MAY REACT TO A COMMIT; ONLY PRECOMMIT AUTHORITY MAY PREVENT ONE still holds',
  ],
  'pipeline-candidate:lib/internals/commit-consequence.ts:hasOpenCommitScope': [
    'KERNEL',
    'CONVERGED',
    'POST-commit consequence scope. deferCommitConsequence returns "accepted into a scope", and its false paths are claimant/ownership checks — it cannot prevent a commit, so AN OBSERVER MAY REACT TO A COMMIT; ONLY PRECOMMIT AUTHORITY MAY PREVENT ONE still holds',
  ],
  'pipeline-candidate:lib/internals/commit-consequence.ts:onCommitScopesSettled':
    [
      'KERNEL',
      'CONVERGED',
      'POST-commit consequence scope. deferCommitConsequence returns "accepted into a scope", and its false paths are claimant/ownership checks — it cannot prevent a commit, so AN OBSERVER MAY REACT TO A COMMIT; ONLY PRECOMMIT AUTHORITY MAY PREVENT ONE still holds',
    ],
  'pipeline-candidate:lib/utils.ts:publishMembershipChange': [
    'KERNEL',
    'CONVERGED',
    'membership change publication',
  ],
  'pipeline-candidate:lib/utils.ts:materializeNode': [
    'KERNEL',
    'CONVERGED',
    'node materialization',
  ],
  'pipeline-candidate:lib/internals/materialize-markers.ts:materializeMarkers':
    ['KERNEL', 'CONVERGED', 'canonical marker materialization'],
  'pipeline-candidate:lib/internals/materialize-markers.ts:materializeMember': [
    'KERNEL',
    'CONVERGED',
    'deferred member materialization',
  ],
  'pipeline-candidate:lib/internals/materialize-markers.ts:_recordTreeConstruction':
    ['KERNEL', 'CONVERGED', 'construction bookkeeping for materialization'],
  'pipeline-candidate:lib/internals/member-membership.ts:reactivateOnWrite': [
    'KERNEL',
    'CONVERGED',
    'dormant-member reactivation on write (ACQUISITION IS CREATE-IF-NEVER-SEEN, REACTIVATE-IF-DORMANT, REUSE-IF-ACTIVE)',
  ],
  'pipeline-candidate:lib/internals/owned-mutation.ts:emitOwnedMutation': [
    'KERNEL',
    'CONVERGED',
    'the single write-path publication into the observation port (ME-B)',
  ],
  'pipeline-candidate:lib/internals/owned-metadata.ts:hasIntrinsicMutationEmitter':
    ['KERNEL', 'CONVERGED', 'capture-capability read on a node'],
  'pipeline-candidate:lib/internals/intercept-leaf-signals.ts:interceptLeafSignals':
    [
      'KERNEL',
      'CONVERGED',
      'internal observation substrate for leaves that received no capture; explicitly not root app API',
    ],
  'pipeline-candidate:lib/internals/physical-commit-clock.ts:createPhysicalCommitClock':
    ['KERNEL', 'CONVERGED', 'physical revision clock lifecycle'],
  'pipeline-candidate:lib/internals/physical-commit-clock.ts:definePhysicalCommitClock':
    ['KERNEL', 'CONVERGED', 'physical revision clock lifecycle'],
  'pipeline-candidate:lib/internals/physical-commit-clock.ts:getPhysicalCommitClock':
    ['KERNEL', 'CONVERGED', 'physical revision clock lifecycle'],
  'pipeline-candidate:lib/internals/production-substrate-stats.ts:recordProductionSubstrateStat':
    [
      'DIAGNOSTIC',
      'CONVERGED',
      'substrate counters; the .prod variant is a no-op with ENABLED=false, so diagnostics cost nothing in shipped builds',
    ],
  'pipeline-candidate:lib/internals/production-substrate-stats.prod.ts:recordProductionSubstrateStat':
    [
      'DIAGNOSTIC',
      'CONVERGED',
      'substrate counters; the .prod variant is a no-op with ENABLED=false, so diagnostics cost nothing in shipped builds',
    ],
  'pipeline-candidate:lib/entity-signal.ts:setEntityPositionIdNotifyEnabledForTesting':
    [
      'TEST-SEAM',
      'CONVERGED',
      'entity test seam; de-exported in the 15.0 orphan sweep, reachable only through the __ testing bag',
    ],
  'pipeline-candidate:lib/internals/owned-mutation.ts:defineIntrinsicMutationEmitter':
    [
      'KERNEL',
      'CONVERGED',
      'marks a node as emitting mutations; de-exported in the 15.0 orphan sweep',
    ],
  'angular-type:lib/link.ts': [
    'KERNEL',
    'CONVERGED',
    'TYPE-ONLY Angular import — erases at build, zero runtime coupling. An Angular-native kernel legitimately names the signal type it produces',
  ],
  'angular-type:lib/readonly.ts': [
    'KERNEL',
    'CONVERGED',
    'TYPE-ONLY Angular import — erases at build, zero runtime coupling. An Angular-native kernel legitimately names the signal type it produces',
  ],
  'angular-type:lib/internals/builder-types.ts': [
    'KERNEL',
    'CONVERGED',
    'TYPE-ONLY Angular import — erases at build, zero runtime coupling. An Angular-native kernel legitimately names the signal type it produces',
  ],
  'angular-type:lib/internals/observation-substrate.ts': [
    'KERNEL',
    'CONVERGED',
    'TYPE-ONLY Angular import — erases at build, zero runtime coupling. An Angular-native kernel legitimately names the signal type it produces',
  ],
  'angular-value:lib/internals/tree-scalar-slot-angular-runtime.ts': [
    'FRAMEWORK-ADAPTER',
    'CONVERGED',
    'this module IS the Angular adapter; framework runtime belongs here by design',
  ],
  'angular-value:lib/signal-tree.ts': [
    'KERNEL',
    'REIMPLEMENT',
    'RUNTIME Angular import (signal/computed/untracked/isSignal). Owner is the module semantic domain — importing Angular does not transfer ownership — but the runtime dependency is the C6 framework handoff and is NOT converged',
  ],
  'angular-value:lib/internals/merge-derived.ts': [
    'KERNEL',
    'REIMPLEMENT',
    'RUNTIME Angular import (signal/computed/untracked/isSignal). Owner is the module semantic domain — importing Angular does not transfer ownership — but the runtime dependency is the C6 framework handoff and is NOT converged',
  ],
  'angular-value:lib/internals/owned-mutation.ts': [
    'KERNEL',
    'REIMPLEMENT',
    'RUNTIME Angular import (signal/computed/untracked/isSignal). Owner is the module semantic domain — importing Angular does not transfer ownership — but the runtime dependency is the C6 framework handoff and is NOT converged',
  ],
  'angular-value:lib/entity-signal.ts': [
    'DOMAIN-SPECIALIZATION',
    'REIMPLEMENT',
    'RUNTIME Angular import (signal/computed/untracked/isSignal). Owner is the module semantic domain — importing Angular does not transfer ownership — but the runtime dependency is the C6 framework handoff and is NOT converged',
  ],
  'angular-value:lib/markers/entity-map.ts': [
    'DOMAIN-SPECIALIZATION',
    'REIMPLEMENT',
    'RUNTIME Angular import (signal/computed/untracked/isSignal). Owner is the module semantic domain — importing Angular does not transfer ownership — but the runtime dependency is the C6 framework handoff and is NOT converged',
  ],
  'angular-value:enhancers/restoration/restoration.ts': [
    'OPTIONAL-CAPABILITY',
    'REIMPLEMENT',
    'RUNTIME Angular import (signal/computed/untracked/isSignal). Owner is the module semantic domain — importing Angular does not transfer ownership — but the runtime dependency is the C6 framework handoff and is NOT converged',
  ],
  'angular-value:enhancers/serialization/serialization.ts': [
    'OPTIONAL-CAPABILITY',
    'REIMPLEMENT',
    'RUNTIME Angular import (signal/computed/untracked/isSignal). Owner is the module semantic domain — importing Angular does not transfer ownership — but the runtime dependency is the C6 framework handoff and is NOT converged',
  ],
  'angular-value:enhancers/devtools/devtools-impl.ts': [
    'DIAGNOSTIC',
    'REIMPLEMENT',
    'RUNTIME Angular import (signal/computed/untracked/isSignal). Owner is the module semantic domain — importing Angular does not transfer ownership — but the runtime dependency is the C6 framework handoff and is NOT converged',
  ],
  'orphan:lib/entity-signal.ts:setEntityPositionIdAllocatorForTesting': [
    'TEST-SEAM',
    'CONVERGED',
    'had a REAL same-file production consumer, so not dead code; the surplus `export` was removed in the 15.0 orphan sweep',
  ],
  'orphan:lib/entity-signal.ts:setEntityPositionIdNotifyEnabledForTesting': [
    'TEST-SEAM',
    'CONVERGED',
    'had a REAL same-file production consumer, so not dead code; the surplus `export` was removed in the 15.0 orphan sweep',
  ],
  'orphan:lib/internals/materialize-markers.ts:isOrdinaryStateRequest': [
    'KERNEL',
    'CONVERGED',
    'had a REAL same-file production consumer, so not dead code; the surplus `export` was removed in the 15.0 orphan sweep',
  ],
  'orphan:lib/internals/owned-mutation.ts:defineIntrinsicMutationEmitter': [
    'KERNEL',
    'CONVERGED',
    'had a REAL same-file production consumer, so not dead code; the surplus `export` was removed in the 15.0 orphan sweep',
  ],
  'orphan:lib/internals/subject-reclamation-sink.ts:createSubjectReclamationSink':
    [
      'OPTIONAL-CAPABILITY',
      'CONVERGED',
      'had a REAL same-file production consumer, so not dead code; the surplus `export` was removed in the 15.0 orphan sweep',
    ],
  'orphan:lib/internals/subject-restoration-claims.ts:defineSubjectRestorationClaims':
    [
      'OPTIONAL-CAPABILITY',
      'CONVERGED',
      'had a REAL same-file production consumer, so not dead code; the surplus `export` was removed in the 15.0 orphan sweep',
    ],
  // ── PUBLIC-SURFACE-CENSUS-PARITY-0 — nine subjects the census could not see ─
  // These were exported as INLINE `type` members of value clauses
  // (`export { defineStore, type DefineStoreConfig }`), a spelling the public
  // type detector did not match. They are ordinary public types, ruled here on
  // the same basis as the rest of Batch 1: the owner of the value they describe.
  'public-type:ReadonlyView': [
    'KERNEL',
    'CONVERGED',
    'readonly projection type surface; same owner as the already-ruled public:asReadonly',
  ],
  'public-type:ReadonlyStore': [
    'KERNEL',
    'CONVERGED',
    'readonly projection type surface; same owner as the already-ruled public:asReadonly',
  ],
  'public-type:ReadonlyNodeAccessor': [
    'KERNEL',
    'CONVERGED',
    'readonly projection type surface; same owner as the already-ruled public:asReadonly',
  ],
  'public-type:ReadonlyEntityNode': [
    'KERNEL',
    'CONVERGED',
    'readonly projection type surface; same owner as the already-ruled public:asReadonly',
  ],
  'public-type:ReadonlyEntitySignal': [
    'KERNEL',
    'CONVERGED',
    'readonly projection type surface; same owner as the already-ruled public:asReadonly',
  ],
  'public-type:AuditEntry': [
    'DIAGNOSTIC',
    'CONVERGED',
    'audit trail type surface, declared in lib/audit/audit.ts',
  ],
  'public-type:AuditMetadata': [
    'DIAGNOSTIC',
    'CONVERGED',
    'audit trail type surface, declared in lib/audit/audit.ts',
  ],
  'public-type:AuditTrackerConfig': [
    'DIAGNOSTIC',
    'CONVERGED',
    'audit trail type surface, declared in lib/audit/audit.ts',
  ],
  'public-type:DefineStoreConfig': [
    'FRAMEWORK-ADAPTER',
    'MOVE',
    'config for defineStore, which is already ruled FRAMEWORK-ADAPTER/MOVE; its config type moves with it',
  ],
  // ── BATCH 2 — construction / capability / markers / structural symbols ────
  // Config rows carry their PROVEN reader site, resolved by declaration symbol
  // (tools/tree-config-consumers.mjs), not by grep. Five further config options
  // measured ZERO production readers and are ESCALATED rather than ruled here —
  // they are public options with no production decision, the `batchUpdates`
  // shape, and deleting public surface is not a fast-lane call.
  //
  // Marker rows deliberately separate SYNTAX (entity-map) from REGISTRATION and
  // MATERIALIZATION (materialize-markers). A marker requests construction; it
  // does not thereby become canonical state authority — `entityMapRegistered`
  // was deleted for exactly that confusion.
  //
  //     A SYMBOL'S NAME DOES NOT CHOOSE ITS OWNER.
  'config:enhancers': [
    'KERNEL',
    'CONVERGED',
    'read at signal-tree.ts:2047 — the enhancer application list, the whole declarative construction contract',
  ],
  'config:capabilities': [
    'KERNEL',
    'CONVERGED',
    'read at signal-tree.ts:2059 — explicit capability requests feeding the build plan',
  ],
  'config:derived': [
    'KERNEL',
    'CONVERGED',
    'read at signal-tree.ts:2137 — derived slice declarations',
  ],
  'config:useShallowComparison': [
    'KERNEL',
    'CONVERGED',
    'read at signal-tree.ts:1539 — leaf equality policy',
  ],
  // ⚠️ DIAGNOSTIC, NOT KERNEL. This row was first closed as KERNEL/CONVERGED
  // because `signal-tree.ts` reads it — which proves LIVENESS, not OWNERSHIP.
  //
  //     A READER PROVES LIVENESS. A READER DOES NOT PROVE OWNERSHIP.
  //
  // DEBUG-MODE-OWNERSHIP-0 traced both readers: signal-tree.ts:1805 gates a
  // `console.log(TREE_DESTROYED)`, and signal-tree.ts:2057 forwards it into
  // `resolveEnhancerOrder`, where it gates only
  // `console.warn(ENHANCER_CYCLE_DETECTED)` — the unordered fallback `return
  // enhancers` happens either way. No canonical state, mutation semantics,
  // identity, membership or causal authority depends on it.
  //
  // TreeConfig remains the right authoring surface: these are kernel-level dev
  // logs that fire without `devTools()` installed, so moving the flag onto the
  // optional enhancer's config would change when they are available.
  //
  // (An earlier report of a third reader in `serialization.ts` was a loose grep
  // — that module declares its OWN unrelated `debugMode`. The symbol-resolved
  // instrument said 2, and 2 is right.)
  'config:debugMode': [
    'DIAGNOSTIC',
    'CONVERGED',
    'gates two development-only log statements and nothing else; TreeConfig is the correct surface because they fire without devTools() installed',
  ],
  'capability:causal-runtime': [
    'KERNEL',
    'CONVERGED',
    'requested capability; 9 hasCapability/buildPlan reads gate causal machinery',
  ],
  'capability:mutation-capture': [
    'KERNEL',
    'CONVERGED',
    'requested capability; gates owned-mutation wrapping at construction',
  ],
  'capability:position-topology': [
    'KERNEL',
    'CONVERGED',
    'requested capability; gates position registry installation',
  ],
  'capability:temporal-snapshots': [
    'KERNEL',
    'CONVERGED',
    'requested capability; gates snapshot retention',
  ],
  'capability:...explicitCapabilities': [
    'KERNEL',
    'CONVERGED',
    'construction parameter at signal-tree.ts:221 carrying the author-requested set into the build plan',
  ],
  'marker-factory:lib/markers/entity-map.ts': [
    'DOMAIN-SPECIALIZATION',
    'CONVERGED',
    'entityMap AUTHORING SYNTAX — a marker requests construction; it is not canonical state authority',
  ],
  'marker-factory:lib/markers/index.ts': [
    'DOMAIN-SPECIALIZATION',
    'CONVERGED',
    'marker factory barrel for the specialization',
  ],
  'marker-registration:lib/internals/materialize-markers.ts': [
    'KERNEL',
    'CONVERGED',
    'canonical MATERIALIZATION owner — turns a requested marker into real tree state',
  ],
  'marker-registration:lib/signal-tree.ts': [
    'KERNEL',
    'CONVERGED',
    'construction-time registration wiring',
  ],
  'marker-registration:index.ts': [
    'KERNEL',
    'CONVERGED',
    'built-in marker registration at package load',
  ],
  'marker-registration:lib/markers/entity-map.ts': [
    'DOMAIN-SPECIALIZATION',
    'CONVERGED',
    'the specialization registering its own processor; registration does NOT make it membership authority — entityMapRegistered was deleted for exactly that',
  ],
  'symbol:SignalTree:Derived': [
    'KERNEL',
    'CONVERGED',
    'derived-slice attachment key; declared in lib/utils.ts',
  ],
  'symbol:SignalTree:DormantMember': [
    'KERNEL',
    'CONVERGED',
    'membership state key; dormancy is kernel membership semantics; declared in lib/internals/member-membership.ts',
  ],
  'symbol:SignalTree:HasDormantMembers': [
    'KERNEL',
    'CONVERGED',
    'branch-level dormancy summary key; declared in lib/internals/member-membership.ts',
  ],
  'symbol:SignalTree:DynamicKeyIndex': [
    'KERNEL',
    'CONVERGED',
    'open-key index attachment; declared in lib/internals/materialize-markers.ts',
  ],
  'symbol:SignalTree:MarkerProcessor': [
    'KERNEL',
    'CONVERGED',
    'marker processor registry key; declared in lib/internals/materialize-markers.ts',
  ],
  'symbol:SignalTree:MemberMaterializer': [
    'KERNEL',
    'CONVERGED',
    'deferred member materialization hook; declared in lib/internals/materialize-markers.ts',
  ],
  'symbol:SignalTree:OrdinaryStateRequest': [
    'KERNEL',
    'CONVERGED',
    'non-marker construction request key; declared in lib/internals/materialize-markers.ts',
  ],
  'symbol:SignalTree:NodeAccessor': [
    'KERNEL',
    'CONVERGED',
    'accessor protocol key; declared in lib/signal-tree.ts',
  ],
  'symbol:SignalTree:NodeAccessorPeer': [
    'KERNEL',
    'CONVERGED',
    'accessor peer link key; declared in lib/signal-tree.ts',
  ],
  'symbol:SignalTree:NodeStore': [
    'KERNEL',
    'CONVERGED',
    'node storage attachment; declared in lib/utils.ts',
  ],
  'symbol:SignalTree:PhysicalCommitClock': [
    'KERNEL',
    'CONVERGED',
    'physical revision clock; declared in lib/internals/physical-commit-clock.ts',
  ],
  'symbol:SignalTree:PositionRegistry': [
    'KERNEL',
    'CONVERGED',
    'position identity registry key; declared in lib/internals/position-registry.ts',
  ],
  'symbol:SignalTree:MutationCaptureRuntime': [
    'KERNEL',
    'CONVERGED',
    'capture runtime attachment; declared in lib/internals/mutation-capture-runtime.ts',
  ],
  'symbol:SignalTree:ScalarSlotRuntime': [
    'FRAMEWORK-ADAPTER',
    'CONVERGED',
    'declared in tree-scalar-slot-angular-runtime.ts — the Angular adapter module; correctly placed on the framework side of the boundary',
  ],
  'symbol:SignalTree:SubjectPhysicalOwners': [
    'DOMAIN-SPECIALIZATION',
    'CONVERGED',
    'physical owner registry for entity subjects; read by the reclamation sink',
  ],
  'symbol:SignalTree:SubjectRestorationClaims': [
    'OPTIONAL-CAPABILITY',
    'CONVERGED',
    'tree-scoped restoration claim index (SUBJECT-CLAIM-SCOPE: conservative by ruling)',
  ],
  'symbol:SignalTree:TransactionLifecycleChannel': [
    'OPTIONAL-CAPABILITY',
    'CONVERGED',
    'transactions() lifecycle channel key',
  ],
  'symbol:SignalTree:TransactionLifecycleOwnerPresent': [
    'OPTIONAL-CAPABILITY',
    'CONVERGED',
    'transactions() owner-presence flag key',
  ],
  'symbol:SignalTree:TreeRealizationDescriptors': [
    'OPTIONAL-CAPABILITY',
    'CONVERGED',
    'causal replay descriptor store key',
  ],
  'symbol:SignalTree:TreeRealizationPort': [
    'OPTIONAL-CAPABILITY',
    'CONVERGED',
    'causal replay port key',
  ],
  // ── BATCH 1 — public type surface (43 types + 2 subpaths) ────────────────
  // Owners are assigned from each type's actual consumer set, not its name.
  // The MOVE rows share one finding: `lib/types.ts` is a mixed-owner type
  // BARREL. It declares optional-capability and diagnostic types alongside the
  // kernel contract — while every one of those enhancers ALREADY has a
  // `<enhancer>.types.ts` beside it. This is co-location, not duplicate
  // authority: `ISignalTree` names no capability method bag, so the kernel type
  // surface does not statically own optional machinery. Nothing here is a
  // semantic defect; it is a placement action.
  'public-type:ISignalTree': [
    'KERNEL',
    'CONVERGED',
    'the tree contract itself; does NOT name any capability method bag — callers compose `SignalTree<T> & BatchingMethods`',
  ],
  'public-type:SignalTree': [
    'KERNEL',
    'CONVERGED',
    'public alias of the tree contract',
  ],
  'public-type:TreeNode': [
    'KERNEL',
    'CONVERGED',
    'recursive mapped node type (OPEN-KEY-OWNERSHIP-0 governs its open-key behaviour)',
  ],
  'public-type:NodeAccessor': [
    'KERNEL',
    'CONVERGED',
    'callable accessor contract',
  ],
  'public-type:CallableWritableSignal': [
    'KERNEL',
    'CONVERGED',
    'callable leaf contract',
  ],
  'public-type:AccessibleNode': [
    'KERNEL',
    'CONVERGED',
    'structural constraint used by the recursive mapper',
  ],
  'public-type:TreeConfig': ['KERNEL', 'CONVERGED', 'construction surface'],
  'public-type:Enhancer': ['KERNEL', 'CONVERGED', 'enhancer contract'],
  'public-type:EnhancerWithMeta': [
    'KERNEL',
    'CONVERGED',
    'enhancer declaration with requirements metadata',
  ],
  'public-type:EnhancerCleanup': [
    'KERNEL',
    'CONVERGED',
    'cleanup callback contract for registerCleanup',
  ],
  'public-type:WriteMetadata': [
    'KERNEL',
    'CONVERGED',
    'generic write metadata; contracted in 15.0 (positionIds/subjectIds deleted)',
  ],
  'public-type:TreeId': [
    'KERNEL',
    'CONVERGED',
    'tree identity token (frozen public surface)',
  ],
  'public-type:TreeErrorEvent': [
    'KERNEL',
    'CONVERGED',
    'tree error boundary payload (frozen public surface)',
  ],
  'public-type:Primitive': [
    'KERNEL',
    'CONVERGED',
    'type-level machinery for the recursive mapper',
  ],
  'public-type:NotFn': [
    'KERNEL',
    'CONVERGED',
    'type-level machinery for the recursive mapper',
  ],
  'public-type:WithDerived': [
    'KERNEL',
    'CONVERGED',
    'derived-slice composition at the type level',
  ],
  'public-type:EntitySignal': [
    'DOMAIN-SPECIALIZATION',
    'CONVERGED',
    'entity collection contract; kernel-coupled by utils/readonly/link/merge-derived — representation tracked by ENTITY-REPRESENTATION-OWNERSHIP-0, not by this row',
  ],
  'public-type:EntitySignalWithSlices': [
    'DOMAIN-SPECIALIZATION',
    'CONVERGED',
    'entity contract with computed slices',
  ],
  'public-type:EntityMapMarker': [
    'DOMAIN-SPECIALIZATION',
    'CONVERGED',
    'entityMap marker contract; consumed by signal-tree/utils',
  ],
  'public-type:EntityMapMarkerWithSlices': [
    'DOMAIN-SPECIALIZATION',
    'CONVERGED',
    'marker contract with computed slices',
  ],
  'public-type:EntityMapBuilder': [
    'DOMAIN-SPECIALIZATION',
    'CONVERGED',
    'entityMap authoring builder',
  ],
  'public-type:EntityMapComputedSlices': [
    'DOMAIN-SPECIALIZATION',
    'CONVERGED',
    'computed-slice declaration for entityMap',
  ],
  'public-type:ComputedSliceConfig': [
    'DOMAIN-SPECIALIZATION',
    'CONVERGED',
    'computed-slice config for entityMap',
  ],
  'public-type:DefaultKey': [
    'DOMAIN-SPECIALIZATION',
    'CONVERGED',
    'entity key defaulting at the type level',
  ],
  'public-type:AddOptions': [
    'DOMAIN-SPECIALIZATION',
    'CONVERGED',
    'entity insert positioning options',
  ],
  'public-type:AddManyOptions': [
    'DOMAIN-SPECIALIZATION',
    'CONVERGED',
    'entity bulk insert positioning options',
  ],
  'public-type:Link': [
    'OPTIONAL-CAPABILITY',
    'CONVERGED',
    'external reconciliation contract (frozen public surface)',
  ],
  'public-type:LinkEndpoint': [
    'OPTIONAL-CAPABILITY',
    'CONVERGED',
    'link endpoint contract (frozen public surface)',
  ],
  'public-type:PersistenceConfig': [
    'OPTIONAL-CAPABILITY',
    'CONVERGED',
    'persistence() configuration; declared beside its enhancer',
  ],
  'public-type:PersistenceMethods': [
    'OPTIONAL-CAPABILITY',
    'CONVERGED',
    'persistence() method bag; declared beside its enhancer',
  ],
  'public-type:StorageAdapter': [
    'OPTIONAL-CAPABILITY',
    'CONVERGED',
    'persistence storage port; declared beside its enhancer',
  ],
  'public-type:RestorationMethods': [
    'OPTIONAL-CAPABILITY',
    'CONVERGED',
    'declared in its owner module since TYPE-BARREL-CONVERGENCE-0; re-exported from the package root, one declaration authority',
  ],
  'public-type:RestorationHistoryEntry': [
    'OPTIONAL-CAPABILITY',
    'CONVERGED',
    'declared in its owner module since TYPE-BARREL-CONVERGENCE-0; re-exported from the package root, one declaration authority',
  ],
  'public-type:TransactionMethods': [
    'OPTIONAL-CAPABILITY',
    'CONVERGED',
    'declared in its owner module since TYPE-BARREL-CONVERGENCE-0; re-exported from the package root, one declaration authority',
  ],
  'public-type:PendingTransaction': [
    'OPTIONAL-CAPABILITY',
    'CONVERGED',
    'declared in its owner module since TYPE-BARREL-CONVERGENCE-0; re-exported from the package root, one declaration authority',
  ],
  'public-type:BatchingConfig': [
    'OPTIONAL-CAPABILITY',
    'CONVERGED',
    'declared in its owner module since TYPE-BARREL-CONVERGENCE-0; re-exported from the package root, one declaration authority',
  ],
  'public-type:BatchingMethods': [
    'OPTIONAL-CAPABILITY',
    'CONVERGED',
    'declared in its owner module since TYPE-BARREL-CONVERGENCE-0; re-exported from the package root, one declaration authority',
  ],
  'public-type:DevToolsMethods': [
    'DIAGNOSTIC',
    'CONVERGED',
    'declared in its owner module since TYPE-BARREL-CONVERGENCE-0; re-exported from the package root, one declaration authority',
  ],
  'public-type:DevToolsDebugSession': [
    'DIAGNOSTIC',
    'CONVERGED',
    'declared in its owner module since TYPE-BARREL-CONVERGENCE-0; re-exported from the package root, one declaration authority',
  ],
  'public-type:DevToolsLogEntry': [
    'DIAGNOSTIC',
    'CONVERGED',
    'declared in its owner module since TYPE-BARREL-CONVERGENCE-0; re-exported from the package root, one declaration authority',
  ],
  'public-type:DevToolsModuleMetadata': [
    'DIAGNOSTIC',
    'CONVERGED',
    'declared in its owner module since TYPE-BARREL-CONVERGENCE-0; re-exported from the package root, one declaration authority',
  ],
  'public-type:DevToolsPerformanceMetrics': [
    'DIAGNOSTIC',
    'CONVERGED',
    'declared in its owner module since TYPE-BARREL-CONVERGENCE-0; re-exported from the package root, one declaration authority',
  ],
  'subpath:.': ['KERNEL', 'CONVERGED', 'the package root entry point'],
  'subpath:./package.json': [
    'KERNEL',
    'CONVERGED',
    'packaging hygiene; required by tooling that resolves the manifest',
  ],
  // ── MUTATION-ENVELOPE-OWNERSHIP-0 — NO ENVELOPE ROWS, BY RULING ──────────
  // Seven `envelope:*` rulings stood here between the field deletions and ME-B.
  // The envelope itself is now deleted, so these name subjects that no longer
  // exist — and a ruling for a nonexistent subject is a stale row, not a
  // decision. Their dispositions live in architecture history. The FACTS they
  // ruled on survive; they travel through `notify(...)`, whose own parameters
  // are censused where that protocol is, not here.
  'public:signalTree': ['KERNEL', 'CONVERGED', 'kernel construction'],
  'public:external': ['KERNEL', 'CONVERGED', 'non-authored ingress (C4)'],
  'public:onTreeError': ['KERNEL', 'CONVERGED', 'tree error boundary'],
  'public:asReadonly': ['KERNEL', 'CONVERGED', 'readonly projection'],
  'public:entityMap': [
    'DOMAIN-SPECIALIZATION',
    'REIMPLEMENT',
    'ordered typed-key collection. H-B semantics retained; the representation is the named ENTITY-REPRESENTATION-OWNERSHIP-0 action — NOT a generic review',
  ],
  'public:link': [
    'OPTIONAL-CAPABILITY',
    'CONVERGED',
    'external reconciliation (+4.10 KB)',
  ],
  'public:restoration': [
    'OPTIONAL-CAPABILITY',
    'CONVERGED',
    'history/undo consumer (+14.38 KB)',
  ],
  'public:transactions': [
    'OPTIONAL-CAPABILITY',
    'CONVERGED',
    'causal turn grouping (+14.50 KB)',
  ],
  'public:persistence': [
    'OPTIONAL-CAPABILITY',
    'CONVERGED',
    'serialization to storage (+6.50 KB)',
  ],
  'public:undoable': [
    'OPTIONAL-CAPABILITY',
    'CONVERGED',
    'restoration eligibility marker',
  ],
  'public:SignalTreeRollbackError': [
    'OPTIONAL-CAPABILITY',
    'CONVERGED',
    'rollback signalling',
  ],
  'public:devTools': [
    'DIAGNOSTIC',
    'CONVERGED',
    'ngDevMode-gated inspection (+0.07 KB prod)',
  ],

  // ── the seven rulings ──────────────────────────────────────────────────────
  'public:batching': [
    'OPTIONAL-CAPABILITY',
    'REIMPLEMENT',
    'explicit application-facing capability: batch(), coalesce(), hasPendingNotifications(), flushNotifications(). Owner settled; the representation is the named BATCHING-OWNERSHIP-0 action — NOT a generic review',
  ],
  'public:derivedFrom': [
    'AUTHORING-HELPER',
    'CONVERGED',
    'a typed identity function giving an externally defined derived factory contextual `$` typing. It performs no derivation, owns no computed(), mutates and observes nothing — consistent with its measured -0.01 KB.',
  ],
  'public:defineStore': [
    'FRAMEWORK-ADAPTER',
    'MOVE',
    'turns a factory into an Angular injectable, binds lifetime to DestroyRef, runs in injection context, supports provider scopes. None of that is kernel semantics.',
  ],
  'public:toWritableSignal': [
    'FRAMEWORK-ADAPTER',
    'MOVE',
    'constructs an Angular WritableSignal, uses effect() and Injector/runInInjectionContext, synchronises both directions. A BIDIRECTIONAL adapter — writes enter through it.',
  ],
  'public:createAuditTracker': [
    'CONSEQUENCE',
    'REIMPLEMENT',
    'acts after surviving committed truth; appends audit records without changing what the tree means. Its 100 ms POLLING fallback exists only because core had no generic subscribe() — a greenfield derivation would not poll. Now that an observation port exists, re-derive onto it.',
  ],
  'angular-value:lib/define-store.ts': [
    'FRAMEWORK-ADAPTER',
    'MOVE',
    'DI/lifecycle imports move with the adapter',
  ],
  'angular-value:lib/utils.ts': [
    'FRAMEWORK-ADAPTER',
    'SPLIT',
    'the Angular DEPENDENCY is adapter-owned, but the FILE is not — utils.ts also holds neutral kernel utilities. Move the adapter machinery out; leave the neutral utilities behind.',
  ],
};

const MECHANICAL = {
  'specs-only': [
    'TEST-SEAM',
    'CONVERGED',
    'reached only by specs — deliberate seam',
  ],
  'doc-comment-only': [
    'RETIRED',
    'DELETE',
    'reachable only from a JSDoc {@link} — dead',
  ],
  'same-file-only': [
    'UNKNOWN',
    'REVIEW',
    '?? called inside its own file: the EXPORT is unnecessary, but that says nothing about who owns the code',
  ],
  nothing: ['UNKNOWN', 'REVIEW', '?? no reference of any kind'],
};

const rows = [];
for (const s of c.subjects) {
  let owner, action, job;
  if (RULINGS[s.key]) [owner, action, job] = RULINGS[s.key];
  else if (s.category === 'orphanExport')
    [owner, action, job] = MECHANICAL[s.reachedBy];
  else {
    owner = 'UNKNOWN';
    action = 'REVIEW';
    const bits = [s.category];
    if (s.bytes) bits.push(`${s.bytes} B in bare`);
    if (s.symbols) bits.push(s.symbols.join('/'));
    if (s.init) bits.push(s.init);
    if (s.mutableCandidate === false)
      // IMMUTABILITY PROVES ABSENCE OF MUTABLE STATE; IT DOES NOT PROVE ABSENCE
      // OF SEMANTIC AUTHORITY. `const DEFAULT_BATCHING = true` still decides
      // something. Prioritised behind the mutable candidates, never dropped.
      bits.push('immutable primitive — MODULE-CONSTANT-POLICY-0');
    else if (s.mutableCandidate === true) bits.push('mutable candidate');
    job = `?? not yet ruled (${bits.join(', ')})`;
  }
  rows.push(`| \`${s.key}\` | ${s.category} | ${job} | ${owner} | ${action} |`);
}
const hdr = readFileSync(
  `${ROOT}/tools/kernel-ownership-ledger-header.md`,
  'utf8'
);
writeFileSync(
  `${ROOT}/docs/architecture/kernel-ownership-ledger.md`,
  hdr + rows.join('\n') + '\n'
);
console.log('ledger rows:', rows.length);
