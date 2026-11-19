# Independent C4 composition inspection

No composition blocker found in the reviewed source delta. Recommend retaining C4 as the composed candidate for Main's targeted gate, not broader qualification. No runtime changes, no tests rerun, no peer verdict used as evidence. Joint/dynamic integration remains outside this review.

## Exact identities and reconstruction

Fully rehashed all manifest files against frozen sources: C2 2976 files, C3 2982, C4 2985; packet successor and both retirement successors also verified. Zero mismatches. VERIFICATION.json records all hashes.

- C2: c7dba7041936bdf80d01e8d69517ce1fd70fcd425325ba3cebf3086a8f8079a3
- C3: ec4902e1c6326df60618c14e820975fb488e858b55cfc73ae4ea616f23c62192
- C4: d5cb5d51990632b161b41dafafd65bc12151f9ea4112f854da1974bacf2c3350
- Packet point-admission successor: 542125745ddaad67aead344961bdfb408e43c6447938f6834413038a90ad413d
- Retirement successor: 05daee5c1db9478e3cdad0bbda8216bbc7f6fd10305622d3c3f2cf895a2bd022
- Cancellation successor: a22a4e603e3e28c2fbcc0d99d11e79f0b8f03eb0c762028896b8897b46fecc8e

C4 RETIREMENT-0.patch is byte-identical to fixed-window-retirement-successor/runtime.patch. RETIREMENT-1.patch is byte-identical to fixed-window-retirement-cancellation-successor/runtime.patch. Independently copied the three affected C3 runtime files into this directory/reconstructed; ran sequentially:

```
# cwd /private/tmp/st-c4-composition-independent/reconstructed
git apply /private/tmp/st-c4-composition-independent/RETIREMENT-0.patch
git apply /private/tmp/st-c4-composition-independent/RETIREMENT-1.patch
```

Both exit0. Every resulting byte matches C4's corresponding file. This is an independent reconstruction in a small isolated source copy, not execution of the library. Author/frozen/root directories untouched.

## No omitted C2 runtime

MANIFEST-DELTAS.json shows no deleted files. C2→C3 changes exactly two runtime files (native experimental-publication/entity.ts and internals/entity-publication.ts), six added packet specs and the occurrence oracle spec. C3→C4 changes exactly those two runtime files plus lifecycle.ts and three added retirement specs. Thus every other C2 runtime byte—including entity-signal, egress projection, ordinary placement producer, lazy owner allocation and recipient machinery—survives through C4 unchanged.

The three placement-sharing physical files in C4 are byte-identical to reviewed st-placement-sharing-successor. The preserved entity-signal C1→C2 diff contains only its expected type import and five final-stage wiring changes: capture after frame.preparePlacement, feed the same entries to ordinary visibility and physical interval. Lazy-owner and ordinary-restoration code were not replaced by the older B-base entity-signal file. Exact inspected diff saved as entity-signal-C1-C2.patch.

## ordinaryPlacements survives packet admission

C3 native entity.ts exactly matches the packet successor. C3 internals/entity-publication.ts exactly matches that successor except for the two-line ordinaryPlacements property/comment carried from C2. No implementation hunk was discarded to preserve the property.

Source chain in C4: entity-signal.ts:931 resolves final ordinary placements; :950 passes them; :2363–2365 puts them on the packet; AdmissionMetadata.prepare spreads the entire packet before overriding its admission-owned fields; entity-egress-projection.ts:201 recognizes placements as structural work and :234 relocates after ordered ordinary edits. Admission does not reconstruct a property whitelist and therefore does not drop this older-base-absent property. All producer/consumer runtime files are identical to C2.

Ownership qualification: resolveOrdinaryRestorationPlacement freezes the nonempty replay array and each row. Admission retains that reference without copying/re-freezing it. The no-restores branch returns a mutable empty []; therefore COMPOSITION's unconditional “frozen array/rows” description is slightly stronger than source. No current consumer writes that array; empty placements contain no relocation instructions and the gate checks length. This is not evidence of lost runtime code or an actual public failure. Do not advertise general stabilization of arbitrary caller-supplied ordinaryPlacements metadata: current correctness relies on the source-owned producer. If that private input surface is expanded, stabilize it explicitly then. No runtime change requested here.

## Packet + retirement native composition

The independent reconstruction proves C4 keeps packet's per-preparation ordinaryEdits sequence, last-occurrence proposal index, singleton path, and support subject enumeration alongside the exact retirement delta. Sequence execution remains ordered; only proposal lookup uses the last occurrence. Retirement adds exact-subject assessment/deletion, not an alternative packet index or cached publication authority.

Internals/entity-publication.ts keeps admission before native source creation/deferred point bookkeeping. Retirement keeps separate source/retirement revision tokens, validates disposed/recipient/retirement changes at finalization, and rechecks source revision plus snapshot-current and eligibility at queued retirement. Settlement observation is separate from readiness; subscriber cancellation is cleared/rebuilt per recheck. Packet's prepared edits do not become readiness or retirement proof.

## Own-W provenance and classification

C4 lifecycle.ts is byte-identical to the final cancellation successor. retirementOwnWindowOnly is computed once at prepareNativeRequirement from original !unknown, known.length0, inputs.length0 and active.length0; it is not reconstructed from compacted proof/cleared arrays. Existing nativeProof, fixed-window capture/finalization, role mapping, invalid/unknown classification and recipient receipt logic remain unchanged by the retirement delta.

Native retirement recursively checks composite constituents. Invalid/unavailable/terminal-rejected/actual destination/input/validation obligations refuse release. An unknown/possible requirement needs both original own-window provenance and historicalWindow; only authentic terminal cells discharge it. Unavailable pending owner sources are not treated as settled. Exact live cells receive queued transition subscriptions; cancellation checks original observer-set identity and cannot delete a later registration. No W→input/owner/declared grant promotion introduced by composition.

All six added packet specs and three retirement/cancellation specs in C4 are byte-identical to their component sources (COMPONENT-MATCHES.json). Original chronology is not rewritten. C3's recorded11 existing reds and point-work limitation are not discharged by a textual composition review; Main's running20-file gate is not rerun or claimed here. C4's pre-copy runner-not-found attempt remains an environment/nonexecution event, as assembly receipt states.

## Scope decision

No additional runtime discriminator was necessary to resolve the composition questions: whole-manifest deltas, exact component matching and byte-exact independent patch reconstruction rule out the specific dropped-code/type-property concern; source inspection confirms the producer/consumer and proof boundaries remain connected. This does not establish all cross-mechanism semantics. Preserve Main's targeted gate, existing refusal/retirement negatives, and independent joint/dynamic work before broader qualification.
