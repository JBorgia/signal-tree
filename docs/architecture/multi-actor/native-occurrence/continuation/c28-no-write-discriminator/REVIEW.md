# Two-history public C27 discriminator

**The histories are publicly distinguishable through receipt disposition.** Output, ordinary state, settlement and ownership observations matched. This is an executed public observation, not merely the earlier sameProof boolean argument. It does not select a new compatibility policy or authorize C28.

Exact C27 base: `bc4c2447f4deeec12bc4ef05ed61392da3ceabb087e55e01d543adae82376ebd`. Frozen test SHA-256 `b11cd947609f6c4eb868449c22497d183f59edd37fda9519c822107c4f7224e5`; input manifest SHA-256 `0f4d2e5415a716bb5e9f63b11cef94c3238ed64adf89a470821d0cdd403daf2e`. The source and input were frozen before the sole execution and never corrected/replaced. No native or private instrumentation, runtime patch, API/config change, broad suite or type gate.

## Matched public trigger

Each arm creates the same tree `{pair:{x:0,y:0},q:0}` and a Link to pair. p writes pair.x=7 and stays pending. a writes q=1, then confirms; b writes q=2, then confirms. In A, a dependent[p,a] ROOT updater runs while a is pending. In B, the corresponding dependent[p,b] ROOT updater runs while b is pending. Each genuinely reads q and uses it to select the returned pair.x; values stay x7/y0. Handles come directly from transact, never manufactured.

Before the decisive call, both ordinary states are exactly `{pair:{x:7,y:0},q:2}`, a/b have confirmed, p remains pending, output is empty, and the historical receipt is conservative/unknown. Both arms then execute the SAME fresh dependent[p,a] root updater, reading exactly q2/x7 once. Confirmed a is an authenticated accepted handle in both arms. p.inspect() is asserted unchanged across the fresh admission. Then p confirms, followed by two drains and disposal.

Assertions were limited to matched state, genuine historical callback inputs, and unchanged pending ownership. Receipt/output/settlement/error observations had no desired oracle; they were recorded before analysis. Two tests passing validates those premises and completion, not a manufactured expected receipt result.

## Exact observed receipts

| Phase | A historical | A fresh | B historical | B fresh |
| --- | --- | --- | --- | --- |
| Before fresh | conservative / reason unknown | absent | conservative / reason unknown | absent |
| Fresh immediate | conservative / reason unknown | validating | conservative / reason unknown | validating |
| Fresh drained | conservative / reason unknown | **no-write** | **superseded** | conservative / reason unknown |
| p confirmed | **started / basis surviving** | **no-write** | **superseded** | **started / basis surviving** |
| Extra drain and disposal | unchanged | unchanged | unchanged | unchanged |

No other basis fields were present. Thus the distinction remains visible in the old AND new public receipt handles, including after terminal useful delivery.

Both arms:

- No admission, confirmation or settlement error was recorded.
- No output before p confirmation; exactly one `{x:7,y:0}` afterward, unchanged after the extra drain and disposal.
- The settled waiter was false before p confirmation and true afterward.
- State remained `{pair:{x:7,y:0},q:2}` throughout the decisive call and terminal stages.
- x notice count stayed1 (the original p write); neither historical nor fresh equal-value updater added a notification.
- Historical updater ran once with q1 in A / q2 in B; fresh updater ran once with q2/x7 in both.
- Full p/a/b inspection snapshots are in OBSERVATIONS.jsonl; pending p inspection equality passed. Trees/Link/subscription were cleaned up.

The observed no-write versus superseded/started receipt lifecycle is sufficient to establish the public distinction. No private noWrite-path instrumentation was added. Its correspondence to the earlier identity-comparison explanation is source interpretation; this run does not inspect role arrays or prove a hypothetical C28 result.

## Execution and preservation

One command, in this directory's isolated candidate:

`corepack pnpm nx test kernel two-history-public.spec.ts --skip-nx-cache --maxWorkers=1`

Environment includes `ST_TWO_HISTORY_OUTPUT=/private/tmp/st-c28-no-write-discriminator/OBSERVATIONS.jsonl`, pinned Node24.15.0/pnpm10.17.0, isolated Nx/cache/temp paths and owned-process-group180-second cap. First run: 2 actual tests / 1 file pass, exit0, no timeout, sourceUnchanged:true. Commands, process identity, hashes and first raw log are under runs/first. Archived-tsconfig/listener warnings remain visible. No retries or source/oracle fixes.

INPUT-FREEZE.json and SNAPSHOT-INPUT.json preserve exact input. OBSERVATIONS.jsonl is raw; SUMMARY.json retains decisive rows including full inspection data. FINAL-IDENTITY.json verifies all copied C27 source entries plus the test overlay unchanged after the run and verifies original C27 unchanged. Both tests and every attempt remain frozen.

This establishes an observable compatibility distinction for this finite public sequence. It does not prove that every implementation must retain an unbounded cell graph, determine which distinctions the product should retain, adjudicate the separate original-row receipt mismatch, or authorize an owner/public-policy exception. Main's central design decision remains separate; no owner question or C28 implementation was initiated.
