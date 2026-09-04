# Kernel ownership ledger — `KERNEL-OWNERSHIP-INVENTORY-0`

⚠️ **SUBJECTS GENERATED, DISPOSITIONS RULED.** Regenerate with
`node tools/gen-kernel-ownership-ledger.mjs`. The subject column comes from
`tools/kernel-ownership-census.mjs`, which reads the repository;
`tools/check-kernel-ownership.mjs` fails when a censused subject has no row
(MISSING), when a row outlives its subject (STALE), or when any row is
`UNKNOWN`. **Every `UNKNOWN` blocks the destructive incumbent strip (Phase 3E).**

This phase exists because a *conceptual* inventory is not a census. The notifier
split moved delivery out of bare with 55/55 gates green, and that same class had
also been carrying producer-owned `batchUpdates` configuration, silently
discarded whenever no consumer existed. No recollection produced that; probing
the ordering by hand did. **A list written from memory cannot report what its
author forgot to think about.**

⚠️ THE CENSUS CAUGHT ITS OWN PARSER ON THE FIRST RUN. The barrel is heavily
annotated, and comment prose inside `export { ... }` blocks was extracted as
export names — four fabricated subjects, while the real `asReadonly`,
`createAuditTracker` and `toWritableSignal` went missing. Three genuine public
exports that appeared on no conceptual list we had assembled.

## ⚠️ THE FIRST VERSION REPORTED "143 SUBJECTS, COMPLETE CENSUS". RETRACTED.

It was neither complete nor a census of what it claimed. Two defects, both of
which made the gate look far greener than the repository was:

**74 discovered subjects never reached the gate.** The checker rebuilt the
subject set from a parallel hand-written list and omitted `runtimeState` and
`pipelines` entirely, plus 43 public type exports and 6 marker
factories/registrations. The census found them and printed them; nothing gated
them.

```text
A CENSUS THAT DISCOVERS A SUBJECT BUT DOES NOT GATE IT HAS NOT CLOSED THAT
SUBJECT.
```

The subject set is now emitted BY the census, and a self-check fails if any
discovered category reaches neither the gate nor a declared, reasoned refusal.
A parallel list is a second source of truth, and the second one always rots.

**94 rows were assigned KERNEL by inference, not ruling.** The generator applied
"bare reachable -> KERNEL" and "the symbol name lacks Entity/Subject -> KERNEL".
Both are invalid, and the first is the exact error this whole phase exists to
find: PathNotifier was bare-reachable, and that reachability WAS the ownership
error, worth 1.42 KB.

```text
REACHABILITY IS EVIDENCE ABOUT COST, NOT EVIDENCE ABOUT OWNERSHIP.
A SYMBOL'S NAME DOES NOT CHOOSE ITS OWNER.
```

Only two mechanical classifications survive, because the evidence settles them:
`specs-only -> TEST-SEAM` and `doc-comment-only -> RETIRED`. Even
`same-file-only` proves ONLY that the export is unnecessary; it says nothing
about who owns the code.

Removing the inferences moved 199 subjects to `UNKNOWN`. That number is the
honest state of the ledger, not a regression.

## ⚠️ "29 MODULE-STATE SUBJECTS" WAS A REGEX-SHAPED SUBSET. NOW 110.

The module-state detector matched three initializer shapes — `= new X(...)`,
`= {...}`, and a bare `let x: T;` — so it could not see any of

```text
let enabled = true;        let revision = 0;        let current = null;
let runtime = factory();   let stack = [];          const cache = signal(0);
const registry = factory();                         const listeners = [];
```

all ordinary ways to hold module-level authority. Its positive controls proved
the three shapes it already knew about. Replaced with a TypeScript AST walk over
every top-level `let`/`var`/`const`: **29 -> 110 bindings, plus 16 declined.**
It had been seeing 29 of 126 — and it was about to be the evidence behind
"MODULE-STATE-OWNERSHIP-0: 29 subjects", the first hidden-authority audit.

```text
FOR HIDDEN AUTHORITY DISCOVERY, OVER-INCLUSION IS CHEAPER THAN SILENT EXCLUSION.
A MODULE BINDING MAY BE DECLINED AFTER DISCOVERY; IT MUST NOT DISAPPEAR BECAUSE
ITS INITIALIZER SHAPE WAS UNEXPECTED.
```

Discovery no longer inspects initializers at all.

### ⚠️ AND AUTO-DECLINING THE 16 CONSTANTS WAS ALSO WRONG

The first fix discovered all 126 bindings and then auto-declined the 16 `const`s
bound to literal primitives: immutable, therefore no changing authority,
therefore not a subject. The first two steps hold; the third does not.

```text
const DEFAULT_BATCHING = true;
const MAX_HISTORY = 50;
const FLUSH_DELAY_MS = 0;
```

None is mutable. Every one makes an architectural decision.

```text
IMMUTABILITY PROVES ABSENCE OF MUTABLE STATE; IT DOES NOT PROVE ABSENCE OF
SEMANTIC AUTHORITY.
```

That was the same move as "bare reachable therefore KERNEL" — letting syntax
rule a fact irrelevant. All 126 are retained and merely ANNOTATED
`mutableCandidate`. `MODULE-STATE-OWNERSHIP-0` may attack the 110 mutable
candidates first; the 16 constants still owe a disposition under
`MODULE-CONSTANT-POLICY-0`.

The denominator for TOP-LEVEL BINDINGS is 126. The denominator for the narrower
MUTABLE-AUTHORITY investigation is 110. Those are different numbers and the
ledger says so.

### ⚠️ `exportedPipelineCandidates`, NOT "21 pipelines"

The detector means "an exported function whose NAME contains a verb like
publish/commit/notify". That is a candidate finder, not a census of behavioural
pipelines — it cannot see `applyWrite`, `const flush = () => {}`, a class
method, or any non-exported convergence function. Renamed so today's `21` cannot
become tomorrow's `29`. `PIPELINE-OWNERSHIP-0` owes a real behavioural
denominator.

## ⚠️ OWNERSHIP AND CONVERGENCE ARE TWO AXES

```text
KNOWN OWNER DOES NOT MEAN CONVERGED IMPLEMENTATION.
```

`defineStore` is decisively `FRAMEWORK-ADAPTER` and is still sitting inside the
thing we intend to call a neutral kernel. Gating on `UNKNOWN` alone would have
authorised the strip with adapters living in the kernel. Phase 3E therefore
requires **UNKNOWN owners = 0 AND unresolved convergence actions = 0**.

Actions: `CONVERGED` · `MOVE` · `SPLIT` · `REIMPLEMENT` · `DELETE` · `REVIEW`

⚠️ AND "NOTHING IMPORTS IT" WAS THREE ANSWERS, NOT ONE. Forty-four internal
exports had no production consumer. Collapsing them would have proposed deleting
live code: 36 are reached only by specs (deliberate seams), 7 are called inside
their own file (the `export` is unnecessary, the code is not), and exactly ONE —
`isAnySignal` — is reachable only from a JSDoc `{@link}`. That is the single
genuinely dead export in the package.

Owners: `KERNEL` · `FRAMEWORK-ADAPTER` · `OPTIONAL-CAPABILITY` ·
`DOMAIN-SPECIALIZATION` · `CONSTRUCTION-ONLY` · `DIAGNOSTIC` · `TEST-SEAM` ·
`AUTHORING-HELPER` · `CONSEQUENCE` · `RETIRED` · `UNKNOWN`

