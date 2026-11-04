# SignalTree v16 — Architectural alternatives review

Repository: [JBorgia/signal-tree — codex/v16-runtime-attribution](https://github.com/JBorgia/signal-tree/tree/codex/v16-runtime-attribution?utm_source=chatgpt.com)

I've located the correct repository and inspected the pushed branch, its runtime implementation, governing architecture, cost attribution, and four-way competitive comparison. The branch is 90 commits ahead of `main`.

## Executive assessment

I would stop optimizing the existing publication pipeline in its current form. I would not abandon the v16 semantics.

The fundamental issue is architectural: v16 represents publication responsibility through several overlapping, relatively expensive structures, and ordinary writes participate in that machinery.

The important discovery is that the responsibility itself is necessary in certain cases, but the current representation is not proven necessary.

The next design should attempt to make ordinary state updates inexpensive while preserving the ability to reconstruct exact responsibility when transactions, overlapping changes, or later consumers require it.

### What the source actually shows

The primary implementation areas are:

| Source                                                                                                                                                                                                  | What it currently does                                                                                | Opportunity                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| [experimental-publication/entity.ts](https://github.com/JBorgia/signal-tree/blob/codex/v16-runtime-attribution/packages/kernel/src/lib/experimental-publication/entity.ts?utm_source=chatgpt.com)       | Maintains field, membership, placement, ordinary/physical view and mapping support                    | Reduce overlapping representations                      |
| [experimental-publication/lifecycle.ts](https://github.com/JBorgia/signal-tree/blob/codex/v16-runtime-attribution/packages/kernel/src/lib/experimental-publication/lifecycle.ts?utm_source=chatgpt.com) | Tracks owners, requirements, frames, inputs, proofs, settlement and retirement                        | Compact responsibility history                          |
| [internals/entity-publication.ts](https://github.com/JBorgia/signal-tree/blob/codex/v16-runtime-attribution/packages/kernel/src/lib/internals/entity-publication.ts?utm_source=chatgpt.com)             | Admits packets, coordinates native and recipient preparation, validation, installation and completion | Specialize common paths without losing lifecycle guards |
| [internals/entity-egress-projection.ts](https://github.com/JBorgia/signal-tree/blob/codex/v16-runtime-attribution/packages/kernel/src/lib/internals/entity-egress-projection.ts?utm_source=chatgpt.com) | Holds eligible projection state and contributor support                                               | Reduce copying and projection maintenance               |

For example, the native entity participant keeps multiple long-lived maps keyed by subject or field. A single admitted row update also creates temporary maps, selected evidence, view snapshots and terminal installation records.

This is substantially more than a single field write, even when there is no active external recipient.

The experiment measured 13,000 work-counter visits across 200 writes, with 55 attributed paths and no unexplained counter charges. Its one copy-elimination prototype reduced the counter to 12,600 but established no accepted CPU or persistent-heap improvement. [Attribution report](https://github.com/JBorgia/signal-tree/blob/codex/v16-runtime-attribution/docs/audits/2026-11-03-runtime-responsibility-attribution/README.md?utm_source=chatgpt.com)

### The constraint we must respect

The late-consumer tests establish that an ordinary write made before a consumer attaches may carry information needed while another transaction is pending. Discarding that information merely because there are no current subscribers produces incorrect publication.

Consequently, lazy observation alone is not the solution.

We need one of three stronger ideas:

- A substantially smaller representation that preserves the necessary historical facts.
- A representation in which pending ownership carries most of the work, while ordinary state updates remain cheap.
- A different transactional architecture that preserves the desired application outcomes with less machinery, potentially changing some v16 contracts.

I'll distinguish these choices below rather than pretending all alternatives can be substituted without semantic consequences.

## 1. Forty alternatives worth evaluating

These are design hypotheses, not demonstrated improvements. I've separated them by which part of the architecture they would replace.

I would prioritize the first two groups because they offer the most plausible path to preserving v16's current guarantees while materially changing its economics.

In the tables, contract-preserving means the proposal is intended to preserve the current observable semantics. That remains unproven until the relevant conformance tests pass.

### A. Replace the responsibility-history algorithm

These attack the core problem: how to remember the minimum historical facts a future consumer might need.

| #  | Alternative                           | Potential advantage                                                                                             | Main difficulty                                                                      |
| -- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1  | Tree-scoped epoch stamps              | Record a small version/window reference on each changed location instead of preparing complete proof structures | Epochs must preserve exact owner and occurrence identity                             |
| 2  | Sparse pending-owner journal          | Retain detailed history only while unresolved owners could affect future publication                            | Must distinguish genuinely irrelevant history from history needed by a late consumer |
| 3  | Per-location MVCC chains              | Keep compact historical versions of touched locations; read the appropriate version during validation           | Version cleanup, structural changes and memory retention                             |
| 4  | Checkpoint plus delta history         | Store a stable baseline and subsequent changed facts instead of repeatedly copying complete row maps            | Correct reconstruction after rollback, rekey and repeated edits                      |
| 5  | Persistent proof DAG                  | Share immutable proof components between related writes and consumers                                           | Avoid expensive recursive proof evaluation and accidental retention                  |
| 6  | Lazy proof evaluation                 | Store the inputs and historical references needed for proof; calculate the detailed proof only when requested   | Those inputs must be frozen against subsequent ownership changes                     |
| 7  | Owner-to-location dependency index    | Settle only locations depending on an owner, rather than repeatedly traversing unrelated state                  | Exact dependency registration, removal and lifecycle                                 |
| 8  | Compact responsibility-role encoding  | Replace repeated owner arrays and role-specific structures with compact role references or bitsets              | Cannot collapse unknown, possible, destination, input and validation semantics       |
| 9  | Horizon-scoped history retention      | Hold historical detail for the lifetime of relevant unresolved windows, then reclaim it                         | Must preserve evidence while historical references remain legally live               |
| 10 | Generation-stamped absence/tombstones | Preserve removal, reappearance and key-reuse facts without full historical row maps                             | Negative evidence and old/new subject isolation                                      |

My first choice in this group is #1 combined with #2 and #9.

A changed location could retain a small immutable reference to the owner window that existed when the write occurred. Detailed proof material would live in a sparse window ledger instead of being reconstructed and copied on every ordinary write.

The important condition is that a terminal owner must not retroactively change the historical membership of a captured window.

### B. Replace the persistent data representation

These target live heap as well as CPU, especially the separate `fields`, `views`, membership and mapping structures currently retained by the entity participant.

| #  | Alternative                             | Potential advantage                                                                                | Main difficulty                                                                         |
| -- | --------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 11 | Fused ordinary/physical field cells     | Store both kinds of responsibility in one per-field record, rather than separate nested maps       | Must retain the distinction between physical truth and ordinary publication eligibility |
| 12 | Integer fact handles and a shared arena | Replace repeated object references, wrappers and map entries with compact IDs                      | Safe reclamation, generation validation and GC interaction                              |
| 13 | Schema-indexed field slots              | Use direct field indices instead of string-keyed maps for known row shapes                         | Dynamic keys and polymorphic rows need a correct fallback                               |
| 14 | Copy-on-write field overlays            | Preserve saved-reader snapshots while recording only changed fields in subsequent versions         | Readers must never observe an overlay that later mutates                                |
| 15 | Small-vector row representation         | For rows with few fields, replace a `Map` with a short array or specialized tuple                  | Performance crossover depends on actual row width                                       |
| 16 | Adaptive row representation             | Small records use compact arrays; larger/dynamic records use maps                                  | Extra shape transitions and implementation complexity                                   |
| 17 | Numeric contributor addresses           | Replace `${subject}:f:${key}` strings with stable numeric location IDs                             | Requires a durable location registry and correct generation changes                     |
| 18 | Sparse ordinary/physical exceptions     | Store one common fact when the two views agree and an exception only when they differ              | Divergence and reconvergence must preserve exact historical evidence                    |
| 19 | Snapshot-on-escape readers              | Reuse internal mutable preparation data until it becomes observable to an independent saved reader | Escape tracking must be exact; aliasing defects would be serious                        |
| 20 | Separate topology from value provenance | Keep structural membership/order facts distinct from cheap field-value updates                     | Structural changes may have consequences for ordinary field eligibility                 |

\#11 and #18 deserve particular attention.

The current implementation keeps parallel structures even when ordinary and physical responsibilities frequently agree.

A possible replacement is one `FieldFact` containing two independently addressable references:

```
interface FieldFact {
  subjectId: number;
  generation: number;
  ordinary: FactRef;
  physical: FactRef;
}
```

When the two references happen to be the same, no second historical object is needed. When they differ, both remain available.

The critical point is that sharing equal references is not the same as declaring the two semantics equivalent.

This could materially reduce the persistent per-row footprint. The size of any gain must be measured.

### C. Replace the preparation and publication pipeline

These alternatives would still use a native responsibility model, but would stop making every write pass through so many generalized layers.

| #  | Alternative                                           | Potential advantage                                                                                           | Main difficulty                                                                 |
| -- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 21 | Single-pass physical/ordinary preparation             | Build paired evidence in one traversal rather than multiple intermediate representations                      | First-physical versus last-ordinary rules and repeated edits                    |
| 22 | Specialized validate/install operation                | Replace generic arrays of `{map, key, value}` terminal edits with a prevalidated operation plan               | Preserve atomic installation, callback reentry and error precedence             |
| 23 | Demand-driven full collection projection              | Avoid generating `Row[]` when only point facts are needed                                                     | Root-only consumers and hidden collections must still receive complete values   |
| 24 | Recipient selection index                             | Prepare only recipients whose declared scope intersects the affected source                                   | Late subscriptions and source-level responsibility still need correct treatment |
| 25 | Revision-keyed proof memoization                      | Reuse unchanged proof results across multiple consumers or accesses                                           | Owner transitions and historical windows must invalidate accurately             |
| 26 | Construction-compiled mutation plans                  | Move capability and shape decisions to tree construction rather than reevaluating generic paths on each write | Runtime structural changes and extension points                                 |
| 27 | Dedicated scalar native pipeline                      | Keep simple scalar stores away from collection-specific machinery                                             | Must preserve native responsibility and cross-source composition                |
| 28 | One-time source metadata admission                    | Avoid repeated metadata copying/freezing when source ownership is already authenticated                       | Mutable alias protection must remain intact                                     |
| 29 | Shared source preparation, local recipient completion | Compute common source facts once while retaining consumer-specific settlement and permissions                 | Cannot centralize consumer-local mutable authority                              |
| 30 | Exact empty-obligation specialization                 | Make the common case cheap when the captured facts prove no unresolved obligation exists                      | Cannot classify emptiness merely from absence of currently attached consumers   |

There is a meaningful distinction between #30 and the failed earlier optimization.

The failed approach effectively assumed that no current consumer meant no relevant historical responsibility.

A correct #30 would require a positive certificate of no outstanding responsibility, including the relevant historical window. It could not simply inspect subscriber count.

Several of these are compatible with one another. For instance, a fused field cell could feed a specialized installer without converting through four maps and multiple generic terminal-record arrays.

### D. Change where the expensive semantics live

These are broader architectural or product alternatives. Some could achieve the application goals much more cheaply, but would require a new contract rather than merely a faster implementation of today's v16 guarantees.

| #  | Alternative                                           | Potential advantage                                                                                            | Contract consequence                                                               |
| -- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 31 | Explicit coordinated-state capability at construction | Basic stores avoid much of the specialized machinery; coordinated stores retain it                             | Ordinary stores cannot later acquire full historical guarantees retroactively      |
| 32 | Domain-scoped responsibility islands                  | Only designated entities/workflows participate in native overlapping settlement                                | Cross-domain guarantees need explicit boundaries                                   |
| 33 | Immutable proposal overlay                            | Agent changes remain separate from committed state until acceptance, dramatically reducing rollback complexity | Changes how speculative edits become visible and interact                          |
| 34 | Versioned backend commands plus simple local state    | C0-style implementation may satisfy many business workflows without the complex native publication engine      | Does not reproduce full same-tree native overlap semantics                         |
| 35 | TanStack DB integration                               | Use existing collections, optimistic transactions and backend settlement mechanisms                            | Requires an adapter and separate proof of SignalTree-specific behavior             |
| 36 | Per-operation MVCC sandbox                            | Each operation works against an isolated snapshot and merges at a controlled boundary                          | Shared speculative visibility and merge semantics change                           |
| 37 | Conflict-domain serial execution                      | Serialize actual conflicting writes while allowing independent domains to proceed                              | Sacrifices some overlapping execution and requires precise conflict classification |
| 38 | CRDT operations for commutative fields                | Certain collaborative operations reconcile without global rollback machinery                                   | Only appropriate for compatible data types and operations                          |
| 39 | Server-authoritative command/event model              | Backend owns durable ordering and acceptance; clients maintain projections                                     | More backend coupling; different offline/optimistic semantics                      |
| 40 | Maintain two explicit product runtimes                | Keep a low-cost v15-style substrate and separately qualify advanced v16 coordination                           | More maintenance, compatibility and conceptual overhead                            |

I would not dismiss #33–35 as inferior merely because they don't reproduce the current native implementation.

Your own [four-arm comparison](https://github.com/JBorgia/signal-tree/tree/codex/v16-runtime-attribution/tools/experiments/multi-actor-operations/comparison?utm_source=chatgpt.com) demonstrates that ordinary commands, application glue, the coordinator and TanStack DB can satisfy the same 44 tested common checks.

However, those tests deliberately do not establish parity for overlapping native speculative edits.

That gap needs its own comparison.

Current TanStack DB documentation explicitly supports optimistic overlays, manual transactions, rollback, and handler-defined backend settlement. It also makes clear that local transaction completion only proves backend confirmation when the handler actually waits for that evidence. So it is a serious alternative architecture, not a trivial collection wrapper.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://tanstack.com\&sz=32)

TanStack DB Docs+1



## 2. How I would rank the most promising directions

Rather than run 40 experiments, I'd narrow the search to a few candidate families.

Strategic shortlist — estimated potential, not measured performance

| Direction                                                            | Potential | Contract |
| -------------------------------------------------------------------- | --------- | -------- |
| Epoch stamps + sparse owner journal<br>Engineering risk: High        |           | Preserve |
| Fused ordinary/physical field facts<br>Engineering risk: Medium–high |           | Preserve |
| Copy-on-write field overlays<br>Engineering risk: Medium–high        |           | Preserve |
| Specialized validate/install pipeline<br>Engineering risk: High      |           | Preserve |
| Shared immutable proof DAG<br>Engineering risk: High                 |           | Preserve |
| Explicit coordinated-state capability<br>Engineering risk: Medium    |           | Change   |
| Proposal overlay + conditional backend<br>Engineering risk: Medium   |           | Change   |
| TanStack DB integration<br>Engineering risk: Medium                  |           | Change   |

The first five are potential ways to retain existing semantic promises. The next two are potentially better product architectures if those promises prove too expensive or insufficiently valuable.

TanStack integration is worth testing, but I wouldn't make it the default replacement without a direct demonstration that it handles the difficult overlapping workflow better.

## 3. The architecture I would prototype first

I would combine #1, #2, #11 and #18 into a single candidate called Sparse Responsibility Runtime.

SignalTree state and identity

Authoritative values, subjects and locations

Compact field facts

Ordinary and physical references, generation, version, window identity

Sparse owner windows

Captured unresolved ownership and immutable dependency bounds

Proof construction when required

Uses frozen source facts, not reconstructed current truth

Validate → Install → Complete

Exact source and recipient lifecycle

In this design, an ordinary field write would record a compact fact tied to its exact subject lifetime and captured responsibility window. If there were no relevant pending ownership, the fact could be cheaper than a complete prepared proof.

A consumer attaching later would use the stored references to evaluate the obligations that existed at the write's original boundary. Crucially, the consumer would not reinterpret history using whichever owners happen to be pending now.

Detailed records would be created when needed for publication, responsibility combination or restoration.

The retained evidence would be compacted only when every legitimate consumer and unresolved ownership boundary had released its claim.

This would be a fundamentally different representation from today's multiple maps and eager proof compositions.

### The critical correctness trap

A compact epoch is not enough by itself.

Consider two histories that leave the same current value but differ in whether a foreign transaction was pending during an earlier write.

If we erase everything that distinguishes those histories, a late consumer sees identical input in both cases. Yet the correct publication decision can differ.

Therefore, any exact solution must retain at least enough information to distinguish the histories until that distinction is no longer observable.

That is a genuine information requirement.

It is not a proof that the current 13,000 work visits, row-map copies, or persistent per-field wrappers are necessary.

## 4. Three competing implementations—not forty experiments

I would implement three small isolated alternatives against the frozen source, without integrating any until one survives both correctness and cost tests.

| Candidate                     | Design                                                                  | Question it answers                                                                              |
| ----------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| A — Sparse Responsibility     | Epoch/window references, sparse owner journal, fused field facts        | Can we preserve native guarantees with dramatically less ordinary-work overhead?                 |
| B — Shared Immutable History  | Persistent proof DAG, copy-on-write overlays, selective materialization | Does structural sharing outperform source-record copying while preserving saved-reader identity? |
| C — Proposal-First Operations | Immutable proposals, ordinary local state, versioned backend acceptance | Do we actually need native speculative overlap for the target application workflows?             |

These should not share an implementation whose overhead would conceal a losing design. They should share the same behavioral oracles.

### Decisive acceptance gates

For A and B, I would preserve every currently meaningful native contract, especially:

- Late consumer during a foreign pending owner, followed independently by confirmation and rollback.
- Independent sibling-field publication.
- Repeated-subject and same-unit physical/ordinary pairing.
- Hidden collection restoration, negative membership and subject key reuse.
- Current and historical owner-role distinctions, including value-neutral semantic transitions.
- Reentry, failure precedence, completion, teardown and retained saved-reader correctness.

C should instead be evaluated against the complete business workflow and separately record every native semantic it does not provide.

Cost measurements should distinguish construction, ordinary CPU, point-work, persistent live heap, pending heap, and peak allocation. The existing `<2000` point-work assertion remains unchanged. We should also obtain a freshly identified released-v15 comparison, because the previous two v16 optimization campaigns do not establish the actual released-v15-to-v16 cost.

And each cost gate needs positive and negative controls so a cheaper implementation cannot win by silently omitting required work.

## 5. The experiment I would authorize first

```

id: V16-SPARSE-RESPONSIBILITY-0
profile: P3
status: PROPOSED

question: >
  Can a versioned field-fact representation and sparse
  owner-window ledger preserve all native publication
  semantics while materially reducing ordinary write
  work and live heap?

baseline:
  branch: codex/v16-runtime-attribution
  head: 9a9770a63bbece5267f6c439270209ccaf9ef3ee
  runtime: fe18a8e1c1f3da42727341d6c6fa30a407c1461e

hypothesis: >
  Detailed per-write proof objects and parallel row
  support maps are not necessary to retain exact
  future-consumer responsibility.

falsifiers:
  - premature delivery for late consumers
  - historical owner membership is rebased
  - ordinary and physical facts are conflated
  - stale subject lifetime follows a reused key
  - hidden collection restoration fails
  - value-neutral transitions are lost
  - saved readers observe later writes
  - completion or disposal changes error precedence
  - point-work bound is still exceeded
  - CPU or live heap fails preregistered acceptance

controls:
  - native confirmation and rollback witnesses
  - repeated-subject pairing
  - independent sibling publication
  - hidden collection and negative membership
  - source/recipient reentry
  - retained-reader and teardown tests
  - representative released v15 comparison
  - known-bad mutation controls

constraints:
  - do not weaken native semantics
  - do not increase numerical thresholds
  - do not change stable v15
  - do not activate or publish candidate
  - do not merge results from different cost cohorts

decision:
  PASS: advance to full qualification
  FAIL_CORRECTNESS: reject representation
  FAIL_COST: reject or retain as evidence only
  INCONCLUSIVE: no promotion

```

I would preregister a meaningful improvement requirement before coding. A tiny reduction such as 13,000 to 12,600 is not the outcome we're seeking. The design should first demonstrate the possibility of clearing the existing absolute gate and then establish materially improved CPU and resident memory under controlled workloads.

## 6. Is the goal worth all of this?

There are two different goals, and I would not give them identical answers.

Goal A: Build an extremely good, framework-neutral state engine.

Yes. That is worth protecting. Low ordinary-operation overhead, stable identity, structured data, correctness and framework-independent semantics are foundational to adoption.

Goal B: Make every instance of that state engine carry complete native responsibility history for arbitrary overlapping multi-actor operations.

That is still an open product decision.

There may be real applications that need it. But the current common-outcome comparison has not demonstrated that SignalTree substantially reduces developer burden against ordinary versioned commands or the other evaluated approaches.

This is the competitive falsifier I would add: give independent developers one particularly difficult overlapping workflow and measure how much correct code, instrumentation and recovery handling they need under each architecture.

If SignalTree's native semantics reduce that burden decisively, we have a reason to make them part of the general runtime.

If they don't, an explicitly scoped coordination capability may be a better product—even if it means changing the v16 contract before release.

## Final recommendation

I would pursue these in this order:

1. Sparse Responsibility Runtime — my preferred attempt to preserve the full native contract with lower costs.
2. Fused field facts and copy-on-write history — a structurally different way to reduce duplication and resident memory.
3. Specialized source installation — once the new representation is stable, remove generic composition overhead that the new design no longer needs.
4. Proposal-first comparison — independently test whether a simpler architecture serves the actual multi-actor product use case just as well.

I would not spend more time on isolated map-copy reductions, raising numerical thresholds, postponing everything until Link attachment, or adjusting the point-work counter to make an expensive architecture appear cheap.

My strongest recommendation is to run a small, competitive architectural selection—not another incremental optimization campaign against the same data structures.

The good news is that the v16 program has already produced an unusually demanding set of behavioral tests. Those tests can now be used to judge genuinely different implementations.

The decision we need is no longer whether the existing machinery can be patched into passing. It is which is the least expensive architecture that earns the guarantees SignalTree actually needs to sell.