# Eligibility source audit (read-only)

Checkout: /Users/jonathanborgia/.codex/worktrees/v16-incumbent-readiness/signaltree
HEAD: 7c511c2b59e803b065b2a674e0f7b0a897f85145. Only AGENTS.md and measurement-contract.md dirty when inspected. No repository edits or tests performed for this audit.

## Facts available now

1. `lib/internals/commit-consequence.ts:57-61,88-109` keeps open scope IDs privately per tree and `(owner,id)` scopes. `hasOpenCommitScope` (343-346) exports only a Boolean; `isCommitScopeOpen` (335-340) answers a known identity. `onCommitScopesSettled` (348-365) supplies no owner/outcome and runs only once all current scopes are gone. It cannot distinguish all-confirm from mixed confirm/reject.
2. The transaction lifecycle source offers an actual pending list, not inferred data: `transaction-lifecycle-source.ts:15-38`; populated at `enhancers/transactions/transactions.ts:1425-1444`. `transactionLifecycleReader` is a tooling/internals reader, not an application facade mechanism. Its snapshot includes tree identity, sequence, pending IDs, phase and consequencesReleased. It has **no retrospective outcome history** (`transaction-lifecycle-view.ts:188-191`). Future events distinguish confirmed, rolled-back, refused, opened and staged.
3. Open phase is registered and recorded before callback (`transactions.ts:3794-3818`). Commit scope opens later (3831-3834), after opened listeners can reenter. Therefore instrumentation that only queries commit scopes can miss an opened transaction around those listeners; snapshot source and write context are different evidence channels.
4. Confirmation is irreversible in handle state (`transactions.ts:3998-4004`), retires lifecycle pending view and records confirmed before callbacks (4011-4019), and settles commit scope in a finally (4054-4059). Public lifecycle delivery occurs after consequences (4070-4072). For a research gate that needs the result before existing durable callbacks, a normal reader callback can arrive too late; private lifecycle source record is earlier. Do not attach another source observer directly: `source.attach` is a single slot (1438-1439) and would displace tooling observation.
5. Rollback records rolled-back only after compensation installed and disposition became rejected (`transactions.ts:4155-4162`), then discards scope (4183-4187). Refusal does not remove authority. Absence from pending list alone is insufficient: early construction abandonment removes lifecycle view and advances sequence **without a terminal event** (1451-1460). Destruction also clears views, not confirmation.
6. `path-notifier.ts:262-325` snapshots write value/previous value, owner/position, current write metadata at notify/enqueue, before delayed notification coalescing. Existing metadata (`mutation-types.ts:76-176`) contains writer transaction attribution, mutation intent and participation, **not a complete read-dependency set**. `write-context.ts:15-34` explicitly says ambient context does not survive await. The before/after values are not proof of their originating dependencies.
7. Link advances a scalar projection on noninspection notifications (`link.ts:689-692`); automatic eligibility does not currently retain owner sets for that revision. The incoming value is separately authoritative for its relationship (`link.ts:475-485`), an existing stronger boundary than an ordinary write.
8. Current safe hold schedules by owning scope or tree-wide pending Boolean (`commit-consequence.ts:188-222`). Scope settlement deletes its identity before running consequences (246-254), then runs all tree-held work after **either outcome**, when no open scope remains (272-289). Comment 230-231 calls held work “never speculative, only unprovable”; that is not evidence of no transitive dependency. Preserve the actual rollback-copy counterexample rather than treating this comment as a provenance proof.

## Candidate hypothesis and exact limit

An immutable per-revision **complete conservative possible-owner set** plus observed irreversible outcomes can resolve all-confirm: if every possible owner confirms, no rejected pending fact in that closed set remains speculative. It is unnecessarily conservative for unrelated work while any member remains pending, but should not permanently hold an otherwise complete revision after all confirm. A single rejection makes that proof unavailable; “no owners pending” must not erase rejection.

The source can furnish a *current pending-owner set*. It cannot prove this set is *complete for an arbitrary ordinary value*. Counterexample classes:

- Copy a pending value into an ordinary surviving field, reject its owner, later copy that field. The relevant owner is terminal before the second write.
- Capture a pending scalar into a JavaScript local; reject; later write that local. Same ordinary write metadata as an independent constant; no async is necessary.
- Read a cached native computed whose evaluation happened earlier. The current write/notification does not enumerate that evaluation's dependencies.
- Depend on another tree: the gate and pending snapshots are intentionally tree-local.

Therefore an experiment can earn all-confirm progress **only with a stated supported boundary making the candidate set complete** (e.g. a fresh, closed sequence with no older rejected data/captured values and monitored source participants). It must not advertise attaching current open IDs to every ordinary write as a generally sound production mechanism. Conversely, the existing bridge's permanent `unknown` does not disprove all-confirm discharge for such a bounded sequence; it simply lacks this bookkeeping.

## Minimal discriminators (expected outcomes before execution)

- Fresh x/y, p writes x7, direct y42, p confirms: require y42 eventually delivered under complete-set hypothesis. Same with y copied synchronously from x: y7 may publish after p confirms, never before.
- p writes x7; q independently pending; direct y42 / copy x7; confirm p: still held if recorded conservative set contains q. Confirm q: may publish. Reject q: complete-set proof unavailable; do not silently cleanse.
- p writes x7; ordinary y copies x; reject p: y7 may remain native ordinary truth, but old dependent revision must not become eligible merely because pending count is zero.
- Repeat after rejection with later y=42 versus y=captured7: if both are ordinary unscoped writes, identify observed evidence difference or preserve impossibility of distinguishing them at this seam. Do not name constant overwrite a clean boundary by fiat.
- New authoritative incoming y9 supersedes unknown/dependent y revision: existing bounded incoming case must progress, and old eligibility must never transfer to new payload.
- Another owner opens during confirmation delivery: exact revision evidence must be preserved and delivery revalidated; adding newly pending owner indiscriminately is conservative but not a proven dependency. A callback-authored new revision requires fresh evidence.
- Failed rollback/refusal: outcome remains pending, authority intact; no release based on exception alone. Confirm then rollback must not reverse terminal outcome.
- Captured-local delayed write after owner rejection (without timers) and cross-tree copy: explicit boundary-negative witnesses, not failed requirements for arbitrary async causality.

No new API or production change proposed. Sources support an executable bounded test of complete-owner-set discharge, while also exposing that completeness is the remaining semantic burden.
