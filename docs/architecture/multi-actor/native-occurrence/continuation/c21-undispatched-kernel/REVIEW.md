# C21 undispatched kernel partition — completed, failing

One authorized Nx run only. **335 files passed, 8 failed; 1939 tests passed, 17 failed, 1 expected fail (1957 total). Exit 1.** This is PARTITIONED additional coverage, never a full-suite pass. The original stalled file was not executed. No retries or runtime/config/test edits.

## Identity and exact scope

Cached graph source: `/private/tmp/st-native-combined-c21/nx-data/project-graph.json`, SHA256 `ef0058a9ad4a41c0fd82bbce32dfd3b5f9e84f9a6edaf7713ca4cd848a9ee9c6`. Frozen C21 manifest SHA256 `73e4ecfde64ee05a1eed1eb1362e8ca6f18755b1192a3583454440ef4ad68c27`. Original progress SHA256 `b2a2c2507e5b473a66e059ed343585fa3d8516af86d8e74c351a50c6de44d290`. Exact copies retained as BASE-GRAPH.json, BASE-MANIFEST.json and BASE-PROGRESS.jsonl.

620 kernel test-ci-- file targets minus 276 unique original module-end paths minus `src/lib/entity-large-batches.spec.ts` = **343 explicitly requested src paths**. LEDGER.json preserves every universe/completed/requested path; requested-files.txt is the invocation ledger. ACTUAL-REPORTER-SET.json verifies 343 starts and 343 ends, no duplicates, missing paths or extras. No previously completed file reran. No file-set tooling mismatch.

All 3066 manifest entries verified when copying, immediately before and after execution; original frozen candidate also verified after execution. Source/config unchanged. Own node_modules entries link installed dependencies; writable cache directories are local. No root source writes.

## Invocation and containment

COMMAND.json contains the exact argv (Nx test kernel, all explicit src paths, --maxWorkers=1, --skip-nx-cache, default plus original progress reporter), selected environment, pinned Node24.15.0 path, own cache/data/tmp/output directories and preload. The preload only redirects the existing hard-coded recipient trace path to this scratch. ST_PREPARED_REVIEW_OUTPUT points to own observations. No whole environment dump.

Supervisor80987, child/ownedPGID80993. External 180-second no-progress watchdog watches original module/case progress protocol; no trigger occurred. No residual group cleanup was needed; final owned process census empty. PROCESS.json, run.py, RESULT.json, progress.jsonl and progress.current.json preserve this evidence. Full first.log is untouched.

## Preserved failures and limits

FAILURE-STACKS.txt extracts the terminal assertion stacks; FAILURE-INDEX.txt lists all 17 failed case headers. FIRST-FAILURES.txt retains a normalized copy of the complete first output (first.log remains authoritative).

| File | Failed cases | Observed failure, not a causal adjudication |
| --- | ---: | --- |
| enhancers/restoration/large-batch-restoration-v16-controls.spec.ts | 1 | publication dependency reads 390001 exceeds 390000; this is a count assertion, not a timeout |
| lib/aggregate-independent-input.spec.ts | 4 | useful outbound value received where original assertion expected [] |
| lib/held-continuation-probe.spec.ts | 1 | held value undefined where function expected |
| lib/public-selected-unit.spec.ts | 4 | required ST_PUBLIC_DIAGNOSTIC_OUTPUT absent; harness/evidence-output setup failure |
| lib/recipient-cause-classification.spec.ts | 2 | outbound {x:1,y:0} received where [] expected |
| lib/restoration-paired-work.spec.ts | 3 | counts 37/385/3073 exceed 36/384/3072 |
| lib/internals/causal-runtime/heterogeneous-independent-invalidation.spec.ts | 1 | source-changed-before-installation error instead of installed invalidation sentinel |
| lib/internals/causal-runtime/heterogeneous-invalidation-containment.spec.ts | 1 | same earlier source validation error instead of first installed invalidation sentinel |

The four public-selected-unit failures expose a runner omission: this run preserved the original supervisor's diagnostic settings but did not supply that file's additional mandatory ST_PUBLIC_DIAGNOSTIC_OUTPUT (source line21). They are not evidence of four runtime defects. First failures are preserved; no automatic rerun or semantic waiver. Cheapest follow-up would be that file alone with a unique own diagnostic-output directory, **not run** under this partition-only instruction.

The expected-failure case is pre-existing; no oracle was edited. Other failure premises/root causes are not adjudicated here. No conclusion about the original full-run stall follows from this partition finishing. No timing comparison, builds, full-suite rerun or additional experiments.
