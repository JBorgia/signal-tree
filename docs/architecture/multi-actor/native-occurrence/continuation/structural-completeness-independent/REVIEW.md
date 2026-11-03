# Independent structural completeness review

Disposition: accept this bounded private completeness correction; no blocker demonstrated within the reviewed route. This is not integration, activation, release approval, or a claim that historical private controls are all green. No runtime/test source was edited.

## Identity and execution

Reviewed frozen candidate /private/tmp/st-structural-completeness-successor/candidate. SOURCE-SHA256.json digest: 14be1df54242880b5a10aa8b0822da6fa999d4586ac51047eee1c1dcac2cefe2. Runtime patch digest declared by FREEZE: 6d89cb7159fd0aea9fe4a3ca44e717cfb689aa1a299756ccc343dba7468e0996. Compared predecessor manifest c5bc23c33106f0ba39223c9ac27665732dad087bf65f1342159c9c5093b77221: only runtime change is tree-realization-adapter.ts; two added test files. Public handoff fixture is byte-identical to my original. Root HEAD inspected: 628d302dadb082a48c58528651c9088234d0a777; unrelated dirty root files preserved. Read docs/review-contract.md, contributor contracts and the prior DESIGN-DISPOSITION.md.

Copied all 2947 manifested files, verified hashes before execution and after both runs against frozen source and isolated copy. No differences. Existing dependency symlink; Node24.15.0; pinned pnpm through corepack; Nx daemon/plugins disabled, skip-nx-cache. Exact commands/environment/cwd in COMMAND.json and HISTORICAL-COMMAND.json; first logs preserved. These are independent execution results, not imported author acceptance:

- Intended suite: 124 passed, 0 failed, Nx exit0. Original structural6, completeness6, public handoff2, adapter/opaque/p0c67, transactions43.
- Unchanged historical sequence: 5 passed, 3 failed, Nx exit1. Raw historical-vitest.json and historical-first.log remain intact.

VERIFICATION.json records the full identity check; PREDECESSOR-DELTA.json records changed paths. No type, framework, full-kernel, release, retention or performance gate was independently run here. Author type results are not represented as my verification.

## Source-supported mechanism

References below are candidate-relative.

packages/kernel/src/lib/internals/causal-runtime/tree-realization-adapter.ts:497–547 validates original ordinary structural groups before physical lowering. The new completeness check requires the actual source ordinary installer. Context-free rekey remains supported. Existence effects require same-subject, non-rekey context with an own value field; it checks presence rather than truthiness, so an own undefined payload is not confused with missing evidence. For add, getStructuralAddEffect at :3051 resolves existing carried or descriptor-backed evidence; the resolved object is now carried on the ordinary operation, rather than merely checked and discarded. No historical payload is reconstructed from display. Existing carried valid context is not replaced with another recipe.

The remove guard is deliberately scoped: absent recipe invalidates the whole paired operation before prepareOrdinaryRealization is called. It does not claim the source could never derive a removal fact; it implements the explicitly reviewed refusal alternative because the current installer requires context. entity-signal.ts:710 onward confirms add/remove ordinary contributions depend on storedContext while rekey synthesizes its own fact from original endpoints. Carrying descriptor context therefore addresses an actual producer/consumer mismatch.

Invalid admission returns an exact marked array; validateEffects at :549 refuses it and applyAtomically at :577 refuses before preparing members or frames. Both scalar orders independently verify unchanged physical ids, sibling value, actual ordinary presence, support identity and commit revision, with zero source preparation/completion deliveries. This closes the demonstrated accepted-no-op path rather than changing only the old requirement-identity assertion.

Exact-array admission, revision checking and one-use remain in place (:487, :546, :578–583); revision is checked again after planning before installation (:677). Complete ordinary-only removal now changes actual ordinary presence despite an empty physical removal and cannot replay. Descriptor-backed restoration installs both ordinary presence and the original payload/order. This delta adds no callback bypass or fallback grant.

Legacy arrays that did not traverse prepareOrdinaryEffects retain the existing physical route; the new guard is not a universal structuralContext precondition. The explicit legacy removal control passes. Complete remove with an obsolete diagnostic key followed by rekey passes: subject-based removal was not changed into strict remove-key matching. The public numeric/string handoff tests pass through undo/redo and transaction planners, retaining exact row identities and distinguishing number 2 from string '2'. No expansion of the direct private physical handoff planner is claimed.

## Historical failures, explicitly not green

1. Ordered semantic vacancy with context-free remove: previously passed, now fails validation. This is a real change to the private paired admission expectation, justified by the reviewed refusal alternative. The distinct complete-context positive preserves subject-based obsolete-key semantics.
2. Ordinary-only context-free removal: historical expectation of admission plus changed requirement identity remains failing. The prior accepted operation was a demonstrated ordinary no-op; requirement identity was not a sufficient presence oracle. The new negative and complete-context positive check actual ordinary presence.
3. Numeric/string direct private handoff: remains failing, now at incomplete-removal admission instead of the earlier physical occupancy/planning failure. This is not proof that the direct private planner was repaired. Two genuine supported public planner controls pass unchanged.

All historical assertions remain executable and unchanged. Their preserved failures must remain separate from the intended 124-pass statement.

## Limits and falsifiers

Ran: whole-unit incomplete refusal in both scalar orders and direct apply; complete-context ordinary-only installation and replay refusal; authentic descriptor fallback; legacy unlowered removal; complete ordered removal/rekey; original external-drift versus inspection-relocation controls; public typed-key handoff; unchanged adapter/restoration/transaction controls; preserved historical8.

Source-inspected rather than newly probed: revision rejection around planning, retained source selection, paired ordinary/physical transport and one-use consumption. This patch does not deeply freeze caller-owned nested recipes or authenticate arbitrary fabricated private objects. No new guarantee is inferred for mutation of those recipes, cloned admission arrays, exotic callback-bearing payloads, or all callers of the optional port. The reviewed completeness invariant applies to typed source-produced structural effects with numeric subjects on this paired route. Other declarative/public planners retain their own preparation and commit boundaries. No concrete new failure in those boundaries was demonstrated by this delta or replay.

The bounded correction is sufficient for the two demonstrated completeness defects without imposing a blanket context requirement on legitimate physical routes. Broader inherited integration findings and independent collection/retirement work remain outside this acceptance.
