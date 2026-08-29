#!/usr/bin/env node
/**
 * BATCH 4A owner provenance for `state:*` subjects.
 *
 * ⚠️ THIS REPLACES A PATH REGEX. The first version of this classification did:
 *
 *     if (/angular/.test(file))            FRAMEWORK-ADAPTER
 *     else if (/enhancers\/restoration/)   OPTIONAL-CAPABILITY
 *     …
 *     else                                 KERNEL          // fallback owner
 *
 * The exact-key join to `module-state-evidence.json` was sound and is kept — it
 * proves which evidence row belongs to which subject. But it does not license
 * deriving an owner from that evidence's directory name:
 *
 *     AN EXACT JOIN TO EVIDENCE DOES NOT AUTHORIZE A HEURISTIC OWNER
 *     DERIVATION FROM THAT EVIDENCE'S FILE PATH.
 *
 *     SAME FILE DOES NOT IMPLY SAME SEMANTIC DOMAIN.
 *
 * Every owner below now comes from one of exactly two admissible sources, and
 * each row records which:
 *
 *   JOB-INVENTORY  the module's OTHER subjects were adjudicated individually on
 *                  their own evidence (pipelines by semantic job, symbols by
 *                  declaring module + consumer domain, config by reader site,
 *                  angular by import kind). Where those agree on one owner, the
 *                  module's state serves that same job. This is the legitimate
 *                  direction: A MODULE'S OWNER IS THE RESULT OF THE JOBS INSIDE
 *                  IT — never the reverse.
 *
 *   EXPLICIT       adjudicated here, per subject, from the retained fact and its
 *                  readers. Used for every module with no adjudicated job, and
 *                  for every module whose jobs disagree.
 *
 * There is NO fallback owner. A subject that matches neither source is reported
 * and fails the run rather than defaulting to KERNEL.
 */
import { readFileSync } from 'node:fs';
import * as fs from 'node:fs';
const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const evidence = JSON.parse(readFileSync(`${ROOT}/tools/module-state-evidence.json`, 'utf8'));
const ledger = readFileSync(`${ROOT}/docs/architecture/kernel-ownership-ledger.md`, 'utf8');

