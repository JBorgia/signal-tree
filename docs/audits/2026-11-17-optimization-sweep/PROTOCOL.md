# Broader optimization investigation

Opened November 17, 2026 UTC after study `76c2e15e1dc70ae0a26b77653b83f69849482efc`.
The owner explicitly requests continued exploration across optimization options
and areas before reporting again. Release/pilot sequencing does not close this
request. This phase investigates and implements justified cost reductions.

## Baselines and authority

- v16 C1 runtime `2c439198b13a93ede29e7bece69a07a534f30797`, tooling checkpoint
  `2810528ef760c5c5a8ecda788f32c168f59d0470`, remains the frozen comparison arm.
- Prepared v15.4.9 runtime `0d2b9619206ab9e7a7af998944e744f6d2b6e492`, documentation
  checkpoint `4c59a7993ffaf61181429a4b946088adb788a3ee`, remains untouched. Any new
  v15 prototype gets separate source and artifact identities.
- Runtime experimentation uses `codex/v16-optimization-sweep`; the study uses
  `codex/optimization-sweep`. The main checkout's unrelated work is preserved.
- Internal implementation improvements are authorized. Experimental alternative
  mechanisms do not themselves select a public API, weaker guarantee or new mode.
  No publication, tag, merge or site deployment belongs to this investigation.

## Coverage and decisions

The [candidate ledger](CANDIDATES.md) covers startup/population, frame and topology
preparation, publication/proof preparation, metadata and cloning, read/context
materialization, pending ownership, long-lived retirement, native history capture,
framework realization and delivered-code costs. Existing demand/configuration
choices and the cost of additional selection machinery are included.

Each area needs a concrete disposition: measured adopted improvement, measured
rejection, a semantic counterexample, or a source/history explanation of why a
specific lead does not justify a prototype. A cheap failed option does not close
all alternatives in its area. The ledger must distinguish surveyed mechanisms
from unknown opportunities; this cannot prove that every possible algorithm is
optimal. Promising unresolved leads remain work, not a completed checklist.

Independent premise scrutiny precedes consequential representation/ownership
changes. Root centralizes architectural decisions and document writes. Reviewers
receive raw source, relevant history and tests without a preferred verdict.
The previous blind notification gate's four counterexamples remain required
boundaries. They establish observable work, not a requirement for the current
sequence of temporary metadata objects.

## Execution and measurement

One heavy execution slot covers installs, builds, tests, mutation checks and
comparative runs. Read-only source analysis may proceed independently. Raw
commands, failures, source snapshots and results use persistent storage under
`artifacts/optimization-sweep-2026-11-17`, outside the prototype checkout.
Use Node 24.15.0 and pnpm 10.17.0 with the frozen lockfile.

Screen one mechanism at a time. Bind exact sources and built payloads before
running; retain each attempted patch and first failure. Require meaningful
behavioral checks before comparative timing. Separate low-count screening from
final comparison, instrumentation from timings, neutral runtime from application
work, allocation from retained heap, and user-input latency from synthetic
framework stabilization. Freeze the final workload/order/sample plan before its
execution, include same-build controls and retain adverse samples.

Adoption requires complete cost accounting across construction, first demand,
steady-state sparse and bulk work, representative wide rows and long-lived churn,
pending/settled memory, teardown and delivered bytes where relevant. Configuration
or caching savings must include routing, cache invalidation and storage costs.
Do not silently trade eager work for a worse first interaction or retained heap.

Preserve late readers, enqueue and delivery observers, reentry and nested writes,
publication completion, retirement/replacement identity, independent publication,
pending ownership, safe refusal, snapshot isolation and the original point-work
bound. User getter/clone/exception boundaries require specific evidence before
changing them. Supported v15 behavior remains a separate compatibility contract.

After selecting combined candidates, run affected kernel/framework/type and
installed-artifact checks, current production demo and documentation gates, and
rerun affected comparisons against C1 and pinned rival implementations. Affected
qualification is not a new full release sign-off. Numerical budget failures and
economic dispositions remain separate; no ceiling is relaxed for green output.
