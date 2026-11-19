# Joint scalar / rich-source phase design — proposal for Main

Status: read-only independent synthesis, not an implementation instruction or accepted architecture. No candidate combination, runtime edits or new tests executed. Recipient classification remains separately under Hume review. Carver coordination questions are in CARVER-HANDOFF.md; no response is represented as received.

## Evidence and exact scope

Scalar candidate is based on SNAPSHOT-A, manifest `e9b1555e1c2f49f1dfd5b26aa56cae20b22afa9d8d386c32f32091d46a8590a6`, patch `c8e2819a9f36333533ccd3631f4411282882c87ce35ef33232c002d93c5790a7`. Independent review: `/private/tmp/st-scalar-frame-publication-independent/REVIEW.md`. Rich candidate is based on combined B, manifest `55ba1e3bb29ac66f1a493e196cee9b68853fa8ad30ac7067a7ea8e280bf871f5`, runtime patch `22a4c7349fb65d1ba348058eb557516480b584394708724581385f6ac969df4d`. Its RESULTS and SCALAR-HANDOFF are failed-experiment evidence. Different bases prohibit treating their passing counts as a combined qualification.

Three concrete obligations:

1. Scalar `internals/tree-scalar-slot-runtime.ts:207–224` prepares siblings sequentially, while `internals/intrinsic-mutation.ts:311–326` seals each source before later sibling preparation. Later b preparation opens a foreign pending owner that a's installed proof omits. Both orderings must retain the correct common preparation-frontier window, while each source's actual inputs stay distinct.
2. Rich `internals/causal-runtime/tree-realization-adapter.ts:1619–1627` completes structural units before their read-model invalidation. Rich `entity-signal.ts:1549–1557` invokes arbitrary observations and publication completion there. Diagnostic reads are row11/12 and leaf11 but cached all50/60; nested777 survives. The first callback must read coherent11/12 through *every participating public read path*, and its nested777 must not later be overwritten.
3. Rich adapter1431–1469 admits normal live rekey via `__planRekey`; `PreparedRealizationContext.rememberRekeyedSubject`223–230 legitimately finds no synthesized entry. Group construction1567–1571 nevertheless requires one. Ten unchanged tests stop at this new check. Source-resolved recipes must survive grouping; a fresh/restore context is not the definition of a valid live subject.

## One operation-local owner, explicit enlistment

Use one private prepared-operation owner for the existing installation unit, not one per source and not a global authority overlay. The heterogeneous adapter owns its scalar frame, collection structure, live-point transitions, ordinary selected disposition and publication units together. A standalone scalar or collection write owns a singleton unit using the same dependencies. The existing scalar `prepareCommit` path remains the entry to coordinate, not a second independently implemented scalar API.

Enrollment is explicit through the owner's preparation context. A nested user write during equality/preparation is a separate operation; it cannot inherit the outer operation's predecessor maps, captured proof or deferred completion by ambient coincidence. A nested operation that changes an outer participant's revision makes the outer preparation stale. An unrelated owner created by preparation is included at the outer seal where policy requires a possible-owner window. Do not infer arbitrary causal input from this scheduling relationship.

Owner state is a single-use progression: collecting → prepared → sealed → installed → read-ready → drained, with pre-install abort. It owns per-source recipes, captured invocation facts, exact installed-record plans, read-coherence obligations, and completion receipts. An abandoned prepared owner releases references without emitting completion or pretending to settle transactions.

## Dependencies, not source-specific sequencing exceptions

