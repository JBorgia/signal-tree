# Bounded C10 / C8a clear-six adjudication

Verdict: all six clear predicate-count failures reproduce unchanged on exact C8a. No C10-specific regression demonstrated. Keep the original count-bound failures open; this review does not authorize widening a limit or changing runtime. Main's interrupted full run remains incomplete, not an enumerated full-suite result.

Exact inputs copied and verified before execution (SETUP.json):
- C10 promoted SNAPSHOT.json SHA256 de88e207c66e65a1a191d05ab4f2b5b2a4deeead71a06f239f278e28dee70dc4, 3042 files.
- C8a SNAPSHOT-C8a.json SHA256 04ba51dec86f537921521cf0a8ef5276c788e48b9a4e4abc24c7c5d14eda9652, 3031 files.

The triggering partial full-run artifact is `/private/tmp/st-native-combined-c10-promoted/runs/kernel-full/first.log:766`: entity-large-batches-v16-controls.spec.ts reports six clearing failures, but that full run was subsequently terminated. This review independently runs only the six 256/1024-row clear cases; it does not execute the 130,000-row workloads.

## Unchanged first failures

Both copies, Node24.15.0 / corepack pnpm10.17.0, actual Nx kernel target:

```
corepack pnpm nx test kernel --skip-nx-cache --testFile=entity-large-batches-v16-controls.spec.ts --testNamePattern='clearing with setAll' --maxWorkers=1
```

Each: 6 failed / 10 skipped. For transactions, transactions+restoration, and restoration+transactions:
- 256 rows: 513 predicate visits, allowed <=512.
- 1024 rows: 2049 predicate visits, allowed <=2048.

Failure is line 154 in the unchanged spec. The next restored-id assertion is blocked by that failure, not passed. First raw logs/commands/exits are c10-clear-first.* and c8a-clear-first.*. Test file SHA256 3164534cc73d4bdb08aa348949218c5efef1c1be14a65431d15bd3f0d6aa1b56 is identical in both snapshots.

## Independent cheap attribution

A separate 256-row transactions-only companion (`packages/kernel/src/lib/clear-find-attribution-review.spec.ts`) uses the original test's direct module imports, instruments Array.find with caller identity and per-call predicate visits only during rollback, restores the prototype in finally, and independently checks restored ids/order, count, and first/last row values. It passes on both copies. No original assertion or budget is modified.

Exact-import captures c10-attribution.json and c8a-attribution.json agree:
- `physical/order-restores-for-placement.ts:78` chain-head fallback: 3 calls, visits [256,256,1], sum 513.
- No other Array.find site contributes in this exact-import workload.

Thus the six failures are not evidence of the old quadratic dominant-structural-effect search returning. In this measured clear workload, the global predicate counter covers three placement chain-head selections, not solely the pending-rollback lookup named by the describe block. Two measured sizes give 2n+1; this is not a universal complexity bound. Source inspection locates consumers at physical/ordinary-restoration-placement.ts:23 and :37 and internals/causal-runtime/tree-realization-adapter.ts:3003. No further per-consumer instrumentation was needed to classify the inherited failure.

The tested spec, order-restores-for-placement.ts, pending-rollback.ts and target-transition.ts are byte-identical between C10 and C8a. The source-level placement fallback is preserved. Existing test comment allows an extra chain-head visit only for replacement, while the measured clear fixture also counts one beyond its 2n ceiling. This supports a separate narrowly justified count-oracle review; it does not itself authorize that edit, and it does not prove absence of broader planner work.

## Fixture limitations and preserved iterations

The first attribution companion imported the package index instead of the original direct modules. That activates additional publication work: at 256 rows, both versions also report 32,896 visits at experimental-publication/entity.ts:102 (256 packet physical-row pairing searches). Preserve that result as a different workload, not an explanation of the unchanged six failures. `ATTRIBUTION-ROOT-IMPORT.spec.ts` and *-attribution-root-import.json preserve it. No inference about this alternate workload's whole-runtime asymptotics or C10 introduction is made here.

The first companion console output was suppressed for passing tests; ATTRIBUTION-FIRST.spec.ts and initial run logs remain. Only the evidence sink was then changed to owned absolute JSON files, followed by the direct-import correction above. Final exact-import logs are c10-attribution-exact-import.log and c8a-attribution-exact-import.log (1 pass each). The final exact-import companion spec-type ratchet also passes (c10-final-types.log, exit 0); no ratchet update. No full suite, source build, release gate, or runtime patch was run/applied.

All runtime/source inputs and original test oracles remain untouched. Final identity/evidence hashes are recorded separately. Dependency symlinks use the earlier owned working node_modules copy, not the broken qualification tree. Exact raw commands and environment accompany each execution.
