# Private retirement interface for Main's merge

C1 base only; this patch does not contain Heisenberg's readiness/phase experiment. Apply the three-file runtime delta to a separately reviewed integration copy, not to another author's evolving source. No public barrel changes.

## lifecycle.ts

`NativeRequirement.retirementOwnWindowOnly?: boolean` is readonly preparation provenance. It is true only when the original prepareNativeRequirement call has unknown=false, zero known owners, zero supplied inputs and zero active declaration frames. This classifies a simple source fact whose only later uncertainty can be its own captured W. It is computed BEFORE inputs/frames are cleared. An absent/false value is not eligible for the new unknown-proof release path. The strict class deliberately excludes even confirmed actual-role or supplied-input cases; this is not all-terminal cleanup.

The property does not affect proof construction, eligibility, window sampling, native readiness, declaration horizons, public receipts or recipient classification. Composite requirements remain references to constituent requirements and are checked constituent-by-constituent; do not synthesize this bit from aggregate proof. If the phase experiment moves requirement construction, carry this exact preparation classification, not a recomputation from cleared arrays or a final unknown boolean.

`ownerCellCanTransition(cell: OwnerCell): boolean`: true only for the exact pending cell still registered in its owning source. Does not infer settlement from absence.

`onOwnerCellTransition(cell: OwnerCell, callback: () => void): () => void`: private exact-cell subscription. Transition and source-disappearance notifications queue a microtask; callback is never invoked inline. Registration after terminality/disappearance queues one notification to cover an assessment/subscription race. The cancellation function clears the callback and membership, including already queued notifications. Multiple transitions before that queued delivery coalesce for that observer; consumers recheck current state. The caller owns cancellation. No automatic recipient operation or global tree list is created.

Hooks: after the existing ownerWake on authentic terminal transitions; in the existing owner-source disappearance loop. Neither changes cell outcome logic, pending-set semantics, normal receipt wake, or readiness. A disappearing source still leaves unresolved cells unresolved.

## EntityRetirementPlan / source scheduler

Private `neutral` is renamed `canRetire`: source facts may be neutral or have a discharged classified own window. `ready` still means the existing lifecycle requirement readiness. Optional `onSettlement(callback)` supplies a cancellation function only when exact live pending cells could make this snapshot eligible. Readiness subscription and settlement subscription are separate; the scheduler uses one appropriate phase and cancels/rebuilds it when rechecking.

At the queued retirement frontier the existing installed-forget kernel eligibility, exact-subject eight-map snapshot equality, source revision, disposal and cancellation checks still apply. Actual release uses existing retire(subject), advancing both source and retirement revisions. No mutation to issued requirements, recovery records or recipient snapshots.

## Merge cautions / tests

Do not collapse `canRetire` into requirement readiness or promote terminal W to a declared proof. Do not activate settlement observers during sealing. If Heisenberg separates sealed/installed readiness, use the readiness boundary that guarantees this source record is installed and its validation complete; keep the current queue after synchronous completion/reentry. This patch does not resolve or preempt that phase design.

Preserve original negative-drain tests and naive-retire early-send mutation. Preserve original foreign-callback boundary tests: they are NOT own-W-only facts (raw unknown=true), so they still retain source proof after settlement. The new tests explicitly assert the opposite terminal outcome only for the newly classified simple own-W cases. See TERMINAL-EXPECTATIONS.md.
