# Read-only successor sketch: selected endpoint versus invocation validation

Proposal for independent premise review only. REPORT.md and frozen runtime remain unchanged. No compaction code, receipt-policy change, new tests or runtime execution accompanies this sketch. Base is the frozen C24 prototype manifest cb54add521dafd9ec875b87d6c19f85de38e4b56d0c79c147a7c3c3e41306bcd; its measured129/513 growth is the counterexample being addressed.

## Smallest proposed representation

Do not store a composite of the old selected endpoint and every new equal invocation. Preserve two existing facts with separate lifetimes:

1. **Selected ordinary endpoint**, source-owned: complete value/presence/owner-binding/requirement selected by existing scalar admission and inverse/fold. When admission says retain-before, retain that exact endpoint, including ALL inherited D/I/V/W, rejected-role evidence and readiness. This is not a snapshot of only pending D and not a new owner ledger.
2. **Invocation requirement**, attempt-owned: current captured updater/branch inputs and declaration horizon. Prepare/finalize/install its validation bookkeeping as today. Keep it in the prepared publication unit and existing declaration/operation lifecycle, not as another permanent parent of nativeValues. When admission really selects a proposal, that proposal's requirement becomes the selected source requirement normally.

The frozen prototype already distinguishes selected support from the current invocation in prepareRevision. The candidate simplification is to stop combining the invocation into retained source storage. It is selection, not post-hoc graph compaction: no flattening, owner-status filtering, proof-history scan or new dependency graph.

Proposed internal prepared fact:

    { selectedEndpoint, invocationRequirement,
      ordinaryPredecessor, physicalViewPlan, validate }

For retain-before, nativeValues stores selectedEndpoint unchanged. For a genuine new admitted endpoint, it stores the proposal. For net-zero/inverse, it stores the endpoint selected from the existing effect pair. Physical views use the selected requirement and their own identity rules below. Current invocation inputs are never reconstructed from old source proof.

## Evidence and exact policy boundary

EntityMap is the closest existing implementation: transactions.ts selects before for no-effect owner-bearing fields; publication/entity.ts installs chosen(edit,key), preserving the complete endpoint, while preparing the invocation requirement and validation record separately. Scalar parity should follow that admission distinction, not add a source-history cleanup algorithm.

The reviewed CURRENT-SPEC forbids erasing native destination/input/validation obligations and says no relevant authorship yields no-write. Therefore p plus inherited q remains p+q even after a retaining literal call. p confirmation must not release q. The proposal does not remove old failed/unknown evidence from a selected owned endpoint. Unowned equal fresh admission remains distinct and may replace prior failed/possible-only support as already approved; scalar-native-support's literal/derived distinction must remain intact.

**Load-bearing premise for independent review:** when admission selects the unchanged before endpoint, the invocation's actual newly consumed q must still be validated (independent contradiction, dependent/unknown semantics, getter errors, nested horizon), but it does not automatically become a new persistent source contributor merely because the callback ran. The actual source selection still names the old endpoint. This is supported by EntityMap's selection separation, but scalar/updater parity must be confirmed explicitly. If an admitted scalar route requires a new persistent obligation on an unchanged value, admission must select a new endpoint for that reason; this sketch does not authorize discarding that obligation. Do not silently generalize the literal no-write adjudication to all derived/equal writes.

## Existing lifecycle and finite hooks

- private.ts native factory: replace the retained-composite storage step with exact selected endpoint storage. Keep the current invocation's record/finalization/activation; return both selected requirement and invocation requirement in the prepared unit. No ambient-q destination on no-effect writes.
- lifecycle.prepareRevision: retain the frozen explicit distinction between output dependency evidence and current invocation validation. Do not reclassify retained p as an input, nor demand declaration of inherited q merely because q is in selected support. The existing operation dependencies/proof must still include the complete selected support.
- Completion/ready: use the current declaration horizon as well as selected source readiness. private.ready already waits for the operation proof; lifecycle.proof withholds it while op.frames is nonempty. Do not replace that with “selected native requirement is ready,” which would expose output before current validation finishes. Finalize and activate the actual invocation component even when its persistent endpoint was not selected. Release transient units through existing completion/no-write/disposal; no retained observer/listener registration just to compact a graph.
- Scalar admission: retain detached precomputed effect pairs and existing combination/inverse selection. Before facts on actual q writes preserve p through q's x7→9→7; q's unrelated z admission cannot claim x. No-effect calls add neither new journal effects nor new endpoint parents.
- Enrollment: a recipient acquired during/after the invocation must consume selected source evidence, and may not acquire another recipient's declaration permission. The current execution horizon still validates real work; read-only old snapshots do not become new authorship. Late-enrollment/failure controls are required to falsify accidental separation of unfinished ADMITTED support.

These are private handoff refinements. No public adapter capability, extra compensation authority, mutation capture bypass or transaction fold rewrite is proposed.

## Physical view plan is separate

The current source uses ordinary mutation.changed as a proxy for physical identity change. That is insufficient for ordinary7 → inspection99 → ordinary7: the final operation is ordinary-equal but physically changes99 to7. A saved inspection99 view must remain unavailable, not borrow the selected ordinary7 requirement.

Carry the already-computed physical-change fact from shared scalar-slot preparation into native preparation. Direct commitRecorded already knows physical equality and ordinary equality separately; frame prepareSlots already has the physical changed-slot set and inspectionBaseline. Thread that fact through existing private preparation callbacks, without rerunning comparers/getters or reading the public payload again. Prepare the physical view action before installation:

- inspection changes only the physical view, leaving the ordinary selected endpoint untouched;
- an ordinary return that changes physical value creates a new physical view with selected ordinary support;
- existing ordinary adoption of a physically equal inspection display retains its established behavior and does not retroactively relabel old unavailable view certificates;
- truly equal ordinary/physical writes preserve the established equal-support view policy; this sketch does not reopen it.

Validate the ordinary predecessor and physical view/requirement before stores. No install-time lookup, validation, user callback or throw. The passing existing adoption regression covers one direction, not the retained old-view isolation discriminator.

## Boundedness claim to prove, not assume

For a fixed live selected endpoint and fixed inherited obligations, N completed no-effect literal declarations must leave the source retaining the SAME endpoint/requirement graph, independent of N. Current invocation records may exist while validation is unfinished, but completed declaration count is not a source storage dimension. Existing actual-effect pairs may retain real before/after evidence required for rollback; this is distinct from adding a pair or wrapper for each no-op.

Replay the exact64/256 research workload with fixed p and fixed p+q, leaf/whole, discarded receipts. Record source graph nodes/depth and exact selected endpoint identity after completion; structural bounds must be independent of N, not merely shallower. Retain no-early-send/zero-notice/current ownership and useful terminal transport assertions. Also check a still-open nested horizon so premature proof caching cannot masquerade as compaction. No timing claims or threshold changes.

Keep original Main13 and React6 immutable. New receipt companions must preserve all downstream transport/settled assertions and add a genuinely held authored revision for disposal; no runtime receipt repair. Queued focused nonregressions are scalar-native-support, inspection-egress-conformance and parent-snapshot-currentness, with the existing adoption case. Do not invent an E5 oracle or run broader suites before the bounded mechanism and cases are accepted.

Disposition: prefer exact retained selection plus transient invocation validation over a new compactor. The derived-input persistence/readiness premise and physical-view handoff require independent review before implementation. This document grants no new runtime authority and claims no repaired bound.