| Phase | Required work | Forbidden work / exit condition |
|---|---|---|
| A. Resolve and prepare | Run equality, descriptor/payload access, source/recipient preparers, responsibility construction and source recipe validation for *all enlisted participants*. Thread same-source proposals in actual operation order. Capture before-images, actual input facts and identity/coverage now. | No outer value/topology/ordinary authority stores. Nested independent writes stand; outer detects staleness. Every callback-capable preparation contribution must be enrolled before closure. |
| B. Close and seal | Close participant enrollment; finish any callback-capable pre-install hook, then seal all operation-owned native/recipient proofs. Validate structure, physical/source/enrollment revisions and recipe preconditions after the last such hook and immediately before installation. | No per-source premature seal, delivery, observer, mutable-packet callback or implicit new participant after closure. Pure proof sealing must not call consumers. |
| C. Install | Apply the prevalidated physical and ordinary transitions, selected endpoints, native/publication records and internal authority bookkeeping. Advance the owning physical clock at its established single-unit boundary. | No equality, user getter, observer, source completer, framework delivery or late structural resolution. Install must not discover an occupancy error after sibling stores. |
| D. Establish readable state | Apply all required read-version/epoch/location/cache invalidations under a single owning invalidation boundary. Every participating row, leaf, collection query, order/active-key and scalar read must resolve installed truth before the boundary releases a callback. | No rich observation, publication completion, membership tap, transport or subscriber callback while a sibling read model is stale. Do not equate installed backing stores with read readiness. |
| E. Deliver and drain | Release existing framework observation scheduling; drain installed source/scalar completion and rich observation in the established causal order, with exact contribution coverage. Run all owned post-install obligations even when one throws. | No remaining outer value installs or stale cache rebuilds after the first reentrant callback; no double completion; no loss of a nested write. |

Core partial order: **all prepare → all pre-install callback hooks → pure seal + final validation → all install → all read readiness → callback-bearing invalidation/delivery/completion**. Same-source recipe dependencies sit inside preparation; exact authority fold dependencies sit inside install. Cross-participant ordering cannot be repaired by special-casing scalar versus collection.

### The current finalize name hides another callback boundary

Scalar lifecycle155–166 currently samples pending owners, caches proof, clears inputs/known and calls `notifyRequirement`. A loop that merely invokes existing finalizers at frame end is insufficient if readiness callbacks can create another owner after an earlier source has cleared its inputs. Repeating finalize is not a repair.

Separate callback-capable hooks from the final proof seal by behavior, not by name. Any legitimate readiness notification needed to finish preparation must occur before sealing *all* source proofs; installed eligibility/retirement wakes must wait until the appropriate post-install/read-ready phase. Seal computes and stores unpublished proof only, then validates the whole unit. Preserve actual D/I/V per source and inherited W; capture a fixed possible-owner horizon for exactly the cases authorized by policy. A common closing horizon is not permission to union every sibling's actual dependency into every other sibling or to replace invocation-time native input snapshots.

No generic observer callback belongs in the pure seal. If a current hook cannot be separated without changing its contract, report that as a blocking dependency before coding, not as an assumed property.

### Synchronous authority folds are not arbitrary observation

The rich experiment distinguishes transaction/restoration witnesses from public observation, but `mutation-capture-runtime.ts` still invokes witness functions and reports errors through callback-capable error reporting. Registering a function as a witness does not prove it is install-safe. Inspect each existing witness fold: materialize any getter/equality-dependent input before seal; preserve synchronous, ordered internal bookkeeping at installation using already prepared source facts. Internal folds must be complete before reentrant application code can open another transaction or request restoration. Queue error reporting that can reenter until read readiness, preserving established containment and primary-error identity.

Do not simply postpone all witness folds with rich observers: that would let nested callbacks act against installed values without installed compensation/responsibility. Conversely, do not run arbitrary rich observers during a witness fold. This is an authority-vs-callback distinction common to all participants, not a collection-specific exemption.

### Read readiness needs a demonstrated facade mechanism

Rich `updateSignals`3333–3348 wraps its own epochs/version in `locations.runInvalidationGroup`; scalar native/neutral `publishPrepared` calls its publication wrapper, which can also complete. Neither name proves an operation-wide barrier. Join the existing grouping capability at the owning unit and separate its read-model marking from callback release wherever those are currently fused. Audit `publishSubjectPhysicalChange`, active-id changes, membership transitions, scalar carrier invalidation and collection version invalidation as well as all().

Qualification must show that the existing native facade capability makes synchronous reads fresh while callbacks remain withheld across all participants. Do not invent a silent native write, use a global read overlay, force eager computed evaluation, or alter supported scheduler/computed timing. If a facade cannot express this through its existing contract, Main must select a separately reviewed capability change; this design does not assert that the current wrappers already suffice. Reordering structural complete after structural invalidate alone still permits the first invalidation callback to see a stale sibling.

