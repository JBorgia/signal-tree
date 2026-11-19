# Fresh scalar current certificates — bounded design, no runtime

**Fresh-admission-only replacement has a concrete source seam, but exact C27 no-write/receipt equivalence is not established by an identity-free confirmed-I/V summary.** The source-level counterexample below distinguishes two histories that such a summary merges. Do not implement a sweep, drop in compactTerminalProof, or infer permission to change receipt disposition. This is not a rejection/abandonment or whole-owner-graph redesign. C27 remains unchanged and retained for its reviewed scope.

Evidence read: /private/tmp/st-c27-owner-history/{REVIEW.md,TERMINAL-CONSUMERS.md}, actual C27 source, and Main's exact C27 replay under /private/tmp/st-c27-owner-history-main. Main's preserved result is exit0/sourceUnchanged with both useful terminal arms; its raw counts show the same confirmed-I/V growth. Those passing semantics do not certify bounded owner history. No tests, helper models, benchmarks or runtime changes were executed for this design.

## Narrow source-admission mechanism that can be specified

Paths below are under packages/kernel/src/lib unless stated otherwise.

Use the existing ordinary scalar preparation in experimental-publication/private.ts:155–180. Preserve predecessor selection, transaction responsibility, allowConfirmedRefresh, restoration selection and proposal/inverse binding before considering a representation change. The growth case takes the retained-derived combination at :177. A future implementation could substitute a **fresh copy of the closed retained contribution**, then combine it with the existing invocation's prepared requirement. It must not rewrite the retained requirement or wait for settlement. The pure copy belongs to this detached preparation and is installed only through the existing terminal record; failure before installation publishes neither it nor bookkeeping.

Scope the first mechanism to retained scalar contributions already finalized and activated. If the predecessor is unresolved, keep its exact contribution for this admission. Do not add a normalizer subscription to make it eligible later. Current invocation/frame proof, captureNativeInput's issued owners array, and newly acquired W are untouched. C26's existing scalar completion/horizon logic still closes the NEW composite; it is not authority to prune its newly consumed responsibilities after they settle.

A conservative eligible set E at this admission cutoff is: cells already confirmed, represented in the predecessor's I/V, and not needed in D, W or unclassified actual support. Preserve all D, including the exact endpoint-bound destination witness even when confirmed; preserve every pending, rolled-back and abandoned cell in every original role. Protecting D/W overlaps is narrower than deleting every confirmed I/V occurrence and suffices for the observed qi-only history. Do not encode rolled-back identities as bits in this experiment. Do not erase terminalRejectedRoles, unknown, invalid, unavailableInput or historicalWindow. Keep role order and identities for the remaining entries. The owners union may lose a cell only when its sole actual responsibilities are the summarized confirmed I/V occurrences.

This cutoff is historical-predecessor-only, not a blanket filter over the final union: a confirmed handle explicitly used by this new declaration must remain new validation evidence. Do not remove a cell captured pending merely because a callback confirms it before completion. Do not normalize owner disappearance into confirmation. If no eligible cells exist, retain the existing representation/fast path.

Create a new requirement/certificate and, where necessary, a new current endpoint carrying the same present/value/owner binding. Do not mutate issued requirements, NativeInput arrays, effect/inverse endpoints, recipient facts or receipt views. Scalar selection at enhancers/transactions/transactions.ts:2873–2894 remains authoritative: its before/after endpoint pairs and net-zero selection must not be rebound to the fresh certificate. Exact restoration and the existing cold-no-preparation path remain unchanged. No fresh certificate on confirmation alone, inspection-only return, read or timer.

The current equal-value native view path (:179–180) reuses a NativeView and assigns its requirement. A cleanup-only implementation must not use that assignment to rewrite an old snapshot's certificate: issue a new current view for the fresh certificate and preserve existing snapshotViews associations to the old view. This is a necessary alias handoff, not authority to change snapshot value identity, notify values, rewrite cached issued snapshots, or replace their evidence on subsequent access. Cached snapshot and direct/updater capture routes need the finite discriminator below; source-map replacement alone does not prove all readers use the new certificate.

## Why prefer admission over settlement replacement

