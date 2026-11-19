# Independent implementation review — scalar observation support

**Bounded ACCEPT of the exact two-file correction; no blocker demonstrated in the requested scalar scope.** Safety alone would not suffice: the frozen candidate also passes useful settlement/reauthoring and independent operation/readiness cleanup discriminators. Main must replay the composed source before treating this as composition acceptance. No runtime, author candidate, frozen base, original assertion or publicsurface edits were made by this review.

## Exact identity

- Base exact C12: `d96cb84faeec4f098b4bba00deb9b82b108a33469b965978e4d248fa354b1df2`,3053 manifest files.
- Candidate SNAPSHOT-SCALAR: `d0b54e145b88a38015b3176000e0a8c23b74ebdc33be6f8eab0c122f2fb4b812`,3055 files.
- RUNTIME.patch: `57e4c3c50cfa30c605ac2fbc6995f81e16a1d961704e388d9cb19a42cca1a689`.
- Full patch: `91c0452964f8b7773aca560567aca6337206bfdb5b345289cb0fc6030aec44d9`.

Author explicitly notified freeze during review. Manifest/patch hashes were checked before acquisition, freeze identity was rechecked afterward, and all original manifest entries in own copies and both frozen sources were verified after execution (`FINAL-VERIFICATION.json`). `EXACT-DELTA.json` identifies precisely two changed runtime files and two added specs. Candidate original specs remain byte-identical to exact C12. The prior actual-contradiction falsifier matches SAFETY-FIRST.spec.ts byte-for-byte. Own discriminators are additional files only and are archived separately; they are not changes proposed for composition.

## Source assessment

`experimental-publication/private.ts:475–509` preserves the selected contribution requirement as a live component and adds only unknown observation evidence. The WeakMap/WeakSet reuse the wrapper on repeated observations; no per-notification recursive chain, global pending-owner scan or new declaration window is introduced. Distinct field facts avoid overwriting one field's proof callback with another field's requirement. The outgoing fact recomposes the complete occurrence index and unresolved count. Existing membership masking, exact-field stale filtering (`:519–537`) and completion drain remain in place.

Observation updates payload/support conservatively; it does not author the scalar. Existing `ready():242–304` remains the source-installed replacement boundary. A genuine literal reauthoring can replace that field's wrapper; sibling work cannot, and a consuming updater retains native/shared obligations. This distinction is verified by the unchanged uninstrumented counterexamples and the useful settlement/reauthoring controls, not inferred from the code alone.

`experimental-publication/lifecycle.ts:421–427` registers an observed revision in the existing operation map and routes its selected owners/possible dependencies through existing projectRevision. It has no declaration frames/views, no native preparation, no recipient authorship window, and grants no new permission. This addition is necessary for useful wake-up: the preserved first private-only runtime stopped early sends but left settlement expectations at `[]` (`candidate-new-first.log`). The frozen implementation both holds and later delivers correctly. This is not acceptance of suppressing sends indefinitely.

Existing operation retirement is reused: `started:326–329`, `supersede:331–335`, `disposeConnection:336–339`, with dependency removal in `retire:325`. Existing index ownership cancels readiness listeners and checks entry identity before callbacks (`recipient-occurrence.ts:57–70,87`). No new parallel listener lifecycle was added. Recomposition may keep dependency interest conservatively until the operation is retired; disposal/supersede/start tests verify its actual removal, not merely disappearance from a diagnostic count.

The weak-cache value references its selected key via the composite. This ephemeron cycle is not a strong global registry. A bounded GC discriminator below verifies release after disposal and dropping an external wrapper reference; it is not a universal heap claim.

## Independently executed evidence

