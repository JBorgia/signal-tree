# Ordinary placement successor — frozen for independent review

Implemented only in `/private/tmp/st-ordinary-placement-successor/candidate`, copied from frozen combined B. No A/B/root runtime or tests changed. Main owns integration. This author previously supplied the premise review; a different reviewer must assess this implementation. No activation or integration acceptance is claimed.

Manifest SHA256: `304256fd4b844b3e1e082d1ba86d4938fd22929eb42b9b893145ba230ad6194d`.
Predecessor manifest: `6630a74c965b1f414eae5105c3eb3bb3ea09ba9b89f57f81149eee52086af1fd`.
See FREEZE.json, SOURCE-SHA256.json, PREDECESSOR.json and VERIFICATION.json. All 2967 predecessor files verified unchanged. Candidate contains 2970 manifested files. Both original fixtures remain byte-identical.

## Mechanism

Sequential ordinary value/lifetime execution is unchanged. The existing loop additionally retains the last surviving add episode per subject; a remove cancels it, another add replaces it, and subsequent field/rekey edits retain that episode while determining final payload/key. Source-owned requested anchors are captured before provisional insertion rewrites them.

After sequential execution, a private resolver removes only the final restoring subjects from the provisional ordinary stage, retaining their final keys. It resolves their requested anchors using final ordinary membership and the existing physical restore dependency policy. The physical helper was extracted unchanged apart from its generic type constraint/import; no public barrel export was added. Physical liveness is not used for ordinary resolution. Explicit ordinaryOrder still applies last through the existing orderDomain validation.

The resolved stage supplies the installed ordinary interval. A sparse private publication field carries resolved restore adjacency to egress; it changes neither payload nor membership. Egress repositions only already eligible subjects after sequential ordinary edits and before any explicit ordinary order. Per-step value/capture records are not reordered or rewritten to pretend every intermediate occurrence had final adjacency.

Final adjacency can introduce dependencies absent from the original requests. The resolver therefore derives a separate replay order from the resolved adjacency using the same helper. This is necessary: the first implementation passed the two regressions but failed the new finite anchor matrix. Replaying final facts in the original resolution order was insufficient.

No new source full-collection snapshot was added. The source resolver touches final restore episodes and their neighbors. Egress already owns an array draft for structural publication; its new relocation uses affected-subject bookkeeping and in-place splice, without an additional full-order snapshot. It still performs array searches and shifting, so no collection-size-independent recipient cost is claimed.

## Execution and first failures

All test executions use Nx, skip-nx-cache, one worker, Node24.15.0 and pinned pnpm10.17.0. Exact argv/cwd/environment, first logs, exit records and before/after source identities are under runs/<name>/. Existing dependencies were symlinked; no heap/time budget overrides.

| Run | Result |
| --- | --- |
| before-runtime, unchanged combined B original two files | 2 passed / 2 failed, exit1 |
| first-runtime, unchanged originals | 4 passed |
| finite-controls, initial added controls | 11 passed |
| focused-final, first final-adjacency matrix | 144 passed / 1 failed |
| corrected-final-adjacency | 12 passed, including625 anchor combinations |
| final-focused | 145 passed |
| final-sparse, final runtime | 146 passed across12 files |
| final-work-control, only measurement workload strengthened afterward | 13 passed, including625 combinations |
| final-sparse-types | source TypeScript exit0 |
| final-sparse-spec-types | spec-type ratchet exit0; no baseline edited |

The final work-control edit only changes the recipient measurement from same-order relocation to an actual tail-to-front move. It does not change runtime or other assertions. Its own test file was rerun successfully. The full146 run and types used the identical final runtime. Repeated passes are not additional distinct assertions.

Original2 failures remain in runs/before-runtime. The first implementation counterexample remains in runs/focused-final; its runtime/fixture copies and reconstructible source-and-tests.patch against B are in first-failures/final-adjacency. No original assertion was weakened, marked failing or skipped.

The final focused set includes the unchanged original two files, structural admission6, completeness6, public typed-key handoff2, adapter/opaque/p0c67, transactions43, entity-realization-handoff5, and new placement13. It covers external versus inspection refusal, incomplete inverse atomic refusal, stale/reentrant source behavior through existing handoff controls, public remove/rekey handoff and source support/lifetime checks.

The added placement fixture covers restored successor and reverse request order; successor priority; absent-successor predecessor fallback; disconnected append fallback; cycles without surviving anchor; final absence and same-key replacement subject separation; source/egress adjacency agreement; explicit-domain precedence/refusal; and repeated same-lifetime add/field/remove/add/field/rekey. The repeated source test asserts all sequential change values, final ordinary interval, subsequent ordinary field planning and unchanged physical image. The625 finite combinations compare source adjacency and egress order, not merely final membership. This is finite evidence, not exhaustive arbitrary history validation.

## New work measurement and limits

`runs/final-work-control/observations/placement-work.json`: two restored subjects with a surviving neighbor require17 EntityPlacementStage.read calls in the added resolver at both32 and1024 total rows. The counter starts after provisional sequential inserts; snapshot/assertion reads are outside the measured interval. This counts stage reads, not allocation bytes, helper queue operations, total pipeline work or elapsed performance.

`recipient-placement-work.json`: two existing tail subjects moved to the front at32/1024 rows use7 indexOf calls and129/4097 dense search positions respectively. Instrumentation wraps indexOf only during relocate and derives inspected dense positions from the returned index; setup and assertions are excluded. Splice shifting and Map/Set allocation are not counted. The helper's fallback search can also cost more for larger restore sets. These limits are explicit; no speed, allocation-reduction or universal complexity claim is made.

## Review focus and remaining scope

Review sparse final facts against source interval, repeated-lifetime episode reduction, final-adjacency replay ordering, eligibility-preserving relocation, explicit-order precedence and physical helper extraction. The new packet field is internal and currently produced by ordinary realization, not a new public policy or general arbitrary-packet facility. General point aggregation and hostile fabricated private packets are not expanded by this work.

No full framework matrix, whole kernel baseline differential, release/build/consumer gate or retention study was run. Earlier unrelated combined-B integration findings remain outside this correction. Spec types are a ratchet pass, not a claim of zero inherited diagnostics. Independent implementation review is required before Main considers integration.
