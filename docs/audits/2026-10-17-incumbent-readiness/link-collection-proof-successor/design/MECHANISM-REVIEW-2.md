# Independent bounded mechanism review — revision 2

2026-10-29. Reviewed `DESIGN-REVISION-2.md` SHA-256 `51e02566022c26a7fa6428f7333b9f76ad09b3510d27845d984e41d514543b44` against clean frozen source `75416029be1e0c1d9735ed3bdc0f4e8e6c02f775`. First review preserved at SHA-256 `d2291eee2c61fc8e73ece6581a351f05c8cd843911f18a51aabc3916aa94fe0c`. No other reviewer verdict read; no runtime edits or test runs.

## Disposition

Revision 2 supplies enough core representation and source-selection semantics for bounded implementation under the existing full-plan authority, with one narrow receipt-readiness correction below. This is not a request for another architecture round: record that guard in the implementation contract and verify the concrete sequence. I found no further core design blocker in the requested scope.

Retirement and whole selected inverse remain separately explicit requirements. This review neither clears their mechanisms nor reduces full qualification to the core binding change.

Frozen aggregate premise at `3c8bbaff`: “Completeness covers all inputs to newly authored facts. Untouched contributing facts retain their own support: a declaration can be valid while the resulting projection and its receipt remain held.” Revision 2 now gives this separation an implementable interface rather than passing one composite requirement into both validation and delivery.

## Remaining correction: aggregate readiness must gate the immediate receipt

The proposed two-input interface is correct, but it must install a requirement for selected-support readiness at receipt preparation, before declaration finalization can refresh its public state. The wording “after relevant validation finalization, reduce selectedSupport and project its proof” otherwise permits a transient authored-only eligible receipt.

Current source makes this a concrete ordering hazard:

- `experimental-publication/lifecycle.ts:219–234`: `finish(h)` combines validation/native authored proof, clears `op.frames`, calls `refresh(op)` synchronously, then wakes the channel.
- `lifecycle.ts:15`: wake runs in a microtask.
- `experimental-publication/private.ts:completeScalar` marks the unit complete and queues `ready`; `ready` subsequently invokes `projectRevision` with aggregate support.
- `lifecycle.ts:283`: `projectRevision` replaces the operation proof and refreshes it, but only once called.

Minimal discriminator, to preserve as a useful behavior assertion rather than a refusal case:

1. A collection has two contributing fields. The untouched field has authentic pending support q.
2. A valid independent declaration literally replaces the other field without consuming q's value. No pending destination owner is necessary for this witness.
3. Immediately after `declare` returns, before yielding a microtask, read its receipt.
4. The declaration must succeed. The receipt must remain non-eligible (held or still completing/validating), and delivery must remain blocked. After q confirms, it must progress and deliver the exact combined payload without another setter.

If unchanged `finish` refreshes only the authored independent proof, step 3 reports eligible before selected q is projected. That conflicts with the quoted receipt requirement even if transport happens to wait for a later microtask.

Required interface rule: an operation that requires collection/aggregate composition cannot expose eligibility until that exact installed revision's selected-support proof is ready. Either register the composition as an explicit readiness condition during `prepareRevision`, or complete its reduction synchronously before the first public-state refresh. Authored-only validation remains available internally for contradiction checking; it must not become a public delivery/receipt proof. Owner/horizon refresh must also respect this guard. A later revision must not satisfy an earlier revision's readiness condition.

This is a source-backed prediction of directly reusing current lifecycle ordering, not an executed revision-2 failure. Revision 2's general statement that selected support gates receipt progress is compatible with this correction; the correction makes its timing obligation explicit.

## Resolved core findings

**Exact source-step mapping.** Unit/ordinal/lifetime association, separate P/O certificates, explicit presence, and prepared overlays resolve the first-subject lookup problem. A certificate may share its underlying requirement with other facts from the same unit while retaining its precise address. Combined point preparation must carry each child's original input/horizon context; the revision correctly forbids substituting the first packet's metadata or ambient post-preparation context. Implementing that explicit transport may change private interfaces, without creating a new public authority.

**Authored input versus retained selected support.** Supplying only the authored requirement to contradiction checks and supplying selected contributors to eligibility resolves both failure directions: retaining q cannot falsely contradict an independent sibling write, and independent p cannot erase q. Actual native updater consumption remains an input lower bound. Copying an untouched field solely to represent the existing reducer's adoption is selection, not a new application input claim. Its P certificate/unavailable support must remain in the aggregate; the new field's O certificate cannot certify it.

**Pure order and support-only revisions.** The new affected-selection rule explicitly covers order and support changes, so `link.ts:595` can no longer drop an order-only receipt. The authored domain and retained latent slots provide enough information to implement this through the existing reducer. The fallback order listener must consume the prepared revision rather than mutate payload with stale proof. Effective support equality remains the no-op criterion; merely allocating a certificate does not authorize a meaningless receipt/send.

**Seed and acquisition.** The envelope plus source/enrollment revision validation specifies a coherent boundary. Baseline permission is recipient-local and distinct from native P certification: a permitted inspection-before-creation baseline does not clean its unavailable native input certificate. Native pending support overrides any attempt to treat matching seed data as unconditionally clean. Baseline-unavailable support uses the approved conservative route, not a fabricated current owner set. Inbound acquisition must prepare its exact seed/proof with its native installation and abort on stale preparation; existing write-then-reseed ordering is not sufficient. The revision explicitly requires this replacement, so its absence in frozen code is implementation work, not an unresolved design choice.

**Summary invalidation.** Finalize windows before installation, retain unfinished horizon references, index affected contributors by blocker/horizon, and invalidate/reduce summaries on changes. That is sufficient to avoid caching an empty pre-finalization window or removing a sibling's same-owner contribution. Callback-free installation and revision checks preserve the existing reentry/enrollment guarantees. The receipt readiness guard above closes the remaining observable interval between validation completion and aggregate composition.

## Acceptance limits

The immediate-receipt discriminator is additional source-derived coverage, not a claimed pass. No C1–C14 assertion changes are justified. The unchanged retained-q hold/eventual-delivery, order-only/support-only, pending seed, inspection seed/adoption, acquire reentry and same-lifetime multi-step controls remain the bounded implementation checks. Retention, selected-unit atomicity, public types, installed consumers and full qualification remain their separate gates. No release, activation or broad-suite acceptance follows.
