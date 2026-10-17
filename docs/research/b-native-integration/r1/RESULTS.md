# R1 final verification

Frozen runtime/test inputs: final-source-hashes.json in the evidence archive (nine files). Baseline8d220643; rejected predecessor2d9ed132. Final local commit is the commit containing this record. Source unchanged during final runs and independent replay; root verified hashes before packaging.

| Check | Result | Evidence |
| --- | --- | --- |
| Native original controls | 13 ordinary pass | final-focused-nx.log; independent-final-original13.log |
| Expanded native controls | 18 ordinary pass | final-focused-nx.log; independent-final-expanded18.log |
| Neutral B semantic / adversarial / destruction | 41 / 14 / 1 pass | recovery-semantic.json; recovery-adversarial.jsonl; recovery-destroy.log |
| Affected kernel, before final clock correction | 145 ordinary pass, 8 files | affected-nx.log |
| Full kernel, final | 5776 ordinary pass; 12 expected fail; 12 skip; 2 fail | full-kernel-final.log/.json |
| Angular | 237 ordinary pass; 3 skip | frameworks-final.log |
| React | 74 ordinary pass | frameworks-final.log |
| Solid | 104 ordinary pass | frameworks-final.log |
| Vue | 172 ordinary pass | frameworks-final.log |
| Source typecheck | exit0 | typecheck-post-clock.log |
| Spec-types ratchet | pass; 6 existing diagnostics, no ratchet edits | spec-types-post-clock.log |
| Kernel lint | exit0; 0 errors, 3 non-null assertion warnings | lint-kernel-final.log |
| Diff whitespace | pass | root and independent review |

The full kernel command exits1 because both preserved primitive replacement probes remain ordinary failing tests. Root inspected the JSON: these are the only failures. Neither is reclassified as an expected failure. Exact unchanged8d runtime independently fails the standalone primitive replacement probe (expected3, got1); fixture and log are archived. The 12 preexisting expected failures remain distinct from ordinary passes. Framework totals are existing-suite regression evidence, not B-enabled transaction integration.

The initial broad run before physical-clock correction had5775 ordinary passes,12 expected failures,12 skips and the same2 baseline probes failing; it did not contain the new clock assertion. Preserve that result separately from the final run.

Spec-types is a ratchet, not a clean spec compilation: six diagnostics remain in mut-participation.spec.ts against baseline seven. Three files improve relative to stored allowances; no ceilings or allowances changed. Initial source type/spec/lint failures and pre-fix sources remain archived. No approval rejection or unexecuted validation attempt occurred in this revision; the predecessor's separate approval timeout and unexecuted commands remain in its unchanged record.

## Review disposition

Independent read-only review first reproduced hidden-value publication and false recovery authority after terminal abort. Both raw failures and corrections are preserved. It independently replayed the final13+18 controls, verified all nine source hashes and diff whitespace, and found no remaining blocker within this slice. It checked the physical-clock sequencing, existing confirmation origin, typed plans, and stronger undefined assertions. Root inspected those changes, final logs and JSON, and independently reproduced exact-baseline primitive replacement. No reviewer result is used to claim full lifecycle or allocation-failure safety.

## Replay and scope

WORKER-REPLAY.sh in the archive gives exact pinned Node24.15.0/pnpm10.17.0 commands, worktree, Nx flags and all final gates. It deliberately allows the preserved primitive/full-kernel commands to fail and continues subsequent checks. Recovery commands are in ../recovery/README.md; all three passing controls were rerun unchanged this revision. The standalone exact-baseline fixture must be overlaid on unchanged8d source and run with:

```sh
NX_DAEMON=false pnpm nx test kernel --testFile=src/lib/b-r1-primitive-baseline.spec.ts --skip-nx-cache
```

Expected exit1. This is an internal marker/materialization probe, not a claim of an ordinary public application trigger.

Not executed: package/demo builds, bundle ceilings, CPU/heap benchmarks, full B-enabled public transact/entity/Link/four-framework matrix. Performance remains premature. No release or production sign-off. The candidate remains isolated; the baseline primitive counterexample and unproved post-install bookkeeping failure behavior prevent a claim of complete coverage.
