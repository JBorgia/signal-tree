# Ordinary-test filesystem prerequisite cleanup

Read-only classification against selected `/private/tmp/st-v16-integration-candidate` (8bd). No source changes, suite, GC, timing or mutation run. Exact38 matching files and inspected hashes are in INVENTORY.json/INVENTORY.md; MATCHES.txt preserves the search output. Search scope is the requested packages/**/*.spec.ts pattern, not a claim to inventory all repository I/O.

## Finding and scope

There are **13 ordinary specs requiring diagnostic storage**: six hardcoded historical paths and seven mandatory environment sinks. These are real no-environment portability failures, not test-selection requirements. Another16 files already have optional sinks. Three files have timing controls only; production-scalar-substrate.benchmark is a fourth timing-control file with an optional report. Two matches are historical comments, two are separate GC-gate fixtures, and one is deliberate fault injection.

No inspected ordinary test reads its output file back or asserts the persisted bytes. Its useful assertions operate on in-memory values, snapshots, counts, errors and identities. Removing the file prerequisite must not remove those assertions or the evaluation that produces their observations. No new skip/runIf/expected-failure conversion is warranted.

## Exact mandatory-sink edit set

All paths below are under packages/kernel/src/lib unless stated otherwise. Preserve every it/each parameter, operation, drain, assertion, spy, cleanup and failure classification.

| File / current site | Required edit |
| --- | --- |
| rich-source-preparation-boundary:14 | Replace historical append destination with optional ST_JOINT_PHASE_OUTPUT directory + preparation-scalar.jsonl; preserve n()/ids() observations and serialization at this point. |
| rich-capture-getter-boundary:15 | Same directory + getter.jsonl; preserve armed=false/drain ordering, reads/partial/error and ids() evaluation. |
| rich-capture-participant-boundary:14 | Same directory + participant.jsonl; preserve ids() observations before expect(seen). |
| internals/causal-runtime/rich-source-completion-boundary:36 | Same directory + completion.jsonl. Preserve observed.push and serialization BEFORE the callback's write777; never place that write inside an output-enabled branch. |
| recipient-window-review:9,13,27 | Replace constant historical file with optional directory + recipient-traces.jsonl; preserve receipt.read(), native-proof spy and error projection at the original checkpoints. |
| fixed-window-retirement:30 | Optional ST_FIXED_WINDOW_OUTPUT directory + provenance-${cause}.json; preserve nativeProof evaluation and existing Set→array replacer at its current point. |
| independent-dynamic-enrollment:10 | Keep ST_PREPARED_REVIEW_OUTPUT as optional directory; independent.jsonl. Do not form literal undefined/independent.jsonl. |
| independent-occurrence-terminal:12 | Same existing optional directory; terminal.jsonl. Keep all terminal delivery assertions running. |
| independent-prepared-unit:11 | Remove missing-directory throw; optional existing directory with existing per-case filenames. Preserve eager record arguments, including value()/row.x() and error conversion. |
| independent-prepared-boundary:13,25,36 | Guard destination construction for existing directory; keep field-order/packet-${order}/absence-${mode} filenames. Preserve inspection/value/packet data and serialization positions. |
| approved-current-obligation:7,15 | Remove missing-output throw; ST_TWO_HISTORY_OUTPUT becomes optional FILE. Preserve the record checkpoints' tree.$(), receipt.read(), inspect(p/a/b), notice/settled/error data; never condition scenario execution or expectations on the sink. |
| public-selected-unit:21–22 | Remove missing-directory throw; optional ST_PUBLIC_DIAGNOSTIC_OUTPUT with current xy/yx-retry/confirm filenames. Keep result construction and before/after JSON inspection strings. |
| equal-owner-retention-diagnostic:37 | Remove missing-trace throw; optional ST_EQUAL_OWNER_TRACE FILE. Keep structure(captured), recursion, nativeProof/ready evaluation, owner/count/readiness assertions and forwarding witness; only persistence becomes optional. |

The two proposed new env names replace the hardcoded historical destinations; no historical directory should remain a default. Existing names retain their FILE versus DIRECTORY meanings, avoiding silent changes to retained replay scripts. Export these only in a deliberately diagnostic invocation, not the ordinary broad harness.

## Small shared utility, no new framework

One test-only helper at `tools/testing/optional-diagnostic.ts`, imported relatively by specs, is sufficient. Do not export it from any package or include it in runtime imports. Proposed shape (not implemented):

```ts
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
export function writeDiagnostic(
  file: string | undefined,
  serialize: () => string,
  append = false,
): void {
  if (!file) return;
  const text = serialize();
  mkdirSync(dirname(file), { recursive: true });
  if (append) appendFileSync(file, text);
  else writeFileSync(file, text);
}
```

