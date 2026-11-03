# R3 comparator-only frozen first gate

Bounded implementation ready for independent review, not broad acceptance. Candidate is frozen; no further mutations planned. Exact baseline R2 manifest 597eaf690450a74cc128b8e90b7032aa7d5ef842deae48a4358ade9ed4b9952c verified across all3093 input paths before copying. Final3095 paths reverified. Root runtime/config/tests untouched.

## Identity and scope

- Candidate: `/private/tmp/st-c28-r3-comparator/candidate`.
- MANIFEST.json: `e0b64de42df330abff455d2ee1b981c99abee187a77269cd064f52f3b08505f3`.
- RUNTIME-MANIFEST.json: `1edb39e668f2a370554f692d455b75fac08a9836003a150acd09e2326368a08c`.
- runtime.patch: `e29e34f8b4a5043da4f984c104ad683ba65869c9b2da3a3d5c12bf22ce7db634`.
- tests.patch: `736ce6c0c517eb9e86613cdcfdadb54e836261bfecac0d4d9facb599fa127e8a`.
- SNAPSHOT.json records separate final diagnostic manifest and overlay hashes.

Runtime delta only lifecycle.ts/private.ts. No support-index representation, public API, source cleanup/transport, current-op projection/reconciliation algorithm, entity dispatch, snapshot registration or authority change. Existing currentRelevance/currentObligations source permission remains unchanged. The comparator predicate is a different consumer with strictly disposable outputs.

First authentic pending-to-confirmed transition stores an exact-cell weak timestamp. Monotone bigint has no reset/wrap; repeated terminal events do not restamp, reversal still throws before mutation, source retirement/unregister do not manufacture confirmation. Native scalar preparation reads the cutoff before preparation/selection; completion carries an immutable copy of captured-input/frame pending protection. Eligibility uses exact authenticated stamped identity, confirmed outcome and first-confirmation at/before the captured serial. Confirmations after cutoff cannot qualify. No historical strong cell registry.

Only ephemeral no-write comparison projects this eligibility. D/W/unclassified roles and all existing flags remain exact, plus value/clean comparison. Stored source/recipient proofs and dependencies are not rewritten by this descriptor. Existing lifecycle.noWrite/fallback handles successful equivalence. Descriptor is cleared on reduction and disposal.

Actual prior completion is witnessed by a WeakSet of exact aggregate proof objects produced by private.ready after raw invocation/frame barriers, selected/native readiness and index.unresolved()==0. Ordered pending reduction handles tentative prior siblings. A subsequent proof replacement does not inherit a Fact-wide bit. Missing witness conservatively falls back to the unchanged R2 comparator; it does not broaden filtering. Current operand receives the same barrier checks. Pending actual owners need not settle: native completion is different from transaction outcome. Unresolved defensive guard reachability remains a coverage limit below.

## First failures and final results

Every run preserves first.log, COMMAND.json, source hashes, process group identity and RESULT.json. Pinned Node24.15.0/pnpm10.17.0 via Nx, maxWorkers1, own Nx/tmp, external owned-group180s cap. No timeout. Historical archived tsconfig warning remains in raw logs, not suppressed.

| Run | Outcome | Interpretation |
| --- | --- | --- |
| runs/before-public | 1pass3fail | Public collapse n2 fails; A/B runner missing required output env. Preserved tooling failure. |
| runs/before-public-env-corrected | 3pass1fail | Unchanged R2: A/B and meaningful sibling pass; public collapse n2 conservative vs required no-write. |
| diagnostic/runs/before-original | 2fail | Unchanged original n1–n4 stops at n2; terminal assertions not reached. |
| runs/after-public-first | 4pass | First R3 public discriminator. |
| runs/first-gate | 26pass | Prior checkpoint, preserved FIRST-GATE-RUNTIME.json and first-gate-runtime.patch. |
| diagnostic/runs/after-original-first | 2pass | Original n1–n4 at prior checkpoint, both endings useful. |
| runs/final-gate | 26pass, exit0/sourceUnchanged | Frozen runtime. Eight explicitly selected files. |
| diagnostic/runs/final-original | 2pass, exit0/sourceUnchanged | Frozen runtime plus separately hashed output-only overlay; original fixture byte-identical. |