All commands used own verified copies, Node24.15.0/pnpm10.17.0 pinned tooling, isolated copied dependencies, Nx test kernel, skip-cache and one worker. Exact cwd/argv/PATH/env are in runs/*/COMMAND.json; GC's explicit NODE_OPTIONS is additionally in EXTRA-ENV.json. Original first outputs were not overwritten.

| Run | Workload / result |
| --- | --- |
| oracle-counterexamples | Exact C12 runtime plus identical two added author fixtures and unchanged native-certificate: **5 pass /11 fail**,16 tests. Original arbitrary-throw and actual-contradiction scalar safety failures reproduce. |
| candidate-focused | Same three files plus unchanged scalar-frame-publication and publication-evidence-scope-controls: **44 pass /2 fail**,46 tests. All11 added tests pass and original scalar parent-invalidated enrollment passes. |
| independent-lifecycle-first | Six own non-vacuous lifecycle/readiness checks: **6 pass**. |
| independent-wrapper-gc | One bounded positive/negative-control wrapper retention check: **1 pass**. |
| independent-final-spec-ratchet | Spec ratchet including own discriminators: **exit0**, unchanged baseline; same three inherited improvements. Earlier pre-GC spec check also passed and is preserved. |

The two candidate-focused failures remain the unchanged private readiness activation omission and retained-collection immediate outgoing-delivery expectation. Both were already present on exact C12, are preserved in raw logs, and were not waived as passes. The separate readiness fixture reconciliation exists outside this candidate. The retained-collection/equal-whole gap is outside this bounded correction; no API/policy expansion or oracle adjustment is requested here.

Unchanged scalar-frame-publication exercises covered/uncovered ordering, sibling payloads, omitted-member non-resurrection, deferred publish:false completion, owner-qualified identity, rollback support, source/equality errors, once-only completion and reentry. Evidence-scope controls exercise actual foreign support surviving disposing a declaring Link, later settlement, and repeated cleanup. Author source-type and final spec-type raw evidence was inspected and archived; source types were not independently rerun.

### Own non-vacuous discriminators

`independent-observation-lifecycle.spec.ts` contains:

1. Three private operation lifecycle cases using real transaction owner cells. Register one observed operation against the selected cell while another unrelated transaction is pending. Assert exactly one operation/dependent edge, no edge on the unrelated cell, bounded counts through four revision replacements, no duplicate edge on recomposition, and exact cleanup through started/superseded/disposed. Confirmation produces one useful wake in the started arm; after retirement/disposal, later settlement causes no extra wake. Full diagnostics return to baseline.
2. Three unfinished-native wrapper cases. Inject repeated uncovered observations while a real declaration horizon is still open. Positively assert at least three exercised replacements, one wrapper identity, **nonzero live subscription counts** and unready requirements. Then either dispose before horizon close, close then settle, or close then genuinely reauthor. All subscriptions reach zero; disposed child stays silent, settlement delivers exact observed `{x:10}` (not a later live read), and reauthor delivers exactly `{x:11}` with no old-payload replay on q confirmation. `settled()` resolves and registry counts return to baseline.

These close the preparation-stage coverage concern: pending owner outcomes were not confused with unfinished readiness, and cleanup was not proved solely by a zero count that started at zero. Private notification/inspection spies are explicitly protocol instrumentation; they do not replace the original uninstrumented safety counterexamples.

`independent-observation-wrapper-gc.spec.ts` captures one actual observation wrapper, disposes sources/links and restores the spy, then uses explicit GC. For12 turns an external holder keeps wrapper and selected requirement alive; an unrelated negative WeakRef becomes empty. After releasing the holder and12 more turns, wrapper, selected requirement and destroyed tree are collectible. This is bounded evidence for weak-cache lifetime, with actual positive/negative controls and no skip when GC is unavailable.

## Limits and disposition

Accept the two-file mechanism for subsequent composition, with original failure distinctions retained. No broader API, ordinary Link publicsurface reconciliation, new scope ownership, delayed-stamp identity redesign, unrelated equal-whole repair or release activation is inferred. No broad suite, demo/build, performance campaign, complete retention matrix, or universal reentry/GC claim. Synthetic readiness/reentry probes are private protocol checks; the actual original safety examples remain uninstrumented. No conditional pass, removed useful assertion or widened budget was used.
