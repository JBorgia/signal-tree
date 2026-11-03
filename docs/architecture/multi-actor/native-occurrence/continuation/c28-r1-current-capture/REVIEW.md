# C28-R1 bounded handoff prototype — frozen for independent review

First focused discriminators pass. This is not integration, general C28 acceptance, release or activation. Stop at this freeze for source/premise review before broader qualification.

## Identity and scope

Candidate: `/private/tmp/st-c28-r1-current-capture/candidate`. MANIFEST.json SHA256 `9805ab2fae49202a334ef506c71a3583ff0f8dfebec51e8b27d992b23971653b`.
Base is the runtime-only rejected C28 variant, manifest `986f7a94c80734070fc51395ca8eee63d808a4fbf949dadc48f5de1e4c48b3b2`; every base path verified unchanged after work. No edits to rejected C28 or its first failures. Root checkout untouched. Base includes original cached-current-input regression. Three test files added; only two existing runtime files changed.

`runtime.patch` SHA256 `6509ca669862704b62bc0eafd9704231c7cdcfdbc78c201bf32a48890dee4da5` is relative to runtime-only C28, not C27. `tests.patch` is separate. SNAPSHOT.json records exact runtime files and original/independent test equality. No diagnostic exports/wrappers are installed in R1.

Authority: central bounded R1 decision and CACHED-INPUT-ADJUDICATION.md, within approved C28 implementation/qualification. No new public surface, snapshot semantics or owner policy selected.

## Implementation

private.ts:107+ gives the existing suppliedViews/nativeInputs walker an internal currentSource mode, selected ONLY by beginBranchInput at the existing updater seam. Snapshot registration/default supplied capture keep their existing path. Current ordinary containers no longer terminate traversal at the cached container's historical certificate. They gather current membership/location and negative-domain evidence from the same known source storage. An absent retained membership edge still terminates traversal. Entity captureViews/captureInput dispatch remains first and unchanged.

A native opaque leaf contributes its current own membership/location AND the registered certificate of the actual supplied payload object. Payload properties are not recursively traversed. The internal source mode propagates through ordinary container descriptors; it neither calls the user updater nor rebuilds its value. No cache invalidation, public callback value replacement, snapshotViews retargeting, or old NativeView mutation was added.

lifecycle.ts:160+ declines relevance cleanup when nativeRequirementReady(retained) is false. This existing predicate includes both unfinished/unactivated barriers recursively. The prototype no longer assumes all still-open retained evidence can be cleaned. Existing pending-at-capture/validation protection, retirement summaries and source readiness remain otherwise unchanged. This narrowing has not yet been checked against the entire approved A/B/retention matrix; first reader gate only.

## Preregistration and first results

Commands use pinned Node24.15.0/pnpm10.17.0 through Nx, isolated per-run cache/data/TMPDIR, maxWorkers1 and an external180s owned-process-group cap. Every run has COMMAND/PROCESS/SOURCE/RESULT metadata and first.log. Every completed run reports sourceUnchanged=true, timeout=false. Historical archived-tsconfig warnings and incidental runner warnings remain unsuppressed.

First three runs use:

`corepack pnpm nx test kernel cached-current-input.spec.ts current-capture-r1.spec.ts current-validation.spec.ts saved-inspection-snapshot-isolation.spec.ts --skip-nx-cache --maxWorkers=1`

- `before-first`: unchanged runtime-only C28, 18 tests: 10 pass/8 fail, exit1. Includes three malformed recursive-fixture failures.
- `before-corrected`: still unchanged runtime-only C28, 18 tests: 12 pass/6 fail, exit1. Original fresh regression, recursive/report fresh input and each route's opaque r-only owner omission fail. Remaining assertions/cases continue through useful terminal delivery where soft failures allow it.
- `after-first`: exact same corrected tests after the bounded runtime delta, 18/18 pass, exit0.

The sole fixture correction happened BEFORE runtime editing: returning {} from a recursive branch update omits its fields, contradicting the fixture's later unchanged-payload assertion. Changed only those recursive callbacks to return their exact input, retaining all assertions. First source remains `first-current-capture-r1.spec.ts`; original preregistration, corrected hash, first raw failure and FIXTURE-CORRECTION.md preserved. This is not correction of the original independent fresh-input fixture, which remains byte-identical and returns {} from root updateAndReport so no later source write can manufacture the expected contradiction.

Three acquisition paths explicitly exercised: direct callable branch (`signal-tree.ts` around489); recursive child updater through object-valued updateAndReport around1136; root updateAndReport callback around2146. The direct/recursive cases may perform subsequent equal source admission, so the unchanged original root fixture is the decisive no-following-write control.

The 18-case gate includes 12 new cases (three fresh routes; r-only/s-only/both across three opaque routes), the original independent regression, three unchanged pending-to-confirmed/nested-validation controls, and two unchanged inspection99/fresh7 isolation controls. Assertions include callback once, actual supplied payload identity, ownership inspection, no premature send, exact useful final7, settlement/no duplicates and disposal cutoff. Inspection controls exercise both direct and frame return from inspection; current-validation includes confirmation inside the updater and inside an open declaration. This is bounded reentry coverage, not every error/horizon path.

Then user requested exact independently baseline-proven opaque packet:

`corepack pnpm nx test kernel opaque-current-input --skip-nx-cache --maxWorkers=1`

`opaque-independent-first`: 4/4 pass, exit0, copied byte-for-byte from `/private/tmp/st-c28-opaque-input-controls/opaque-current-input.spec.ts`. No assertion/source edits. Baseline C27/runtime-C28 findings belong to that independent report, not this run's count. The four cases overlap semantically with author tests; do not sum these into a claim of independent breadth.

## Decisive observations

Original fresh regression now: freshError after-callback contradiction; before []; after [7]; one callback each; q inspection unchanged. Saved-object contrast: no error, [7] before q, no duplicate. See after-observations.jsonl.

Independent opaque controls: naming only r or only s reports contradiction, holds after first owner confirms, then exactly [7] after second; naming both succeeds but likewise waits for both. All settle and preserve disposal cutoff. Saved-before-q payload remains identical and sends [7] before q without error or duplicate. See opaque-after-observations.jsonl. The four tests assert these results; they are not diagnostic-only success claims.

Classification: opaque r-only missing current holder s already failed C27 and runtime-only C28 in the independent matched packet. It is an inherited gap that the approved conjunctive handoff covers, not a newly introduced C28 regression. The original fresh current q leak is new in C28 versus C27. Saved-before-q isolation was already correct in C28 and stays correct in R1; the fix does not restore C27's old alias mutation behavior.

## Limits and next review boundaries

No broad suite/build, source/spec types, new performance/retention claim, activation or default gating change. No source edits after these focused results. Tests are runtime-qualified only; ordinary type gate is pending reviewer clearance. Original approved A/B, finite all-root accounting, full C26 lifecycle and later readiness-disposal/error controls have NOT been rerun on R1.

Absence/negative-membership and entity dispatch branches are preserved by source inspection, but no new absence/entity qualification was run in this first gate. No arbitrary getter-reentry/cyclic opaque probe added; payload traversal stops at writable location, but absence of extra getter invocation is not generalized from these data snapshots. Source/value alignment is executed for finite fresh pending input, supplied identity, inspection and pending-confirmation reentry routes, not every grouped-write interstage case. Review should assess these residuals before any broader focused qualification.

The closed-predecessor gate deliberately preserves wider evidence rather than asserting earlier open-horizon treatment safe. No new sweep/listener or owner graph rewrite. The frozen C28 baseline remains rejected; passing this handoff gate alone does not recover all C28 qualification.
