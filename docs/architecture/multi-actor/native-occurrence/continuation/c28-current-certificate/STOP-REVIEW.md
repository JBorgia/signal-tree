# C28 stopped: current-input certificate safety

Do not compose. Owner-approved current-obligation no-write semantics remain authorized, but this implementation fails the covered fresh-reader isolation gate. No policy change follows from the failure.

## Frozen identities and edits

`FROZEN-WORKING-MANIFEST.json` SHA256 f367cd3d25ea18715c9192a98ff52c932d73cf4790fe22c71b280bc5c1f25de4 covers 3091 paths: 3086 base paths plus five test files. `FROZEN-IDENTITY.json` records both runtime file identities, patch hashes and unchanged exact C27 input. All 3086 paths match the independent public discriminator's captured C28 (`REVIEW-CAPTURE-COMPARISON.json`). Thus its result applies to this runtime, not an inferred later revision.

Production behavior was implemented once in lifecycle.ts/private.ts. The 22-case focused pass used that uninstrumented implementation. Subsequent production-file changes ONLY added the preserved diagnostic overlay: capture wrapper/exports and weak-root observation helpers. They remain frozen in the working candidate. Saved original implementation bytes are in research/uninstrumented, with hashes in research/UNINSTRUMENTED.json. No production repair, readiness narrowing, getter/cache change or view mutation was made after the first focused gate. `runtime-uninstrumented.patch` preserves the behavior delta separately; `runtime-working-instrumented.patch` includes diagnostics.

After first diagnostic failure, ONLY two research test files changed: the graph visitor iterates values returned by its weak-map helper instead of visiting the new wrapper array, and reader assertions became soft to permit subsequent routes/identity recording while retaining the same failed assertions. First versions are preserved in research/first-diagnostic-sources. These are diagnostic continuation, not a passing replacement oracle. No ordinary baseline or Tesla guard assertion changed.

## Executed results and first failures

- `runs/counterpart-before`: exact C27 approved A/B counterpart, A pass/B fail on six receipt assertions; useful terminal delivery reached. Exit1, source unchanged.
- `runs/focused-after-first`: seven files, 22 tests pass. Approved A/B, three current-validation cases, Tesla four unchanged guards and unchanged ownership/terminal/inspection controls. Exit0, source unchanged. This is not reader qualification.
- `runs/roots-readers-first`: three failures preserved. Two are visitor recursion; one is the supplied certificate assertion. Exit1, source unchanged.
- `runs/roots-readers-corrected-visitor`: two useful confirm/rollback churn arms pass; reader assertion still fails. Exit1, source unchanged. No timeout. All commands/environment and raw logs are in the corresponding run directories; diagnostic sink files are under research.
- Independent public safety fixture: `/private/tmp/st-c28-cached-input-discriminator/REPORT.md` records exact C27 pass and captured C28 failure: fresh input sends 7 before genuinely pending q confirms; `freshError:null` instead of contradiction. Main separately reports matching unchanged replay. These are independent observations, not additional author test counts.

No source/spec types, new lifecycle expansion, broad suite, build, or further acceptance gate ran after this stop. Remaining readiness/failure/reentry and repeated no-write selected-operation qualification are NOT established.

## Diagnostic classification

Graph recursion was a harness error: `__historyFactRoot(value)` returns a fresh four-element array for every argument. Visiting that array recursively calls the helper again for the array itself, manufacturing an infinite chain even when all weak lookups return undefined. Iterating the returned values fixes the observer traversal; it does not alter graph roots/runtime behavior. First failures and both visitor versions remain preserved.

The saved-reader assertion conflated two different identities. Corrected recording says `savedContainedEndpoint:false`, `suppliedUsesSaved:true`, `suppliedUsesOld:false`. The saved cached object's certificate already predates the endpoint sampled after a prior equal admission. Expecting the supplied consumer to select that sampled endpoint was an incorrect premise: no such endpoint was in the saved certificate. The test is still red and is not counted as an isolation pass. `sameCachedObject:true` and `oldViewsUnchanged:true` demonstrate the tested saved association stayed stable. Direct leaf and immediate pair updater matched their current endpoint in that finite sequence; `branchReusedCachedObject:false`. This does NOT cover the nested cached-child root updater that the independent public test fails.