## Preserve source-resolved structural recipes

The original planner must supply a stable recipe identifying source, revision/lifetime, subject, original key, target key, selected value/ordinary disposition and placement constraints for every admitted live/fresh/restore/remove path. A live rekey recipe obtains identity/value from that source's successful live planner, without requiring an entry created for restoration. No adapter fallback should rediscover a row by target key or synthesize a new lifetime after preparation.

Group those recipes by exact source and replay their established operation order into one operation-local occupancy/value proposal. A removal vacates a key for a later rekey; repeated subject operations use the preceding staged state; numeric and string keys stay distinct; placement dependencies refer to the selected lifetime. Fresh restore can supply later recipes but does not redefine all recipes as fresh restore.

Structural and live-point plans that touch the same backing/Map cannot each install a whole replacement built from the same old Map. Compose their disjoint/touched-subject transitions against the shared source proposal before seal, or establish explicit predecessor outputs and one final replacement. No post-install rescan/merge. This protects both live-point updates and structural occupancy without a persistent root or authority overlay. Distinct sources retain distinct native evidence even when enlisted together.

## Failure, reentry and lifetime

Before C, any preparation/seal/validation failure discards outer plans and emits nothing for them; an independently installed nested operation remains. C is restricted to callback-free, prevalidated source operations, so arbitrary errors cannot be treated as a rollback protocol for a partially installed unit. Do not catch an install-time invariant defect and claim atomic refusal.

After C, committed truth remains. First invalidation/completion error stays primary, later failures use the existing supported reporting path, and all independent installed obligations drain. Source completion receipts travel independently of changedSlots, including equal-display authority adoption and publish:false. Capture the exact completion participants rather than consulting current subscriptions. Retire completion ownership before invocation so reentry cannot rerun it. Release records afterward; no universal GC claim.

Once E begins, the outer unit may deliver recorded facts but may not rewrite live storage or reset newer revisions. Subsequent callbacks read current coherent truth, which may include nested777; do not promise that every callback sees the old11/12 snapshot. Callback payloads keep their captured operation facts. Disposal/unregistration must not resurrect an operation or erase an already-installed obligation.

## Preregistered next mechanism gate (no execution in this task)

1. Preserve the exact later-sibling scalar red and earlier-sibling positive control. Add mixed scalar/structural/live-point later-preparer owner creation and permutation controls. Assert no stores before install, exact per-source D/I/V and fixed W, later-owner exclusion, useful confirm/reject wake.
2. Add a final readiness/finalizer callback that attempts owner creation or packet mutation. The phase design must either run it before *all* seals or refuse before any store. No repeat-finalize loophole or cross-source proof borrowing.
3. Preserve rich observation/source-completion reds and getter/participant refusal controls. First callback reads row/leaf/all/order/active-id/scalar coherently; nested777 survives all remaining completion. Add a callback from the *first invalidation*, not just from completion. Replay native facade sync-reader/timing controls without weakening them.
4. Preserve all ten live-rekey/structural failures, including strict remove/rekey occupancy, pending rekey and stale unit. Retain same-source two-restore positive control; add fresh-restore dependent recipe and structural plus live-point same-Map overwrite discriminator.
5. Replace only the obsolete fault injection location with an equivalent failure at the actual new pre-install preparation boundary, preserving original test/log. Assert all participants unchanged, no authority/completion, exact thrown identity. The passing absence of the obsolete hook is not safety.
6. Post-install primary-error and completion-drain controls from the scalar review remain exact; add rich invalidation and observer errors, disposal, equal-write and publish:false. Verify no later callback triggers stale outer writes.

Implementation order for Main to select: establish the operation owner and explicit preparation/seal lifecycle first; make source planners hand off complete recipes; compose storage plans; then prove operation-wide read readiness and drain ownership together. Do not integrate one passing half and label the joint mechanism complete. Scalar-A/rich-B reconciliation and independent review precede acceptance.
