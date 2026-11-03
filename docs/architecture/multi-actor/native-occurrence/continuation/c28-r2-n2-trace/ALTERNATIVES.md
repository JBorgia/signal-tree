# Shared relevance mechanism alternatives — no selection or implementation

The executed n2 trace establishes the missing input to classification: a closed issued recipient proof containing confirmed a, after source P/S/C no longer enumerate a. x's comparison fails solely on owners/I/V; y's predecessor is then tentative x. Both options below must support that distinction, rather than mutate the old proof or add a special case for a.

## Shared invariants

Keep R2 source P/S/consumed-history closure and raw C validation/activation barriers. Preserve pending-at-capture/frame-entry lower bounds L, D/W/unclassified actual roles, unknown/invalid/unavailable/rejection flags and exact retirement summary. Authentic confirmed validation still validates completeness; relevance is not declaration permission. Only fresh transported proof and temporary comparison views can be projected. Issued snapshots/receipts/operation evidence stay immutable in meaning. Current source installation and ordinary occurrence replacement still happen even when final no-write retains an older operation. Neither option sweeps settlement, reauthors terminal outcomes or retires owners.

Source and recipient use the same relevance rule but need not enumerate identical evidence: a native source cannot depend on which Link happened to enroll. Recipient-only prior proof must not become source authorship/input permission. The descriptor must reach source projection, recipient finish/projectRevision/dependency reconciliation and final comparison consistently; a comparator-only exception is incomplete.

## A — enumerate actual recipient predecessor history at admission

**Mechanism.** Keep source H/V classification as R2. Add an immutable recipient-local classification of the actual predecessor selected by `mutation.publicationPredecessors`/binding.current, alongside source eligibility and L. For a completed predecessor, inspect the actual aggregate `proofs.get(previous)` and establish closure from its completed projection/support state; classify its confirmed I/V cells at the agreed admission cutoff. Do not assume its leaf factRequirements is the entire aggregate proof. The actual n2 x predecessor is available/closed and contains a, so this supplies the missing candidate without changing source P or issued proof8.

Use the resulting recipient descriptor for all new recipient proof projections and final equality, not only the x comparator. The native source descriptor remains source-owned; both descriptors use the same role/flag/lower-bound rules. They are detached sets/classifications, not fresh permissions and not persistent historical requirement graphs. No-write still retires only the new operation and leaves the old finite receipt/dependencies untouched.

**Tentative sibling predecessor.** At n2 y admission, previous fact12 is pending, has no final proof/factRequirements and its native C is unready. Looking up only `proofs.get(previous)` cannot classify it. Looking through `effectivePredecessor` also cannot yet decide whether x will keep its revision or collapse to fact8: the noop mapping is installed only during reduction.

A complete A must carry a transient classification for the pending Unit's potential comparison ancestry. Include the closed base's classified candidates and the earlier Unit's own prospectively classified current evidence, plus protection for its captured-pending/open-horizon facts. This supports both eventual branches (earlier Unit meaningful or no-write) without pretending tentative C is a closed historical certificate. The final comparator still uses the actual reduced proof. An unrelated genuinely open old contributor continues to veto cleanup. Candidate/protection propagation must remain per-pending operation, released at reduction/disposal; never attach an ever-growing history list to the surviving old receipt.

**Exact cutoff seam limitation.** Native preparation runs before recipient preparers (intrinsic-mutation.ts composePublication). R2 freezes its source eligibility there. Recipient preparers can be callback-capable, so classifying an old recipient cell later by its then-current outcome can accidentally include a confirmation that occurred after the source cutoff. A safe complete A needs either a pure comparison-history preflight for the participating recipients before callback-capable preparation, or explicitly justified earlier captured classification. There is no existing universal preflight returning those classifications. The existing captureInput map captures facts, not confirmed-at-cutoff classifications; it runs before the updater and has a different boundary. Simply reading all recipient outcomes later is not equivalent.

This is A's concrete additional integration work: obtain the right aggregate prior/possible tentative ancestry at a common cutoff using the existing participant snapshot, without invoking user callbacks or creating a second recipient graph. A conservative refusal when metadata is absent is safe but must not be presented as satisfying all repeated no-write cases. A partial change that classifies only current closed x but ignores sibling/reentry timing is not complete.

