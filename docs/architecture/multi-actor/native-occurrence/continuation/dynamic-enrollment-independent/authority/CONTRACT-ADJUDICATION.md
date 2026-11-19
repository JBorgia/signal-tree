# Independent contract adjudication

## Known native input: the returned-receipt expectation conflicts with the approved experiment contract

**Disposition:** Main may correct that specific obsolete receipt expectation while preserving the original and retaining write/ownership/settlement assertions. This is bounded experimental contract reconciliation, not approval of public aggregate APIs or release activation.

Authority was read directly, not inferred from passing tests:

- Git `247cfec70c87c591e69e87dc3ee514840dad3f61`, `link-api-proposal/PROPOSAL.md:49–58`: independent asserts a complete empty dependency set; runtime validates known contradictions, not hidden-input completeness.
- The same proposal, lines156–171: late contradictions throw after installed writes remain conservative; code/stage/reason are prescribed; **no receipt is returned from a throwing call**. An original callback error remains primary if one exists.
- Exact supplied candidate `RELEASE-CURRENT.md:716–724` records owner approval of the proposed surface at247cfec7 for the bounded native experiment, explicitly not production activation or release acceptance. The checkpoint's proposal text was retrieved directly from Git and preserved in `authority/247cfec7-PROPOSAL.md`.

The original `aggregate-native-input-independent.spec.ts` sets root x=7 under p, then an independent declaration writes descendant pair using the root updater's supplied `input.x`. This is an actual supported updater argument, not a guessed external read or hidden saved-value inference. `private.ts:133–145` captures root native inputs when opening the branch input scope; `private.ts:125–130` carries them into each written leaf's NativeRequirement. `lifecycle.ts:113–130` promotes source obligations into actual input roles; prepareRevision required-input checks conflict with the declaration's empty owner set.

Independent raw trace (`raw-traces.jsonl`, known=true) records a pending p in native **input**, empty initial destination/validation, then invalid/shared-validation evidence in the subsequent preparation. The call throws exact `SIGNALTREE_PUBLICATION_DECLARATION_INVALID`, stage `after-callback`, reason `contradiction`. This classification is supported by the input path and approved rule, not merely the throw.

Fresh-copy replay: Main's two added controls pass; the original unchanged receipt test fails at the throw (`known-input-replay.log`: 2 pass / 1 fail). Both terminal controls retain pair `{x:7,y:0}`, preserve p.inspect ownership, send nothing while pending, and then deliver useful surviving pair7 after confirm or successful rollback, without a new target write. Rollback restores p's root x; it does not retroactively make the ordinary pair copy owned by p. That matches the approved separation of publication dependency from compensation ownership. Keep these stronger controls when correcting the single obsolete expectation; do not delete the pending or post-terminal assertions.

## Wider-input conflicts: current bounded-window authority retains an explicit exception

**Disposition:** the two immediate surviving-fallback assertions cannot be waived by citing the general bounded-window approval. The supplied current owner decision expressly preserves this case's recipient-only fallback. Relative to that authority, the successor's blanket coverageUnknown window is overbroad. If a later owner decision changes that exception, Main must identify that decision explicitly; author intent, passing hold tests, or this review cannot supply it.

Read directly from Git `75c645eb71e4a03e5c84491ce8078debfe797e19` (2026-10-26), preserved verbatim under `authority/`:

- `AUTHORITY.md:6–8,12–18`: owner approved fixed possible-owner holds for undeclared/unobserved-origin writes, including unrelated owners; later owners do not extend the window.
- **`AUTHORITY.md:19–22`: “Recipient-only uncertainty retains its adjudicated fallback”**; native known dependencies remain lower bounds.
- **`POLICY-DECISION.md:20–23`: “Recipient-only coverage uncertainty retains its adjudicated tree-local fallback.”**
- `POLICY-DECISION.md:11–14` predicates the new obligation on lack of complete declaration plus native input evidence; lines24–25 say undeclared updater syntax alone is insufficient. These clauses do not erase the explicit recipient-only exception.

Both disputed tests have a matching independent declaration, an unrelated pending foreign owner, and root-updater native inputs that contain no pending actual dependency. `beginBranchInput` marks the descendant relationship unknown because its recipient field domain does not cover the wider root argument. The native argument evidence is captured separately. The independent known=false trace shows **recipient unknown=true while native unknown=false, invalid=false, historicalWindow=false, and destination/input/validation/possible are all empty**. This isolates recipient-only coverage, not undeclared origin or known native consumption.

Current `lifecycle.ts:210` sets incomplete when `unknown` is true without distinguishing these causes; finalization then captures the unrelated owner. The two original immediate-send expectations fail exactly there (`publication-evidence-scope-controls.spec.ts:14` foreign arm and `collection-contributor-core.spec.ts:110`). The contradictory hold oracle at `aggregate-installed-publication.spec.ts:127` is evidence of incompatible tests, not authority to overrule the selected exception. The approval did supersede unconditional foreign-tree liveness for *undeclared/unobserved origin*; that historical correction must not be extended to a distinctly declared, recipient-only case.

Bounded correction direction: retain windows for an undeclared recipient or explicitly incomplete origin, but distinguish recipient-only projection uncertainty from source/input incompleteness. Preserve unknown/conservative status for the former and its ordinary surviving fallback; do not convert it into declared early permission or erase known D/I/V. A single blanket `coverageUnknown` boolean is insufficient to make that distinction. No runtime repair was made by this review.

All original conflicting assertions and raw failures remain unchanged. This adjudication resolves the known-input error expectation but does not grant acceptance of the recipient-window candidate.
