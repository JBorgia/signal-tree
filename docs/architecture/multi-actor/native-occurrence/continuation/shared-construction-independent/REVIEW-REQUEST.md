# Shared construction extension — independent review request

Frozen candidate `/private/tmp/st-shared-construction-successor/candidate`.
Manifest SHA-256 `f63ade892aa381b827f1db54986fbb2ca787cb1bde497847104bd0a40bd9dffe`.
Source delta SHA-256 `cf878ebbd612bb79237f5fc38e31c980d09e42ccf2deeb7080c14bcabca5d679`.
Tests delta SHA-256 `44fb3e0913ce0492481dce28dae462dec46380e5b46de85688ce9074ac3905b4`.
Base is the unchanged a158ac53 construction-cleanup freeze. SOURCE-SHA256.json covers full source; source.patch is only the additional three-runtime-file delta; changed-files.tar.gz includes both new fixtures. Review in a disposable copy, no author edits. Main retains combination authority.

Question: does this extension close the named materializeMember→bindMember cleanup and source-responsibility gap without changing reuse, source identity or publication chronology? Independently challenge actual producer behavior. This request is additional to, not a substitute for, the a158ac53 implementation review.

Producer/source inventory:
- `materializeKeyedAware` accepts the marker dispatcher's ordinaryBranch request, builds the canonical branch and attaches `authority.bindMember(branch)` only for keyed lookup.
- `bindMember` derives owner position/path/address from that actual source. It now creates an explicit construction owner before reserving any child position or recursing, uses the same constructionContext helper as ordinaryMemberBuilders, builds the same canonical ordinary branch/cells, and prepares responsibility from `(ownerBranch,key,child)` before returning a PreparedMemberConstruction packet.
- `materializeMember` still checks KEY_INDEX first. Active/dormant identities use the unchanged applyMemberValue path and do not acquire a new allocation record. First appearance passes the packet to the existing installPreparedMember frontier and closes allocation in finally. Publication now uses that existing construction-owned install boundary, avoiding a second membership notification after return.
- Failure during construction/responsibility is closed at the producer. Failure during membership preparation/validation is closed by the caller. Installed/completion failure is protected by the same installed receipt as a158ac53. No materialize callback or framework factory was moved into attachment.
- MemberMaterializer's return type changed only in the private source module. Public root/adapter/internals barrels are unchanged; no public SDK surface or marker policy is added. This producer is the existing private ordinary-keyed mechanism, not EntityMap row construction.

Preserved tests-first baseline: keyed-red runs four original new cases against a158ac53 before runtime edits. Held failed-branch new-key writes hit native occurrence ancestry/lifetime errors; the responsibility callback is never invoked; rollback leaves the new member present. Preserve those exact first outcomes: do not summarize them as all slot-count failures. The subsequent recursive-getter and actual native controls supplement the original four; they were not run red before implementation.

Final controls: 433 kernel pass, 28 actual Angular pass, source types pass, spec ratchet pass (no baseline update). Includes all previous428/26 controls. New controls require nested same/other-key identity survive refusal, escaped failed branch cannot route writes/new allocations to root, exact old position/leaf slots no longer resolve, responsibility refusal acquires nothing, transaction creation rollback removes the new membership, dormant reuse preserves handle and allocation count, recursive later-getter failure releases the earlier provisional leaf, actual Angular signal identity/.set/.update/computed survive adoption and rollback/reuse.

Please test adversarial same-key validation without explicit throw on this keyed entry, completion reentry, and responsibility/source pairing as needed. Common installation controls cover those on the ordinary entry; do not infer exhaustive keyed variants from that. Scope is the two named post-construction ordinary-member producers. Initial whole-tree construction failure, arbitrary custom marker implementations, all frameworks, universal heap retention, activation and performance remain outside these run claims.