No sink: no mkdir/write and no new environment prerequisite. Explicit sink: create missing parents; serialization/write errors propagate, preserving evidence failures rather than silently swallowing them. Caller retains JSON formatting/newline/replacer and append-versus-replace behavior. Construct directory paths only when the variable is set: `const file = dir ? join(dir, name) : undefined`. Do not pass `join(undefined, ...)`, non-null assertions, or `'undefined/name'`.

**Evaluation preservation rule:** for formerly mandatory writers, keep their payload evaluation AND JSON.stringify eager at the same program point, then call `writeDiagnostic(file, () => text, true)`. This removes only I/O dependence; it avoids accidentally changing a getter/proof/inspection read into an env-dependent operation. For already-optional serialization, leave it lazy inside the callback, while preserving any existing eager record arguments/snapshot variables outside. Do not move existing eager reads inside a sink guard merely for apparent efficiency. Simplifying those reads is separate semantic work, not necessary for this cleanup.

The16 already-optional ordinary files can use the same helper without altering assertion logic; INVENTORY.md lists them individually. production-scalar-substrate's writeRows is also already optional, so no required cleanup there. Its existing parent-path split has a bare-filename edge case that dirname handles, but this does not justify changing benchmark controls. Keep framework-qualified diagnostic destinations or distinct per-invocation output directories: kernel/angular parent-freshness currently reuse terminal-window/builder-work/direct-capture names and could overwrite each other's optional records if deliberately pointed at the same directory. This is evidence naming, not permission to share test state.

## Serialization is not automatically harmless

- No ordinary fixture consumes its written file, but JSON.stringify can traverse enumerable getters/toJSON, and arguments to record() execute even when record immediately returns. The getter-boundary fixture deliberately contains getter-bearing rows; do not generalize plain-object purity to all snapshots.
- approved-current-obligation's record() performs repeated current-tree and pending-inspection reads. Preserve those reads even with output absent for this smallest behavioral delta.
- preparation-reader-comparison already gates its writer but eagerly calls getRestorationHistory(), rows.all(), observedRead() and handle() in some record arguments. Wrapping the WHOLE call in a guard could change materialization/tracking/inspection work. Keep that evaluation placement.
- cached-current-input and opaque-current-input use JSON.stringify on pending inspections as an ownership-equality oracle. public-sibling-current-obligation does likewise; public-selected-unit compares serialized inspection before/after. These are assertions' inputs, NOT diagnostic formatting to remove.
- equal-owner-retention structure/count computation is directly asserted. fixed-window nativeProof/Set serialization and completion callback sequencing should remain in place. Existing observations must not be replaced by a log-only path.
- Removing disk writes changes incidental blocking time; no timing/performance claim follows. Synchronous serialization is preserved where previously unconditional; the cleanup does not promise logs are perfectly observationally inert.

## Controls and mandatory external receipts to preserve

- `held-continuation-probe` and `forwarding-retention-probe`: ST_GC_ARM/ST_GC_SCENARIO choose real scenarios; --expose-gc is asserted. Existing kernel Vitest config already excludes these from ordinary suites. tools/check-forwarding-retention.mjs owns twelve modes, creates ST_GC_OUTPUT, reads each JSON back and validates samples/matrix. That output is REQUIRED gate evidence, not an ordinary optional sink. Leave these controls, config partition and required receipts unchanged; do not default an arm or mark them skipped.
- `publication-retirement-acceptance`: ST_RETIREMENT_FAULT=naive-retire injects the rejected implementation for a negative proof. Keep the branch; ordinary execution leaves it unset. Do not convert it into diagnostic configuration.
- `benchmarks`, `internals/derived`, Angular `kernel-comparison.benchmark`, kernel `production-scalar-substrate.benchmark`: ST_PERF selects deliberately opt-in timing work. Preserve current timing selection, correctness cases, counts and ceilings. ST_PERF_OUTPUT_FILE is only the scalar benchmark's optional report.
- `batching-semantic-scopes` and `restoration-operation-outcome`: matches are comments only. No functional edits needed.

## Minimal later qualification, no broad campaign now

Main should compose this test/helper-only change separately, review the diff for preserved assertions/case selection/evaluation order, then run the13 changed mandatory-sink files through Nx with all diagnostic ST_* variables unset and no manufactured historical directories. Include helper tests proving unset path does not invoke a lazy serializer or touch disk; set path creates its parent and writes exact bytes; deliberate serializer/I/O failures remain failures. Add focused no-sink versus sink runs for the completion/getter and repeated-inspection-sensitive cases, comparing their existing assertions/case counts, not claiming identical wall time. Existing optional sites should retain no-env behavior; spec-types verifies the test-only cross-package helper imports. No GC/perf campaign is triggered by this sink cleanup.

Once that bounded qualification passes, remove the broad harness's diagnostic directory/env scaffolding and continue the already planned broad qualification on the composed identity. Clear fault/performance/diagnostic environment contamination explicitly. Preserve old first failures and frozen8bd; do not manufacture success by supplying historical paths. This review demonstrates source-level sink prerequisites and proposes corrections; it does not claim any corrected spec has executed.