Final changes after first gate were solely BigInt(0) syntax for existing TS target (instead of0n), and explicit disposal descriptor clearing. Both final runs repeat on that identity. Repeated runs are not additional coverage. Final26 consists of existing19 focused controls, unchanged public sibling pair2, new lifecycle/cutoff/readiness5. Separate original2 use diagnostic exports and are not pure public-source tests. They assert original selected operation/proof/native/dependency identity across n1–n4, useful exact send/old receipt on confirm, pending disposal/no later send, no duplicates and cleanup.

Public sibling fixture is unchanged from /private/tmp/st-c28-r3-public-controls/TESTS.patch. Existing A/B and R2/raw validation/opaque/cached-reader/readiness controls unchanged. No assertions weakened. Source/public/spec types and broader147 are delegated qualification, not claimed here; no builds/full suites/cost measurements run.

## Boundary limitations, not green claims

Read `/private/tmp/st-c28-r3-boundary-controls/DIAGNOSTIC-REQUEST.md`. The late-confirm public seam executes confirmation after native preparation and before recipient preparation. Its public receipt/output can match even when no filtering occurs. Our new private predicate control directly proves post-cutoff and captured-pending exclusions, but no output-only observation of that exact public seam has been executed here. Such observation must record copied cells/roles/flags and ignored identities, not retain mutable proof roots.

Tesla's aggregate probe did not reach index.unresolved()>0; preserve that as a coverage miss. Source seam exists at RecipientOccurrences.replaceEntry readiness subscription, while private.ready independently processes completed units. However shared horizon closure and installed-order reduction often resolve all relevant scalar requirements before comparison. I have not established a genuine public schedule leaving an unrelated selected occurrence unresolved at this exact comparator while the current Unit can reduce. No injected requirement is claimed as public evidence. Current private readiness control proves activation/projectionPending distinctions, not this missing public scheduling path. The guard is conservative defensive code pending a source-grounded reachable discriminator.

The exact-proof WeakSet intentionally declines broader comparison for later replacement versions not marked by this reduction seam. No general liveness claim across all observation/index replacement paths. No all-root/heap bound inferred from finite n1–n4.

Independent source review and qualification remain pending. McClintock and Plato received direct explicit freeze confirmation. Main's direct app message was refused because it is the native ancestor; progress/final carry the same identity.

## Final bounded closure check

No actual reachable public/native unresolved-occurrence-at-comparison path was identified. Treat index.unresolved guard as defensive source-only coverage, not general readiness/liveness proof. No further search planned.

Separate frozen release-check/candidate uses exactly final diagnostic runtime and adds only a disposal fixture plus a copy of the existing lifecycle fixture. release-check/runs/descriptor-first: 2pass4filtered, exit0/sourceUnchanged. Exact filter: disposal clears actual|post-cutoff confirmation. The cutoff case directly tests actual first-confirm metadata and immutable descriptor projection, not receipt-only behavior; it asserts both post-cutoff and captured-pending cells survive filtering, and fresh unprotected confirmed history is removed. This is private predicate coverage, not the missing output observation of Tesla's public preparer seam.

Disposal case creates real public pending units inside an open declaration horizon, proves at least one comparison descriptor exists, retains those exact Unit references, disposes before horizon completion, and asserts every descriptor cleared. It also checks disposed receipt, unchanged owner inspection/saved snapshot, no output after confirmation, and settled completion. This is reference-release evidence, not a heap/GC claim. No production diagnostics added.

These2 tests are not added to26 as wholly new coverage: the cutoff test repeats an existing case; disposal is one additional diagnostic case. All runtime/test candidates now frozen. Production MANIFEST remains e0b64de42df330abff455d2ee1b981c99abee187a77269cd064f52f3b08505f3 and was fully reverified after closure check. Independent qualification/review and Main's bounded decision remain distinct from integration.
