# Independent expansion/scope comparison review

Reviewed 2026-10-26. Exact reviewed COMPARISON.md SHA-256: `ea01813c38fe76dbcbb92271df4f1ae61fc7a5effb9b8f853205ae278d6b6145`.

Source: clean `/private/tmp/v16-transition-qualification`, HEAD `f01ed39a7df8a5de185ebec0773e09e36537dacb`. Read the applicable review contract, the `f80645c8` plan's scope/stop provisions, and `cebfcd4ae050403452c3dda1e4373a27331d9ab9` boundary README/controller change. Independently inspected the relevant source branches. I previously reviewed the membership-admission design; I have not implemented it. I did not read DEFERRAL-PREMISE-REVIEW.md or other new verdicts. No tests, models, runtime changes, builds or measurements were performed.

## Disposition

**Decision-ready for choosing design-only A0 versus an explicit B0 product-contract revision. Not ready to approve A's mechanism or native experiment.** No blocker to that limited scope decision is demonstrated. The comparison identifies the previously missing mechanisms, names the expanded writers, keeps the runtime stop, and explicitly reserves unsettled semantic outcomes before implementation. Its last paragraph is essential: selecting A does not automatically approve the proposed map or authorize A1.

A now addresses membership equality, mixed authored payloads and no-event completion together. The support-transfer table remains a real design deliverable, not a detail that can be filled in by tests or by whichever map is easiest to implement. This is appropriate for A0 authorization, but would be circular if “all required facts” or “complete authorized footprint” were treated as executable definitions when admitting A1.

## Source-supported claims

Source paths below are relative to `packages/kernel/src/`.

- **Membership-only admission is necessary.** `internals/tree-scalar-slot-runtime.ts:268–269` skips terminal preparation when physical and ordinary equality are unchanged, while `internals/tree-scalar-leaf-runtime.ts:140–144` still calls re-add. Native replace/derive call capture between commit and re-add (`internals/native-tree-scalar-leaf-runtime.ts:177–201`, publication helpers at `139–162`). The additional writer row at comparison line 64 correctly includes both implementations and the structural shortcut. It does not claim that moving the existing reactivation function earlier is safe. Equal retained-value re-add, unchanged present value, exactly-once publication and notification order remain distinct controls (`lib/absent-path-write.spec.ts:260–267,464–481`; `lib/whole-value-membership.spec.ts:296–324`).
- **Installed deltas are needed before a final event.** `internals/plain-branch-membership.ts:148–168` emits net presence changes and reads final after-values. Exact event IDs cannot recover an absent net event or separate nested authorship in that after-image. `lib/signal-tree.ts:1035–1040,1281–1309,1314–1328` establishes the earlier install/publication and partial-success boundaries. The proposed replacement/removal list at comparison lines 38–45 addresses these facts.
- **No-event completion requires more than an eligibility wake.** `lib/link.ts:991–1002` returns when `held.size === 0`. `895–910` normally creates the waiter obligation before consequence scheduling, and `921–939` separates held release from queued/serialized sending. Comparison line 42 now explicitly adds pending projection work at admission and scheduling when no held send exists. This closes the prior specification omission; it does not prove a correct implementation.
- **Whole-payload latest-fact authority is being replaced.** `experimental-publication/projection.ts:25–32` uses latest/completed/projected facts; `lifecycle.ts:74–78,86–95` moves declaration views to the last revision and removes started/superseded operations. Retaining support for an earlier contribution is a substantive change to that mechanism. Comparison lines 41,49–60 state that honestly.

These are source findings, not newly executed reproductions. The earlier candidate failures do not measure proposed A or prove production87 has those failures.

## A0 must close these precise matters

### 1. The support map owns publication responsibility even without values

Comparison line 49's “not another copy of canonical values” is true of the proposed contents, but does not make the map non-authoritative. Its entries decide which payload may leave a relationship. It is a new representation of **publication eligibility authority**, constrained by incumbent ownership and native source facts. It must replace the old evaluator rather than compete with it, as line 45 requires.

For clarity, interpret the stop phrase “support requiring a second state authority” at line 77 as a second canonical state or settlement authority. If it means any new publication-authority representation, A contradicts its own premise immediately. State this distinction explicitly in the final packet. No new rollback authority is shown to be necessary, and absence of values alone is not evidence that none could be introduced accidentally.

