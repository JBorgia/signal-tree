# Independent scalar instrumentation review

**Bounded acceptance of the instrumentation correction.** No counterexample found in the reviewed counter semantics. This is a C1-based delta, not qualification of the joint-phase merge, production performance, or changed work budgets.

## Identity and changes

Fresh copy of frozen source manifest `2aab56bae322344427d91edfe1e3834717ba698b97a3c766c127cdc7136c89e5` (2,976 files); runtime patch SHA256 `30638fc746016fce66c7b2d47bc9abe9e3a10e21561f7526b47b38f216bc7235`. Verified source and patch hashes before copying. Only added independent tests; no author/runtime edits. Post-run manifest verification is recorded in VERIFICATION.json.

The runtime diff changes only instrumentation in tree-scalar-slot-runtime.ts. Each prepared physical assignment counts once, after the assignment. The common advanceRevision helper counts after the actual scalar-runtime advance, and the old recorded-path increment is removed. Equality counters precede the additional actual comparison when an inspection baseline exists, including a throwing comparison. Values, callback ordering, equality policy and stale/once-only guards are unchanged. The nullish revision expression preserves the previous fallback.

## Meaning of counters

slotReads is readSlot invocations, not all array reads or logical reads. The point-write expectation1→0 corrects that event definition; it must not be presented as eliminating all read work. slotWrites is physical assignments, including recorded semantic admission that assigns an equal physical value; prepared authority-only admission can instead advance revision without a physical assignment. revisionIncrements is advances performed by this scalar runtime, not every use of a shared external clock. equalityChecks counts equality callbacks, including unsuccessful calls, not Object.is bookkeeping.

The shared-clock distinction is essential for composition: two suppressed scalar installations followed by one enclosing clock advance legitimately report two assignments and zero scalar revision increments. A subsequent scalar-owned recorded write reports one increment, not two. Do not later label this field a total operation-clock count without changing its measurement contract.

## Independent execution

Exact focused author selection replay: **27pass,78 filtered**, exit0. Includes the unchanged sizes10 through100000, widths2/10/100 and original20000ms timeout. No ceiling raised. Counter snapshots are copied at assertion time, avoiding later mutation of the diagnostic object.

Three added independent controls: **3pass**, exit0. Shared-clock composition verifies actual values and shared revision alongside counters; throwing ordinary-shadow equality is tested in both prepared and recorded paths with exact error, unchanged value/revision, two equality calls and zero assignments/advances. The original eight accounting controls additionally cover no-op, discard, equality/reentry, stale refusal, once-only installation and authority-only admission. This is not a benchmark or CPU claim.

The separate omission companion executes all three enhancer orders. Its changed assertion names the specific existing effect-validation refusal and collection path while retaining hidden-state and confirm checks. It is separately applicable from instrumentation; this review does not grant new omission-policy authority or silently waive the preserved original failures.

No independent full source/spec type rerun was necessary for this review-only delta; the author's type results remain attributed to the author. No broader framework/release or combined-candidate qualification is claimed. Preserve the counter definitions when Main composes this patch into a runtime with different prepared installation code.