/** Per-subject adjudications: [owner, action, semanticJob]. */
const EXPLICIT = {
  // ── named actions carried forward, NOT cleared by knowing the owner ───────
  'state:lib/internals/materialization-realization.ts:installed':
    ['FRAMEWORK-ADAPTER', 'REIMPLEMENT', 'the installed realization boundary — a named C6 action'],
  'state:lib/internals/materialize-markers.ts:applyMemberValue':
    ['KERNEL', 'REIMPLEMENT', 'member value application hook — a named convergence action'],

  // ── lib/utils.ts: the module is mixed (ruled SPLIT), so its bindings are
  //    adjudicated individually rather than inheriting an ambiguous owner ────
  'state:lib/utils.ts:ngDevMode': ['FRAMEWORK-ADAPTER', 'CONVERGED', 'the build-tool global declaration used to gate dev-only code'],
  'state:lib/utils.ts:MATERIALIZED': ['KERNEL', 'CONVERGED', 'per-node materialization record'],
  'state:lib/utils.ts:NODE_STORE_SYMBOL': ['KERNEL', 'CONVERGED', 'node store protocol key'],
  'state:lib/utils.ts:TREE_STORES': ['KERNEL', 'CONVERGED', 'per-tree store registry'],
  'state:lib/utils.ts:MEMBERSHIP_REVISION': ['KERNEL', 'CONVERGED', 'membership revision counter per node'],
  'state:lib/utils.ts:DERIVED_STAMP': ['KERNEL', 'CONVERGED', 'derived-slice stamp key'],

  // ── modules with no adjudicated job of their own ──────────────────────────
  'state:lib/constants.ts:DEV_MESSAGES': ['DIAGNOSTIC', 'CONVERGED', 'development message catalogue'],
  'state:lib/constants.ts:PROD_MESSAGES': ['DIAGNOSTIC', 'CONVERGED', 'production message catalogue'],
  'state:lib/constants.ts:SIGNAL_TREE_MESSAGES': ['DIAGNOSTIC', 'CONVERGED', 'the frozen message table, read by 3 modules'],
  'state:lib/constants.ts:ngDevMode': ['FRAMEWORK-ADAPTER', 'CONVERGED', 'build-tool global declaration'],
  'state:lib/constants.ts:_isProdByEnv': ['DIAGNOSTIC', 'CONVERGED', 'build-mode discrimination for message selection'],
  'state:lib/constants.ts:_isDev': ['DIAGNOSTIC', 'CONVERGED', 'build-mode discrimination for message selection'],
  'state:lib/enhancer-types.ts:ENHANCER_META': ['KERNEL', 'CONVERGED', 'enhancer metadata key, read by 10 modules — the construction contract'],
  'state:lib/internals/node-shape.ts:CALLABLE_SIGNAL_SYMBOL': ['KERNEL', 'CONVERGED', 'callable-signal protocol key'],
  'state:lib/internals/position-registry.ts:POSITION_REGISTRY_SYMBOL': ['KERNEL', 'CONVERGED', 'position registry attachment key'],
  'state:lib/internals/position-registry.ts:treeIdBrand': ['KERNEL', 'CONVERGED', 'TreeId brand carrier'],
  'state:lib/internals/position-registry.ts:nextRegistryId': ['KERNEL', 'CONVERGED', 'registry namespace allocator — the ownerId that scopes non-global position ids'],
  'state:lib/internals/tracking-suppression.ts:installed': ['KERNEL', 'CONVERGED', 'the installed tracking-suppression implementation; undefined until a realization installs one, and the undefined default is correct for a runtime with no dependency tracking'],
  'state:lib/signal-tree.ts:isRealizedNode': ['KERNEL', 'CONVERGED', 'the neutral realization predicate the kernel ASKS with; narrows to object rather than to a framework type so the coupling is not reintroduced in the type system (S2b-2)'],
  'state:enhancers/serialization/serialization.ts:isSignal': ['OPTIONAL-CAPABILITY', 'CONVERGED', 'the local reactive-cell predicate persistence asks with; routed through the realization port by SERIALIZATION-REACTIVE-CLASSIFICATION-0 (answer A)'],
  'state:lib/internals/cell-runtime.ts:installed': ['KERNEL', 'CONVERGED', 'S1 — the installed ordinary-leaf carrier factory; undefined until a realization installs one, and signal-tree keeps a working fallback so leaf allocation never becomes contingent on an optional adapter'],
  'state:lib/write-context.ts:activeContext': ['KERNEL', 'CONVERGED', 'ambient authored-write context'],
  'state:lib/internals/restoration-eligibility.ts:designated': ['OPTIONAL-CAPABILITY', 'CONVERGED', 'restoration designation flag'],
  'state:lib/write-participation.ts:getWriteParticipation': ['KERNEL', 'CONVERGED', 'write participation classifier, read by 11 modules'],
  'state:lib/write-participation.ts:isInspectionWrite': ['KERNEL', 'CONVERGED', 'inspection-write predicate, read by 7 modules'],
  'state:lib/internals/entity-projection-seed.ts:SEED': ['DOMAIN-SPECIALIZATION', 'CONVERGED', 'entity projection seed key'],
  'state:lib/internals/runtime-tree-plan.ts:RESTORATION_CAPABILITIES': ['KERNEL', 'CONVERGED', 'capability set a restoration request implies, consumed by the build plan'],
  'state:lib/internals/mutation-capture-runtime.ts:MUTATION_CAPTURE_RUNTIME': ['KERNEL', 'CONVERGED', 'capture runtime attachment key'],
  'state:lib/internals/root-source.ts:ROOT_TREES': ['KERNEL', 'CONVERGED', 'root tree registry'],
  'state:lib/readonly-readers.ts:ENTITY_READERS': ['DOMAIN-SPECIALIZATION', 'CONVERGED', 'entity-aware reader table for the readonly projection'],
  'state:lib/internals/error-reporter.ts:listeners': ['KERNEL', 'CONVERGED', 'onTreeError listener set — the frozen tree error boundary'],
  'state:enhancers/batching/batching.types.ts:_neutralTest': ['TEST-SEAM', 'CONVERGED', 'compile-time assertion that BatchingEnhancer extends Enhancer<BatchingMethods>'],
  'state:lib/internals/subject-reclamation-sink.ts:SUBJECT_PHYSICAL_OWNERS_SYMBOL': ['OPTIONAL-CAPABILITY', 'CONVERGED', 'physical owner registry key for reclamation'],
  'state:lib/internals/subject-reclamation-sink.ts:SUBJECT_RECLAMATION_SINK_SYMBOL': ['OPTIONAL-CAPABILITY', 'CONVERGED', 'reclamation sink attachment key'],
  'state:lib/internals/causal-runtime/transaction-lifecycle.ts:TRANSACTION_LIFECYCLE': ['OPTIONAL-CAPABILITY', 'CONVERGED', 'transaction lifecycle channel key'],
  'state:lib/internals/causal-runtime/transaction-lifecycle.ts:TRANSACTION_LIFECYCLE_OWNER': ['OPTIONAL-CAPABILITY', 'CONVERGED', 'transaction lifecycle owner-presence key'],
  'state:enhancers/serialization/constants.ts:TYPE_MARKERS': ['OPTIONAL-CAPABILITY', 'CONVERGED', 'serialization type markers, read at 27 sites'],

  // ── ADJUDICATED FROM READER EVIDENCE (replaces JOB-INVENTORY inheritance) ──
  // Each row's owner comes from what its READERS do, taken from
  // `readerLocationsInFile`. `lib/signal-tree.ts` is why this mattered: module
  // inference made all twelve of its bindings KERNEL, but nine are read only by
  // `warnEntityArrayLeaf` / `warnMarkerInContainer` / noop-warn paths and are
  // DIAGNOSTIC. That is precisely the undiscovered minority job inside an
  // otherwise single-owner module.
  //
  //     AGREEMENT AMONG KNOWN JOBS IN A MODULE DOES NOT PROVE THAT AN
  //     UNCLASSIFIED JOB BELONGS TO THE SAME DOMAIN.

  // lib/signal-tree.ts — accessor protocol vs dev warnings
  'state:lib/signal-tree.ts:NODE_ACCESSOR_SYMBOL': ['KERNEL', 'CONVERGED', 'read by isNodeAccessor/makeNodeAccessor/create/createBuilder — the accessor protocol'],
  'state:lib/signal-tree.ts:NODE_STORE_SYMBOL': ['KERNEL', 'CONVERGED', 'read by makeNodeAccessor — node store attachment'],
  'state:lib/signal-tree.ts:NODE_ACCESSOR_PEER': ['KERNEL', 'CONVERGED', 'read by makeNodeAccessor — accessor peer link'],
  'state:lib/signal-tree.ts:ENTITY_ARRAY_MIN_LENGTH': ['DIAGNOSTIC', 'CONVERGED', 'read only by warnEntityArrayLeaf — a dev warning heuristic threshold'],
  'state:lib/signal-tree.ts:ENTITY_ARRAY_SAMPLE': ['DIAGNOSTIC', 'CONVERGED', 'read only by warnEntityArrayLeaf/warnMarkerInContainer — dev warning sampling'],
  'state:lib/signal-tree.ts:ENTITY_ID_KEYS': ['DIAGNOSTIC', 'CONVERGED', 'read only by warnEntityArrayLeaf — dev warning id-key heuristic'],
  'state:lib/signal-tree.ts:ENTITY_ARRAY_WARN_CAP': ['DIAGNOSTIC', 'CONVERGED', 'read only by warnEntityArrayLeaf — the cap that bounds the warn set'],
  'state:lib/signal-tree.ts:looksLikeMarker': ['DIAGNOSTIC', 'CONVERGED', 'read only by warnMarkerInContainer — dev warning predicate'],

  // lib/internals/materialize-markers.ts
  'state:lib/internals/materialize-markers.ts:NODE_STORE_SYMBOL': ['KERNEL', 'CONVERGED', 'read by materializeMember/materializeMarkers'],
  'state:lib/internals/materialize-markers.ts:PROCESSOR_STAMP': ['KERNEL', 'CONVERGED', 'read by getNodeProcessor/materializeMarkers'],
  'state:lib/internals/materialize-markers.ts:SNAPSHOT_MEMO': ['KERNEL', 'CONVERGED', 'read by snapshotMarkerNode — a derivation cache, not a second observable state'],
  'state:lib/internals/materialize-markers.ts:MARKER_PROCESSORS': ['KERNEL', 'CONVERGED', 'read by isRegisteredMarker/registerProcessor/materializeMarkers'],
  'state:lib/internals/materialize-markers.ts:warnedWriteOnly': ['DIAGNOSTIC', 'CONVERGED', 'read only by warnWriteOnlyMarker — dev warning dedupe'],
  'state:lib/internals/materialize-markers.ts:treesConstructedCount': ['KERNEL', 'CONVERGED', 'read by registerProcessor/_recordTreeConstruction — construction bookkeeping'],
  'state:lib/internals/materialize-markers.ts:ORDINARY_STATE': ['KERNEL', 'CONVERGED', 'read by ordinaryBranch/isOrdinaryStateRequest'],
  'state:lib/internals/materialize-markers.ts:KEY_INDEX': ['KERNEL', 'CONVERGED', 'read by attachKeyIndex/materializeMember'],
  'state:lib/internals/materialize-markers.ts:MEMBER_MATERIALIZER': ['KERNEL', 'CONVERGED', 'read by materializeMember/materializeKeyedAware'],

  // lib/entity-signal.ts
  'state:lib/entity-signal.ts:ngDevMode': ['FRAMEWORK-ADAPTER', 'CONVERGED', 'build-tool global declaration'],
  'state:lib/entity-signal.ts:WRONG_ENTITY_METHODS': ['DIAGNOSTIC', 'CONVERGED', 'wrong-method error message table'],
  'state:lib/entity-signal.ts:nextStandaloneEntityPositionId': ['DOMAIN-SPECIALIZATION', 'CONVERGED', 'read by standaloneEntityPositionIdAllocator — entity position allocation'],
  'state:lib/entity-signal.ts:standaloneEntityPositionIdAllocator': ['DOMAIN-SPECIALIZATION', 'CONVERGED', 'read by createEntitySignal — entity position allocation'],
  'state:lib/entity-signal.ts:entityPositionIdAllocatorOverride': ['TEST-SEAM', 'CONVERGED', 'read by createEntitySignal; written only by a ForTesting setter'],
  'state:lib/entity-signal.ts:entityPositionIdNotifyEnabled': ['DOMAIN-SPECIALIZATION', 'CONVERGED', 'read by getPositionIdsForNotify — entity notify participation'],

  // enhancers/devtools/devtools-impl.ts
  'state:enhancers/devtools/devtools-impl.ts:ngDevMode': ['FRAMEWORK-ADAPTER', 'CONVERGED', 'build-tool global declaration'],
  'state:enhancers/devtools/devtools-impl.ts:GLOBAL_GROUPS_KEY': ['DIAGNOSTIC', 'CONVERGED', 'read by getGlobalDevToolsGroups'],
  'state:enhancers/devtools/devtools-impl.ts:GLOBAL_MARKER_KEY': ['DIAGNOSTIC', 'CONVERGED', 'read by ensureGlobalMarker'],
  'state:enhancers/devtools/devtools-impl.ts:devToolsGroups': ['DIAGNOSTIC', 'CONVERGED', 'read by getOrCreateDevToolsGroup'],
  'state:enhancers/devtools/devtools-impl.ts:GLOBAL_CONNECTIONS_KEY': ['DIAGNOSTIC', 'CONVERGED', 'read by getGlobalDevToolsConnections'],
  'state:enhancers/devtools/devtools-impl.ts:devToolsConnections': ['DIAGNOSTIC', 'CONVERGED', 'read by initBrowserDevTools'],

  // enhancers/restoration/restoration.ts
  'state:enhancers/restoration/restoration.ts:HISTORY_RETAINED_POINTER_BUDGET': ['OPTIONAL-CAPABILITY', 'CONVERGED', 'read by checkHistoryRetention — history retention bound'],
  'state:enhancers/restoration/restoration.ts:RETENTION_CHECK_INTERVAL': ['OPTIONAL-CAPABILITY', 'CONVERGED', 'read by buildTurn — how often retention is checked'],
  'state:enhancers/restoration/restoration.ts:MAX_OBSERVED_BATCHES': ['OPTIONAL-CAPABILITY', 'CONVERGED', 'read by observeBatch — observation bound'],
  'state:enhancers/restoration/restoration.ts:warnedHistoryRetention': ['DIAGNOSTIC', 'CONVERGED', 'read by checkHistoryRetention — warn-once dedupe for the retention warning'],
  'state:enhancers/restoration/restoration.ts:withRestoration': ['OPTIONAL-CAPABILITY', 'CONVERGED', 'the restoration enhancer itself'],

  // lib/internals/member-membership.ts
  'state:lib/internals/member-membership.ts:DORMANT': ['KERNEL', 'CONVERGED', 'read by memberBinding/deactivateOne — dormancy membership state'],
  'state:lib/internals/member-membership.ts:HAS_DORMANT': ['KERNEL', 'CONVERGED', 'read by hasDormantMembers/markHasDormant'],
  'state:lib/internals/member-membership.ts:NODE_STORE_SYMBOL': ['KERNEL', 'CONVERGED', 'read by peerOf'],
  'state:lib/internals/member-membership.ts:NODE_ACCESSOR_PEER': ['KERNEL', 'CONVERGED', 'read by peerOf'],

  // lib/internals/commit-consequence.ts
  'state:lib/internals/commit-consequence.ts:scopesByOwner': ['KERNEL', 'CONVERGED', 'read by openCommitScope/deferCommitConsequence/settleCommitScope'],
  'state:lib/internals/commit-consequence.ts:openScopesByKey': ['KERNEL', 'CONVERGED', 'read by hasOpen/openCommitScope/settleCommitScope'],
  'state:lib/internals/commit-consequence.ts:settleListenersByKey': ['KERNEL', 'CONVERGED', 'read by settleCommitScope/onCommitScopesSettled'],
  'state:lib/internals/commit-consequence.ts:heldByKey': ['KERNEL', 'CONVERGED', 'read by scheduleDurableConsequence/settleCommitScope'],

  // enhancers/transactions/transactions.ts
  'state:enhancers/transactions/transactions.ts:INTERNAL_TRANSACTION_RUNTIME': ['OPTIONAL-CAPABILITY', 'CONVERGED', 'read by getOrCreateInternalTransactionRuntime'],
  'state:enhancers/transactions/transactions.ts:ROLLBACK_ERROR_MESSAGE': ['OPTIONAL-CAPABILITY', 'CONVERGED', 'read by explainRollbackFailure'],
  'state:enhancers/transactions/transactions.ts:explainRollbackFailure': ['OPTIONAL-CAPABILITY', 'CONVERGED', 'read by createRollbackError'],
  'state:enhancers/transactions/transactions.ts:createRollbackError': ['OPTIONAL-CAPABILITY', 'CONVERGED', 'read by rollback paths'],

  // enhancers/serialization/serialization.ts
  'state:enhancers/serialization/serialization.ts:ngDevMode': ['FRAMEWORK-ADAPTER', 'CONVERGED', 'build-tool global declaration'],
  'state:enhancers/serialization/serialization.ts:DEFAULT_CONFIG': ['OPTIONAL-CAPABILITY', 'CONVERGED', 'read by persistenceFn'],
  'state:enhancers/serialization/serialization.ts:restoreSpecialTypes': ['OPTIONAL-CAPABILITY', 'CONVERGED', 'read by applyJSON — special type revival'],

  // lib/internals/causal-runtime/tree-realization-adapter.ts
  'state:lib/internals/causal-runtime/tree-realization-adapter.ts:TREE_REALIZATION_DESCRIPTORS': ['OPTIONAL-CAPABILITY', 'CONVERGED', 'read by define/getTreeRealizationDescriptors'],
  'state:lib/internals/causal-runtime/tree-realization-adapter.ts:TREE_REALIZATION_PORT': ['OPTIONAL-CAPABILITY', 'CONVERGED', 'read by define/getTreeRealizationPort'],
  'state:lib/internals/causal-runtime/tree-realization-adapter.ts:WHOLE_SUBJECT': ['OPTIONAL-CAPABILITY', 'CONVERGED', 'read by deriveSubjectAddress'],

  // lib/internals/production-substrate-stats.ts
  'state:lib/internals/production-substrate-stats.ts:PRODUCTION_SUBSTRATE_STATS_ENABLED': ['DIAGNOSTIC', 'CONVERGED', 'read at 13 cross-file sites to gate substrate counters'],
  'state:lib/internals/production-substrate-stats.ts:activeStats': ['DIAGNOSTIC', 'CONVERGED', 'read by recordProductionSubstrateStat'],

  // lib/internals/observation-substrate.ts
  'state:lib/internals/observation-substrate.ts:ARM': ['KERNEL', 'CONVERGED', 'read by installDormantObservation/claimLeaf'],
  'state:lib/internals/observation-substrate.ts:OBSERVATION': ['KERNEL', 'CONVERGED', 'read by installDormantObservation/claimLeaf'],

  // singles
  'state:lib/internals/physical-commit-clock.ts:PHYSICAL_COMMIT_CLOCK': ['KERNEL', 'CONVERGED', 'read by define/getPhysicalCommitClock'],
  'state:lib/types.ts:ENTITY_MAP_BRAND': ['DOMAIN-SPECIALIZATION', 'CONVERGED', 'the entityMap marker brand'],
  'state:lib/internals/owned-metadata.ts:OWNED_NODE_METADATA': ['KERNEL', 'CONVERGED', 'read by getOwnedPositionIds/getOwnedOwnerPath/getOwnedOwnerId/hasIntrinsicMutationEmitter'],
  'state:lib/internals/tree-scalar-slot-angular-runtime.ts:TREE_SCALAR_SLOT_RUNTIME': ['FRAMEWORK-ADAPTER', 'CONVERGED', 'read by define/getTreeScalarSlotRuntime in the Angular adapter module'],
  'state:lib/internals/merge-derived.ts:ngDevMode': ['FRAMEWORK-ADAPTER', 'CONVERGED', 'build-tool global declaration'],
  'state:lib/signal-tree.ts:ENTITY_ARRAY_WARNED': ['DIAGNOSTIC', 'CONVERGED', 'read only by warnEntityArrayLeaf — warn-once dedupe, bounded by ENTITY_ARRAY_WARN_CAP'],
  'state:lib/signal-tree.ts:MARKER_IN_ARRAY_WARNED': ['DIAGNOSTIC', 'CONVERGED', 'read only by warnMarkerInContainer — warn-once dedupe'],
  'state:lib/signal-tree.ts:warnedNoopPaths': ['DIAGNOSTIC', 'CONVERGED', 'read by recursiveUpdate behind an ngDevMode guard — warn-once dedupe that cannot grow in a shipped build'],
  'state:lib/signal-tree.ts:warnedNoopCopyPaths': ['DIAGNOSTIC', 'CONVERGED', 'warn-once dedupe behind the same ngDevMode guard'],
  'state:enhancers/serialization/serialization.ts:SNAPSHOT_FORMAT_VERSION': ['OPTIONAL-CAPABILITY', 'CONVERGED', 'read by encodeSnapshot; documented write-now/enforce-later token'],
  'state:lib/internals/production-substrate-stats.prod.ts:PRODUCTION_SUBSTRATE_STATS_ENABLED': ['DIAGNOSTIC', 'CONVERGED', 'the shipped no-op variant: false, so substrate counters cost nothing in production'],
  'state:lib/internals/causal-runtime/confirmed-undo.ts:defaultDependencies': ['OPTIONAL-CAPABILITY', 'CONVERGED', 'read by undoConfirmedAt — default dependency bag for confirmed undo'],
  'state:lib/internals/acquire-projection.ts:isRealizableSubject': ['KERNEL', 'CONVERGED', 'realizability predicate for acquisition'],
  'state:lib/internals/acquire-projection.ts:EXTERNAL_ACQUISITION': ['KERNEL', 'CONVERGED', 'external acquisition descriptor'],

  // ── modules whose only adjudicated jobs were test seams, or which held
  //    disagreeing owners; surfaced by the tool's refusal to guess ───────────
  'state:enhancers/devtools/devtools.ts:devToolsImpl': ['DIAGNOSTIC', 'CONVERGED', 'lazily-held devTools implementation'],
  'state:enhancers/devtools/devtools.ts:ngDevMode': ['FRAMEWORK-ADAPTER', 'CONVERGED', 'build-tool global declaration'],
  'state:lib/internals/causal-runtime/confirmed-redo.ts:defaultDependencies': ['OPTIONAL-CAPABILITY', 'CONVERGED', 'default dependency bag for confirmed redo'],
  'state:lib/internals/diagnostics/diagnostic-journal.ts:DEFAULT_MAX_EVENTS': ['DIAGNOSTIC', 'CONVERGED', 'journal retention bound — what makes the journal bounded'],
  'state:lib/internals/diagnostics/diagnostic-journal.ts:DEFAULT_MAX_TURNS': ['DIAGNOSTIC', 'CONVERGED', 'journal turn retention bound'],
  'state:lib/internals/enhancer-requirements.ts:describe': ['KERNEL', 'CONVERGED', 'requirement description for construction-time validation messages'],
  'state:lib/internals/path-observation-port.ts:PORT': ['KERNEL', 'CONVERGED', 'the stable delegating facade the kernel holds; allocated once, holds no state'],
  'state:lib/internals/path-observation-port.ts:runtime': ['KERNEL', 'CONVERGED', 'the nullable delivery runtime; null until an optional consumer installs one'],
  'state:lib/internals/subject-restoration-claims.ts:SUBJECT_RESTORATION_CLAIMS_SYMBOL': ['OPTIONAL-CAPABILITY', 'CONVERGED', 'tree-scoped restoration claim index key'],
  'state:lib/internals/tree-capabilities.ts:canonicalizeCapabilities': ['KERNEL', 'CONVERGED', 'capability set canonicalization for the build plan'],
  'state:lib/internals/tree-capabilities.ts:TREE_CAPABILITY_DEPENDENCIES': ['KERNEL', 'CONVERGED', 'capability implication table'],
  'state:lib/internals/tree-capabilities.ts:TREE_CAPABILITY_ORDER': ['KERNEL', 'CONVERGED', 'capability ordering table'],
  'state:lib/internals/tree-location.ts:FUNCTION_VALUE': ['KERNEL', 'CONVERGED', 'callable-value marker for the location grammar'],
  'state:lib/path-notifier.ts:globalPathNotifier': ['OPTIONAL-CAPABILITY', 'CONVERGED', 'delivery engine singleton, installed through the port and never linked by the bare kernel'],
  'state:lib/path-notifier.ts:materializeDeliveryMeta': ['OPTIONAL-CAPABILITY', 'CONVERGED', 'delivery-side meta materialization'],
};