Corrected churn diagnostic samples 0/1/2/4 (four actual distinct qi admissions) show source owner count 1/2/2/2, current recipient contribution 1/2/2/2 and selected-operation dependencies 1/2/2/2 in each terminal arm. Closed roots at 1/2/4: 9 requirements, 4 component edges, 2 owner cells; selected operation list empty after p terminal. Exact useful outputs 7/0, no premature/duplicate send, ownership unchanged and teardown behavior passed. These are finite instrumented graph observations, not heap/closure reclamation or repeated no-write-old-receipt proof. Rollback terminal roots have 12 requirements/6 component edges/2 cells; do not hide that distinction. A safety failure overrides any favorable count.

## Concrete causal boundary

private.ts suppliedViews prefers snapshotViews for an object and recursively applies that preference to nested plain branches. Snapshot registration uses the same function. C28 correctly avoids retargeting already-issued NativeViews by allocating a new view when a requirement changes, but fresh updater acquisition still selects certificates through supplied cached values.

Actual routes differ:

1. Direct leaf input: native factory captureInput -> nativeInputs(node) without supplied branch object -> current nativeViews.
2. Direct branch callable updater: signal-tree.ts around 488 uses unwrap(store). Its immediate scalar fields may be newly assembled; nested branches still come from memoized accessor reads.
3. Recursive branch updater: around 1135 uses unwrap(prop), potentially memoized accessor snapshot.
4. updateAndReport: around 2145 uses unwrap(signalState); nested accessor values are reused by utils.ts buildFromStore. A new root object may therefore inherit an old child certificate.
5. Saved object held in an opaque leaf: branch capture reaches that terminal's supplied object; snapshotViews supplies the historical issued association. It must not be silently relabeled current.

SCOPE.md's earlier assertion that actual branch capture uses the uncached canonical builder is incorrect. The helper exists but these call sites do not invoke it. This report supersedes that claim without editing the frozen evidence. New NativeView identity alone is insufficient; fresh root identity alone is also insufficient, as the public failure recorded a different root object.

The matched public test establishes pending-input safety failure. It does not isolate the view replacement line from every other lifecycle change by mutation, nor assign a new required saved-object outcome. The source route explains how the fresh acquisition can miss q without any source value change. No blind in-place view mutation is justified: it would alter earlier issued evidence.

## Authorized runtime-only replay after stop

Original frozen candidate remains untouched. In a separate `runtime-only-replay/candidate`, copied only the 3086 base manifest paths, reversed the original `research/instrumentation.patch` using `patch -R -p1 --batch`, and verified both runtime files byte-identical to the saved pre-instrumentation implementation. No behavior repair. Copied the independent public fixture unchanged; no other author tests added to this variant.

Runtime-only manifest SHA256 `986f7a94c80734070fc51395ca8eee63d808a4fbf949dadc48f5de1e4c48b3b2`. Removed overlay SHA256 `b2ec08a95fd20319a50b01293afb1441de820cbf78e51ecf600cb5cd5ec3b66d`. Public fixture SHA256 `bc1504926067188a541e76e9b2e3539c3a8b1cf678ab7362949e55b8caa328d4`. Identity/procedure: runtime-only-replay/IDENTITY.json and REMOVE-OVERLAY.log.

Exactly one Nx replay: `corepack pnpm nx test kernel cached-current-input --skip-nx-cache --maxWorkers=1`, pinned Node24.15.0/pnpm10.17.0, own Nx/cache/TMPDIR, external owned-group180s cap. `runs/public-first/RESULT.json`: exit1, no timeout, sourceUnchanged. Same first failure at fixture line67: premature `[7]` versus `[]`. Diagnostic `freshError:null`, before `[7]`, after `[7]`; callback counts1/1/1, unchanged q inspection, final exact useful single payload. The later contradiction assertion remains blocked by the first assertion; the diagnostic independently records no error. Removing diagnostics does not remove the safety failure.

`runtime-only-replay/AFTER.json` verifies all3091 original frozen paths and all3087 runtime-only/fixture paths unchanged, plus fixture equality with independent source. First raw log, observations, command/process metadata are preserved. No retry, typecheck, broad suite or subsequent runtime edit.
