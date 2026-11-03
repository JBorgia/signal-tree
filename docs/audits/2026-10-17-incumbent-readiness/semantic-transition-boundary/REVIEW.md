# Independent mechanism/API feasibility review

Read-only against checked HEAD90c1bd1118cba0748dd0d233fc787b3d055a39a2 and rejected candidate's entity-signal.ts. No successor implementation or prototype performed.

## Findings

The stated last-loss boundary is accurate. `preparePointRealization` resolves ordered ReversalEffect row-relative paths at tree-realization-adapter.ts730, distinguishes empty whole-row path, deletion via fieldPresence.after, and assignment through734. At738–740 it passes only accumulated subjectId/key/value. The original effects still exist outside that representation. Candidate preparePointValues at entity-signal.ts499 onward then prepares a full-row transition from that physical target, so it cannot distinguish an ordinary realized n edit from untouched inspected m. This is a consumer input deficiency, not evidence that the rollback planner lacks the n footprint.

The point port is private. The source search finds its local CollectionNode declaration, kernel caller and kernel nonenumerable installation; no framework implementation. The adapter SDK file explicitly excludes entity/restoration internals. Changing this private typed handoff is not intrinsically a public adapter SDK change. It still requires internal consumer/type audit and preserving public observable semantics; a nonenumerable property is not a substitute for that audit.

Ordered realized edits can express the demonstrated existing-lifetime n/m failure: retain current physical m, apply the realized n after-value to both prepared physical target and ordinary baseline, and keep m's divergence. No new settlement authority is needed: existing admitted ReversalEffects determine the edit, the value substrate installs it. Do not re-infer authority from the resulting physical row or replay original authored intents.

## Required precision before implementation acceptance

- Preserve the supplied realization effect order. Do not sort by turn number or treat a per-subject set as an ordered plan. Repeated writes and parent replacement followed by descendant edit differ from the reverse sequence. Per-subject grouping may preserve each row's semantic order, but must not claim original cross-row callback/getter execution order without proof.
- Distinguish field absence from present undefined. A missing path descriptor remains unavailable; it is not `[]`. A whole-row `[]` is an actual replacement fact and cannot be substituted for unknown footprint.
- Nested traversal is a concrete unresolved mechanism case: existing `assignPreparedSubjectValue` at1972–2000 silently returns if a parent is nontraversable. A parent may exist in physical inspection display but be absent/nontraversable in ordinary-before. Applying the same edit using that helper could silently fail. The proposal must either use an already-defined construction rule or fail preparation atomically; it cannot silently infer parent creation. This does not prevent expressibility of the known top-level n/m case.
- Applying edits must prepare against isolated values, not mutate retained ordinary-before or effect.after objects through aliasing. Parent/child replacements require owned intermediate preparation; user getters/equality and reentry remain before installation under the revision guard.
- A semantic no-op with physical change and a physical no-op with semantic change remain distinct. Discharge divergence by the actual realized footprint, not blanket clearing of a lifetime's baseline. Retained recovery metadata cannot become visible authority.
- Validate lifetime, key and encompassing revision before any mixed scalar/entity installation. Preparation refusal preserves all outer writes untouched and existing authority. An unavailable point path may use only the already-admitted structural fallback; returning undefined must not hide this same footprint loss in that fallback.
- This proposal does not determine inspection-created/removed-lifetime rollback, rekey, structural/full-target semantics or allocation guarantees. Those require the already-recorded conditional dispositions and sibling audit.

## Disposition

Feasible for the established existing-lifetime point-restoration counterexample; no public API expansion or second ownership engine is necessary in the proposed form. This is not proof the representation covers every nested or structural path. The nested missing-parent case and ordered repeat cases are concrete discriminators, and the sibling source audit remains required. No implementation acceptance follows from this review.
