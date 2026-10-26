# Independent premise review: ordinary plain-member presence

The preserved no-Link control demonstrates missing native membership responsibility, not merely a lost private publication handoff. Existing scalar ordinary-value evidence and descriptor-based branch capture cannot reconstruct the missing ordinary presence after inspection has reactivated the member.

A sparse native ordinary-presence divergence record would be a substantive source-mechanism addition, not a notifier relocation. A0 already names the writer families and requires the resulting ordinary-presence/inspection-adoption behavior; it does not concretely specify this additional native representation. That distinction needs an explicit design/scope disposition before implementation. This review grants none.

## Evidence identity and limits

Read `ORDINARY-PRESENCE-PREREG.md`, `ordinary-presence-discriminator.spec.ts`, `ordinary-presence-discriminator-first.log` and `ordinary-presence-discriminator.sha256`. The raw Nx run was at 13:17:05: 20 tests, 17 passed, three failed. Two failures are the new no-Link/default-Link native controls; the third is the existing declared-Link useful re-add assertion. No new runtime execution was performed by this reviewer.

The run's recorded `member-membership.ts` hash is `319f87b74639417210615bd4a20ed2c9882d62cc0580a8ca1376c25115035a0e`; the inspected source matches it. The source manifest supplied with the run does not include every native file used in this causal chain. I therefore copied the inspected current native files into `ordinary-presence-independent-source/` and recorded their exact hashes in its `SOURCE.json`; these additional identities are source-review identities, not retroactively proven run identities. In particular, inspected `plain-branch-membership.ts` is `4116ebdd4e7d300bf47e6f14260c914e6698116f6fbae3a30279fd7aceec12d7`, and slot runtime is `766a3f606b3f2ff59492c45a0748f69b07739262e213cbd9baa91eb10b3b9165`. A0 reviewed hash is `942c14563096ca29ba90a8a27a5bab65b139fba068cfd10ec96b68aab1365e42`.

## What the witness establishes

The sequence uses an existing retained y location under an existing parent a: ordinary omit y; inspection write y=99; ordinary transaction writes y=7; inspect and rollback. In both no-Link and default-Link cases, the raw pending log shows exposed y=7, branch `{y:7,keep:9}` and transaction inspection `{changes:[]}`. The post-rollback log still shows that same present y=7. The default-Link send log contains only the earlier absence (`undefined`, serialized as null inside the JSON array). No declaration call participates in either native control.

This rules out an explanation solely in aggregate declaration policy, eligibility scheduling, or Link losing an otherwise complete native membership record. The native transaction itself lacks the relevant effect. It does not prove production87 or f01 fail identically; no comparator execution is in this witness. Nor does it establish a broad history/framework/retention verdict.

The log establishes physical/public results. It does not directly inspect an ordinary-presence store—the gap is that no such separate source evidence is apparent. The asserted rollback-to-absence oracle is derived from A0: inspection does not advance ordinary facts; ordinary adoption includes existence (lines 74–75); absence is separate from value (42); and capture/inspection/inverse consumers use exact O facts (95,114–115). Thus the prior ordinary absence should survive inspection until explicitly adopted, and the ordinary adoption should have an inverse. This is an A0-derived expectation, not something inferred merely from Link retaining an absent baseline or asserted as a pre-existing passing plain-member test.

## Source chain

References are to the preserved inspected source under `packages/kernel/src/`.

- `lib/internals/member-membership.ts:166–173,236–273`: live absence is computed from descriptor enumerability. The dormant binding/cache locates and caches that physical answer; it is not a history of ordinary presence.
- `:702–722`: inspection reactivation uses the same activation primitive, restores enumerability and may disable the scalar absence path when the omitted count reaches zero. No participation-specific ordinary-presence baseline is retained there.
- `:384–409`: a later write returns immediately from re-add when the location is physically present. Consequently it never captures the ordinary-absence-to-presence transition that would be needed in this witness.
- `lib/internals/tree-scalar-slot-runtime.ts:252–281`: `inspectionBaseline` stores an ordinary scalar value per slot. Inspection 99 can retain ordinary value 7. Later y=7 compares equal to that ordinary value, so its scalar semantic change is false even though physical value changes from 99 to 7. That value ledger correctly distinguishes values; it cannot encode whether retained 7 was ordinarily absent. Encoding absence as value undefined would also conflate a present undefined member with absence and contradict the existing contract.
- `lib/internals/tree-scalar-leaf-runtime.ts:129–144`: record reads use the slot ordinary value; re-add occurs after commit via the physical absence hook. The source can therefore report no ordinary value change and no membership change in precisely this sequence.
- `lib/internals/plain-branch-membership.ts:87–168`: capture takes presence before and after from enumerable descriptors. It can emit actual physical changes but has no prior O-presence input when physical presence is already true. Calling this capture later is insufficient: before and after would both be present.
- The same limitation exists in native replay admission/read and prepared before-images (`plain-branch-membership.ts:714–723,945–961`). These helpers can consume a selected membership effect if one exists; they cannot reconstruct its missing before-presence from the scalar value or current descriptor.

Existing transaction inspection footprints/branch capture are downstream records of actual captured mutations, not a persistent ordinary-membership baseline. Scanning prior transaction/history events would not supply a general native source: omission can precede the transaction and a Link, and history need not exist. A connection-local absent projection can reveal this witness but must not become rollback authority; the no-Link case requires the same native result.

## Scope classification

For this one retained child under an existing parent, A0 already requires the semantic distinction: ordinary member presence, inspection isolation, explicit existence adoption, exact ordinary inverse, and ordinary membership completion even without a value event. Named source owners include member-membership, plain-branch realization, scalar writers and whole-value writers (A0 lines 109–115). Addressing it does not inherently add a new writer family, aggregate declaration surface, settlement selector, or nested-missing-parent policy.

However, A0's sparse relationship *publication support* map is not an existing native ordinary-presence ledger. Its writer table says to retain the same descriptor authority and consume exact O facts; that was an unfilled source premise for this case. A new source-level P/O-presence divergence representation is therefore more than implementing an already-described port. It affects native capture and inverse authority even without Link, so it needs an explicit source ownership/installation/retirement mapping in the experiment record and review before being treated as covered.

Such metadata is not automatically a prohibited second canonical value store: it need not copy payloads or compete with descriptors for current physical reads, just as the existing scalar inspection baseline does not make inspected physical value the ordinary baseline. But calling it sparse does not resolve authority by itself. Its ordinary-presence answer must be the single source supplied to capture and selected inverse, independent of Link subscription; otherwise the change would create competing ordinary answers. This report identifies that requirement, not a design or implementation approval.

Keep the first scope at the existing lifetime and existing parent in this witness. Fresh child identities, hidden ancestor creation/reactivation, sibling exposure and nested missing-parent behavior do not follow from it. The physically observed retained y identity is enough to analyze this gap without selecting those policies.

No runtime or architecture file was changed. The observed failure remains preserved; no assertion was weakened and no automatic expansion or repair authorization is inferred.

Archived witness spec SHA-256: `65da8178f977561bb234071fe90cea7c1a40b772c05f49f15a3dafc7c63221d7`.
