# Independent existing-snapshot retained-context review

The existing pending/primed snapshots support a **retained code and VM metadata difference**, rather than an additional population of live per-point preparation contexts. They do not establish the cause of the drain-time difference or justify a runtime repair.

## Evidence and generating commands

Compared the eight existing anchor snapshots: primed, pending, confirmed and rolled-back × frozen-before/C9aa. No new workload, cost run or snapshot was generated. `review-contexts.mjs` (packet only) validates each raw snapshot and invokes the frozen calibrated parser for individual retained sizes; it enumerates context slot signatures, their incoming edges, representative target fields, and closure populations. Each snapshot was loaded alone under `guard.py`, Node24.15.0, `--max-old-space-size=1800`; successful guards are `runs/heap-context-*` (pending candidate uses `-rerun`). All successful guards exited0, reported no source mismatches or remaining owned processes; observed RSS remained below 1.09 GB. The initial sandbox guard invocation could not run `/bin/ps`; no parser ran in that attempt. The subsequent guarded invocation had required process-census permission.

Representative command, repeated sequentially by `run-context-review.py` for the six primed/settled inputs:

    python3 guard.py heap-context-confirmed-candidate 300 /Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node --max-old-space-size=1800 review-contexts.mjs children/snapshot-confirmed-candidate/heap.heapsnapshot heap-context-confirmed-candidate.json

`reduce-context-review.py` reduces only the small JSON reports and the campaign's existing `analysis-snapshot-*` censuses into `heap-context-review-summary.json`, including all eight raw input SHA256 identities. HEAP-CALIBRATION.json records the prior parser chain/shared/cycle/weak/actual-Node24 controls and killed weak/conditional mutants. Parser JS/WASM hashes are embedded in each output. No frozen tools/runtime files changed. Heavy parsing is finished; remaining work was small JSON reduction only.

## Additive self-size finding

Use distinct-node **self sizes**, not summed retained sizes. The difference of increments `(C pending − C primed) − (before pending − before primed)` in these particular snapshots is **+59,816 bytes**:

| Snapshot node type | Difference of increments, bytes |
| --- | ---: |
| code | +56,120 |
| array | +6,000 |
| object shape | +1,496 |
| object | +440 |
| string | +352 |
| concatenated string | +32 |
| hidden | −4,624 |
| closure | 0 |
| remaining types | 0 |

Code is about 94% of the net snapshot difference; positive and negative components remain visible above. This +59,816 snapshot result is not interchangeable with the separate repeated-run +63,232-byte pending-increment observation. Snapshots have different measurement boundaries and one sample per checkpoint.

Largest code entries in the difference include `(instruction stream for prepare)` +7,520 B, FeedbackVector +6,296 B, BytecodeArray +4,936 B, TrustedByteArray +4,896 B, `(instruction stream for derive)` +3,776 B, baseline instruction streams +2,880 B, `(instruction stream for commitExistingSubjectValue)` +2,784 B, ScopeInfo +2,440 B, constant pools +1,824 B and `(instruction stream for complete)` +1,728 B. Names like `prepare`/`complete` are shared by several source functions: their labels do not by themselves bind all those bytes to EntityPublicationSource. Code/feedback/bytecode retention is established; a precise causal source-function allocation or compiler-tier explanation is not.

## Context slots and incoming edges

All counted context objects are distinct snapshot nodes, so their self sizes may be added. C exceeds before by **1,216 bytes of context self size at every checkpoint**:

| Checkpoint | Before context self B | C context self B | Difference |
| --- | ---: | ---: | ---: |
| primed | 282,040 | 283,256 | +1,216 |
| pending | 302,520 | 303,736 | +1,216 |
| confirmed | 282,680 | 283,896 | +1,216 |
| rolled-back | 282,680 | 283,896 | +1,216 |

Thus the pending-minus-primed context-self difference is zero. These fixed context changes are source-bound:

* Ten collection contexts have 141 named slots instead of138; additional slots are `advanceCollectionVersion`, `prepareSourcePoint`, `versionCell`. Their context self size is1,208 versus1,176 B each, +320 B over ten collections. Incoming closures include the collection methods already owned by each collection. This is fixed setup layout in these samples.
* Ten native entity contexts have17 named slots instead of11. Added names are `escaped`, `preparing`, `retirementRevisions`, `exposeCompletion`, `retirementRevision`, `nativeRequirement`. Their self sizes are192 versus144 B each, +480 B total. Incoming closure→context edges are ordinary internal `context` edges from `prepare`, `preparePoint`, `complete`, `expose`, `prepareRetirement`, `retire`, evidence/capture/inspect helpers and the added helpers. Slot→target edges are explicit named context edges to the Maps/WeakSets/WeakMaps/functions. These facts match the source's participant-scoped machinery, not a per-owner journal.
* C has ten extra40-byte `this` contexts, with named context slot `this`→EntityPublicationSource and an anonymous closure's internal `context` incoming edge. They are consistent with construction-bound issuer arrows. Population is already present at primed and remains unchanged during authoring/settlement: +400 B fixed.
* Lifecycle module context grows392 versus376 B, +16 B; the additional slots are the snapshot-cache function/state. These four changes account for the1,216 B context difference, using only distinct context self sizes.

No contexts with point/generic preparation signatures (`targetFields`, `targetViews`, `selectedAt`, `nextFields`, `nativeUnit`, `pointRow`) survived in any of the eight contexts inventories. `prepare` closure count stays203 in both variants/all checkpoints; candidate `preparePoint`11 versus before1 and `nativeRequirement`10 versus0 are fixed method/helper populations. Closures named `seal` stay2 in both/all checkpoints; names alone are not source-unique. This is evidence against a growing retained per-point closure/context population in these sampled heaps, not proof that every opaque completion is absent under all workloads.

## Qualified individual retained sizes, not additive attribution

The calibrated engine reports these representative native-context values; they overlap all their reachable/dominated targets and must **not** be added to table self sizes or to each other as a group claim:

| Checkpoint | Before representative native context retained B | C representative retained B |
| --- | ---: | ---: |
| primed | 1,054,720 | 1,055,392 |
| pending | 1,053,728 | 1,054,624 |
| confirmed | 1,062,592 | 1,068,104 |
| rolled-back | 1,054,720 | 1,055,584 |

The table uses the first sampled context from each phase/group, not identity-matched collection pairs across separate snapshots; the JSON preserves up to two representatives. Incoming edges and exact slot targets are preserved in `heap-context-STATE-VARIANT.json`.

In the first sampled C native context, `escaped`, `preparing`, and `retirementRevisions` each report136 B retained at all four checkpoints. `exposeCompletion` reports136 B at primed and328 B at pending/confirmed/rolled-back. That is a concrete small changed weak-container retained footprint in this sample; it does not establish live completion-key counts or justify summing weak-container retained sizes as the pending regression. Ordinary fields Map representative retained values match before/C at each checkpoint (404,504 primed;404,024 pending;404,904 confirmed;404,504 rolled-back); physical fields Map is332,744 in each. No array/Map ownership inference was made with BFS.

Campaign field-shape candidate counts likewise match native requirements:214 primed,314 pending,314 confirmed,214 rolled-back in both variants. Endpoint/physical-View shape counts also match. These broad overlapping shapes are not exact ownership classification, but do not support a candidate-only100-owner requirement population.

## Finite interpretation

Source-supported fixed cost: candidate adds collection/issuer/native/module context slots and participant weak machinery. Snapshot-supported pending excess: chiefly retained compiled code/VM metadata, with a small non-code residue. No supported conclusion identifies an owner journal leak, retained packet/point-unit population, deferred publication or GC as the cause. No timing attribution follows from retained-code bytes, and settled snapshots do not retroactively show which work consumed drain CPU. A repair selected solely on a completion-retention/owner-context hypothesis would contradict the dominant evidence here. Keep diagnostic and qualification conclusions separate; no runtime change is proposed by this review.
