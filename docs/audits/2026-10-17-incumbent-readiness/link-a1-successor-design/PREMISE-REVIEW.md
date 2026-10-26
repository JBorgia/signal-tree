# Independent premise review — native ordinary presence and timing

Read-only review of AUTHORITY.md, MECHANISM.md and ACCEPTANCE.md against A0 (`4ed3b609`), frozen A1 `d0e7d1659900b18c9a63d280f409c0448a0c1d80`, preserved no-Link presence evidence, and the public heterogeneous reentry failure. I did not run a model/test, edit runtime, or choose a new public policy. I previously authored the source inventory and parts of A1; this is independent interpretation of the central proposal, not independent authorship of those earlier artifacts.

## Finding

The sparse O-presence premise is coherent for the **existing retained child / existing parent** witness. It fills a real native fact missing from descriptor-only membership; it is not inherently a second value/settlement authority. The separation from relationship baselines and publication support is necessary and correctly stated. There is no source evidence here that this minimum case requires an architectural replacement.

That is not yet a complete behavioral oracle for every P/O combination. The following points must remain explicit gates; none should be resolved by whichever implementation is convenient.

## 1. P2 lacks an exact inverse oracle

MECHANISM.md:34–39 supplies exact O-before/O-after for the established P1 witness. ACCEPTANCE P1 has a concrete outcome. P2 instead says “exact existing authority governs rejection” without stating the physical and ordinary endpoints.

Concrete distinguishable case:

1. Ordinary retained y=7 exists under existing parent a.
2. Inspection omits y, so P absent / O present.
3. Transaction writes held y(7), so P reactivates while O presence/value may be unchanged.
4. Reject the transaction.

Possible outputs are distinguishable: preserve P present/O present as realization of unchanged ordinary truth, or restore P absent/O present as prior inspected display. A false ordinary creation effect is explicitly forbidden by the draft, so the implementation cannot simply reuse descriptor false→true as the inverse oracle.

The current source establishes that held writes reactivate their physical path and same-value reactivation is meaningful (`whole-value-membership.spec.ts` cases7/9/16; `member-membership.ts:365–433`). Those cases do not, by themselves, select rejection behavior when inspection alone caused the absence. The owner-approved ordinary-topology inverse rule is strongest evidence toward ordinary restoration, but the draft intentionally keeps “separately prepared physical realization”; it should cite the exact governing decision/application to this local edge before declaring P2 prewritten. If existing authority determines it, document that derivation; otherwise keep this dependent case gated for one concrete owner adjudication. This is an unresolved case oracle, not proof the sparse representation cannot express either outcome.

## 2. Revalidation must observe O-only changes and ABA

Identity validation and physical descriptor epochs are insufficient by themselves. In P1, an O-only false→true adoption can leave P descriptors unchanged. Reentry can change O or publication responsibility and return to the same bit/value before an older preparation resumes. “Revision” at MECHANISM.md:44 must include those relevant source changes; a membership epoch advanced only by descriptor flips does not do so.

A0 already provides the necessary rule (:29–30, :93–94): installed units have identities/sequences, earlier units remain installed, and the later membership unit is reprepared after capture reentry. This is a missing concrete mapping to the new source record, not a new semantic requirement or an architectural blocker. The implementation plan should name which existing source revision/unit token covers O-only changes and prove that no-op comparison does not erase write identity. Add an O-only reentry/ABA variant to P4/G9, not just physical reactivation.

## 3. Preserve two intervals; do not claim a whole setter is atomic

The draft correctly preserves value installation/capture before path reactivation (MECHANISM.md:48–54). This agrees with A0:30,94 and frozen `tree-scalar-leaf-runtime.ts:140–145`. It avoids changing observable capture/reentry timing merely to make pairing easier.

The resulting correctness argument must distinguish these phases:

- First scalar unit installs its own value/ordinary-value responsibility and support.
- Capture can reenter or throw.
- A later presence unit uses the **then-current** validated source O/P state, not the source state cached before the first unit’s callback.
- If a newer callback operation has already adopted the member, the older unit must not install a stale O-before false record or claim that callback’s existence.
- If the first unit installed but the presence unit never did, failure/abort handles that partial-installed outcome. P4’s before-install “changes neither source nor resources” applies per actual installed unit, not retroactively to the entire setter.

The draft and A0 can express this consistently. This is a required preparation/acknowledgement proof and executable control, rather than a reason to move descriptors earlier or fold callback work into the outer operation.

## 4. No-op adoption is not a value effect

Frozen A1’s witness has ordinary value7→7 while O presence false→true is missing. Scalar `readRecordSlot`/inspection baselines only answer values; physical absence fast paths only answer descriptors. A distinct O membership admission is needed even without a scalar contribution or value notification. MECHANISM.md:35–38,49–54 says this correctly.

The minimum responsibility must capture the O membership edge once, with existing retained identity. Do not create a fabricated scalar difference, rely on rich notification count, or make source O completeness conditional on Link enrollment. Whole-value and `inStructuralWrite` capture have existing duplicate-suppression rules; source-unit acknowledgement must prevent a second captured membership effect without suppressing O-only adoption. This is unimplemented mapping, not new public semantics.

## 5. Lifetime and cleanup bounds are appropriately conditional

The key must validate canonical parent/key **and child identity**, as proposed. Existing ordinary writes reuse retained children (`materializeMember` identity discovery; `preparePlainBranchMembers` descriptor.value validation). This is enough for the minimum retained-child scope. A string-key map with stale entries silently applied to a fresh child would violate the proposal.

The draft correctly treats O≠P as a current source obligation even with no pending owner, and releases on convergence. Weak ownership is a storage-root constraint, not collectibility evidence. Destruction must not make inspection authoritative while retained operations can still use the node. Fresh inspection-created identity and missing ordinary-ancestor cases remain gated; they cannot be counted as passed by refusal or by adopting all physical siblings. No additional public lifetime/destruction rule is selected by this review.

## 6. Chronological private publication is a necessary separate correction

The preserved permanent Nx reentry regression shows physical A777/B12 but final outbound A11/B12 after a later callback write. Sparse native membership alone cannot fix that. Whole-installed-unit admission before capture/invalidation/enqueue/tap reentry directly addresses the causal source of the failure. Keeping public notification timing while preventing those notifications from replaying older state into an already-advanced private projection is consistent with existing callback semantics.

The aggregate authored-input authorization does not authorize changing native operation atomicity or rollback ownership. AUTHORITY.md and MECHANISM.md explicitly preserve that boundary. There is no basis to treat aggregate surface approval as blanket runtime approval for the new source owner.

## Disposition for the specification

The minimum source mechanism is a viable **design hypothesis**, with no demonstrated contradictory authority in the retained-child P1 case. Native implementation/qualification is not established. Before a dependent P2 implementation, provide its exact physical/ordinary inverse oracle from a governing decision or resolve that concrete question. Before any claim of P4/G9 completeness, map O-only source revision and the two installation intervals explicitly. Fresh identities/ancestors, lifecycle collectibility, and broad qualifications remain gated exactly as the draft states.

No additional feature, wrapper, fallback settlement authority, or public policy was approved by this review.