// Job inventory: rows adjudicated on their own evidence. state: and
// bare-module: rows are excluded — using them would be circular.
const jobs = {};
for (const m of ledger.matchAll(/^\| `([a-z-]+):([^`]+)` \| [^|]*\| [^|]*\| ([A-Z-]+) \| ([A-Z-]+) \|/gm)) {
  const [, cat, key, owner] = m;
  if (cat === 'state' || cat === 'bare-module' || owner === 'UNKNOWN') continue;
  const file = key.split(':')[0];
  if (!/\.ts$/.test(file)) continue;
  (jobs[file] ??= []).push({ key, owner });
}

const out = [];
let explicit = 0;
const derived = 0; // the derivation branch was deleted; kept so the closure report still names it as zero
const unresolved = [];
for (const r of evidence.sort((a, b) => a.subject.localeCompare(b.subject))) {
  if (EXPLICIT[r.subject]) {
    const [o, a, job] = EXPLICIT[r.subject];
    out.push({ subject: r.subject, owner: o, action: a, source: 'EXPLICIT', job });
    explicit++;
    continue;
  }
  // ⚠️ THERE IS NO DERIVATION BRANCH. An earlier version inherited the owner
  // from the module's other adjudicated jobs when they agreed. That detects a
  // KNOWN mixed module but cannot detect the case this audit exists to catch —
  // a binding that IS the module's undiscovered minority job.
  //
  //     A MODULE'S OWNER IS THE RESULT OF ITS JOBS. A JOB'S OWNER CANNOT BE
  //     DERIVED FROM THE MODULE OWNER IT HELPS CREATE.
  //
  // `lib/signal-tree.ts` is the proof: inheritance made all twelve of its
  // bindings KERNEL, and nine are read only by warn paths and are DIAGNOSTIC.
  unresolved.push(r.subject);
}

console.log(`CURRENT STATE SUBJECTS   ${evidence.length}`);
console.log(`EXPLICIT adjudications   ${explicit}`);
console.log(`JOB-INVENTORY derived    ${derived}`);
console.log(`PATH-INFERRED OWNERS     0`);
console.log(`UNRESOLVED               ${unresolved.length}`);
for (const u of unresolved) console.log(`   ${u}`);
if (unresolved.length || explicit + derived !== evidence.length) {
  console.error('\n❌ state ownership provenance incomplete — no fallback owner exists by design.');
  process.exit(1);
}
if (process.argv.includes('--emit')) {
  const lines = out.map((r) =>
    `  '${r.subject}': ['${r.owner}', '${r.action}', '${r.source}: ${r.job.replace(/'/g, "\\'")}'],`);
  fs.writeFileSync(`${ROOT}/tools/state-ownership-rulings.txt`, lines.join('\n') + '\n');
  console.log(`\nemitted ${lines.length} rulings`);
}