Admission already has a selected predecessor, exact source validation, detached records, installed native-first completion and recipient plans. It can select a fresh certificate for the next operation without inventing an operation or a new declaration. The observed sequence would retain the newest qi captured pending until another real admission; an idle final source may retain that last confirmed qi. This is an admission-relative bound, not immediate cleanup after confirmation.

Settlement-time replacement would need to discover current aliases/slots, update recipient counts and operation dependencies, protect inspection/inverse evidence, and avoid overwriting reentrant newer selections even when no write is occurring. It also needs an event-driven lifetime and readiness contract. Existing owner wakes do not supply authority for those changes. That alternative is outside this task: no settlement sweep, subscription, replacement pass or new public API.

## Exact no-write equivalence: concrete obstruction

private.ts:71 compares exact sets separately for owners, D, I, V and W and exact flags. Its ready reducer (:339–350) uses that comparison to choose lifecycle.noWrite versus keepRevision/supersede/selectProjection. Those branches affect receipt fallback and revision lifecycle even when physical payloads are equal.

Consider two closed predecessor proofs with identical value, endpoint binding, cleanliness, flags and retirement summary. p is the same pending destination; a and b are different already-confirmed owners:

| Role | History A | History B |
| --- | --- | --- |
| D | p | p |
| I | p,a | p,b |
| V | p,a | p,b |
| owners | p,a | p,b |
| W | p | p |

Both have unknown=true, invalid=false, historicalWindow=true, identical remaining flags/bits. Both have retirement B=true due to actual roles. An identity-free summary of the confirmed historical I/V makes their fresh certificates identical: live p plus the same confirmed-history summary bits, if any.

Now admit the same equal-value derived operation whose genuine new capture has I={p} and whose explicit declaration supplies V={p,a}. C27 accepts a still-authentic confirmed handle: runDeclaration rejects rolled-back/abandoned handles, not confirmed ones. New capture already omits confirmed actual owners. The old retained contribution is output debt, not a requirement to declare b as fresh invocation input.

With the original contribution intact, A's combined role sets do not change; B gains a in V/owners. Holding the other sameProof inputs fixed, **C27's no-write predicate is true for A and false for B**. With both histories collapsed to the same identity-free certificate, the same new invocation cannot distinguish them. Both compact effective proofs include fresh a; comparing compacted sets selects the same branch for both histories. Dropping all confirmed entries from both sides instead also selects the same branch, and can erase genuinely new explicit validation evidence.

This is a source-level counterexample to a stateless abstraction preserving the exact existing comparison. It is not an executed public receipt regression. The existing growth fixture supplies the historical-role shape; the two-history public receipt replay remains a finite required discriminator. Do not preassign an unmeasured full receipt state/basis merely from the boolean branch. The source already establishes that the branches differ; the public replay establishes their useful observable consequences.

A temporary raw before/after comparison can preserve the admission that first creates a compact certificate. It does not solve a later admission after that temporary history is released. Retaining an old requirement/identity-membership chain solely to answer later comparisons restores the history being removed; storing unbounded numeric identities instead of cells is not an identity-free bound either. A weak prior-certificate backpointer makes behavior depend on collection and is not a semantic certificate.

Therefore there are two distinct questions for Main's central selection: preserve the current identity-sensitive no-write relation, or explicitly establish a narrower observational relation under which those historical distinctions may be forgotten. This task supplies no approval for the latter and no bounded exact-membership mechanism for the former. Do not silently change sameProof globally or label a new receipt behavior “representation only.”

## Recipient occurrence-accounting handoff

The source-only copy does not update a recipient's cached contribution. At the existing installed unit reduction, use installFact and RecipientOccurrences.replace for the exact field/value occurrence, never mutate an entry's proof in place. recipient-occurrence.ts:59–73 already cancels the old subscription, subtracts **old cached counts**, installs the new entry and adds **new counts**, preserving ancestor visibility and unresolved accounting. Subtracting freshly filtered old roles instead would leave stale counts or underflow shared contributions. Two occurrences containing one cell require two contributions; never remove a cell globally when replacing one slot.

