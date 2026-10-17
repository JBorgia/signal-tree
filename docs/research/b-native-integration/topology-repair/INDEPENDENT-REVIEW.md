# Final independent review — candidate rejected

This supersedes my earlier positive bounded-review disposition. The five reviewer probes passed, but they did not cover a surviving explicit ordering author depending on a pending-created lifetime.

## Verified blocker

`focused-final.log` reports 123 passed and 1 failed across 124 tests in eight files. The sole failure is the unchanged `src/enhancers/transactions/b-public-entity-experiment.spec.ts` creator-first ordering-dependency case (test starts at line 600; assertion at 627). Starting A,B, creator appends C; a second pending transaction explicitly orders C,A,B with setAll. Creator rollback succeeds in removing C, yielding A,B instead of required C,A,B (or atomic refusal retaining that topology). The prior qualification raw `full-b-kernel.json` records this exact unchanged case, and its ordering-first sibling, as passed. This is a newly observed regression against that baseline, not one of the original failed rekey replays.

Source trace: replace-value captures are structural:false (`entity-signal.ts:653–658`). Candidate membership capture now accepts only structural changes. Explicit order is separately staged under the collection ordering ledger. Creator settlement visits only its owned ledger keys, and its absent-membership dependency guard inspects row field ledgers only. It therefore sees neither the other pending ordering fact nor an ordering existence dependency on C. No ordering ledger belongs to the creator's settlement, so the ordering reconciliation loop is not entered for that surviving ordering author. Physical delta validation correctly permits C's removal; it validates placement, not semantic ownership of the independent ordering obligation. The candidate thus turns observed-membership classification into loss of actual ordering dependency. The two-mechanism repair is not qualified.

## Verified narrower improvements and limits

Parsed `relevant-groups.json`: 30 tests, 15 passed, 15 failed. Matched all 30 by file basename and full test name to `/private/tmp/st-b-qualification-20261016/full-b-kernel.json`: exactly two failed→passed changes, zero passed→failed changes in these 30. Improvements are REKEY-OCCUPANCY-0 T06a and REKEY-SUPERSESSION-0 “key reverts, the newer field value survives.” The selected 30 do not include the new explicit-order dependency regression.

The original reviewer counterexamples and raw logs remain preserved: hidden field rollback failed baseline and first candidate; confirmed new-extra truth was lost entirely by the first candidate (baseline retained extra but incorrectly dropped original fields). The final dependency-retention correction passed all five reviewer probes, including useful terminal cleanup. Those successes remain valid bounded observations, not evidence overriding the larger focused-matrix failure.

No further repair or broad tests were run for this final audit. Candidate rejection before broader qualification is justified. Architectural B acceptance remains unsupported.
