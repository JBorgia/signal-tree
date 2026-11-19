# Cheapest next discriminator for the unexplained130k stall

No new experiment run. Keep frozen negative filter evidence and separate clear+1 attribution intact. No large replay, runtime patch, ceiling change or timing claim.

## What is established and what is not

Plato's exact-import small probe measures linear predicate visits. I verified its raw site sums, wrappers and actual predicate bodies. No nested Array.includes/find occurs inside reached callbacks; entity-signal.ts:1042 filter/includes belongs to prepareOrdinaryRealization and is not reached. Linear filter visits do not bound work outside callbacks, allocations, GC/JIT thresholds, or all worker history. The first probe's reader-acquisition flaw was corrected and preserved. The remaining comparability difference is its intermediate ids()/count() reads; original large case does not perform them.

Read C19 full command: Nx kernel, maxWorkers=1, default reporter plus progress reporter; no --no-isolate or explicit pool override. Kernel config sets happy-dom and no isolate/pool override. Installed Vitest defaults (node_modules/vitest/dist/chunks/defaults.9aQKnqFk.js:47, config.cjs:50) set isolate:true. Therefore earlier-file shared module/registry state must NOT be assumed from serial execution. Conversely test isolation is not proof of a fresh OS process, reclaimed heap, or no process-global/native/JIT history. Record PID and actual runtime flags rather than declaring those histories equivalent.

The preserved sample records physical footprint3.5G, peak3.6G, sampled worker23615 with parent19452. That is process footprint, not reachable JS heap, a leak measurement or attribution to filter allocations. ArrayFilter sample prominence has no resolved JS callsite. It motivates checking heap/phase behavior but cannot select a repair.

## Proposed staged probe, not a matrix

1. First close the cheapest workload gap: one bounded exact-import observed sequence at N128, without ids()/count() reads between initial/disjoint/empty setAll. Keep payloads built before measurement. Record only before/after EACH operation: stage, PID, process.execArgv, heapUsed/heapTotal/RSS and monotone operation completion; final count/order/events after all three. Compare with the existing instrumented sequence's per-site filter visits. Use a separate output sink. Preserve exact membership event units; no read-derived callbacks or subscriber mutations.
2. If unchanged, repeat that same bounded sequence a small fixed number of times (e.g.8), destroying each tree, in the SAME test worker; contrast first and last and a fresh worker's first sequence. This is a bounded history-sensitivity test, not reconstruction of the full preceding suite. No forced GC or deliberate heap ballast initially. Stable logical visits but increasing boundary memory would suggest an allocation/retention/history lead, not prove a leak. Different logical callsites/counts would instead expose state/registration accumulation. Record actual PID so worker replacement cannot masquerade as same-process history.
3. Only if those remain unchanged, one bounded size extension N256 then1024 in fresh workers (not130k) can look for callsite/phase switches or allocation growth beyond the previous N128 range. Stop after a new divergence. External process watchdog is required for any future extension because the synchronous Vitest timeout cannot interrupt a stuck operation. These sizes cannot refute a threshold occurring only near130k.

Do not rerun nested-search instrumentation merely because linear visits can theoretically hide it: source inspection already excludes it in observed callback bodies. If a new filter callsite appears, then use a filter-depth marker and native passthrough find/findIndex visits plus includes/indexOf call counts/receiver lengths/fromIndex for that callback. Calibrate with intentionally nested growing searches. includes receiver length is an upper search range, not actual comparisons. Never substitute indexed loops to hide measured work.

The memory samples above are boundary observations only: they do not capture transient peak allocations or GC cost within an operation. If stable logical counts accompany a bounded repeat/size-specific stall, the next separate request should be a bounded JS-attributed CPU/allocation profile of the first affected phase, with source identity/PID/output limits—not a broad native sample or guessed source rewrite. Do not claim a guaranteed speed improvement or whole-algorithm linearity from any of these steps.

## Separate preserved finding

/private/tmp/st-c19-clear-find-attribution/REPORT.md attributes2N+1 to physical N + ordinary N + final-adjacency replay head1, with exact unchanged256/1024 six failures preserved. That diagnostic neither explains the plain setAll stall nor licenses changing the point<2000 ceiling. Its original legacy-dominance mutant is bypassed by selectedCompensation; no bound-only maintenance is recommended.