private.ts:299 combines requirementOf(operation proof) with unit.native; :334 may also combine unit.selected. These can reintroduce historical identities even if nativeValues was replaced. The handoff must identify the fresh selected contribution separately from fresh invocation/recipient proof and replace only that contributor. Do not strip recipient-domain unknown, other fields/collections, or invocation validation to make the root count shrink. A changed source proof with unchanged recipient entries is not a completed mechanism.

After replacement, projectRevision updates proof but only ADDS to op.dependencies (lifecycle.ts:488+). retire/noWrite/supersede remove registrations through existing operation lifetime. A new compact certificate alone cannot reclaim old dependencies from a surviving no-write predecessor operation, issued inputs or old effect records. Do not rewrite those issued objects or delete dependents wholesale. The exact no-write branch must be settled before specifying whether an active current operation needs a scoped dependency-delta handoff; otherwise cleanup can inadvertently create/supersede a revision or grant declaration permission. No all-root owner-history bound is claimed from this current-source mechanism.

The cleanup itself must not increment produced/taken work epochs, change unit.changed, trigger value notifications, create a declaration/grant, rerun callbacks or start transport. Existing proof-change handling of a genuine new operation remains distinct from a metadata-only replacement. Same physical value alone is not proof of equivalent receipt disposition.

## Retirement and the dormant helper

Compute/carry the exact pre-summary retirement classification for the retained contribution. If it has a C26 finalized summary, preserve its B and ordered live Q; otherwise derive it from the closed original recursive predicate before discarding any roles. A previously blocked leaf stays blocked even if all removed I/V cells were confirmed. Combine with the new invocation's classification only under the existing finalization/readiness rules. Never recompute from the shrunken role arrays, infer retirementOwnWindowOnly, freeze owner outcomes or replace live source-availability checks. Issued certificates retain their original summaries. The summary itself must not retain the old requirement node as a provenance chain.

compactTerminalProof is not suitable here: it drops confirmed D including the selected witness, changes rolled-back roles to bits, filters terminal W, and lacks source installation, snapshot handoff, occurrence counts, receipt equivalence and retirement provenance. Reusing its name or tests would not supply those missing contracts. No rejected/abandoned policy change is proposed.

## Finite next discriminators, not executed

1. **No-write distinction first:** build the two public histories A/B on exact C27, retain authenticated a/b handles, use the same fresh dependent[p,a] updater, and compare actual receipt sequence, noWrite/keep path, output, settled and duplicates. Preserve first outcomes before assigning a successor oracle. If observable divergence requires history identity, stop the proposed identity-free equivalence claim.
2. **Existing growth control unchanged:** both p-confirm and p-rollback arms at0/1/2/4; record immediately before/after qi confirmation and next admission. Expect no cleanup merely on confirmation, no p.inspect/value/notice change, useful exact terminal payload and no duplicate. Distinguish selected current certificate from issued/operation roots; no invented global budget.
3. **Issued evidence and late confirmation:** hold an input captured while qi pending, confirm qi during user work, and consume the issued capture later. It must not be rewritten or retroactively discharged. Hold old snapshot and inverse endpoints; verify new current admission does not change them, and exact rollback/net-zero selects the old endpoint correctly.
4. **Destination/roles:** confirmed bound destination possible-only refresh remains allowed; pending/abandoned destination and input identities remain exact; rolled-back identities/bits unchanged. Include same cell across D/I/V/W and a genuine new explicit confirmed validator so blanket filtering cannot pass.
5. **Accounting/no-op handoff:** two exposed occurrences share a cell, one source contribution changes; absent occurrence and untouched collection retain their counts. Compare old/new cached counts, readiness, active operation dependency registrations, receipt disposition, and transport work epochs. No mutation of old fact/input certificates; no owner-wide deletion.
6. **Retirement equivalence:** original actual-confirmed blockers remain blocked after summarization, clean/unknown/window classification unchanged, Q subscription identity/order and source disappearance stay live. Reuse the reviewed recursive predicate comparator against the new certificate, not only its publication proof.

No runtime C28 is warranted from this document alone. Fresh-admission-only is the narrower hook; exact historical no-write/receipt equivalence and issued-view/accounting handoff are the remaining proof obligations. Main selects the next step; C27 and all prior failures/results are preserved.