**Retention/cost.** No lifecycle-wide confirmation metadata. Work is proportional to the actual prior-proof roles and pending predecessor classifications inspected/copied per admission. Naively searching b.pending or recursively rebuilding ancestry for every sibling can create repeated work; the existing pending Unit can carry detached sets, but their union/copy cost and release require measurement. Never store entire requirement/operation chains as the convenient shortcut. The old issued operation legitimately retains its finite original p/a; new masks must not append every later confirmed handle. No savings or new budget asserted.

## B — immutable local confirmation fact plus admission cutoff

**Mechanism.** Record a write-once local ordinal for the first observed pending->confirmed transition of each authentic OwnerCell. Keep a monotonically increasing module-local confirmation counter. Capture its value in the admission relevance descriptor together with closure eligibility and frozen L. A later query of ANY comparison proof can ask:

`cell is currently confirmed && observedConfirmation(cell) exists && observedConfirmation(cell) <= admissionCutoff && cell not in L`

and still apply per-proof I/V-only and D/W/unclassified protection. Thus old a remains classifiable at n2 even though it was not enumerated from current source. The same predicate works for source and recipient without importing recipient history into native authorship. No old receipt or proof is rewritten.

This ordinal is only a record that confirmation occurred before this local admission. It must never order writers, select winners, override inverses, rank sources, serve as a commit stamp or cross-runtime/distributed authority. Role identity remains the existing OwnerCell. Raw current validation, historical closure, current activation and finalization gates remain necessary; time qualification alone does not bless unresolved/invalid proof or grant independent declaration permission.

**Future/tentative proofs.** The predicate can classify old a when y's actual prior becomes known during reduction. Confirmations after the cutoff remain ineligible even if the cell is now confirmed; captured-pending cells remain ineligible even if confirmation preceded the cutoff because the updater confirmed them. Raw frame/input validation and flags remain exact. This avoids retaining an enumeration of every potential prior proof, but does NOT allow dropping arbitrary unfinished historical contributors. Keep the R2 closure restriction and distinguish same-invocation tentative proof from a genuinely unresolved old certificate.

**Not a Set substitution.** Current code uses `.size` to decide whether to construct a transported scalar composite, retain invocation on Operation, wait in private.ready, and guard projection. A predicate descriptor can be relevant to a future recipient prior even when the current source has zero removable cells. Treating that as an empty set would recreate n2. B needs explicit eligibility/barrier state rather than `.size` as a proxy. Source normalization, recipient finish/projectRevision, dependency reconciliation and equality must all accept that descriptor. It should be cleared at the same completion/disposal boundaries. The existing actual-factory invariant (masked native consists of C plus already-ready old support) must continue to justify the invocation-only wake subscription.

**Storage and numerical correctness.** A private WeakMap keyed by OwnerCell can hold the immutable ordinal without making it a required public/internal structural OwnerCell field or strongly retaining cells. A single scalar cutoff plus L avoids historical-owner enumeration. No global strong set of confirmed cells or list of all cutoffs. A number counter cannot silently wrap/reset at MAX_SAFE_INTEGER; an exact monotone representation such as bigint is a possible design choice, not a selected implementation. Bigint has growing bit width, so this is bounded metadata per live cell/cutoff, not a claim of literally constant bytes forever. Source getter closures and operation descriptors still require release after normalization/projection.

## Complete OwnerCell lifecycle inventory for B (source inspection, not new executions)

Production scan of packages finds one OwnerCell constructor/outcome writer: lifecycle.ts ownerTransition. Other production modules read cells/roles; entity retirement and recipient-occurrence do not create them. Hand-built test/model OwnerCells exist and must not be assigned fake observed confirmation facts.

