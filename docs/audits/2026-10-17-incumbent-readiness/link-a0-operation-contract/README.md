# A0 operation admission and completion: design disposition

The expanded design is ready for a bounded native A1 experiment, **not integration**. Production remains `87f6831fa60cafe87508f0ace84b7638698ca3b0`; rejected `f01ed39a7df8a5de185ebec0773e09e36537dacb`, first failures, budgets and historical B closure remain unchanged.

[Final A0 contract](A0.md), [composition and writer map](COMPOSITION-MAP.md), [native timing trace](WRITER-MAP.md) and [destruction/disposal trace](DESTRUCTION-MAP.md) define the finite mechanism. [Premise audit](PREMISE-AUDIT.md), [first interpretation review](INTERPRETATION-REVIEW.md) and [correction review](CORRECTION-REVIEW.md) distinguish design survival from unexecuted native obligations. [Identities](IDENTITIES.json) and the two source manifests preserve exact provenance.

## What the mechanism changes

Install exact value, membership and publication-support facts with incumbent responsibility before observable delivery. Preserve partial ordinary operations and native capture timing; do not invent whole-method atomicity. Carry completed ordinary/physical order evidence across existing history/transaction selection. Track each payload's contributing facts, rather than allowing its last write to certify the whole payload. Register completion work even when no public value event occurs. Keep terminal receipts separate from still-needed proof and in-flight delivery.

It replaces experimental notification-time admission, whole-payload latest tickets, event-relative completion, missing-work wake logic and intermediate-domain composition. It retains native current truth, incumbent settlement, relationship creation baselines, the existing notification protocol and serialized delivery. It does not promise arbitrary JavaScript causality or hide the new publication-support authority's costs.

## Review corrections and disposition

The [first draft](FIRST-DRAFT.md) is preserved unchanged at SHA256 `14af9c8e7e174a7b7c5d7e73d8620472dd055e20dd42cf6410043510aedce72e`. Review found:

1. Equal P/O values can still require fresh publication responsibility. The final design distinguishes unchanged effective support from an explicit equal setter after rejection, without manufacturing a value event or transaction effect.
2. Nested child dependencies accumulate into enclosing known evidence. They cannot disappear when an outer literal overwrites the value. A fresh separate scope remains distinct.
3. The useful literal-y case needs established baseline presence. The final design supplies it when the actual conservative gate permits baseline establishment; creation during pending work with unavailable evidence stays honestly unknown.
4. Completed source units alone do not fix history composition. The final map names history bucket, selected inverse and pre-reentry order witness consumers.

[The frozen correction candidate](REVIEW-CANDIDATE.md) and composition map were independently reviewed. That review required two final precise corrections, both incorporated centrally:

- An outer complete-empty declaration which learns child dependency p is an after-callback contradiction, not merely a valid held operation. The declared set remains separate from accumulated known evidence. This follows the approved completeness/error contract; f01's contrary behavior is not the oracle.
- Registry removal cannot downgrade a retained authentic confirmation. Only unresolved/unverifiable evidence becomes unavailable. Removal does not invent any terminal outcome.

The correction review states no remaining A0 mechanism/authority blocker once these are incorporated. The final A0 text has those two corrections; it is not falsely labeled as the exact hash reviewed before those edits. Central verification checked their wording against the cited API and lifecycle source. No runtime, model, tests, builds or performance measurements ran for A0.

## Gates and remaining limitations

A1 must execute the original compound-undo and leaf-Link failures unchanged, plus A0's prewritten discriminators. Test state no-op versus support-only reauthoring, nested completeness errors, membership-only completion, P/O adoption, partial failure/reentry, useful delivery, receipt terminality and explicit teardown. It cannot pass by holding or refusing every operation. A1 is isolated; it does not automatically resume the old later slices.

A2 covers all mapped writers, four frameworks, inspection/restoration/entities, Link composition and retention. Only then can A3 freeze source for whole-system qualification and preregistered cost comparison. No new API/public semantics, automatic activation, ceiling increases, merge, push or publication is authorized by a design pass.

Source destruction is not connection disposal. The source-destroy-only held-waiter gap remains unqualified; explicit disposal's release and cleanup are a separate contract. Creation during pending work without trustworthy support is not claimed to provide universal early progress. Both qualifications remain visible acceptance limits, not silently promoted passes.

The design adds metadata and affected-source/dependency indexes whose size and runtime costs are unknown. Original f01 qualification and costs remain its rejection evidence, not measurements of A0. Historical B remains closed.

## Verification and replay

A0 is source/design work. Replay no new runtime test here. Verify frozen-source hashes from `/private/tmp/v16-transition-qualification` with this packet's `FROZEN-SOURCE.sha256`; verify contract hashes from Git revision `763b696191b76c405100eeb4c9144cda9f8d14d7`, not a later working controller. `MEMBERS.sha256` covers the saved packet.

The original native replay commands, source identities and logs remain in [slice-5 integration disposition](../slice5-integration-disposition/README.md). A1 must save its new commands/results separately; design review cannot inherit those as green results.
