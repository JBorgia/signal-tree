# External architecture comparison: coherence, ownership and publication

October 6, 2026. Research checkpoint, not an implementation selection or release approval.

## Scope and evidence

The owner requested external research before continuing permanent repairs. Further implementation changes are paused; already-running verification may finish. Existing edits and red results are preserved. No package, compatibility contract, budget or release decision changes through this report.

Local base: `8e5be3dd02c2398e1c68542883b4e3ea68d2c595`, branch `fix/v15-permanent-repairs`, with uncommitted repairs. This is not an exact-commit qualification. Source SHA-256 inventory: `/private/tmp/st-permanent-repairs/external-research-source.json`.

Owner premise, verbatim: **“Fresh SignalTree reads; preserve native computed timing (recommended).”** Current controller additionally preserves stable-v15 behavior, direct reads/writes, framework-native carriers, optional transaction/restoration capability, and no cross-tree atomicity promise.

Evidence classes:

- **Executed local:** the latest focused prepared-publication run has 150 passes and one failure, exit 1. It fixes five earlier omitted-collection controls and passes the mixed collection/scalar preparation control. The remaining update-only callback sees `[0,2]`, not the test's expected `[0,0]`. Logs: `/private/tmp/st-permanent-repairs/prepared-publication-first.log`; generating command: `pnpm nx test kernel --maxWorkers=1 prepared-projection-publication entity-tap-reads projection-transaction-current absent-collection target-transition` with Node 24.15.0 and the worktree environment.
- **Source inference:** update-only compensation can use `applyAtomically`'s sequential `applyEffect` fallback, rather than the aggregate prepared-target path. B may not have been physically changed when A's tap runs. The failing test does NOT, by itself, establish a stale cache, new regression, or violated existing tap contract. My initial characterization as another projection-cache failure was too broad.
- **External:** official documentation, maintainer source/design material and original research, read October 6. Upstream main/latest URLs are moving references, not pinned executed artifacts. No cross-library performance or conformance benchmark was run for this research.
- **Hypothesis:** proposed transfers and rankings below. External success is not proof of SignalTree integration.

The existing `tools/experiments/transaction-options/RESULTS.md` is essential prior evidence. Its base is `7ade0e3e`, not this checkout. Prepared compensation, sparse contributions, drafts and replay already exist as executed assignment models. They do not establish native callback capture, full enhancer composition or four-framework publication. Do not restart the same scalar whiteboard and call it new evidence.

## The first distinction: three different problems

1. **Read coherence:** does a held reader reflect the storage applicable to this read?
2. **Publication coherence:** which intermediate states may each class of callback observe?
3. **Speculative ownership:** which contribution survives acceptance, rejection or authority ingress?

A signal graph can solve 1–2 without solving 3. A draft or overlay can solve parts of 3 while still publishing incoherently. A publication epoch is not a server revision, and neither establishes a settlement relation.

There is also a specification boundary: a per-write tap, a cache-invalidation hook, an end-of-operation observer, and a durable Link consequence are not interchangeable callbacks. “Fresh” means matching applicable current storage; it does not automatically mean reading a future write that has not executed. Before routing all callbacks through a new commit pipeline, classify the existing guarantees and reentrant-write behavior. Otherwise a new test can quietly impose a new public contract.

## External mechanisms and transfer limits