| Path | Existing behavior | Required B handling |
| --- | --- | --- |
| registerOwnerSource | New source token/cell Map if absent | No confirmation event or cutoff advance |
| first opened OR staged | Creates pending cell if source exists | No confirmed ordinal; staged-first covered too |
| repeated opened/staged | Re-adds only still-pending cell; never reopens terminal cell | No ordinal change |
| pending->confirmed | Sets outcome, removes pending, queues cell-map retirement, wakes/observes | Record exactly once before any consumer can acquire later admission evidence |
| repeated same confirmed before map retirement | Allowed; repeats wake/retirement scheduling | Preserve the FIRST ordinal; do not increment/restamp |
| terminal event after cell-map retirement | No cell; ignored, not reconstructed | Do not fabricate a new cell/fact or advance for ignored event |
| terminal reversal | Throws before outcome mutation | Preserve prior ordinal; no new fact on failed transition |
| pending->rolled-back or explicit abandoned | Terminal rejected/abandoned outcome | Never eligible; no confirmation ordinal |
| source unregister/abandonOwnerSource | Removes pending membership, wakes, clears source storage; does NOT set outcome | Pending cell stays unconfirmed/ineligible; disappearance is not confirmation |
| confirmed cell surviving unregister/map retirement in issued proof/authentic handle | Cell object/outcome retained independently of source map | Keep its original fact; requiring current map membership would incorrectly reject normal historical confirmation |
| late normal/recovery handle enrollment | Weak authentic mapping to existing cell only | Same cell fact; enrollment is not confirmation. Do not mint ordinals here |
| absent source/unknown terminal id | Returns without construction | No ordinal |
| later new cell with same numeric owner/id (if injected/reused) | Distinct object from old issued cell | Identity-keyed metadata; no transfer by numeric id |
| synthetic/private confirmed cell lacking observed metadata | Not produced by the authentic constructor path | Conservative ineligible, never assume ordinal0 or backfill an earlier time |

transactions.ts routes lifecycle facts through research.transition before its observer, has a separate explicit abandoned path for abandoned pre-handle work, enrolls normal and recovery handles, and unregisters on cleanup. These all converge on the inventory above. `abandonOwnerSource` is distinct from an explicit `'abandoned'` terminal event. B must preserve that distinction and the independent source-availability checks used by retirement summaries.

Recording only when a Link exists is insufficient: n2's old confirmation may predate recipient enrollment and the live source map may already have retired it. B consequently adds confirmation bookkeeping for the experimental publication lifecycle even with no recipient. It does not authorize default activation, but its write-path footprint is broader than A's recipient preparation changes. All five facades already share the same kernel authority; this does not authorize passing certificates between unrelated kernel module instances.

## Comparison and unresolved scope

| Question | A | B |
| --- | --- | --- |
| n2 old a | Enumerate the actual closed recipient prior at cutoff | Query old a's immutable confirmation fact against cutoff |
| tentative sibling | Transient potential-predecessor classification/protection needed | No role-history enumeration, but closure and captured-pending/barrier protection still required |
| callback confirmation after native cutoff | Requires preflight/earlier classification; late outcome read is insufficient | Ordinal comparison excludes it |
| production lifecycle change | None needed | First-confirm metadata/ordinal on the unique transition path |
| retention hazard | Accumulating predecessor sets/chains on old receipts | Strong confirmed registry, restamping/reset/overflow, lingering descriptor closures |
| common shared projection | Source-owned descriptor plus recipient-local extension under one rule | One time-qualified predicate with source/recipient closure context |
| cost uncertainty | Prior-role traversal and pending-sibling propagation | Every first confirmation bookkeeping, predicate lookups, descriptor/barrier scope |

Neither is implemented or selected here. A has a concrete pure-preflight/tentative-ancestry integration obligation; B has a concrete lifecycle-metadata/cutoff-representation and projection-consumer obligation. Neither needs new owner policy merely to fix n2, but neither is a one-line mask/operand change. Do not choose B solely because it avoids this particular enumeration, or A solely because it avoids a counter.

## Finite discriminators before a future mechanism is accepted (not run)

Preserve unchanged original repeated-no-write cases plus exact A/B/current-reader/opaque/invalidity controls. Require all four fresh receipts no-write, old receipt the useful sender, stable old dependency identities and complete disposal cleanup. Repeat with opposite sibling reduction order, tentative sibling that becomes meaningful versus collapses, real open old contributor, and pending-at-capture confirmation/reentrant nested validation. Include a confirmation inside a callback-capable preparer BETWEEN native cutoff and recipient preparation: it must not be silently treated as already confirmed at the chosen shared cutoff.

For B additionally isolate both constructor branches, repeated confirmed events before/after map retirement, rejected terminal reversal, rolled-back/explicit-abandoned/source-unregister cases, old confirmed certificate after source retirement, late normal/recovery enrollment, missing metadata and object-identity reuse. Check exact counter/fact immutability, no new publication/callback/notification, and source availability/retirement unchanged. These are source-derived necessary falsifiers, not executed success claims.

For A additionally assert that the actual prior aggregate and both tentative predecessor outcomes are classified before callback-capable preparation, that unseen/open history remains conservative, and that classification state disappears with pending Units rather than accumulating on the surviving receipt. Both alternatives need separate source/recipient/selected-op/issued-root accounting under matched workloads; no CPU/allocation/budget claim is made from this design comparison.