### 2. Name the support transfer, not only its desired result

Lines 53–60 give sensible constraints, but “still-required” and “complete authorized footprint” need finite rules before A1. In particular, A0 must determine:

- How a dependent field, independent sibling write, and later independent replacement transfer value support while retaining any independently required ancestor/lifetime support.
- Whether omission retires or masks descendant support, and precisely which validated restoration/re-add facts can revive ordinary output without reviving rejected evidence.
- Which support is discharged by confirmation, invalidated by rejection, or replaced by surviving/reversal evidence. A rejected dependency must neither authorize an old captured payload nor cause permanent hold after safe existing settlement.
- How order support follows the selected authored domain without claiming ownership of incidental neighbors or foreign order. Scalar/branch and entity facts need native rules, not a universal path-patch interpretation.

This is the distinction between an internal support representation and silently choosing new public publication semantics. The packet appropriately calls for an owner question when existing decisions do not determine an outcome. A0 should terminate with either an exact source-grounded table or a specific unresolved question; passing a prototype must not supply that missing authority.

Cheapest future falsifiers: the nested dependent-field/independent-sibling sequence paired with a complete independent overwrite; then the same pair beneath pending presence and with subset order. **Not run.** Both payload safety and useful progress must be asserted, not just a held receipt.

### 3. Lifecycle scope includes public receipts and in-flight send snapshots

The expanded writer list is materially explicit. At A0 it needs exact entry-point mapping, including the `inStructuralWrite` shortcut (`internals/member-membership.ts:370`) and prepared member restoration (`internals/plain-branch-membership.ts:888+`); these are not interchangeable with ordinary leaf commit.

The remaining lifecycle work is also real. Current `lifecycle.started` discards proof and operation bookkeeping; the new support may need a different lifetime. A0 must separate a terminal user receipt, retained support for the current projection, a queued payload, and an already-started request. Newer support must not retroactively authorize a captured request, and retiring an old request must not delete support still required by current output. `lib/link.ts:935–939` already requires rechecking each send lap. Preserve receipt meanings rather than redefining a receipt as the status of every fact in the map.

Connection creation during preparation, disposal, declaration validation completion/failure, and no-event waiter release need rows in the same table. The comparison already includes these in its gates; they are prerequisites to A1, not new implementation scope discovered by this review. No-event private completion must use the existing consequence boundary rather than directly sending an intermediate prefix.

Cheapest future falsifier: admit a net-zero public summary while no held entry exists, then overlap a pending declaration and an in-flight request; assert truthful waiter completion, no early send, serialized correction, unchanged receipt terminality and disposal release. **Not run.**

## Gates and the B comparison

A0–A3 form a finite progression if A0 freezes the exact added writer set, transfer table, entry-point mapping and expected results before A1. The current distinction between unmigrated mapped paths and recurrence in a covered path prevents routine milestones from becoming stop points. “Covered” should mean a path whose promised mechanism/obligation has actually been implemented and qualified, not merely a row named in the inventory. Conversely, a recurrence cannot be renamed an unmigrated path to continue another exception.

The measurements are correctly future obligations, with unchanged budgets and preregistered matched thresholds; no performance superiority is claimed. Additional state is not accepted merely because it uses an existing queue. A0 should specify retirement bounds in terms of live facts, affected bindings and live publication obligations, with no retained operation history.

B is **not** presented as release-ready. Lines 25–27 and B2 preserve independently approved adoption work; B1 forbids indefinite hold after settlement and stale output; B3 requires an actual frozen candidate and fresh qualification. Lines 94 and 100 correctly avoid claiming byte/speed improvement over production87 or transferring f01 failures to production. The B wording remains conditional on actual consequence scope rather than claiming all application work is blocked.

One naming clarification would help: “B is closed” at the beginning refers to the historical architecture route, while “B” later names deferral. Call the former “historical architecture B” so choosing the deferral option cannot appear to reopen it.

## Bounded recommendation

Use this packet for the owner's capability/scope choice, with the authority and historical-B wording clarified. If A is selected, authorize only A0 as the packet states. Its exact support/lifecycle table and source mapping remain an acceptance boundary, not presumed approvals. If B is selected, revise only the declared-progress contract and then qualify its separate remaining obligations. This review chooses neither product preference and grants no runtime or release authorization.