| System / primary source | What is actually useful | What does not transfer automatically |
| --- | --- | --- |
| [Solid batch](https://docs.solidjs.com/reference/reactive-utilities/batch) | Refresh stale reads on demand while delaying downstream execution; nested batches share completion. | A synchronous batch ends at async suspension. It is not multi-writer rollback or a public Vue batching primitive. |
| [Preact Signals core](https://github.com/preactjs/signals/blob/main/packages/core/README.md) and [implementation account](https://preactjs.com/blog/signal-boosting/) | Separate invalidation, lazy dependency validation, and effect delivery; reuse dependency links and version information. | Replacing SignalTree's graph is not equivalent to preserving framework-native carriers. Its benchmark results are not ours. |
| [Angular signal graph](https://github.com/angular/angular/blob/main/packages/core/primitives/signals/src/graph.ts) | Dirty propagation is a protected phase; graph reads during notification are forbidden. | SignalTree taps intentionally read and can write. They cannot simply become Angular-style graph-notification hooks. |
| [Vue watcher timing](https://vuejs.org/guide/essentials/watchers) | Native sync watchers are deliberately unbatched. Framework timing is a real contract, not an implementation inconvenience. | Updating native dependency carriers early can expose intermediate states. A second kernel graph does not magically solve this bridge. |
| [MobX actions](https://mobx.js.org/actions.html) and [reactions](https://mobx.js.org/reactions.html) | Delay reactions to the outermost action; keep derivations separate from reactions and dispose subscriptions. | Actions are not database rollback. Async continuation requires its own action boundary; reaction ordering is not a dependency mechanism. |
| [TC39 Signals proposal](https://github.com/tc39/proposal-signals) | A low-level notification phase can be separate from framework-owned effects. Watcher notification prohibits signal reads/writes. | Proposal status is not a shipped universal API. Do not expose these restrictions through existing taps without a compatibility decision. |
| [Alien Signals](https://github.com/stackblitz/alien-signals) | Concrete small push/pull algorithm control, with deliberate allocation and recursion constraints. | Does not supply entity lifetime, rollback, restoration or authority. A faster microbenchmark does not establish a better kernel. |
| [React external-store contract](https://react.dev/reference/react/useSyncExternalStore) | Cached immutable snapshots and pre-commit revalidation protect consumers from inconsistent versions. | It may fall back to blocking rendering. It does not make multiple mutable writes atomic or justify imposing React's adapter on Angular. |
| [Compose snapshots](https://developer.android.com/reference/kotlin/androidx/compose/runtime/snapshots/Snapshot) and [Snapshot implementation](https://github.com/JetBrains/compose-multiplatform-core/blob/jb-main/compose/runtime/runtime/src/commonMain/kotlin/androidx/compose/runtime/snapshots/Snapshot.kt) | Mutable handles can access context-specific state records; a private snapshot can apply atomically. Isolation need not imply a reducer API. | Apply conflicts, record retention, disposal and context scope are substantial machinery. Independent native framework graphs remain an integration obligation. |
| [Clojure STM](https://clojure.org/reference/refs) | Read-your-writes, validators, immutable shared structure and one commit point; conflicts retry. | Retrying arbitrary JS callbacks repeats side effects. Ref values must behave immutably. Snapshot isolation is not a proof of all business invariants. |
| [SQLite isolation](https://www.sqlite.org/isolation.html) and [WAL format](https://www.sqlite.org/fileformat2.html) | A clear reader view and commit marker separate installing new content from exposing it. | Database isolation differs from intentionally shared live speculation; neither WAL nor snapshot isolation solves selective rejection by itself. |
| [Replicache](https://doc.replicache.dev/concepts/how-it-works) | Rebase pending mutations over server state privately, then reveal one completed view. Explicit mutation acknowledgements distinguish truth from settlement. | Mutators can run again and produce different results. SignalTree cannot replay arbitrary application closures safely without an explicit replay contract. |
| [Apollo optimistic cache](https://www.apollographql.com/docs/react/performance/optimistic-ui) and [cache batching](https://www.apollographql.com/docs/react/caching/cache-interaction) | Keep optimistic versions distinct from canonical data; remove a named layer with the real-data update in one batch. | Normalized GraphQL identities and update policies do not establish SignalTree's lifetime/rekey semantics or its settlement-order rules. |
| [TanStack DB mutations](https://tanstack.com/db/latest/docs/guides/mutations) | Explicit handler-defined settlement and optimistic layers give a strong control. | Current docs specify whole-row snapshots; older layers can reappear when newer ones stop contributing. That is not SignalTree's authored-precedence law. |
| [Jane Street Incremental](https://github.com/janestreet/incremental/blob/master/src/incremental_intf.ml) | Demand-driven graph membership and a distinct stabilization phase avoid recomputing unobserved results. | Its documented stabilization-error behavior can make the system unusable. SignalTree requires explicit recovery; copying the scheduler is insufficient. |
| [Salsa red-green algorithm](https://github.com/salsa-rs/salsa/blob/master/book/src/reference/algorithm.md) | Distinguish when a value was checked from when it actually changed; equal derived output cuts propagation. | Cached-query assumptions and revision validation do not settle transactions. Broad epochs can create unrelated work without scope/demand controls. |
| [Differential Dataflow paper](https://www.microsoft.com/en-us/research/?p=163907) and [DBSP correctness account](https://www.feldera.com/blog/correctness-at-feldera) | Treat insertions and retractions as explicit changes; compose incremental operators and compare with full recomputation. | Arbitrary setters, overwrite precedence and existence dependencies are not automatically invertible algebra. A relational engine would impose significant code and state cost. |
| [Timely progress](https://timelydataflow.github.io/timely-dataflow/chapter_3/chapter_3_1.html) | Completion requires evidence that no relevant work remains; capabilities express ongoing responsibility. | A distributed partial-order frontier is likely excessive for a single JS tree. Holding capabilities can prevent progress; abandonment cannot be wished away. |
| [Bevy entities](https://docs.rs/bevy_ecs/latest/bevy_ecs/entity/) and [deferred application](https://docs.rs/bevy_ecs/latest/bevy_ecs/schedule/struct.ApplyDeferred.html) | Generational identity prevents stale references from addressing replacement entities; structural application has explicit scheduling boundaries. | Deferred commands do not provide immediate read-your-writes or rollback automatically. Identity generations can wrap; do not equate them with globally unique business IDs. |
| [Linux RCU](https://cdn.kernel.org/doc/html/latest/RCU/whatisRCU.html) | Publishing replacement data and reclaiming old data are separate responsibilities. | RCU is not transaction isolation, merge policy or a JavaScript memory-management implementation. Borrow the lifecycle distinction, not kernel synchronization machinery. |
| [Yjs UndoManager](https://docs.yjs.dev/api/undo-manager) and [Automerge conflicts](https://automerge.org/docs/reference/documents/conflicts/) | Explicit origins and operation identity support selective history and honest conflict inspection. | Origin is not authenticated actor identity. Deterministic convergence is not business correctness; time-window undo grouping is not semantic authorship. |
| [Transactional outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html) | Record consequence responsibility with the state decision, deliver separately, distinguish installed from delivered. | A browser memory queue is not durable. Duplicate delivery needs an idempotency contract; “exactly once” is not obtained by naming a queue an outbox. |
| [MLIR dialect conversion](https://mlir.llvm.org/docs/DialectConversion/) | One structured intermediate form can preserve meaning across specialized backends; legality checks can detect an operation that bypasses required lowering. | A compiler framework itself would be excessive. The useful analogy is a small verified change representation and explicit legal fast paths. |
| [FoundationDB paper](https://www.foundationdb.org/files/fdb-paper.pdf) and [TigerBeetle simulation](https://tigerbeetle.com/blog/2023-07-06-simulation-testing-for-liveness/) | Exercise production mechanisms under controlled schedules and faults; test recovery as well as safety. | A passing abstract model does not prove production refinement. SignalTree still needs actual native-framework tests beyond a deterministic scheduler. |

## Ranked choices for SignalTree

These are engineering judgments, not measured performance scores. Supporting mechanisms are not falsely presented as interchangeable product architectures.

### 1. Shared mutation/publication protocol, specialized storage and native carriers

Best first candidate for the demonstrated v15 problem. Preserve direct writes and the existing storage/lifetime authority. Define the phases and callback classes once, then require every applicable write/reversal/realization path to obey them. Cache invalidation and notification delivery are distinct. Direct single writes should retain a cheap fast path with the same observable rules.

A possible internal representation is a typed change set carrying exact addresses, installed changes, captured context, affected-read invalidations and consequence responsibility. It need not retain a permanent event ledger or expose another public API. A direct write can use a compact specialization; “one protocol” does not require one heavyweight executor or allocation per write.

Pros: targets measured seam failures, keeps adoption and native types, can remove duplicate rules rather than add a feature layer. Cons: routing coverage is the hard part; reentrant taps, hidden membership, post-install exceptions and native sync observers can defeat a simplistic phase diagram. It does not solve overlapping speculative ownership.

Falsifier: a legal mutation route bypasses invalidation, leaks a half-state to a callback promised coherent state, or changes existing per-write tap semantics unintentionally. Reject this design if its implementation merely adds another coordinator while old paths still own competing rules.

### 2. Sparse contributions over committed state, feeding the same publication protocol

Leading mechanism to investigate for v16 shared-live speculation, not a new v15 patch assumption. Keep authored precedence independent of settlement time. Resolve surviving contributions into a target and publish through the common boundary.

Pros: targets the historical baseline-versus-ownership failure directly; direct field reads can remain. Cons: structural support, authoritative ingress, partial payloads, reentrancy and retention remain hard. The existing frontier experiment already exposes these limitations. A full dependency graph is not yet justified.

Falsifier: rejected predecessor resurfaces, older confirmation displaces newer truth, or retirement metadata grows without a live obligation. Next evidence must be real composition on the stronger incumbent, not another scalar-only prototype.

### 3. Snapshot/draft engine with atomic merge

Strongest alternative when review should be isolated. Compose is a more revealing comparison than a reducer store: mutable-looking handles and private versions can coexist.

Pros: discard does not compensate live state; a clear publication point; supports review isolation. Cons: not a transparent replacement for live optimistic behavior; merge/conflict UX, held references, native integration and version reclamation become central. A snapshot per ordinary write would be an unmeasured tax.

Falsifier: disjoint merges need app-side conflict reconstruction, lifetime replacement retargets an old handle, or private storage escapes before acceptance. Evaluate against the draft profile, never award failure for not satisfying a contradictory live-visibility profile.

### 4. Replay/rebase of explicit operations

Replicache-style private recomputation is attractive for network-authoritative applications.

Pros: coherent rebuild over server state and explicit acknowledgements; a full-recompute oracle is straightforward. Cons: executable operations need deterministic/replay-safe behavior; captured assignments and re-running user intent are different semantics. This is a product/API constraint, not an internal optimization.

Falsifier: replay repeats an external side effect or changes meaning due to uncaptured reads/context. Not recommended for silently re-executing existing transaction callbacks.

### 5. Replace the neutral reactive engine with a mature small signals core

Useful control, not the leading remedy. Benchmark Preact/Alien-style machinery against the neutral layer if measurements show that layer is expensive or unreliable.

Pros: less custom graph code; mature dependency algorithms. Cons: native adapters, identity, structural planning, rollback and consequence delivery remain ours. It can add another graph instead of removing one. No evidence yet that swapping the engine repairs the current cross-subsystem problem.

### 6. Differential/incremental collection engine

Targeted future option for measured expensive filters, ordering and aggregates; not a replacement for state semantics.

Pros: changes can update views without rebuilding whole collections. Cons: arbitrary predicates and mutable entity values require careful dependency capture; memory/index costs can dominate small stores. Rejection is not simply a negative delta for arbitrary overwrite semantics.

### 7. CRDT core, full event sourcing or a general distributed database

Not supported as the default direction. They answer broader replication/durability problems and impose data/retention/conflict contracts. They might be optional integrations if application demand earns them. The null control remains the current direct state library with conservative transaction safety, not the deletion of shipped APIs.

## Most promising synthesis — hypothesis, not a new product promise

The high-upside idea is a small common change protocol, not a universally clever rollback function:

- stable typed location/lifetime identity;
- explicit operation context captured before deferral;
- storage installation with an unambiguous completion boundary;
- read invalidation independent of callback scheduling;
- distinct per-write hooks, coherent observers and durable consequences;
- settlement changes authority only according to its own outcome;
- state for pending work, undo and diagnostics retained under separate obligations.

Native frameworks remain responsible for their own computations/effects. Long-lived pending owners, if enabled, feed this protocol rather than owning a second physical publication path. A plain store must not pay for speculative ownership, retained history or network causality.

This combines established ideas; there is no evidence for claiming a novel algorithm or guaranteed size/performance win. The potential breakthrough for SignalTree would be making semantic preservation compositional and mechanically testable at its boundaries.

## Experiments that would change the ranking

1. Classify every callback/write route by its actual contract. In particular, determine whether the current update-only tap observation is allowed per-write behavior or an operation-coherence gap. Preserve the red; do not redefine the contract merely to get green.
2. Compare two bounded publication candidates on identical tests: current in-place storage with shared phase enforcement, versus a private prepared view with atomic publication. Use real collections, scalar slots, omitted members, held readers and all native facades. No new speculative ownership needed for this comparison.
3. Include read-inside-group, reentrant write, callback throw after installation, failed preparation, retry, destroy, and independent-tree demand. Check positive observer counts and subsequent useful operations so silence cannot pass.
4. Build a small reference state machine and seeded trace generator around production entry points. Vary synchronous/microtask/native-sync delivery and inject faults at named boundaries. Minimize failing traces. Separately mutation-test skipped invalidation, early callback, duplicate installation and premature authority retirement.
5. Measure fresh artifacts: plain scalar, plain entity, transaction, restoration and combined workloads separately; cold/warm reads, mutation counts, allocation/retention and bundle contribution. No comparison copied from upstream charts. The old Angular callable-write benchmark was a read workload; keep that correction explicit.
6. Only after publication composition survives, re-run the existing v16 ownership candidates against the integrated incumbent. The incremental cost and successful operations beyond safe refusal determine value.

No more broad speculative laws are needed. The immediate research has identified mechanisms and discriminators; the next useful evidence is at the actual integration boundaries.

## Independent review and correction

Two distinct read-only reviews were received; neither selected production architecture or ran external benchmarks.

- Local boundary review: `/private/tmp/st-permanent-repairs/projection-final-review.md`. It confirms that existing taps describe per-write lifecycle observation, not a universal completed-reversal snapshot. Therefore the remaining `[0,2]` assertion must not justify a forced tap-timing change. It also identifies a separate, unexecuted concern: the physical-row access scope may outlive the inner observer-delivery group. That needs a positive hidden-row subscriber test, not just a final-state assertion.
- External transfer review: `/private/tmp/st-permanent-repairs/external-independent-review.md`. Using the same owner premise without this report's ranking, it identifies push invalidation/pull recomputation as the closest freshness mechanism, Compose as a preparation/isolation precedent, Replicache as conditional on replay semantics, and MobX as a control demonstrating that batching is not rollback. It explicitly cautions that Solid's native timing includes refresh on demand: preserving native timing must not force a stale result.

The local review changes the interpretation of the latest red, not the recorded test result. It is still a failed proposed assertion. It is not yet a demonstrated product defect. This distinction is part of the systemic finding: tests can also conflate callback contracts. All further implementation remains paused at this research checkpoint.
