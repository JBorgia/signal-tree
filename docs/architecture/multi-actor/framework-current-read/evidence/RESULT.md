# Inherited selected-callback repair — NOT ACCEPTED

2026-10-29. Work stopped at the owner-specified existing-SDK/public-surface boundary.
Everything here is confined to `/private/tmp/st-selected-projection-repair`.
The scratch runtime retains the rejected candidate for inspection. Do not activate or apply it as a completed repair.
No app migration, declaredLink continuation, rejected B, push, tag, merge, or shared-history operation occurred.

## Exact source and patch identities

- Extraction: `git archive 87f6831fa60cafe87508f0ace84b7638698ca3b0 | tar -x -C /private/tmp/st-selected-projection-repair`, read from `/Users/jonathanborgia/code/signaltree`.
- Retained commit: `87f6831fa60cafe87508f0ace84b7638698ca3b0`.
- Git tree: `10e6be502fda139bb16ab7a72c426efc86ce8888`.
- Archive SHA-256: `f68758a1fda1ccb3198098f97d1f0c4b254ce2def039c602d291b2deb72595ad`.
- Main checkout HEAD at start and verification: `628d302dadb082a48c58528651c9088234d0a777`, branch `fix/d1-d2-forward-port`; the same pre-existing dirty/untracked path list remained. No edits were made there.
- `source-identity.json` and `archive-manifest.json` compare all 2,517 archive files. The sole changed existing file is `packages/kernel/src/lib/entity-signal.ts`; seven regression test files were added.
- `REJECTED-source.patch`: SHA-256 `7134d90baf33b478fbcc924774a900334cb934a7bcae3c4613738fa9c0e71c05`.
- `REJECTED-candidate.patch` (source plus tests): SHA-256 `129fa28475a7b8316e0ddb0d84dd5846abab6321c60ae466eb637993caafd917`.
- `regression-tests.patch` is separately available. `git apply --check` of the combined patch against the preserved baseline subtree passed.
- `FINAL-HASHES.json` identifies final runtime/test files, preserved exact public tests, and patches. No public barrel, exported type, or SDK interface was changed.

## Preserved first failures

The evidence origin is the active readiness worktree's
`docs/audits/2026-10-17-incumbent-readiness/link-collection-proof-successor/evidence/selection-capability/`.
`exact/PUBLIC-RESULT.md` and both `exact/*-PUBLIC-EXECUTED.spec.ts` preserve those inputs.
The exact executed source includes a private capability case; only the public discriminator was selected in the exact runs. The private case was skipped, not counted as passed.

- `angular-first.log`, exit 1: callback sees selected X while rows and direct A are restored to A/C.
- `vue-first.log`, exit 1: `rows.ids.value` is undefined and spread throws before the selection oracle or callback choice executes. This is not reported as an executed stale-selection failure.
- `angular-held-first.log` and `vue-held-first.log`, each exit 1: the first repair, retaining one native derived reader, returns stale A after the callback selects C. This failed implementation was replaced, not hidden.
- `angular-metadata-first.log` and `vue-metadata-first.log`, each exit 1: the subsequent proxy changes native metadata identity across accesses on the same retained reader. Angular SIGNAL node and Vue effect identity comparisons both fail.

The final source patch is that latter, rejected implementation. First failures have not been overwritten.

## Executed semantics: ST reads versus native computed timing

The exact original public tests pass with the rejected candidate (`angular-exact-final.log`, `vue-exact-final.log`, each exit 0). Their original bytes were restored temporarily for those runs and selected by their original public test name.

The strengthened public-facade tests separately execute all of the following:

- A callback-acquired ST activeId/activeEntity reader sees restored A and row 1 before the callback chooses newer C.
- C is chosen conditionally on the retained reader observing A; otherwise the test writes `wrong-selection`. This strengthening is in the facade tests, not retroactively inserted into the preserved original public tests.
- Retained callback readers stay current across selection C and row update 9; callback rekey and clear operations also survive settlement.
- A warmed application-owned native computed continues to return X inside the held publication group, including after the callback writes C. Its execution count does not advance there. Following normal publication, it returns C.
- Ordinary activeEntity computation remains granular across unrelated-row updates.

`facades-timing.log` executes those controls across all five facades: 18 tests passed.
The final acceptance run adds the two metadata controls: **18 passed, 2 failed**, Nx exit 1, failing Angular and Vue. See `final-acceptance.log`.
Passing the earlier full suite is not acceptance against these newly exposed failures.

## SDK boundary and concrete alternative

Inspection was limited to this retained source and its existing contracts:

- `ObservationAdapter.createReadonlyCell(compute)` is the only readonly native creation hook. Angular uses `computed`, Vue wraps a `computed`, and Solid lazily creates a memo.
- `LocationRuntime.createDerived(compute)` forwards to that hook. It carries no distinction between normal cached derivation and an uncached source-owned callback read.
- Writable cell/projection hooks serve writable publication; their existing readonly conversions do not establish a stable fresh readonly representation. Using invalidation from a read would change delivery/write timing. No such workaround was adopted.

Three concrete approaches are falsified: bare callable loses Vue's read facade; one cached realization loses current reads across nested writes; per-property realization loses retained native metadata coherence. Merely caching metadata would associate it with a different computation from the fresh value read and would not resolve the review finding.

**Concrete next option, not implemented:** authorize an optional source-current readonly realization capability on the public adapter SDK (for example an explicit read policy on the existing readonly factory, with internal LocationRuntime routing). The kernel would select that policy for its existing tap-fresh semantic boundary; each framework would own the stable readonly representation, dependency tracking, and metadata. Existing ordinary derived construction would retain cached timing. This needs a neutral implementation, framework-specific proof including current Signal/ComputedRef carrier types, and owner review before implementation. Adding a method or parameter to ObservationAdapter changes public SDK surface even without a new barrel export.

No supported connection satisfying that combination was established with the existing SDK. This is the concrete boundary at which the user's instruction requires stopping; it is not a claim that no framework-internal implementation could ever exist. Reopening ordinary computed timing, dropping retained-reader freshness, weakening carrier types, or exporting tap internals is not an authorized substitute.

## Validation and limitations

- Earlier full package suites: kernel 5,838 passed + 5 expected failures + 12 skipped; React 78 passed; Angular 243 passed + 3 skipped; Solid 109 passed; Vue 178 passed. Total 6,446 passed, 5 expected failures, 15 skipped. These precede the new metadata controls. The runtime source is unchanged since that run.
- Source/typing gate: exit 0. Final spec-types including metadata controls: exit 0; no baseline was loosened.
- Full package build stalled after emitting kernel artifacts; stopped rather than counted green. Streamed kernel retry also emitted artifacts but did not terminate and was stopped (143). Source warnings are preserved; no cause is asserted from emission alone.
- First demo attempt was an invocation error: package-script `--` forwarded Nx flags into the Angular builder schema. Preserved exit 1. Corrected direct Nx demo command also exited 1 after `Building...` without a useful diagnostic in the captured log. No production-demo success is claimed.
- README API gate exited 1 because framework package outputs were absent from the incomplete build (22 package-reference findings). This is not evidence of 22 source regressions.
- Bundle/declaration artifact gates were not qualified against a completed package build. No release, package size, performance, or publication claim is made.
- Two independent reviews were run before the owner's prohibition on further external CLI review transfers. No additional CLI review was dispatched after that instruction. Their verdicts were treated as claims; the metadata and timing controls were verified in-session.

See `COMMANDS.md` and `command-results.json` for invocations/statuses, and corresponding `.log` files for raw output.
