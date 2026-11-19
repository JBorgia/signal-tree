# Exact clear rollback find attribution, C19

No runtime, original test, or bound edits. Own scratch adds only a diagnostic spec. Exact C19 baseline b8eace4025ff735988dee88db512a2e9ceb5ac9e1302683d68d6900acea17576. Pinned Node24.15.0/pnpm10.17.0, Nx, root working dependencies symlink; no large workload, microbenchmark or timing claim. Independent Plato filter review completed first, separately at /private/tmp/st-c19-filter-independent-review/REVIEW.md.

## Executed evidence

small-corrected:6pass at N3/8 across transactions, transactions+restoration, restoration+transactions. LARGE attribution:6pass at N256/1024 same arms. Diagnostic asserts exact restored IDs AND complete row values after rollback. Counts respectively7,17,513,2049 =2N+1 for all configurations. SMALL-observations.json and LARGE-observations.json retain counts/site stacks. invocation-detail:1pass at N3, retains every invocation stack and visits in INVOCATIONS.json.

unchanged-clear-first: original entity-large-batches-v16-controls.spec.ts unchanged, filter 'clearing', SIX failures, ten intentionally skipped. Actual513>512 and2049>2048. Raw command/exit/log retained. Failure is real against the unchanged partial counter, not a claim of whole-planner complexity. The original post-count order assertion is blocked by that failure; the separate diagnostic checks order/values nonvacuously.

First diagnostic small-first had recursion because instrumentation's own stack classification used patched Array.find. FIRST-PROBE.spec.ts/FIRST-observations.json and raw first log preserve that instrumentation failure. Corrected classifier uses a loop; native find still executes search and forwards predicate thisArg/arguments, prototype restored in finally. No runtime failure attributed to this fixture error. Some initial Vite config warnings concern archived audit configs; corrected Nx test execution succeeds.

## Exact three calls (not a guessed graph-head site)

Every visit is at lib/physical/order-restores-for-placement.ts:78. At N3 the invocation traces prove visits3,3,1, each receiver length3:

1. tree-realization-adapter.ts:3003 orderPhysicalPlacements -> planHeterogeneousFrame:1310: physical restoration anchor resolution, head at the end of the reversed restore sequence, N predicate visits.
2. physical/ordinary-restoration-placement.ts:23 -> entity-signal.ts:1032 -> planHeterogeneousFrame:1585: ordinary restore request ordering, again N visits.
3. physical/ordinary-restoration-placement.ts:37: order FINAL ordinary adjacency for replay, head first in the now ordered sequence, ONE predicate visit.

This is not order-boundary-evidence.applyPairs:274, not transactions.orderDeltas.find, and not pending-rollback's indexed dominant lookup. Other find sites have zero visits in this exact workload. At N256/1024 aggregate site totals remain2N+1; detailed per-invocation stack decomposition was captured at N3 only, so the per-pass formula at larger N is source inference supported by the same site and total, not separately logged per-call values there.

The final-adjacency pass is deliberate. ordinary-restoration-placement.ts:27–29 says final adjacency can differ from requested anchors: a later insertion may become an earlier restore's successor, making the first resolution order insufficient. The second pass orders that final snapshot for replay. order-restores-for-placement.ts:69–82 first consumes ready full/partial queues; with a wholly restored chain and no live anchor it selects a head using find. The +1 is one successful head predicate in that second resolution, not an extra full scan. It is constant for this fixture, not proof of a constant bound for arbitrary anchor graphs. Do not remove the second pass or replace the order with capture order to satisfy the counter. Existing ordinary-restoration-placement.spec.ts includes finite anchor/replay parity over625 combinations; inspected, not rerun here.

## Guard purpose and mutation-coverage caveat

Original comments :83–88 explicitly describe a PARTIAL Array.find predicate-work guard, not total planner linearity. It was introduced against createPendingRollbackEffects scanning all structural effects per effect, m(m+1)/2 candidates. The count comment :146–151 currently attributes clear's N to indexed dominance and one head only to replacement. That attribution no longer describes C19's reached route.

transactions.ts:3821 passes selectedCompensation:inverseEffects. pending-rollback.ts:78–80 uses that authority-selected sequence and bypasses createPendingRollbackEffects entirely. The observed complete absence of its find site corroborates this. Therefore merely reverting the legacy indexed lookup to its original quadratic scan in that bypassed function would not be exercised by this fixture. This is a source-based mutant-reachability conclusion; NO runtime mutant was installed or run under the no-runtime-edit scope.

An executed quadratic dominant scan with m=N would numerically exceed even2N+1 at original sizes (32,896 at256;524,800 at1024), but that arithmetic is NOT proof the current public fixture kills the original mutant. The reachability gap matters. Do not report “original mutant still killed” without a targeted reachable legacy-route discriminator, or a separately reviewed mutation in the actual current route.

## Disposition

No unnecessary extra source work demonstrated by the +1: it serves the existing final ordinary-adjacency replay, and source tests explain why that pass exists. No N² find growth demonstrated; N3/8/256/1024 totals are2N+1. This says nothing about uncounted filter/includes work or full rollback cost. Point absolute<2000 and the stalled130k membership case are separate.

A precise oracle-maintenance discussion is justified by the causal mismatch in the old comment/bound, but **do not promote a bound change alone**. The requested prerequisite that original quadratic mutant coverage survives is not established and source shows its old route is bypassed. Keep original six failures/bounds intact. Any later maintenance should separately retain a meaningful legacy-dominance regression control if that code remains supported, and pin the actual physical/ordinary/final-adjacency search work and restored semantics; review mutant sensitivity before promotion. No implementation or oracle patch proposed in this task.

Raw commands are NAME-command.json with cwd/environment/argv; NAME-exit.json holds actual subprocess exit (runner itself returns0 after recording it). No broad suites/types or additional profiling claimed.