| subject | category | semantic job | owner | action |
|---|---|---|---|---|
| `public:SignalTreeRollbackError` | publicValue | rollback signalling | OPTIONAL-CAPABILITY | CONVERGED |
| `public:asReadonly` | publicValue | readonly projection | KERNEL | CONVERGED |
| `public:batching` | publicValue | explicit application-facing capability: batch(), coalesce(), hasPendingNotifications(), flushNotifications(). Owner settled; the representation is the named BATCHING-OWNERSHIP-0 action — NOT a generic review | OPTIONAL-CAPABILITY | REIMPLEMENT |
| `public:createSignalTreeFactory` | publicValue | binds a neutral observation adapter to canonical tree construction | KERNEL | CONVERGED |
| `public:devTools` | publicValue | ngDevMode-gated inspection (+0.07 KB prod) | DIAGNOSTIC | CONVERGED |
| `public:entityMap` | publicValue | ordered typed-key collection. H-B semantics retained; the representation is the named ENTITY-REPRESENTATION-OWNERSHIP-0 action — NOT a generic review | DOMAIN-SPECIALIZATION | REIMPLEMENT |
| `public:external` | publicValue | non-authored ingress (C4) | KERNEL | CONVERGED |
| `public:isNodeAccessor` | publicValue | kernel-owned branch identity guard exposed to adapters for collision-free location dispatch | KERNEL | CONVERGED |
| `public:link` | publicValue | external reconciliation (+4.10 KB) | OPTIONAL-CAPABILITY | CONVERGED |
| `public:observeOwnerInvalidation` | publicValue | adapter port for coherent owner-level invalidation | KERNEL | CONVERGED |
| `public:onTreeError` | publicValue | tree error boundary | KERNEL | CONVERGED |
| `public:readCanonicalSnapshot` | publicValue | adapter read of kernel-owned canonical whole-tree truth | KERNEL | CONVERGED |
| `public:restoration` | publicValue | history/undo consumer (+14.38 KB) | OPTIONAL-CAPABILITY | CONVERGED |
| `public:signalTree` | publicValue | kernel construction | KERNEL | CONVERGED |
| `public:transactions` | publicValue | causal turn grouping (+14.50 KB) | OPTIONAL-CAPABILITY | CONVERGED |
| `public:undoable` | publicValue | restoration eligibility marker | OPTIONAL-CAPABILITY | CONVERGED |
| `public:withRestorationDesignation` | publicValue | semantic ingress for framework-owned authored restoration intent | OPTIONAL-CAPABILITY | CONVERGED |
| `public-type:AccessibleNode` | publicType | structural constraint used by the recursive mapper | KERNEL | CONVERGED |
| `public-type:AddManyOptions` | publicType | entity bulk insert positioning options | DOMAIN-SPECIALIZATION | CONVERGED |
| `public-type:AddOptions` | publicType | entity insert positioning options | DOMAIN-SPECIALIZATION | CONVERGED |
| `public-type:BatchingConfig` | publicType | declared in its owner module since TYPE-BARREL-CONVERGENCE-0; re-exported from the package root, one declaration authority | OPTIONAL-CAPABILITY | CONVERGED |
| `public-type:BatchingMethods` | publicType | declared in its owner module since TYPE-BARREL-CONVERGENCE-0; re-exported from the package root, one declaration authority | OPTIONAL-CAPABILITY | CONVERGED |
| `public-type:ComputedSliceConfig` | publicType | computed-slice config for entityMap | DOMAIN-SPECIALIZATION | CONVERGED |
| `public-type:DefaultKey` | publicType | entity key defaulting at the type level | DOMAIN-SPECIALIZATION | CONVERGED |
| `public-type:DevToolsConfig` | publicType | ?? not yet ruled (publicType) | UNKNOWN | REVIEW |
| `public-type:DevToolsDebugSession` | publicType | declared in its owner module since TYPE-BARREL-CONVERGENCE-0; re-exported from the package root, one declaration authority | DIAGNOSTIC | CONVERGED |
| `public-type:DevToolsLogEntry` | publicType | declared in its owner module since TYPE-BARREL-CONVERGENCE-0; re-exported from the package root, one declaration authority | DIAGNOSTIC | CONVERGED |
| `public-type:DevToolsMethods` | publicType | declared in its owner module since TYPE-BARREL-CONVERGENCE-0; re-exported from the package root, one declaration authority | DIAGNOSTIC | CONVERGED |
| `public-type:Enhancer` | publicType | enhancer contract | KERNEL | CONVERGED |
| `public-type:EnhancerCleanup` | publicType | cleanup callback contract for registerCleanup | KERNEL | CONVERGED |
| `public-type:EnhancerWithMeta` | publicType | enhancer declaration with requirements metadata | KERNEL | CONVERGED |
| `public-type:EntityConfig` | publicType | ?? not yet ruled (publicType) | UNKNOWN | REVIEW |
| `public-type:EntityMapBuilder` | publicType | entityMap authoring builder | DOMAIN-SPECIALIZATION | CONVERGED |
| `public-type:EntityMapComputedSlices` | publicType | computed-slice declaration for entityMap | DOMAIN-SPECIALIZATION | CONVERGED |
| `public-type:EntityMapMarker` | publicType | entityMap marker contract; consumed by signal-tree/utils | DOMAIN-SPECIALIZATION | CONVERGED |
| `public-type:EntityMapMarkerWithSlices` | publicType | marker contract with computed slices | DOMAIN-SPECIALIZATION | CONVERGED |
| `public-type:EntityNode` | publicType | entity subject node projected through universal locations | DOMAIN-SPECIALIZATION | CONVERGED |
| `public-type:EntitySignal` | publicType | entity collection contract; kernel-coupled by utils/readonly/link/merge-derived — representation tracked by ENTITY-REPRESENTATION-OWNERSHIP-0, not by this row | DOMAIN-SPECIALIZATION | CONVERGED |
| `public-type:EntitySignalWithSlices` | publicType | entity contract with computed slices | DOMAIN-SPECIALIZATION | CONVERGED |
| `public-type:ISignalTree` | publicType | the tree contract itself; does NOT name any capability method bag — callers compose `SignalTree<T> & BatchingMethods` | KERNEL | CONVERGED |
| `public-type:Link` | publicType | external reconciliation contract (frozen public surface) | OPTIONAL-CAPABILITY | CONVERGED |
| `public-type:LinkEndpoint` | publicType | link endpoint contract (frozen public surface) | OPTIONAL-CAPABILITY | CONVERGED |
| `public-type:Location` | publicType | universal writable location contract | KERNEL | CONVERGED |
| `public-type:MutationOptions` | publicType | ?? not yet ruled (publicType) | UNKNOWN | REVIEW |
| `public-type:NodeAccessor` | publicType | callable accessor contract | KERNEL | CONVERGED |
| `public-type:ObservationAdapter` | publicType | neutral adapter port for framework observation of kernel truth | KERNEL | CONVERGED |
| `public-type:ObservationToken` | publicType | neutral dependency-token port used by ObservationAdapter | KERNEL | CONVERGED |
| `public-type:PendingTransaction` | publicType | declared in its owner module since TYPE-BARREL-CONVERGENCE-0; re-exported from the package root, one declaration authority | OPTIONAL-CAPABILITY | CONVERGED |
| `public-type:Primitive` | publicType | type-level machinery for the recursive mapper | KERNEL | CONVERGED |
| `public-type:ReadonlyLocation` | publicType | universal readable and subscribable location contract | KERNEL | CONVERGED |
| `public-type:ReadonlyStore` | publicType | readonly projection type surface; same owner as the already-ruled public:asReadonly | KERNEL | CONVERGED |
| `public-type:RestorationConfig` | publicType | ?? not yet ruled (publicType) | UNKNOWN | REVIEW |
| `public-type:RestorationHistoryEntry` | publicType | declared in its owner module since TYPE-BARREL-CONVERGENCE-0; re-exported from the package root, one declaration authority | OPTIONAL-CAPABILITY | CONVERGED |
| `public-type:RestorationMethods` | publicType | declared in its owner module since TYPE-BARREL-CONVERGENCE-0; re-exported from the package root, one declaration authority | OPTIONAL-CAPABILITY | CONVERGED |
| `public-type:SignalTree` | publicType | public alias of the tree contract | KERNEL | CONVERGED |
| `public-type:SignalTreeFactory` | publicType | canonical construction overload set shared by every facade | KERNEL | CONVERGED |
| `public-type:TransactionMethods` | publicType | declared in its owner module since TYPE-BARREL-CONVERGENCE-0; re-exported from the package root, one declaration authority | OPTIONAL-CAPABILITY | CONVERGED |
| `public-type:TreeCapability` | publicType | ?? not yet ruled (publicType) | UNKNOWN | REVIEW |
| `public-type:TreeConfig` | publicType | construction surface | KERNEL | CONVERGED |
| `public-type:TreeErrorEvent` | publicType | tree error boundary payload (frozen public surface) | KERNEL | CONVERGED |
| `public-type:TreeId` | publicType | tree identity token (frozen public surface) | KERNEL | CONVERGED |
| `public-type:TreeNode` | publicType | recursive mapped node type (OPEN-KEY-OWNERSHIP-0 governs its open-key behaviour) | KERNEL | CONVERGED |
| `public-type:WritableLeaf` | publicType | ?? not yet ruled (publicType) | UNKNOWN | REVIEW |
| `subpath:.` | subpath | the package root entry point | KERNEL | CONVERGED |
| `subpath:./package.json` | subpath | packaging hygiene; required by tooling that resolves the manifest | KERNEL | CONVERGED |
| `subpath:./adapter` | subpath | minimal SDK for framework observation adapters and semantic ingress | KERNEL | CONVERGED |
| `config:useShallowComparison` | config | read at signal-tree.ts:1539 — leaf equality policy | KERNEL | CONVERGED |
| `config:debugMode` | config | gates two development-only log statements and nothing else; TreeConfig is the correct surface because they fire without devTools() installed | DIAGNOSTIC | CONVERGED |
| `config:enhancers` | config | read at signal-tree.ts:2047 — the enhancer application list, the whole declarative construction contract | KERNEL | CONVERGED |
| `config:capabilities` | config | read at signal-tree.ts:2059 — explicit capability requests feeding the build plan | KERNEL | CONVERGED |
| `config:derived` | config | read at signal-tree.ts:2137 — derived slice declarations | KERNEL | CONVERGED |
| `capability:...explicitCapabilities` | capability | construction parameter at signal-tree.ts:221 carrying the author-requested set into the build plan | KERNEL | CONVERGED |
| `capability:causal-runtime` | capability | requested capability; 9 hasCapability/buildPlan reads gate causal machinery | KERNEL | CONVERGED |
| `capability:mutation-capture` | capability | requested capability; gates owned-mutation wrapping at construction | KERNEL | CONVERGED |
| `capability:position-topology` | capability | requested capability; gates position registry installation | KERNEL | CONVERGED |
| `capability:temporal-snapshots` | capability | requested capability; gates snapshot retention | KERNEL | CONVERGED |
| `marker-factory:lib/markers/entity-map.ts` | markerFactory | entityMap AUTHORING SYNTAX — a marker requests construction; it is not canonical state authority | DOMAIN-SPECIALIZATION | CONVERGED |
| `marker-factory:lib/markers/index.ts` | markerFactory | marker factory barrel for the specialization | DOMAIN-SPECIALIZATION | CONVERGED |
| `marker-registration:index.ts` | markerRegistration | built-in marker registration at package load | KERNEL | CONVERGED |
| `marker-registration:lib/signal-tree.ts` | markerRegistration | construction-time registration wiring | KERNEL | CONVERGED |
| `marker-registration:lib/internals/materialize-markers.ts` | markerRegistration | canonical MATERIALIZATION owner — turns a requested marker into real tree state | KERNEL | CONVERGED |
| `marker-registration:lib/markers/entity-map.ts` | markerRegistration | the specialization registering its own processor; registration does NOT make it membership authority — entityMapRegistered was deleted for exactly that | DOMAIN-SPECIALIZATION | CONVERGED |
| `state:enhancers/batching/batching.types.ts:_neutralTest` | moduleState | EXPLICIT: compile-time assertion that BatchingEnhancer extends Enhancer<BatchingMethods> | TEST-SEAM | CONVERGED |
| `state:enhancers/devtools/devtools-impl.ts:ngDevMode` | moduleState | EXPLICIT: build-tool global declaration | FRAMEWORK-ADAPTER | CONVERGED |
| `state:enhancers/devtools/devtools-impl.ts:GLOBAL_GROUPS_KEY` | moduleState | EXPLICIT: read by getGlobalDevToolsGroups | DIAGNOSTIC | CONVERGED |
| `state:enhancers/devtools/devtools-impl.ts:GLOBAL_MARKER_KEY` | moduleState | EXPLICIT: read by ensureGlobalMarker | DIAGNOSTIC | CONVERGED |
| `state:enhancers/devtools/devtools-impl.ts:devToolsGroups` | moduleState | EXPLICIT: read by getOrCreateDevToolsGroup | DIAGNOSTIC | CONVERGED |
| `state:enhancers/devtools/devtools-impl.ts:GLOBAL_CONNECTIONS_KEY` | moduleState | EXPLICIT: read by getGlobalDevToolsConnections | DIAGNOSTIC | CONVERGED |
| `state:enhancers/devtools/devtools-impl.ts:devToolsConnections` | moduleState | EXPLICIT: read by initBrowserDevTools | DIAGNOSTIC | CONVERGED |
| `state:enhancers/devtools/devtools.ts:ngDevMode` | moduleState | EXPLICIT: build-tool global declaration | FRAMEWORK-ADAPTER | CONVERGED |
| `state:enhancers/devtools/devtools.ts:devToolsImpl` | moduleState | EXPLICIT: lazily-held devTools implementation | DIAGNOSTIC | CONVERGED |
| `state:enhancers/restoration/restoration.ts:ngDevMode` | moduleState | ?? not yet ruled (moduleState, uninitialised) | UNKNOWN | REVIEW |
| `state:enhancers/restoration/restoration.ts:process` | moduleState | optional Node environment input to restoration consistency diagnostics | OPTIONAL-CAPABILITY | CONVERGED |
| `state:enhancers/restoration/restoration.ts:RUN_RESTORATION_CONSISTENCY_CHECKS` | moduleState | resolved restoration consistency-check policy | OPTIONAL-CAPABILITY | CONVERGED |
| `state:enhancers/restoration/restoration.ts:withRestoration` | moduleState | EXPLICIT: the restoration enhancer itself | OPTIONAL-CAPABILITY | CONVERGED |
| `state:enhancers/serialization/constants.ts:TYPE_MARKERS` | moduleState | EXPLICIT: serialization type markers, read at 27 sites | OPTIONAL-CAPABILITY | CONVERGED |
| `state:enhancers/serialization/serialization.ts:ngDevMode` | moduleState | EXPLICIT: build-tool global declaration | FRAMEWORK-ADAPTER | CONVERGED |
| `state:enhancers/serialization/serialization.ts:isSignal` | moduleState | EXPLICIT: the local reactive-cell predicate persistence asks with; routed through the realization port by SERIALIZATION-REACTIVE-CLASSIFICATION-0 (answer A) | OPTIONAL-CAPABILITY | CONVERGED |
| `state:enhancers/serialization/serialization.ts:SNAPSHOT_FORMAT_VERSION` | moduleState | EXPLICIT: read by encodeSnapshot; documented write-now/enforce-later token | OPTIONAL-CAPABILITY | CONVERGED |
| `state:enhancers/serialization/serialization.ts:DEFAULT_CONFIG` | moduleState | EXPLICIT: read by persistenceFn | OPTIONAL-CAPABILITY | CONVERGED |
| `state:enhancers/serialization/serialization.ts:restoreSpecialTypes` | moduleState | EXPLICIT: read by applyJSON — special type revival | OPTIONAL-CAPABILITY | CONVERGED |
| `state:enhancers/transactions/transactions.ts:INTERNAL_TRANSACTION_RUNTIME` | moduleState | EXPLICIT: read by getOrCreateInternalTransactionRuntime | OPTIONAL-CAPABILITY | CONVERGED |
| `state:enhancers/transactions/transactions.ts:ROLLBACK_ERROR_MESSAGE` | moduleState | EXPLICIT: read by explainRollbackFailure | OPTIONAL-CAPABILITY | CONVERGED |
| `state:enhancers/transactions/transactions.ts:explainRollbackFailure` | moduleState | EXPLICIT: read by createRollbackError | OPTIONAL-CAPABILITY | CONVERGED |
| `state:enhancers/transactions/transactions.ts:createRollbackError` | moduleState | EXPLICIT: read by rollback paths | OPTIONAL-CAPABILITY | CONVERGED |
| `state:lib/constants.ts:DEV_MESSAGES` | moduleState | EXPLICIT: development message catalogue | DIAGNOSTIC | CONVERGED |
| `state:lib/constants.ts:PROD_MESSAGES` | moduleState | EXPLICIT: production message catalogue | DIAGNOSTIC | CONVERGED |
| `state:lib/constants.ts:ngDevMode` | moduleState | EXPLICIT: build-tool global declaration | FRAMEWORK-ADAPTER | CONVERGED |
| `state:lib/constants.ts:_isProdByEnv` | moduleState | EXPLICIT: build-mode discrimination for message selection | DIAGNOSTIC | CONVERGED |
| `state:lib/constants.ts:_isDev` | moduleState | EXPLICIT: build-mode discrimination for message selection | DIAGNOSTIC | CONVERGED |
| `state:lib/constants.ts:SIGNAL_TREE_MESSAGES` | moduleState | EXPLICIT: the frozen message table, read by 3 modules | DIAGNOSTIC | CONVERGED |
| `state:lib/enhancer-types.ts:ENHANCER_META` | moduleState | EXPLICIT: enhancer metadata key, read by 10 modules — the construction contract | KERNEL | CONVERGED |
| `state:lib/entity-signal.ts:ngDevMode` | moduleState | EXPLICIT: build-tool global declaration | FRAMEWORK-ADAPTER | CONVERGED |
| `state:lib/entity-signal.ts:WRONG_ENTITY_METHODS` | moduleState | EXPLICIT: wrong-method error message table | DIAGNOSTIC | CONVERGED |
| `state:lib/entity-signal.ts:nextStandaloneEntityPositionId` | moduleState | EXPLICIT: read by standaloneEntityPositionIdAllocator — entity position allocation | DOMAIN-SPECIALIZATION | CONVERGED |
| `state:lib/entity-signal.ts:standaloneEntityPositionIdAllocator` | moduleState | EXPLICIT: read by createEntitySignal — entity position allocation | DOMAIN-SPECIALIZATION | CONVERGED |
| `state:lib/entity-signal.ts:entityPositionIdAllocatorOverride` | moduleState | EXPLICIT: read by createEntitySignal; written only by a ForTesting setter | TEST-SEAM | CONVERGED |
| `state:lib/entity-signal.ts:entityPositionIdNotifyEnabled` | moduleState | EXPLICIT: read by getPositionIdsForNotify — entity notify participation | DOMAIN-SPECIALIZATION | CONVERGED |
| `state:lib/path-notifier.ts:materializeDeliveryMeta` | moduleState | EXPLICIT: delivery-side meta materialization | OPTIONAL-CAPABILITY | CONVERGED |
| `state:lib/path-notifier.ts:globalPathNotifier` | moduleState | EXPLICIT: delivery engine singleton, installed through the port and never linked by the bare kernel | OPTIONAL-CAPABILITY | CONVERGED |
| `state:lib/readonly-readers.ts:ENTITY_READERS` | moduleState | EXPLICIT: entity-aware reader table for the readonly projection | DOMAIN-SPECIALIZATION | CONVERGED |
| `state:lib/signal-tree.ts:isWritableCell` | moduleState | ?? not yet ruled (moduleState, function) | UNKNOWN | REVIEW |
| `state:lib/signal-tree.ts:readWritableCell` | moduleState | non-tracking kernel read through Location.peek with structural fallback | KERNEL | CONVERGED |
| `state:lib/signal-tree.ts:ngDevMode` | moduleState | ?? not yet ruled (moduleState, uninitialised) | UNKNOWN | REVIEW |
| `state:lib/signal-tree.ts:ENTITY_ARRAY_MIN_LENGTH` | moduleState | EXPLICIT: read only by warnEntityArrayLeaf — a dev warning heuristic threshold | DIAGNOSTIC | CONVERGED |
| `state:lib/signal-tree.ts:ENTITY_ARRAY_SAMPLE` | moduleState | EXPLICIT: read only by warnEntityArrayLeaf/warnMarkerInContainer — dev warning sampling | DIAGNOSTIC | CONVERGED |
| `state:lib/signal-tree.ts:ENTITY_ID_KEYS` | moduleState | EXPLICIT: read only by warnEntityArrayLeaf — dev warning id-key heuristic | DIAGNOSTIC | CONVERGED |
| `state:lib/signal-tree.ts:ENTITY_ARRAY_WARNED` | moduleState | EXPLICIT: read only by warnEntityArrayLeaf — warn-once dedupe, bounded by ENTITY_ARRAY_WARN_CAP | DIAGNOSTIC | CONVERGED |
| `state:lib/signal-tree.ts:ENTITY_ARRAY_WARN_CAP` | moduleState | EXPLICIT: read only by warnEntityArrayLeaf — the cap that bounds the warn set | DIAGNOSTIC | CONVERGED |
| `state:lib/signal-tree.ts:NODE_ACCESSOR_PEER` | moduleState | EXPLICIT: read by makeNodeAccessor — accessor peer link | KERNEL | CONVERGED |
| `state:lib/signal-tree.ts:MARKER_IN_ARRAY_WARNED` | moduleState | EXPLICIT: read only by warnMarkerInContainer — warn-once dedupe | DIAGNOSTIC | CONVERGED |
| `state:lib/signal-tree.ts:looksLikeMarker` | moduleState | EXPLICIT: read only by warnMarkerInContainer — dev warning predicate | DIAGNOSTIC | CONVERGED |
| `state:lib/signal-tree.ts:warnedNoopPaths` | moduleState | EXPLICIT: read by recursiveUpdate behind an ngDevMode guard — warn-once dedupe that cannot grow in a shipped build | DIAGNOSTIC | CONVERGED |
| `state:lib/signal-tree.ts:warnedNoopCopyPaths` | moduleState | EXPLICIT: warn-once dedupe behind the same ngDevMode guard | DIAGNOSTIC | CONVERGED |
| `state:lib/signal-tree.ts:signalTree` | moduleState | ?? not yet ruled (moduleState, AsExpression) | UNKNOWN | REVIEW |
| `state:lib/signal-tree.ts:createSignalTreeFactory` | moduleState | construction-bound factory creator for one observation adapter | KERNEL | CONVERGED |
| `state:lib/types.ts:ENTITY_MAP_BRAND` | moduleState | EXPLICIT: the entityMap marker brand | DOMAIN-SPECIALIZATION | CONVERGED |
| `state:lib/utils.ts:isReactiveStateValue` | moduleState | kernel tree-cell classifier used by snapshot and unwrap traversal | KERNEL | CONVERGED |
| `state:lib/utils.ts:ngDevMode` | moduleState | EXPLICIT: the build-tool global declaration used to gate dev-only code | FRAMEWORK-ADAPTER | CONVERGED |
| `state:lib/utils.ts:DERIVED_STAMP` | moduleState | EXPLICIT: derived-slice stamp key | KERNEL | CONVERGED |
| `state:lib/write-context.ts:activeContext` | moduleState | EXPLICIT: ambient authored-write context | KERNEL | CONVERGED |
| `state:lib/write-participation.ts:getWriteParticipation` | moduleState | EXPLICIT: write participation classifier, read by 11 modules | KERNEL | CONVERGED |
| `state:lib/write-participation.ts:isInspectionWrite` | moduleState | EXPLICIT: inspection-write predicate, read by 7 modules | KERNEL | CONVERGED |
| `state:lib/internals/acquire-projection.ts:isRealizableSubject` | moduleState | EXPLICIT: realizability predicate for acquisition | KERNEL | CONVERGED |
| `state:lib/internals/acquire-projection.ts:EXTERNAL_ACQUISITION` | moduleState | EXPLICIT: external acquisition descriptor | KERNEL | CONVERGED |
| `state:lib/internals/cell-identity.ts:CELL_MARK` | moduleState | nominal identity for runtime-minted and explicitly adopted universal locations | KERNEL | CONVERGED |
| `state:lib/internals/commit-consequence.ts:scopesByOwner` | moduleState | EXPLICIT: read by openCommitScope/deferCommitConsequence/settleCommitScope | KERNEL | CONVERGED |
| `state:lib/internals/commit-consequence.ts:openScopesByKey` | moduleState | EXPLICIT: read by hasOpen/openCommitScope/settleCommitScope | KERNEL | CONVERGED |
| `state:lib/internals/commit-consequence.ts:settleListenersByKey` | moduleState | EXPLICIT: read by settleCommitScope/onCommitScopesSettled | KERNEL | CONVERGED |
| `state:lib/internals/commit-consequence.ts:heldByKey` | moduleState | EXPLICIT: read by scheduleDurableConsequence/settleCommitScope | KERNEL | CONVERGED |
| `state:lib/internals/enhancer-requirements.ts:describe` | moduleState | EXPLICIT: requirement description for construction-time validation messages | KERNEL | CONVERGED |
| `state:lib/internals/entity-projection-seed.ts:SEED` | moduleState | EXPLICIT: entity projection seed key | DOMAIN-SPECIALIZATION | CONVERGED |
| `state:lib/internals/error-reporter.ts:ngDevMode` | moduleState | ?? not yet ruled (moduleState, uninitialised) | UNKNOWN | REVIEW |
| `state:lib/internals/error-reporter.ts:listeners` | moduleState | EXPLICIT: onTreeError listener set — the frozen tree error boundary | KERNEL | CONVERGED |
| `state:lib/internals/intrinsic-mutation.ts:SOURCES` | moduleState | ?? not yet ruled (moduleState, new WeakMap) | UNKNOWN | REVIEW |
| `state:lib/internals/location-runtime.ts:activeConsumer` | moduleState | active kernel derived-location dependency consumer | KERNEL | CONVERGED |
| `state:lib/internals/location-runtime.ts:publicationDepth` | moduleState | nested kernel publication depth for coherent derived settlement | KERNEL | CONVERGED |
| `state:lib/internals/location-runtime.ts:pendingConsumers` | moduleState | pending kernel derived consumers awaiting dependency-ordered settlement | KERNEL | CONVERGED |
| `state:lib/internals/location-runtime.ts:dependencyFinalizer` | moduleState | releases weak reverse dependency edges when derived locations are collected | KERNEL | CONVERGED |
| `state:lib/internals/location-runtime.ts:flushConsumers` | moduleState | dependency-ordered settlement of pending kernel derived locations | KERNEL | CONVERGED |
| `state:lib/internals/location-runtime.ts:notifyObservers` | moduleState | delivers framework invalidation and vanilla listeners without observer starvation | KERNEL | CONVERGED |
| `state:lib/internals/location-runtime.ts:trackDependency` | moduleState | records kernel location dependencies and delegates only outer observation | KERNEL | CONVERGED |
| `state:lib/internals/location-runtime.ts:notifyDependents` | moduleState | invalidates kernel dependency consumers after committed truth changes | KERNEL | CONVERGED |
| `state:lib/internals/location-runtime.ts:NODE_LOCATION_RUNTIMES` | moduleState | tree-node association with its construction-bound kernel location runtime | KERNEL | CONVERGED |
| `state:lib/internals/location-runtime.ts:NEUTRAL_LOCATION_RUNTIME` | moduleState | framework-free default location runtime | KERNEL | CONVERGED |
| `state:lib/internals/materialize-markers.ts:ngDevMode` | moduleState | ?? not yet ruled (moduleState, uninitialised) | UNKNOWN | REVIEW |
| `state:lib/internals/materialize-markers.ts:PROCESSOR_STAMP` | moduleState | EXPLICIT: read by getNodeProcessor/materializeMarkers | KERNEL | CONVERGED |
| `state:lib/internals/materialize-markers.ts:MARKER_PROCESSORS` | moduleState | EXPLICIT: read by isRegisteredMarker/registerProcessor/materializeMarkers | KERNEL | CONVERGED |
| `state:lib/internals/materialize-markers.ts:warnedWriteOnly` | moduleState | EXPLICIT: read only by warnWriteOnlyMarker — dev warning dedupe | DIAGNOSTIC | CONVERGED |
| `state:lib/internals/materialize-markers.ts:treesConstructedCount` | moduleState | EXPLICIT: read by registerProcessor/_recordTreeConstruction — construction bookkeeping | KERNEL | CONVERGED |
| `state:lib/internals/materialize-markers.ts:ORDINARY_STATE` | moduleState | EXPLICIT: read by ordinaryBranch/isOrdinaryStateRequest | KERNEL | CONVERGED |
| `state:lib/internals/materialize-markers.ts:KEY_INDEX` | moduleState | EXPLICIT: read by attachKeyIndex/materializeMember | KERNEL | CONVERGED |
| `state:lib/internals/materialize-markers.ts:MEMBER_MATERIALIZER` | moduleState | EXPLICIT: read by materializeMember/materializeKeyedAware | KERNEL | CONVERGED |
| `state:lib/internals/materialize-markers.ts:applyMemberValue` | moduleState | EXPLICIT: member value application hook — a named convergence action | KERNEL | REIMPLEMENT |
| `state:lib/internals/member-membership.ts:DORMANT` | moduleState | EXPLICIT: read by memberBinding/deactivateOne — dormancy membership state | KERNEL | CONVERGED |
| `state:lib/internals/member-membership.ts:HAS_DORMANT` | moduleState | EXPLICIT: read by hasDormantMembers/markHasDormant | KERNEL | CONVERGED |
| `state:lib/internals/member-membership.ts:NODE_ACCESSOR_PEER` | moduleState | EXPLICIT: read by peerOf | KERNEL | CONVERGED |
| `state:lib/internals/merge-derived.ts:ngDevMode` | moduleState | EXPLICIT: build-tool global declaration | FRAMEWORK-ADAPTER | CONVERGED |
| `state:lib/internals/mutation-capture-runtime.ts:MUTATION_CAPTURE_RUNTIME` | moduleState | EXPLICIT: capture runtime attachment key | KERNEL | CONVERGED |
| `state:lib/internals/node-shape.ts:CALLABLE_SIGNAL_SYMBOL` | moduleState | EXPLICIT: callable-signal protocol key | KERNEL | CONVERGED |
| `state:lib/internals/node-shape.ts:NODE_STORE_SYMBOL` | moduleState | ?? not yet ruled (moduleState, Symbol.for()) | UNKNOWN | REVIEW |
| `state:lib/internals/observation-adapter.ts:NEUTRAL_OBSERVATION_ADAPTER` | moduleState | neutral implementation of the framework-observation port | KERNEL | CONVERGED |
| `state:lib/internals/observation-substrate.ts:OBSERVATION` | moduleState | EXPLICIT: read by installDormantObservation/claimLeaf | KERNEL | CONVERGED |
| `state:lib/internals/owned-metadata.ts:OWNED_NODE_METADATA` | moduleState | EXPLICIT: read by getOwnedPositionIds/getOwnedOwnerPath/getOwnedOwnerId/hasIntrinsicMutationEmitter | KERNEL | CONVERGED |
| `state:lib/internals/owner-invalidation-port.ts:dispatch` | moduleState | ?? not yet ruled (moduleState, uninitialised) | UNKNOWN | REVIEW |
| `state:lib/internals/owner-invalidation.ts:states` | moduleState | ?? not yet ruled (moduleState, uninitialised) | UNKNOWN | REVIEW |
| `state:lib/internals/owner-invalidation.ts:ownerIdFor` | moduleState | ?? not yet ruled (moduleState, function) | UNKNOWN | REVIEW |
| `state:lib/internals/path-observation-port.ts:runtime` | moduleState | EXPLICIT: the nullable delivery runtime; null until an optional consumer installs one | KERNEL | CONVERGED |
| `state:lib/internals/path-observation-port.ts:PORT` | moduleState | EXPLICIT: the stable delegating facade the kernel holds; allocated once, holds no state | KERNEL | CONVERGED |
| `state:lib/internals/physical-commit-clock.ts:PHYSICAL_COMMIT_CLOCK` | moduleState | EXPLICIT: read by define/getPhysicalCommitClock | KERNEL | CONVERGED |
| `state:lib/internals/position-registry.ts:POSITION_REGISTRY_SYMBOL` | moduleState | EXPLICIT: position registry attachment key | KERNEL | CONVERGED |
| `state:lib/internals/position-registry.ts:treeIdBrand` | moduleState | EXPLICIT: TreeId brand carrier | KERNEL | CONVERGED |
| `state:lib/internals/position-registry.ts:nextRegistryId` | moduleState | EXPLICIT: registry namespace allocator — the ownerId that scopes non-global position ids | KERNEL | CONVERGED |
| `state:lib/internals/production-substrate-stats.prod.ts:PRODUCTION_SUBSTRATE_STATS_ENABLED` | moduleState | EXPLICIT: the shipped no-op variant: false, so substrate counters cost nothing in production | DIAGNOSTIC | CONVERGED |
| `state:lib/internals/production-substrate-stats.ts:PRODUCTION_SUBSTRATE_STATS_ENABLED` | moduleState | EXPLICIT: read at 13 cross-file sites to gate substrate counters | DIAGNOSTIC | CONVERGED |
| `state:lib/internals/production-substrate-stats.ts:activeStats` | moduleState | EXPLICIT: read by recordProductionSubstrateStat | DIAGNOSTIC | CONVERGED |
| `state:lib/internals/restoration-eligibility.ts:designated` | moduleState | EXPLICIT: restoration designation flag | OPTIONAL-CAPABILITY | CONVERGED |
| `state:lib/internals/root-source.ts:ROOT_AUTHORITIES` | moduleState | ?? not yet ruled (moduleState, new WeakMap) | UNKNOWN | REVIEW |
| `state:lib/internals/runtime-tree-plan.ts:RESTORATION_CAPABILITIES` | moduleState | EXPLICIT: capability set a restoration request implies, consumed by the build plan | KERNEL | CONVERGED |
| `state:lib/internals/snapshot-authority.ts:ngDevMode` | moduleState | ?? not yet ruled (moduleState, uninitialised) | UNKNOWN | REVIEW |
| `state:lib/internals/snapshot-authority.ts:MATERIALIZED` | moduleState | ?? not yet ruled (moduleState, new WeakMap) | UNKNOWN | REVIEW |
| `state:lib/internals/snapshot-authority.ts:SNAPSHOT_PARENT` | moduleState | ?? not yet ruled (moduleState, new WeakMap) | UNKNOWN | REVIEW |
| `state:lib/internals/snapshot-authority.ts:TREE_STORES` | moduleState | ?? not yet ruled (moduleState, new WeakSet) | UNKNOWN | REVIEW |
| `state:lib/internals/snapshot-authority.ts:VOLATILE_SNAPSHOTS` | moduleState | ?? not yet ruled (moduleState, new WeakSet) | UNKNOWN | REVIEW |
| `state:lib/internals/snapshot-authority.ts:MEMBERSHIP_REVISION` | moduleState | ?? not yet ruled (moduleState, new WeakMap) | UNKNOWN | REVIEW |
| `state:lib/internals/subject-reclamation-sink.ts:SUBJECT_PHYSICAL_OWNERS_SYMBOL` | moduleState | EXPLICIT: physical owner registry key for reclamation | OPTIONAL-CAPABILITY | CONVERGED |
| `state:lib/internals/subject-reclamation-sink.ts:SUBJECT_RECLAMATION_SINK_SYMBOL` | moduleState | EXPLICIT: reclamation sink attachment key | OPTIONAL-CAPABILITY | CONVERGED |
| `state:lib/internals/subject-restoration-claims.ts:SUBJECT_RESTORATION_CLAIMS_SYMBOL` | moduleState | EXPLICIT: tree-scoped restoration claim index key | OPTIONAL-CAPABILITY | CONVERGED |
| `state:lib/internals/tree-capabilities.ts:TREE_CAPABILITY_ORDER` | moduleState | EXPLICIT: capability ordering table | KERNEL | CONVERGED |
| `state:lib/internals/tree-capabilities.ts:TREE_CAPABILITY_DEPENDENCIES` | moduleState | EXPLICIT: capability implication table | KERNEL | CONVERGED |
| `state:lib/internals/tree-capabilities.ts:canonicalizeCapabilities` | moduleState | EXPLICIT: capability set canonicalization for the build plan | KERNEL | CONVERGED |
| `state:lib/internals/tree-scalar-slot-port.ts:TREE_SCALAR_SLOT_RUNTIME` | moduleState | ?? not yet ruled (moduleState, Symbol.for()) | UNKNOWN | REVIEW |
| `state:lib/internals/causal-runtime/confirmed-redo.ts:defaultDependencies` | moduleState | EXPLICIT: default dependency bag for confirmed redo | OPTIONAL-CAPABILITY | CONVERGED |
| `state:lib/internals/causal-runtime/confirmed-undo.ts:defaultDependencies` | moduleState | EXPLICIT: read by undoConfirmedAt — default dependency bag for confirmed undo | OPTIONAL-CAPABILITY | CONVERGED |
| `state:lib/internals/causal-runtime/transaction-lifecycle.ts:TRANSACTION_LIFECYCLE` | moduleState | EXPLICIT: transaction lifecycle channel key | OPTIONAL-CAPABILITY | CONVERGED |
| `state:lib/internals/causal-runtime/transaction-lifecycle.ts:TRANSACTION_LIFECYCLE_OWNER` | moduleState | EXPLICIT: transaction lifecycle owner-presence key | OPTIONAL-CAPABILITY | CONVERGED |
| `state:lib/internals/causal-runtime/tree-realization-adapter.ts:TREE_REALIZATION_DESCRIPTORS` | moduleState | EXPLICIT: read by define/getTreeRealizationDescriptors | OPTIONAL-CAPABILITY | CONVERGED |
| `state:lib/internals/causal-runtime/tree-realization-adapter.ts:TREE_REALIZATION_PORT` | moduleState | EXPLICIT: read by define/getTreeRealizationPort | OPTIONAL-CAPABILITY | CONVERGED |
| `state:lib/internals/causal-runtime/tree-realization-adapter.ts:WHOLE_SUBJECT` | moduleState | EXPLICIT: read by deriveSubjectAddress | OPTIONAL-CAPABILITY | CONVERGED |
| `state:lib/internals/diagnostics/diagnostic-journal.ts:DEFAULT_MAX_TURNS` | moduleState | EXPLICIT: journal turn retention bound | DIAGNOSTIC | CONVERGED |
| `state:lib/internals/diagnostics/diagnostic-journal.ts:DEFAULT_MAX_EVENTS` | moduleState | EXPLICIT: journal retention bound — what makes the journal bounded | DIAGNOSTIC | CONVERGED |
| `state:lib/internals/utilities/deep-clone.ts:globalStructuredClone` | moduleState | EXPLICIT: private platform-capability capture used by kernel cloning; an implementation choice, not a required public semantic | KERNEL | CONVERGED |
| `state:lib/internals/utilities/deep-equal.ts:CYCLE_GUARD_DEPTH` | moduleState | EXPLICIT: private measured threshold for lazy cycle tracking in the kernel equality hot path; an implementation choice, not a public contract | KERNEL | CONVERGED |
| `state:lib/markers/entity-map.ts:ngDevMode` | moduleState | ?? not yet ruled (moduleState, uninitialised) | UNKNOWN | REVIEW |
| `state:lib/physical/subject-record-target.ts:preparedSubjectUpdatesBrand` | moduleState | ?? not yet ruled (moduleState, uninitialised) | UNKNOWN | REVIEW |
| `pipeline-candidate:enhancers/transactions/transactions.ts:cloneTurnRecord` | exportedPipelineCandidate | turn record cloning for transaction bookkeeping | OPTIONAL-CAPABILITY | CONVERGED |
| `pipeline-candidate:lib/entity-signal.ts:setEntityPositionIdNotifyEnabledForTesting` | exportedPipelineCandidate | entity test seam; de-exported in the 15.0 orphan sweep, reachable only through the __ testing bag | TEST-SEAM | CONVERGED |
| `pipeline-candidate:lib/signal-tree.ts:materializeTreeMarkers` | exportedPipelineCandidate | marker materialization entry during construction | KERNEL | CONVERGED |
| `pipeline-candidate:lib/signal-tree.ts:republishMembers` | exportedPipelineCandidate | republishes members after structural change | KERNEL | CONVERGED |
| `pipeline-candidate:lib/signal-tree.ts:materializeOrdinaryBranch` | exportedPipelineCandidate | branch materialization during construction | KERNEL | CONVERGED |
| `pipeline-candidate:lib/utils.ts:materializeNode` | exportedPipelineCandidate | node materialization | KERNEL | CONVERGED |
| `pipeline-candidate:lib/internals/commit-consequence.ts:openCommitScope` | exportedPipelineCandidate | POST-commit consequence scope. deferCommitConsequence returns "accepted into a scope", and its false paths are claimant/ownership checks — it cannot prevent a commit, so AN OBSERVER MAY REACT TO A COMMIT; ONLY PRECOMMIT AUTHORITY MAY PREVENT ONE still holds | KERNEL | CONVERGED |
| `pipeline-candidate:lib/internals/commit-consequence.ts:deferCommitConsequence` | exportedPipelineCandidate | POST-commit consequence scope. deferCommitConsequence returns "accepted into a scope", and its false paths are claimant/ownership checks — it cannot prevent a commit, so AN OBSERVER MAY REACT TO A COMMIT; ONLY PRECOMMIT AUTHORITY MAY PREVENT ONE still holds | KERNEL | CONVERGED |
| `pipeline-candidate:lib/internals/commit-consequence.ts:settleCommitScope` | exportedPipelineCandidate | POST-commit consequence scope. deferCommitConsequence returns "accepted into a scope", and its false paths are claimant/ownership checks — it cannot prevent a commit, so AN OBSERVER MAY REACT TO A COMMIT; ONLY PRECOMMIT AUTHORITY MAY PREVENT ONE still holds | KERNEL | CONVERGED |
| `pipeline-candidate:lib/internals/commit-consequence.ts:hasOpenCommitScope` | exportedPipelineCandidate | POST-commit consequence scope. deferCommitConsequence returns "accepted into a scope", and its false paths are claimant/ownership checks — it cannot prevent a commit, so AN OBSERVER MAY REACT TO A COMMIT; ONLY PRECOMMIT AUTHORITY MAY PREVENT ONE still holds | KERNEL | CONVERGED |
| `pipeline-candidate:lib/internals/commit-consequence.ts:onCommitScopesSettled` | exportedPipelineCandidate | POST-commit consequence scope. deferCommitConsequence returns "accepted into a scope", and its false paths are claimant/ownership checks — it cannot prevent a commit, so AN OBSERVER MAY REACT TO A COMMIT; ONLY PRECOMMIT AUTHORITY MAY PREVENT ONE still holds | KERNEL | CONVERGED |
| `pipeline-candidate:lib/internals/intercept-leaf-signals.ts:interceptLeafSignals` | exportedPipelineCandidate | internal observation substrate for leaves that received no capture; explicitly not root app API | KERNEL | CONVERGED |
| `pipeline-candidate:lib/internals/materialize-markers.ts:_recordTreeConstruction` | exportedPipelineCandidate | construction bookkeeping for materialization | KERNEL | CONVERGED |
| `pipeline-candidate:lib/internals/materialize-markers.ts:materializeMember` | exportedPipelineCandidate | deferred member materialization | KERNEL | CONVERGED |
| `pipeline-candidate:lib/internals/materialize-markers.ts:materializeKeyedAware` | exportedPipelineCandidate | keyed-aware materialization path | KERNEL | CONVERGED |
| `pipeline-candidate:lib/internals/materialize-markers.ts:materializeMarkers` | exportedPipelineCandidate | canonical marker materialization | KERNEL | CONVERGED |
| `pipeline-candidate:lib/internals/member-membership.ts:reactivateOnWrite` | exportedPipelineCandidate | dormant-member reactivation on write (ACQUISITION IS CREATE-IF-NEVER-SEEN, REACTIVATE-IF-DORMANT, REUSE-IF-ACTIVE) | KERNEL | CONVERGED |
| `pipeline-candidate:lib/internals/member-membership.ts:deactivateOne` | exportedPipelineCandidate | membership deactivation half; same single owner | KERNEL | CONVERGED |
| `pipeline-candidate:lib/internals/member-membership.ts:activateOne` | exportedPipelineCandidate | membership activation half; setMemberPresence owns both physical halves | KERNEL | CONVERGED |
| `pipeline-candidate:lib/internals/owned-metadata.ts:hasIntrinsicMutationEmitter` | exportedPipelineCandidate | capture-capability read on a node | KERNEL | CONVERGED |
| `pipeline-candidate:lib/internals/owned-mutation.ts:defineIntrinsicMutationEmitter` | exportedPipelineCandidate | marks a node as emitting mutations; de-exported in the 15.0 orphan sweep | KERNEL | CONVERGED |
| `pipeline-candidate:lib/internals/owned-mutation.ts:emitOwnedMutation` | exportedPipelineCandidate | the single write-path publication into the observation port (ME-B) | KERNEL | CONVERGED |
| `pipeline-candidate:lib/internals/owner-invalidation-port.ts:markOwnerInvalidated` | exportedPipelineCandidate | ?? not yet ruled (exportedPipelineCandidate) | UNKNOWN | REVIEW |
| `pipeline-candidate:lib/internals/owner-invalidation-port.ts:markOwnerInvalidatedFrom` | exportedPipelineCandidate | ?? not yet ruled (exportedPipelineCandidate) | UNKNOWN | REVIEW |
| `pipeline-candidate:lib/internals/owner-invalidation.ts:markOwnerInvalidated` | exportedPipelineCandidate | ?? not yet ruled (exportedPipelineCandidate) | UNKNOWN | REVIEW |
| `pipeline-candidate:lib/internals/owner-invalidation.ts:markOwnerInvalidatedFrom` | exportedPipelineCandidate | ?? not yet ruled (exportedPipelineCandidate) | UNKNOWN | REVIEW |
| `pipeline-candidate:lib/internals/physical-commit-clock.ts:createPhysicalCommitClock` | exportedPipelineCandidate | physical revision clock lifecycle | KERNEL | CONVERGED |
| `pipeline-candidate:lib/internals/physical-commit-clock.ts:definePhysicalCommitClock` | exportedPipelineCandidate | physical revision clock lifecycle | KERNEL | CONVERGED |
| `pipeline-candidate:lib/internals/physical-commit-clock.ts:getPhysicalCommitClock` | exportedPipelineCandidate | physical revision clock lifecycle | KERNEL | CONVERGED |
| `pipeline-candidate:lib/internals/production-substrate-stats.prod.ts:recordProductionSubstrateStat` | exportedPipelineCandidate | substrate counters; the .prod variant is a no-op with ENABLED=false, so diagnostics cost nothing in shipped builds | DIAGNOSTIC | CONVERGED |
| `pipeline-candidate:lib/internals/production-substrate-stats.ts:recordProductionSubstrateStat` | exportedPipelineCandidate | substrate counters; the .prod variant is a no-op with ENABLED=false, so diagnostics cost nothing in shipped builds | DIAGNOSTIC | CONVERGED |
| `pipeline-candidate:lib/internals/snapshot-authority.ts:publishMembershipChange` | exportedPipelineCandidate | ?? not yet ruled (exportedPipelineCandidate) | UNKNOWN | REVIEW |
| `pipeline-candidate:lib/internals/snapshot-authority.ts:materializeSnapshotNode` | exportedPipelineCandidate | ?? not yet ruled (exportedPipelineCandidate) | UNKNOWN | REVIEW |
| `pipeline-candidate:lib/internals/causal-runtime/confirmed-undo.ts:getRestoredStructuralResource` | exportedPipelineCandidate | restored resource lookup on confirmed undo | OPTIONAL-CAPABILITY | CONVERGED |
| `pipeline-candidate:lib/internals/causal-runtime/pending-rollback.ts:getRestoredStructuralResource` | exportedPipelineCandidate | restored resource lookup on pending rollback | OPTIONAL-CAPABILITY | CONVERGED |
| `pipeline-candidate:lib/internals/causal-runtime/target-transition.ts:isRecord` | exportedPipelineCandidate | ?? not yet ruled (exportedPipelineCandidate) | UNKNOWN | REVIEW |
| `pipeline-candidate:lib/internals/causal-runtime/tree-realization-adapter.ts:resolveNotifyPath` | exportedPipelineCandidate | address resolution for replay delivery | OPTIONAL-CAPABILITY | CONVERGED |
| `symbol:SignalTree:Derived` | structuralSymbol | derived-slice attachment key; declared in lib/utils.ts | KERNEL | CONVERGED |
| `symbol:SignalTree:DormantMember` | structuralSymbol | membership state key; dormancy is kernel membership semantics; declared in lib/internals/member-membership.ts | KERNEL | CONVERGED |
| `symbol:SignalTree:DynamicKeyIndex` | structuralSymbol | open-key index attachment; declared in lib/internals/materialize-markers.ts | KERNEL | CONVERGED |
| `symbol:SignalTree:HasDormantMembers` | structuralSymbol | branch-level dormancy summary key; declared in lib/internals/member-membership.ts | KERNEL | CONVERGED |
| `symbol:SignalTree:MarkerProcessor` | structuralSymbol | marker processor registry key; declared in lib/internals/materialize-markers.ts | KERNEL | CONVERGED |
| `symbol:SignalTree:MemberMaterializer` | structuralSymbol | deferred member materialization hook; declared in lib/internals/materialize-markers.ts | KERNEL | CONVERGED |
| `symbol:SignalTree:MutationCaptureRuntime` | structuralSymbol | capture runtime attachment; declared in lib/internals/mutation-capture-runtime.ts | KERNEL | CONVERGED |
| `symbol:SignalTree:NodeAccessor` | structuralSymbol | accessor protocol key; declared in lib/signal-tree.ts | KERNEL | CONVERGED |
| `symbol:SignalTree:NodeAccessorPeer` | structuralSymbol | accessor peer link key; declared in lib/signal-tree.ts | KERNEL | CONVERGED |
| `symbol:SignalTree:NodeStore` | structuralSymbol | node storage attachment; declared in lib/utils.ts | KERNEL | CONVERGED |
| `symbol:SignalTree:OrdinaryStateRequest` | structuralSymbol | non-marker construction request key; declared in lib/internals/materialize-markers.ts | KERNEL | CONVERGED |
| `symbol:SignalTree:PhysicalCommitClock` | structuralSymbol | physical revision clock; declared in lib/internals/physical-commit-clock.ts | KERNEL | CONVERGED |
| `symbol:SignalTree:PositionRegistry` | structuralSymbol | position identity registry key; declared in lib/internals/position-registry.ts | KERNEL | CONVERGED |
| `symbol:SignalTree:ScalarSlotRuntime` | structuralSymbol | declared in tree-scalar-slot-angular-runtime.ts — the Angular adapter module; correctly placed on the framework side of the boundary | FRAMEWORK-ADAPTER | CONVERGED |
| `symbol:SignalTree:SubjectPhysicalOwners` | structuralSymbol | physical owner registry for entity subjects; read by the reclamation sink | DOMAIN-SPECIALIZATION | CONVERGED |
| `symbol:SignalTree:SubjectRestorationClaims` | structuralSymbol | tree-scoped restoration claim index (SUBJECT-CLAIM-SCOPE: conservative by ruling) | OPTIONAL-CAPABILITY | CONVERGED |
| `symbol:SignalTree:TransactionLifecycleChannel` | structuralSymbol | transactions() lifecycle channel key | OPTIONAL-CAPABILITY | CONVERGED |
| `symbol:SignalTree:TransactionLifecycleOwnerPresent` | structuralSymbol | transactions() owner-presence flag key | OPTIONAL-CAPABILITY | CONVERGED |
| `symbol:SignalTree:TreeRealizationDescriptors` | structuralSymbol | causal replay descriptor store key | OPTIONAL-CAPABILITY | CONVERGED |
| `symbol:SignalTree:TreeRealizationPort` | structuralSymbol | causal replay port key | OPTIONAL-CAPABILITY | CONVERGED |
| `orphan:enhancers/devtools/devtools.ts:fullDevTools` | orphanExport | reached only by specs — deliberate seam | TEST-SEAM | CONVERGED |
| `orphan:enhancers/devtools/devtools.ts:productionDevTools` | orphanExport | reached only by specs — deliberate seam | TEST-SEAM | CONVERGED |
| `orphan:enhancers/restoration/restoration.ts:shouldRunRestorationConsistencyChecks` | orphanExport | restoration consistency-check policy with focused test consumers | OPTIONAL-CAPABILITY | CONVERGED |
| `orphan:enhancers/restoration/restoration.ts:enableRestoration` | orphanExport | reached only by specs — deliberate seam | TEST-SEAM | CONVERGED |
| `orphan:enhancers/serialization/serialization.ts:applySerialization` | orphanExport | reached only by specs — deliberate seam | TEST-SEAM | CONVERGED |
| `orphan:enhancers/transactions/transactions.ts:getOrCreateInternalTransactionRuntime` | orphanExport | reached only by specs — deliberate seam | TEST-SEAM | CONVERGED |
| `orphan:lib/entity-signal.ts:planEntitySubjectReclamation` | orphanExport | reached only by specs — deliberate seam | TEST-SEAM | CONVERGED |
| `orphan:lib/path-notifier.ts:resetPathNotifier` | orphanExport | reached only by specs — deliberate seam | TEST-SEAM | CONVERGED |
| `orphan:lib/audit/audit.ts:createAuditTracker` | orphanExport | reached only by specs — deliberate seam | TEST-SEAM | CONVERGED |
| `orphan:lib/internals/commit-consequence.ts:deferCommitConsequence` | orphanExport | reached only by specs — deliberate seam | TEST-SEAM | CONVERGED |
| `orphan:lib/internals/commit-consequence.ts:deferOperationConsequence` | orphanExport | reached only by specs — deliberate seam | TEST-SEAM | CONVERGED |
| `orphan:lib/internals/enhancer-requirements.ts:findEnhancerConfigurationProblems` | orphanExport | reached only by specs — deliberate seam | TEST-SEAM | CONVERGED |
| `orphan:lib/internals/materialize-markers.ts:hasUnregisteredSymbolKeys` | orphanExport | reached only by specs — deliberate seam | TEST-SEAM | CONVERGED |
| `orphan:lib/internals/materialize-markers.ts:ordinaryBranch` | orphanExport | reached only by specs — deliberate seam | TEST-SEAM | CONVERGED |
| `orphan:lib/internals/materialize-markers.ts:materializeMember` | orphanExport | reached only by specs — deliberate seam | TEST-SEAM | CONVERGED |
| `orphan:lib/internals/node-shape.ts:nodeStoreOf` | orphanExport | ?? called inside its own file: the EXPORT is unnecessary, but that says nothing about who owns the code | UNKNOWN | REVIEW |
| `orphan:lib/internals/observation-substrate.ts:observationStateForTesting` | orphanExport | reached only by specs — deliberate seam | TEST-SEAM | CONVERGED |
| `orphan:lib/internals/owner-invalidation.ts:ownerInvalidationStateForTesting` | orphanExport | reached only by specs — deliberate seam | TEST-SEAM | CONVERGED |
| `orphan:lib/internals/path-observation-port.ts:resetPathDeliveryRuntime` | orphanExport | reached only by specs — deliberate seam | TEST-SEAM | CONVERGED |
| `orphan:lib/internals/production-substrate-stats.ts:installProductionSubstrateStatsForTesting` | orphanExport | reached only by specs — deliberate seam | TEST-SEAM | CONVERGED |
| `orphan:lib/internals/production-substrate-stats.ts:clearProductionSubstrateStatsForTesting` | orphanExport | reached only by specs — deliberate seam | TEST-SEAM | CONVERGED |
| `orphan:lib/internals/production-substrate-stats.ts:resetProductionSubstrateStatsForTesting` | orphanExport | reached only by specs — deliberate seam | TEST-SEAM | CONVERGED |
| `orphan:lib/internals/subject-restoration-claims.ts:createSubjectRestorationClaims` | orphanExport | reached only by specs — deliberate seam | TEST-SEAM | CONVERGED |
| `orphan:lib/internals/tree-capabilities.ts:assertTreeCapabilityGraphAcyclic` | orphanExport | reached only by specs — deliberate seam | TEST-SEAM | CONVERGED |
| `orphan:lib/internals/causal-runtime/confirmed-redo.ts:redoConfirmedAt` | orphanExport | reached only by specs — deliberate seam | TEST-SEAM | CONVERGED |
| `orphan:lib/internals/causal-runtime/confirmed-undo.ts:undoConfirmedAt` | orphanExport | reached only by specs — deliberate seam | TEST-SEAM | CONVERGED |
| `orphan:lib/internals/causal-runtime/greenfield-transactions.ts:createGreenfieldTransactionDraft` | orphanExport | reached only by specs — deliberate seam | TEST-SEAM | CONVERGED |
| `orphan:lib/internals/causal-runtime/subject-reclamation-coordinator.ts:reclaimSubject` | orphanExport | reached only by specs — deliberate seam | TEST-SEAM | CONVERGED |
| `orphan:lib/internals/causal-runtime/subject-reclamation-coordinator.ts:reclaimAvailableSubjects` | orphanExport | reached only by specs — deliberate seam | TEST-SEAM | CONVERGED |
| `orphan:lib/internals/causal-runtime/target-transition.ts:applyCollectionOrderDelta` | orphanExport | reached only by specs — deliberate seam | TEST-SEAM | CONVERGED |
| `orphan:lib/internals/causal-runtime/transaction-capture-bridge.ts:toExplicitTransactionEffect` | orphanExport | reached only by specs — deliberate seam | TEST-SEAM | CONVERGED |
| `orphan:lib/internals/causal-runtime/transaction-capture-bridge.ts:createTransactionCaptureBridge` | orphanExport | reached only by specs — deliberate seam | TEST-SEAM | CONVERGED |
| `orphan:lib/internals/diagnostics/diagnostic-journal.ts:createDiagnosticJournal` | orphanExport | reached only by specs — deliberate seam | TEST-SEAM | CONVERGED |
| `orphan:lib/physical/physical-value-pool.ts:emptyPhysicalValuePool` | orphanExport | reached only by specs — deliberate seam | TEST-SEAM | CONVERGED |
| `orphan:lib/physical/physical-value-pool.ts:preparePhysicalValueTarget` | orphanExport | reached only by specs — deliberate seam | TEST-SEAM | CONVERGED |
| `orphan:lib/physical/physical-value-pool.ts:preparePhysicalValueRelease` | orphanExport | reached only by specs — deliberate seam | TEST-SEAM | CONVERGED |
| `orphan:lib/physical/physical-value-pool.ts:valueHandleForSubject` | orphanExport | reached only by specs — deliberate seam | TEST-SEAM | CONVERGED |
| `orphan:lib/physical/subject-record-target.ts:composePreparedSubjectUpdates` | orphanExport | reached only by specs — deliberate seam | TEST-SEAM | CONVERGED |
| `orphan:lib/physical/subject-record-target.ts:preparePhysicalSubjectTarget` | orphanExport | reached only by specs — deliberate seam | TEST-SEAM | CONVERGED |
| `orphan:lib/physical/subject-record-target.ts:preparePhysicalSubjectSlotTarget` | orphanExport | reached only by specs — deliberate seam | TEST-SEAM | CONVERGED |
| `orphan:lib/physical/subject-record-target.ts:preparePhysicalSubjectValueRelease` | orphanExport | reached only by specs — deliberate seam | TEST-SEAM | CONVERGED |
| `orphan:lib/physical/subject-record-target.ts:preparePhysicalSubjectValueReleases` | orphanExport | reached only by specs — deliberate seam | TEST-SEAM | CONVERGED |
| `orphan:lib/physical/subject-record-target.ts:preparePhysicalSubjectForget` | orphanExport | reached only by specs — deliberate seam | TEST-SEAM | CONVERGED |
| `orphan:lib/physical/subject-record-target.ts:preparePhysicalSubjectForgets` | orphanExport | reached only by specs — deliberate seam | TEST-SEAM | CONVERGED |
| `orphan:lib/physical/subject-record-target.ts:assertPhysicalSubjectSlots` | orphanExport | reached only by specs — deliberate seam | TEST-SEAM | CONVERGED |
| `bare-module:core/lib/signal-tree.ts` | bareModule | universal LocationRuntime replaced framework signal/isSignal/untracked/computed dependencies | KERNEL | CONVERGED |
| `bare-module:core/lib/internals/location-runtime.ts` | bareModule | kernel-owned location values, dependency graph, equality and publication; bare-required and framework-free | KERNEL | CONVERGED |
| `bare-module:core/lib/internals/tree-scalar-slot-runtime.ts` | bareModule | BM-A: lib/internals/tree-scalar-slot-runtime.ts has no separately adjudicated job beyond kernel construction; the bare tree requires it | KERNEL | CONVERGED |
| `bare-module:core/lib/internals/materialize-markers.ts` | bareModule | DIAGNOSTIC + KERNEL co-location with NO runtime Angular import and 8 ngDevMode-guarded sites; co-location alone is not a defect and no cost or coupling discriminator says otherwise | KERNEL | CONVERGED |
| `bare-module:core/lib/constants.ts` | bareModule | DEV-ENV: no runtime Angular import; the mix is build/dev policy (ngDevMode) feeding diagnostic message tables. Fix the S4 convergence point, then re-evaluate — do not split first | KERNEL | REIMPLEMENT |
| `bare-module:core/lib/utils.ts` | bareModule | framework observation and Angular DI moved to facade packages; this module now contains only kernel traversal and snapshot utilities | KERNEL | CONVERGED |
| `bare-module:core/lib/internals/owned-mutation.ts` | bareModule | intrinsic location mutation capture replaced framework tracking suppression | KERNEL | CONVERGED |
| `bare-module:core/lib/internals/utilities/deep-equal.ts` | bareModule | BM-A: kernel-internal equality utility required by the bare tree | KERNEL | CONVERGED |
| `bare-module:core/enhancers/index.ts` | bareModule | BM-A: enhancers/index.ts has no separately adjudicated job beyond kernel construction; the bare tree requires it | KERNEL | CONVERGED |
| `bare-module:core/lib/internals/tree-scalar-leaf-runtime.ts` | bareModule | ?? not yet ruled (bareModule, 1386 B in bare) | UNKNOWN | REVIEW |
| `bare-module:core/lib/internals/member-membership.ts` | bareModule | BM-A: every adjudicated job in lib/internals/member-membership.ts is KERNEL; the bare tree requires it | KERNEL | CONVERGED |
| `bare-module:core/lib/internals/utilities/is-built-in-object.ts` | bareModule | BM-A: kernel-internal built-in-object utility required by the bare tree | KERNEL | CONVERGED |
| `bare-module:core/lib/internals/tree-capabilities.ts` | bareModule | BM-A: every adjudicated job in lib/internals/tree-capabilities.ts is KERNEL; the bare tree requires it | KERNEL | CONVERGED |
| `bare-module:core/lib/internals/position-registry.ts` | bareModule | BM-A: every adjudicated job in lib/internals/position-registry.ts is KERNEL; the bare tree requires it | KERNEL | CONVERGED |
| `bare-module:core/lib/internals/merge-derived.ts` | bareModule | derived recipes are realized by the kernel LocationRuntime with no framework predicate | KERNEL | CONVERGED |
| `bare-module:core/lib/internals/snapshot-authority.ts` | bareModule | ?? not yet ruled (bareModule, 576 B in bare) | UNKNOWN | REVIEW |
| `bare-module:core/lib/internals/mutation-capture-runtime.ts` | bareModule | BM-A: every adjudicated job in lib/internals/mutation-capture-runtime.ts is KERNEL; the bare tree requires it | KERNEL | CONVERGED |
| `bare-module:core/lib/internals/node-shape.ts` | bareModule | BM-A: every adjudicated job in lib/internals/node-shape.ts is KERNEL; the bare tree requires it | KERNEL | CONVERGED |
| `bare-module:core/lib/internals/intrinsic-mutation.ts` | bareModule | ?? not yet ruled (bareModule, 223 B in bare) | UNKNOWN | REVIEW |
| `bare-module:core/lib/internals/owned-metadata.ts` | bareModule | BM-A: every adjudicated job in lib/internals/owned-metadata.ts is KERNEL; the bare tree requires it | KERNEL | CONVERGED |
| `bare-module:core/lib/internals/physical-commit-clock.ts` | bareModule | BM-A: every adjudicated job in lib/internals/physical-commit-clock.ts is KERNEL; the bare tree requires it | KERNEL | CONVERGED |
| `bare-module:core/lib/internals/cell-identity.ts` | bareModule | ?? not yet ruled (bareModule, 191 B in bare) | UNKNOWN | REVIEW |
| `bare-module:core/lib/internals/tree-scalar-slot-port.ts` | bareModule | ?? not yet ruled (bareModule, 170 B in bare) | UNKNOWN | REVIEW |
| `bare-module:core/lib/internals/runtime-tree-plan.ts` | bareModule | BM-A: every adjudicated job in lib/internals/runtime-tree-plan.ts is KERNEL; the bare tree requires it | KERNEL | CONVERGED |
| `bare-module:core/lib/internals/path-observation-port.ts` | bareModule | BM-A: every adjudicated job in lib/internals/path-observation-port.ts is KERNEL; the bare tree requires it | KERNEL | CONVERGED |
| `bare-module:core/lib/internals/observation-substrate.ts` | bareModule | BM-A: every adjudicated job in lib/internals/observation-substrate.ts is KERNEL; the bare tree requires it | KERNEL | CONVERGED |
| `bare-module:core/lib/internals/owner-invalidation-port.ts` | bareModule | ?? not yet ruled (bareModule, 97 B in bare) | UNKNOWN | REVIEW |
| `bare-module:core/lib/internals/observation-adapter.ts` | bareModule | neutral framework-observation port required by kernel-owned locations; implementation remains framework-owned | KERNEL | CONVERGED |
| `bare-module:core/lib/internals/root-source.ts` | bareModule | BM-A: every adjudicated job in lib/internals/root-source.ts is KERNEL; the bare tree requires it | KERNEL | CONVERGED |
| `bare-module:core/lib/enhancer-types.ts` | bareModule | BM-A: every adjudicated job in lib/enhancer-types.ts is KERNEL; the bare tree requires it | KERNEL | CONVERGED |
| `bare-module:core/lib/write-context.ts` | bareModule | BM-A: every adjudicated job in lib/write-context.ts is KERNEL; the bare tree requires it | KERNEL | CONVERGED |
