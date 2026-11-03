# Four-file unchanged R2/R3 differential

All six selected failures reproduce on exact R2 and frozen R3. Both runs:96pass6fail, four files,102cases, exit1/no timeout/sourceUnchanged. Case identities, statuses and first error lines match across all102 cases; all six failed names match the preserved original full-characterization ledger. No new selected failure is introduced by the R3 delta in this differential. This establishes inheritance from R2, not the earlier introduction point, a root cause, or permission to waive failures.

## Exact inputs and command

Own immutable-source reconstructions under `/private/tmp/st-r3-r2-four-file-differential/{r2,r3}/candidate`. R2 manifest SHA256 `597eaf690450a74cc128b8e90b7032aa7d5ef842deae48a4358ade9ed4b9952c` (3093 paths); R3 `e0b64de42df330abff455d2ee1b981c99abee187a77269cd064f52f3b08505f3` (3095 paths). Each input hash verified before copying; all manifest paths rechecked after its run. All four fixture hashes identical across arms. No runtime/spec/config edits, source repair, diagnostic overlay or oracle migration. The separate finished suite-correction candidate is not used.

Sequential pinned Node24.15.0/pnpm10.17.0 Nx kernel commands, each with exactly:

```
src/enhancers/transactions/transaction-safety.spec.ts
src/lib/internals/causal-runtime/tree-realization-adapter.spec.ts
src/lib/whole-value-new-keys.spec.ts
src/lib/entity-granular-reactivity.spec.ts
--skip-nx-cache --maxWorkers=1 --reporter=default --reporter=json
--outputFile=<arm>/RESULTS.json
```

Owned caches/workspace-data/tmp/process group,180s external cap; no timeout. COMMAND.json records exact argv/env/cwd; first.log preserves unedited raw output and historical archived-tsconfig warning. No spec-specific process.env output requirement found in these four files; JSON output explicitly named per arm. Reporter's actual four-file set is checked against the requested ledger. No performance/timing comparison. No additional files, builds, types or full suites run.

## Matched failure classification

| File / exact failing case | R2 and R3 observation | Classification |
| --- | --- | --- |
| transaction-safety: retains external ABA written inside a failed callback (batching=false), line361 | x reads0; expected1. Throws as expected, then fails physical value assertion. | Actual state failure under private notifier scheduling; not a spy failure. Same batching=true counterpart passes. Later pending-count/open-scope assertions are not reached in the failing arm. |
| tree-realization-adapter: keeps outer transaction authorship active across an inner realization write, line3924 | middle initially B, then becomes empty after outer pending.rollback; expected B. | Internal adapter integration with a real observable state failure, not a mock/call-count oracle. left rollback assertion passes; subsequent right/counter assertions are not reached. Does not alone establish a pure public-only reproduction. |
| whole-value-new-keys: retains newly installed membership responsibility after a failed rollback | Scalar selection requires prepared admission. Stack ends node.n; fixture's second transaction writes the newly created b.n. | Real native admission exception on an ordinary installed member. The intended rollback/refusal assertions are not reached. No old-port spy in this case. |
| whole-value-new-keys: refuses removal of a created branch with a confirmed descendant dependency | Same native admission exception on node.n. | Fails descendant write before intended confirmation/rollback refusal. No old-port spy. |
| whole-value-new-keys: preserves reentrant installed handles when outer private preparation throws | Same exception on node.saved0 after the reentrant construction checks. | Actual later write through retained installed handle fails. Uses private slot-count observations earlier, but failure is not their count assertion or a port spy. |
| entity-granular-reactivity: a single-entity update does not rebuild the collection, line215 |13000 counted visits vs frozen <2000. | Operation-count budget failure with unchanged instrumentation.200 updates at2000 rows and20000 rows produce equal counts, so the earlier size-equality assertion passes; absolute bound fails. No CPU claim, allocation claim or budget waiver. Calibration assertions after line215 are not reached. |

Per-file totals in both: transaction-safety22pass1fail; adapter42pass1fail; whole-value-new-keys23pass3fail; entity-granular-reactivity9pass1fail.

Do not lump these six with other ledger entries asserting applyAtomically call counts or injecting old realization ports. This selection does not execute restoration/transaction-observer-failure/transaction-lifecycle-view. Within whole-value-new-keys, a separate validateEffects-spy recovery case passes on both; that does not prove all old-port injectors remain meaningful elsewhere.

## Source leads, not causal conclusions

- The three member-write stacks converge at transactions.ts:2891. Source directly proves the immediate throw condition: scalar selection is handling a changed transaction-owned slot but mutation.preparedTerminal.scalarAdmission is absent. Hypothesis: transaction preparation attachment for dynamically installed/reentrantly retained scalar nodes misses this admission. No trace has established which producer omitted it or the introducing change.
- Unbatched external ABA suggests failed-callback compensation loses the external replacement's protection or authorship. Batch scheduling is a concrete discriminator already executed by the unchanged pair. No deeper trace was performed; do not assign cause to notification draining or endpoint selection from this result alone.
- Inner realization B being rolled back suggests the private adapter write is captured or restored as outer ownership. No attribution/metadata trace establishes that mechanism. Preserve as an internal integration state defect, not automatically an obsolete expectation.
- Equal13000 operation counts at both sizes establish a shared absolute-cost failure in this workload, not collection-size growth. Source attribution to publication preparation or another subsystem remains untraced in this task. Earlier historical counts are not substituted.

R3 only adds comparator chronology/descriptor/completion bookkeeping over this R2; matching failures establish these regressions were already present in R2. They do not establish that R3 has no other effects or that any of these contracts should change.

## Evidence

INPUTS.json: exact paths, fixture hashes, source manifests, copied ledger hash. ORIGINAL-FAILURES.json preserves the supplied first-failure ledger. Each arm: RESULTS.json full reporter data, CASES.json, FAILURES.json, runs/first/{COMMAND,PROCESS,SOURCE,RESULT}.json and first.log. COMPARISON.json records exact-set matching and post-run all-manifest verification. No rerun/retry hid a first failure.

Postprocessing note: original ledger suite separators are ` > `; Vitest JSON fullName uses spaces. First strict ledger-name comparison failed on this formatting difference, preserved in POSTPROCESS-FIRST.txt. Corrected comparison normalizes only that delimiter. Arm-to-arm102-case statuses/error lines matched without normalization; no runtime rerun or oracle edit.
