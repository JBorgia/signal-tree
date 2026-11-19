# C21 bounded alternatives — frozen for independent review

**A produced the predicted small reduction; B stopped at a concrete source-premise gap and was not implemented.** No blending, budget change, public API change or full-suite run. Main's C21/root and all prior frozen inputs remain untouched.

A manifest9375f98e076c48aa7c4885d09067a5d7308b7c93d9fc821d9d9c37f86f56f0ce; runtime patch4f306f1a002afc0281c1141447cb8d87522fa5f4d8909bfcea55a1b7c40769b1. FREEZE.json contains identities and every run disposition. Baseline is exact C21 manifest73e4ecfde64ee05a1eed1eb1362e8ca6f18755b1192a3583454440ef4ad68c27. All3066 baseline paths were verified before copying; final baseline remains exact, A differs in one runtime file only. Both contain identical two added research specs, separately patched.

## A: retain capture, remove singleton dedup intermediates

Only experimental-publication/private.ts nativeInputs changes. Existing entity-bound capture stays unchanged. The non-entity branch calls suppliedViews once. For exactly one private view it calls existing lifecycle.captureNativeInput on that view's requirement once and returns a fresh result array. Otherwise it retains the existing map/Set/spread/map pipeline. Native factories, registration, actual input capture, source preparation, validation, completion and application updater dispatch stay intact.

A singleton cannot contain duplicate requirements. Removing the intermediate requirement array, Set and deduplicated array is actual representation work removal; it does not translate a growing walk into an uncounted loop. The capture result and fresh final array still exist. Required evidence/error behavior is tested; no claim that the private-counter capture itself is mandatory or unnecessary is used by A.

## Fresh count comparison

| Exact workload:200 literal updates, two-field rows | C21 baseline | A |
|---|---|---|
|2,000 rows|13,800|13,000|
|20,000 rows|13,800|13,000|
|Every individual update|69|65|
|Original strict <2,000 assertion|FAIL|FAIL|

Both original and attributed counters agree at each size. Within each candidate, full histograms match across populations. A removes800 charged visits total:400 Array.map,200 Array iterator,200 Set iterator at private nativeInputs. The200 suppliedViews push visits remain. Every other charged first-callsite histogram agrees after documented normalization. No timing/performance superiority or total-allocation-volume claim.

COUNT-COMPARISON.json and compare-counts.py preserve the arithmetic. The initial cross-version full-stack comparison failed only because direct namespace invocation labels the same lifecycle site `Module.captureNativeInput` instead of `captureNativeInput`. FIRST-HISTOGRAM-NORMALIZATION-DIFF.json preserves this difference: both are200 calls/zero visits at lifecycle.ts154. The function body does not use this, and actual captured requirement/owner/error semantics are controlled. Final comparison explicitly normalizes that name, checkout prefix and shifted private.ts source positions; it does not assert byte-identical cross-version stacks. Raw rows-2000.json/rows-20000.json remain in each point run's observations directory.

## Frozen expectations and controls

EXPECTATIONS.md was written/hashed before runtime edits. PRE-IMPLEMENTATION-FIXTURE-HASHES.json records the initial controls/attribution harness. The only later control correction replaced Vitest's non-file module URL with an explicit source path supplied by the runner; assertion text is byte-identical after that locator substitution. FIRST-singleton-input-controls.spec.ts and the first failing log are preserved.

Paired baseline/A focused controls total55 passing cases each:

-14 new actual-source-function seam controls: empty/single/duplicate/distinct lists; fresh output identity; immutable captured receipt/owner arrays; pending/confirmed/rolled-back/abandoned owner classification through the actual captureNativeInput implementation; unavailable and retained old evidence; requirement sampling before capture reentry; undefined/primitive/object thrown identity with recovery/no automatic retry; entity-branch bypass and copied membership.
-4 existing readonly cases.
-37 unchanged controls across aggregate-native-input-independent, entity-native-input-independent, singleton-row-reuse and publication-enrollment-adjudicated. These include actual application updater contradiction/owner preservation, retained per-edit facts across later writes, finalizer reentry/refusal, thrown preparation, and late/dynamic enrollment.

