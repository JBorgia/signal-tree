# Bounded compound-compensation candidate

Integration base `753dbcf3` includes the separate Link repair `fd333871` and its
assertion-preserving spec-types correction. This checkpoint is not release
acceptance. The historical checkpoint retained one ordinary failure at an invalid
history-index assertion. The owner authorized its specific correction on October
19; see the current result below. Historical evidence is unchanged.

## Mechanism and first failures

An installed structural frame records its before/after order frontier alongside
existing paired transaction responsibility. Settlement composes contiguous
same-owner intervals, verifies complete net structural coverage and exact current
lineage, then rechecks after preparation. The recovered lineage installs with the
complete compensation before callbacks and terminal cleanup. ST1034 validation
remains intact; independent topology changes do not gain rollback authority.

The initial nine-control candidate fixed the original ST1034 retry, but failed
zero-net cancellation: add/remove a temporary lifetime, successfully reject, then
undo the earlier designated reorder. Empty net effects skipped compensation and
terminal cleanup discarded the remaining interval evidence. This counterexample
is preserved for baseline and first candidate. The final mechanism handles known
empty disposition through the same prepared completion boundary. Missing records
are not treated as empty. It emits no artificial row/order facts, does not revive
the temporary lifetime and does not treat confirmation as rejection.

No collection traversal was added to frame capture. Frontier evidence is constant
size per structural frame; settlement visits recorded operations and indexed
net effects. This is not a constant-time rollback or general performance claim.

## Verified results and limits

- Final combined focused Nx run: **44 ordinary passes**, no skips or expected
  failures: 16 compound/zero-net controls, 12 Link controls and 16 unchanged
  membership-granularity, point-lookup and transaction-reentry controls.
- Source typecheck, ordinary spec-types and changed-file lint pass. The three
  pre-existing spec-type improvements remain reported without baseline changes.
- Fresh five-package and production demo builds pass. All four unchanged bundle
  ceilings pass: bare 12.30/12.41 KB production, 14.68/14.79 KB development;
  entities 26.12/26.16 KB production, 28.90/28.98 KB development. These are the
  gate's rounded displays; raw output and 248 artifact hashes are retained.
- Independent [source review](REVIEW.md) and [zero-net review](ZERO-NET-REVIEW.md)
  verified the frozen source and found no concrete blocker within tested scope.
- The original public regression remains **1 ordinary pass / 1 ordinary failure**.
  It now passes the unchanged useful-undo, value and held-reference assertions,
  then reaches `getCurrentIndex() === index - 1`. Established v16 tests explicitly
  say undo does not move that snapshot index. The [independent disposition](INDEX-REVIEW.md)
  records the earlier decision and tests. Separate controls execute useful redo
  and authority checks; the original invalid assertion has not been weakened.

The exact original file remains in the earlier runtime-boundaries archive. Its
active carrier differs only in a lint-required relative import; assertions are
unchanged. New control setup mistakes (void return expectation and an invented
placement after moving a predecessor) are preserved separately, with established
API/baseline evidence for their corrections. They are not runtime regressions.

R1/R2 complete-turn explicit-order composition remains unresolved. Frames with
unrepresented restore-subject responsibility remain excluded rather than granted
false lineage. Independent Link progression and final qualification remain open.
No full-suite pass, CPU equivalence, new API or v16 release readiness is claimed.

## Approval accounting

The initial broad scripted edit was rejected before execution because replacement
matches and frontier safety were insufficiently reviewed. An exact diff, checked
seams and independent review subsequently passed normal approval and was applied.
A later edit to the invalid index assertion was rejected under the instruction to
preserve assertions. That rejection was not bypassed; the specific owner question
remains pending. Neither rejection is counted as a runtime test failure.

## Replay

Use Node 24.15.0 and pnpm 10.17.0. Extract `evidence.tar.xz` into a disposable
folder; `evidence-manifest.json` hashes exact uncompressed bytes. It preserves
first failures, intermediate sources, commands, input receipts and review reports.
Absolute paths in historical scripts identify executed worktrees and must be
relocated explicitly elsewhere. `source-hashes.sha256` describes final tested
runtime/spec files; artifact hashes describe the fresh build, not a release.

```sh
NX_DAEMON=false pnpm nx test kernel --testFile=src/enhancers/restoration/compound-compensation-controls.spec.ts --testFile=src/enhancers/restoration/zero-net-compensation.spec.ts --skip-nx-cache
# Preserved original carrier: currently one ordinary failure at the index assertion.
NX_DAEMON=false pnpm nx test kernel --testFile=src/enhancers/restoration/compound-compensation-retry-readiness.spec.ts --skip-nx-cache
pnpm run typecheck
node tools/check-spec-types.mjs
pnpm run build:all
node tools/check-bundle-budget.mjs
pnpm run build:demo:prod
```

## Owner-authorized index correction — October 19, 2026

The owner explicitly authorized replacing only the invalid decrement assertion
with established causal undo/redo authority checks. State, held-reference, retry
and terminal-behavior assertions remain intact. Runtime source is unchanged.

The affected regression now passes **2/2 ordinary tests**, with no expected
failures or skips. Ordinary spec-types passes without a baseline update. These
are fresh results for the corrected fixture; the earlier 44-test run and artifact
checks remain attributed to their original source and commands, not rerun here.

`authorized-index-correction.json` records authorization, hashes and results;
`authorized-index-correction.tar.xz` preserves the exact pre-correction fixture
and new logs. The original ST1034 and newly reached index failures remain in the
previous archives. The prior approval rejection was resolved by explicit owner
authorization, not bypassed. R1/R2, broader Link progress and release qualification
remain open.
