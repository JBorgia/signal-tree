# C28-R2 first gate — frozen for independent review

First bounded gate passes19/19. No broader acceptance, composition, activation, API or budget change. Stop at this identity for independent source/mechanism review before expansion.

Candidate `/private/tmp/st-c28-r2-cutoff/candidate`; MANIFEST.json SHA256 `597eaf690450a74cc128b8e90b7032aa7d5ef842deae48a4358ade9ed4b9952c`. Base is test-qualified R1 `8845040f287d4062ff368d558e713edd5b30ad684b51d67d10ed93a9189c3f22`, runtime-identical to rejected R1. Every base input remains unchanged. All prior R1/C28 failures and independent packets remain untouched.

`runtime.patch` SHA256 `0d01c32f3faccb74f464d1e6de9e49606dbae0a1c70184ae682d6f79c6e08834` changes only lifecycle.ts/private.ts, relative to test-qualified R1. `tests.patch` is separate. SNAPSHOT.json gives file hashes, provenance and run results. No diagnostic exports/trace wrappers installed.

## Mechanism

At scalar preparation, P is always predecessor.requirement. S is supplied only when the selected retained certificate is genuinely old (not the admitted proposal). C remains the raw prepared invocation. currentRelevance explicitly collects P, optional S and captured input requirements; all must be ready at admission before any cleanup is eligible. Open history gets an empty mask. No delayed reclassification or settlement sweep.

Candidates include closed historical I/V and current invocation I/V. Existing captured-pending arrays and frame protection form L; confirmed-at-cutoff cells in L remain protected. Existing role guards preserve D/W/unclassified actual owners; unknown/invalid/unavailable/rejection flags are unchanged. Current confirmed validation is still checked through raw C/frame installedOwners before any transported proof can omit it. No declaration permission is inferred from source support.

Source combineScalarNativeRequirements uses its frozen constituent list. Its fresh proof getter returns raw combined proof until every constituent passes activation AND finalization readiness. Only afterward can the admission mask shorten the transported proof. Existing C26 normalization replaces this getter with data and deletes ancestry; retirement classification still walks unprojected constituents first. No old issued requirement is projected or recursively normalized by the new cutoff helper.

Recipient Operation stores raw invocation only when it has a nonempty prospective mask. projectionReady checks both remaining frames and current invocation/native readiness. finish() computes raw frame/native proof, closes its frame references, and applies relevance only if both barriers permit it; otherwise proof/dependencies remain raw. refresh()/decision() cannot treat such a masked-but-unready operation as ready to publish. projectRevision() retains mask/invocation when called early, and clears them only after valid projection timing. Existing private ready() already waits for invocation; it now also checks native readiness before masked projection. No new listener is created: existing installed completion/horizon/recipient wake ownership handles progress. Historical closure guarantees any old constituents of this masked scalar were already ready at admission.

The same mask reaches ordinary occurrence replacement and actual reduced aggregate prior/effective comparison. No y-specific equality, forced receipt state, blind operand swap or comparator-only workaround. Existing noWrite preserves the old receipt/operation after current source installation. Unit relevance is cleared when reduction completes; Operation mask/invocation are cleared on qualified projectRevision. Transient P/S/input arrays exist only in currentRelevance; only cell eligibility is returned. Source getter closure is removed by existing normalization. These are source paths, not a new all-root reclamation result.

## Preregistered first gate

All six fixture hashes recorded before runtime edits in PREREGISTERED.json. No assertions or fixture bytes changed after the pre-edit run. Exact approved A/B file copied unchanged. Inherited public/internal negative-type classification remains intact; no public unsupported grammar was cast into acceptance.

Command, in both runs:

`corepack pnpm nx test kernel approved-current-obligation.spec.ts current-cutoff-r2.spec.ts current-validation.spec.ts cached-current-input.spec.ts opaque-current-input.spec.ts scalar-horizon-lifecycle-controls.spec.ts --skip-nx-cache --maxWorkers=1`

Node24.15.0/pnpm10.17.0; run-owned Nx cache/data/temp; external180s owned-group cap. COMMAND.json/PROCESS.json/SOURCE.json/RESULT.json and first.log preserved. Existing archived-tsconfig warnings remain unsuppressed.

- `runs/before-first`: unchanged test-qualified R1,14pass/5fail, exit1. Failures: approved A/B2; source/recipient projection barrier2; open-old-history followed by fresh no-write1. Exact first failures preserved, including all soft assertions and useful terminal behavior. No timeout/sourceUnchanged=true.
- `runs/after-first`: same19 tests, six files,19pass, exit0. No timeout/sourceUnchanged=true. No retry or post-run runtime correction.

## What the controls establish

Approved A/B: both fresh receipts no-write; historical receipt remains the surviving sender; p holds before confirmation; exact one payload afterward; callback once, notification/inspection unchanged, sticky final states. BEFORE-AB/AFTER-AB.jsonl retain the full matched observations.

New two-order internal barrier controls use an authenticated already-confirmed transaction handle in raw declaration validation, not a fabricated owner proof. They install existing terminal records/prepareRevision directly to expose source and recipient timing. Before closure/activation, both retain the validation cell; after both barriers, the new transported proof omits it while raw issued C retains it. Retirement blocker stays true because unprojected validation originally existed. Source identity stays its fresh composite, with ancestry closed by existing completion. In activation-last order, lifecycle.proof after finish still contains the cell before native activation. This directly exercises the previously identified finish() gap, not just source getter behavior.

New readiness-sentinel control verifies exact thrown identity, continued later listener invocation, completed normalization and preserved retirement blocker despite a throwing listener. Its title mentions invalidity, but this particular body does not introduce invalid raw declaration evidence; do not count it as an independent invalid=true projection test. Existing public horizon callback-sentinel test covers primary throw, installed nested work, conservative hold and later recovery. Explicit projected-invalid=true/rejection-bit testing remains a possible next focused review requirement.

New public open-history control makes two admissions within an outer horizon, confirms q between them, and preserves p ownership/no premature send. A later closed fresh admission becomes no-write, retains the earlier receipt and delivers exactly once after p. It checks supported observable behavior; it does not directly count the intermediate mask. Historical closure restriction itself is source-reviewed, with two-order internal timing tests complementary.

Unchanged current-validation3 checks confirmed nested validator completeness, pending input confirmed inside updater, and pending-at-declaration-entry confirmation. Original fresh pending-q leak test and unchanged independent opaque4 all pass: genuine current input and both opaque owner responsibilities hold; saved-before-q payload stays isolated. AFTER-CACHED/AFTER-OPAQUE.jsonl preserve observations. Five unchanged public horizon controls preserve alias replacement, no-source-recipient support, late enrollment/disposal, outer error and useful terminal behavior.

## Limits and next review

No source/spec types, builds, full suites, framework repetition, cost gate or new root-growth run at this first freeze. Test-qualified R1's prior spec-type pass does not certify the newly added R2 test or implementation. No revised ceilings or release claims.

First gate does not prove arbitrary preparation/getter interleavings, all activation-failure paths, rejection-role combinations, all-root retention or entity normalization. Entity completion.support/source machinery and snapshot registration/capture handoff are unchanged. Retirement algebra itself is unchanged; the new control checks its blocker under projected confirmed validation, not all45 model cases again.

Independent review should inspect closure operands/consumed-history coverage, no-mask versus masked operation timing, exact literal/restoration bypasses, finish() ordering/error precedence and release paths. Any new semantic conflict or requirement for broader responsibility machinery stops this prototype. R1 remains rejected; this packet is the separate reviewed-design implementation awaiting its own review.