The14 new cases extract/transpile the actual private nativeInputs source into a controlled fixture with suppliedViews/binding collaborators injected. They call the real lifecycle capture implementation and assert explicit outcomes, not merely baseline equality. This permits exact private cardinality/read/error tests without adding a runtime export. Synthetic owner cells in these seam cases test capture classification, not authentication; existing public/native controls exercise real owners. They do not independently prove every public call route. These files are **research-only replay harnesses**, not a proposed production-test promotion: source-extraction requires ST_INPUT_SOURCE and attribution writes to a runner-controlled output path. Do not copy research-tests.patch into ordinary production discovery without separate routing review. Runtime patch is separate.

## Executed validation and preserved failures

| Run | Result |
|---|---|
|baseline-controls|37 existing cases pass; new suite fails before cases on non-file URL. Fixture failure preserved.|
|baseline-controls-pathfix|14 new +4 readonly cases pass; no assertion change. Together baseline55 controls qualified.|
|A-controls|All55 controls pass in6 files.|
|baseline-point|Three diagnostic tests pass; original budget test fails13800<2000;9 unrelated cases filtered.|
|A-point|Three diagnostic tests pass; original budget test fails13000<2000;9 unrelated cases filtered.|
|A-source-types|`pnpm run typecheck:source`: pass.|
|A-spec-types|`pnpm exec node tools/check-spec-types.mjs`: pass.|

Each runs/<name> directory contains exact argv/cwd/env, first.log, source-before identity and RESULT.json. All runs report source unchanged during execution. No first failures overwritten; no xfail/skip added to required assertions. The name filter deliberately limits point measurement; unrelated filtered cases are unsupported by that run, not passed. Original counter body remains unchanged. Archived tsconfig discovery warnings remain unmodified in initial Nx output; this experiment did not compose the separate resolver-scan correction.

Runner uses pinned Node24.15.0/root installed pnpm10.17.0, Nx single worker/daemon disabled and per-copy caches. Heavy commands ran sequentially. No full suite/build/framework qualification was attempted; A changes shared private capture, so framework-wide acceptance is beyond these bounded controls and remains for composition review.

## B: source-premise stop, no patch/count

See B-PREMISE.md. Neutral private createCell exposes an untracked source peek and discards its preparation callback. But the same EntityMap version/subject-state sites also receive native realization cells. In native-location-realization, untracked `realized.peek` belongs to the realization object; Angular's returned signal cell does not get that method. Therefore `replaceLocation(version,version.peek()+1)` is not a valid shared substitution. Using version() instead introduces tracking and may read an unnotified native mirror inside a group.

No neutral-only identity guard, new backing-read port, epoch redesign, generic derive suppression or factory suppression was introduced. Such a mechanism would require separately proving read/error/notification order and its scope. Native epoch handles already have a distinct adapter advancement contract and are not changed. B is neither measured nor rejected as impossible; it is unqualified under the requested equivalence premise. This also does not assert that the existing discarded neutral capture is required by publication semantics.

## Replay and independent review boundary

Use run.py with a new exclusive run name and candidate label baseline/A. Underlying commands are recorded verbatim in COMMAND.json. Control selection is singleton-input-controls.spec.ts, readonly.spec.ts, aggregate-native-input-independent.spec.ts, entity-native-input-independent.spec.ts, singleton-row-reuse.spec.ts and publication-enrollment-adjudicated.spec.ts. Point selection is point-work-attribution.spec.ts plus entity-granular-reactivity.spec.ts with `--testNamePattern=exact C21 point visits|calibrates positive|a single-entity update does not rebuild`; Nx receives the proper positional file arguments. Output helper variables are harness destinations, not changed product semantics.

Review A-runtime.patch, SNAPSHOT-A.json, FREEZE.json, frozen expectations and raw runs. Research controls/attribution changes are isolated in research-tests.patch. Independent review must precede Main composition. A is a bounded reduction proof, not a solution to the absolute point budget; that inherited failure remains open at13,000. B remains a separate premise finding. No release claim.
