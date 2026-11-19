# Point result-demand composition onto frozen C8a

Ready for Main review. Composition was trivial: the independently reviewed runtime patch applied with zero fuzz and no conflict resolution. No novel optimization or semantic adjustment. The 104 focused controls pass on both baseline and successor; source and spec types pass. **The unchanged original point gate remains red: 15,600 baseline and 14,200 successor against <2,000.** This is not performance-gate acceptance.

## Frozen inputs and output

Base: `/private/tmp/st-native-combined-c8a/candidate`, all 3,031 files verified against SNAPSHOT-C8a.json before copying; reverified unchanged at freeze. The base is an exported snapshot, not an independently inspectable Git HEAD. Ambient repository HEAD was 628d302dadb082a48c58528651c9088234d0a777 with unrelated dirty files; none were edited or substituted for this baseline.

Successor: `candidate/`, 3,033 source files in `SNAPSHOT-POINT-DEMAND-C8a.json`; manifest SHA-256 **ffba656df9413c59d334884064b0690281cc9a29c3170a8775a1cc32c845dc0d**. Only existing file changed: `packages/kernel/src/lib/entity-signal.ts`. Added the two promoted test files. FREEZE.json contains all patch hashes and run receipts.

`runtime.patch` has exactly the same added/deleted line payload as the reviewed `/private/tmp/st-point-result-demand-successor/runtime.patch`; only hunk positions differ. `tests.patch` contains promoted tests. `FROM-C8a.patch` combines both. Replaying the combined patch on fresh affected C8a files reproduced all three output file hashes exactly; see patch-replay.log. All other manifest files, including singleton row reuse and C8a refusal diagnostics, remain byte-identical. The source-current revision/reader and R4 phase changes inside entity-signal remain intact: this is the reviewed point/rich result-demand delta only.

## Promoted coverage and preserved research

Promoted without assertion changes: inspection-created row adoption, rich repeated-subject rollback/held handles, and supported recipient preparation reentry. Promoted allocation fixture retains exact independent calibration and all useful-work assertions; the sole behavior change is guarding diagnostic appendFileSync behind the optional environment variable. Five allocation/calibration tests also pass with that variable absent, producing no diagnostic file.

Original full point-result-demand.spec.ts, its patches, first experimental fixture, baseline/successor failed control logs, and diagnostic reentry outputs are preserved verbatim under `research/`, together with Main review and PREPARE-INSTALL-ADJUDICATION.md. The unsupported private prepareInstall monkeypatch refusal expectation is not changed, skipped, xfailed, or promoted into the production test files. Its old failing evidence remains failing evidence. It was not re-executed on C8a. The research-only throw control and diagnostic also remain separate. This disposition follows the supplied adjudication; it is not a claim arbitrary private prototype substitution is safe.

## Executed validation

Every run has exact cwd/argv/environment, first.log, result, and source-before hashes under `runs/`; each result confirms source unchanged during execution. No retries or overwritten first logs.

| Run | Result |
| --- | --- |
| baseline-controls | 104 passed, 14 files |
| successor-controls | Same 104 passed, same 14 files |
| source-types | `corepack pnpm run typecheck:source`, exit 0 |
| spec-types | `node tools/check-spec-types.mjs`, exit 0; baseline ratchet unchanged |
| optional-diagnostic-no-output | 5 passed; output environment variable absent |
| baseline-point-gate | 1 failed, 9 deliberately filtered; 15,600 is not <2,000 |
| successor-point-gate | Same failure/selection; 14,200 is not <2,000 |

Focused Nx selection: point-result-demand, point-result-allocation, ordinary-order-owner-preparation, ordinary-order-source-boundaries, ordinary-restoration-placement, packet-index-adversarial, packet-index-review, independent-refusal-branches, point-admission-followup, native-admission-handoff, native-invocation-handoff, singleton-row-reuse, current-read-capability, joint-membership-phase. All use `--skip-nx-cache --maxWorkers=1`. This includes composition-sensitive singleton and source-current/phase tests without running full suites.

Original point gate command: `corepack pnpm nx test kernel --skip-nx-cache entity-granular-reactivity.spec.ts --testNamePattern="a single-entity update does not rebuild" --maxWorkers=1`. The original file hash is unchanged. Its size equality assertion precedes the failing ceiling; later counter-calibration code in that test is unreachable on this failure. The separate promoted calibration ran and passed. No budget was raised and no expectation changed.

## Matched allocation observations

Generator: promoted point-result-allocation.spec.ts, executed through the controls commands above. Each cell seeds 2,000 or 20,000 rows, width 2 or 32, outside interception; counts 200 actual `updateOne(i,{v:1})` calls; then asserts all 200 writes and an untouched row. Trees are destroyed. Independent calibration asserts exact empty/copied Map and Array.map counts. Raw data: each controls run's allocation.jsonl; joined data: ALLOCATION-COMPARISON.json.

| Width | Resident rows | Map constructions, base → successor | Copied Map entries, base → successor | Array.map result arrays, base → successor | Array.map result entries, base → successor |
| --- | --- | --- | --- | --- | --- |
| 2 | 2,000 | 5,000 → 4,800 | 1,600 → 1,600 | 3,200 → 2,600 | 2,200 → 1,600 |
| 2 | 20,000 | 5,000 → 4,800 | 1,600 → 1,600 | 3,200 → 2,600 | 2,200 → 1,600 |
| 32 | 2,000 | 5,000 → 4,800 | 25,600 → 25,600 | 3,200 → 2,600 | 2,200 → 1,600 |
| 32 | 20,000 | 5,000 → 4,800 | 25,600 → 25,600 | 3,200 → 2,600 | 2,200 → 1,600 |

Observed reduction per 200 writes in every cell: 200 Map constructions, 600 Array.map result arrays, 600 result entries; copied Map-entry count unchanged. These are actual intercepted counts, not inferred source counts. Literal arrays, iterator-entry arrays and total allocation bytes are not measured. Original point gate counts a different collection of iteration operations; its totals must not be substituted for these measurements.

Node 24.15.0 and pnpm 10.17.0 match candidate pins. Local dependencies were clone-copied from the already isolated characterization dependency tree; 647 copied pnpm shim fallback paths were rewritten to this candidate, and zero absolute dependency symlinks were found (DEPENDENCIES.json). Candidate runtime tests load local dependencies. Nx cache/data and temporary output are inside this task directory. Other agents were active; no quiet-host or timing inference is made from elapsed run times. No CPU, heap, bundle, release, or full-suite claim.

No composition blocker demonstrated within this reviewed delta and focused checks. Original point budget failure remains explicit for Main's decision. No root or other worker scratch files were changed.
